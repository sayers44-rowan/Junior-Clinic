import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { UIManager } from './UIManager.js';

export const globalManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const _gltfLoader = new GLTFLoader(globalManager);
_gltfLoader.setDRACOLoader(dracoLoader);

export class StationStage {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.clock = new THREE.Clock();
        this.isPaused = false;

        this.playerContainer = new THREE.Group();
        this.scene.add(this.playerContainer);

        this.input = { forward: false, backward: false, left: false, right: false };
        this.mixer = null;
        this.playerModel = null;
        this.cameraAngle = 0;
        this.cameraPitch = 0.1;
        this.velocityY = 0;
        this.isOnGround = true;
        this.cityReady = false;
        this._cullFrameCount = 0;

        this.init();
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.scene.clear();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0015);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;

        this.playerContainer.position.set(0, 150, 0);
        this.camera.position.set(0, 155, 10);

        this.setupLights();
        this._buildCity();
        this.setupInput();

        this.camera.far = 1200;
        this.camera.updateProjectionMatrix();

        const floorGeo = new THREE.PlaneGeometry(10000, 10000);
        this.groundMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ visible: false }));
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.groundMesh);
    }

    _buildCity() {
        const skyLoader = new THREE.CubeTextureLoader();
        skyLoader.setPath('/textures/skybox/');
        this.scene.background = skyLoader.load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']);

        _gltfLoader.load('/map/low_poly_city_pack.glb', (gltf) => {
            const cityMap = gltf.scene;
            cityMap.scale.set(0.5, 0.5, 0.5);

            const box = new THREE.Box3().setFromObject(cityMap);
            const center = box.getCenter(new THREE.Vector3());
            cityMap.position.set(-center.x * 0.5, -box.min.y * 0.5, -center.z * 0.5);

            cityMap.traverse(child => {
                if (child.isMesh) {
                    // GEOMETRY PURGE: kill airplanes and 50% of trees to fix stutter
                    const name = child.name ? child.name.toLowerCase() : '';
                    const wPos = child.getWorldPosition(new THREE.Vector3());

                    if (wPos.y > 80 || name.includes('plane') || name.includes('aircraft')) {
                        child.visible = false;
                        return;
                    }
                    if (name.includes('tree') || name.includes('pine') || name.includes('foliage')) {
                        if (Math.random() > 0.5) {
                            child.visible = false;
                            return;
                        }
                    }

                    child.receiveShadow = true;
                    if (child.material) child.material.side = THREE.DoubleSide;
                }
            });

            this.cityGroup = cityMap;
            this.scene.add(cityMap);
            this.cityReady = true;
            console.log("CITY READY");
        });
    }

    setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const sun = new THREE.DirectionalLight(0xffffff, 2.5);
        sun.position.set(200, 500, 200);
        this.scene.add(sun);
    }

    async loadPilot(modelPath) {
        const path = modelPath || '/assets/models/pilot_timmy.fbx';
        console.log('LOADING:', path);

        if (this.pilot) this.playerContainer.remove(this.pilot);

        return new Promise((resolve, reject) => {
            const loader = new FBXLoader(globalManager);
            loader.load(path, (fbx) => {
                fbx.scale.set(0.009, 0.009, 0.009);
                this.pilot = fbx;
                this.playerModel = fbx;
                this.playerContainer.add(fbx);

                // FORCE VISIBILITY IMMEDIATELY
                this._forceModelVisibility(fbx);
                this._setupAnims(fbx);

                resolve(fbx);
            }, undefined, (err) => {
                console.error("LOAD FAILED:", path, err);
                reject(err);
            });
        });
    }

    _forceModelVisibility(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => {
                        m.transparent = false;
                        m.alphaTest = 0.5;
                        m.depthWrite = true;
                        m.side = THREE.DoubleSide;
                        m.needsUpdate = true;
                    });
                }
            }
        });
    }

    _setupAnims(fbx) {
        this.mixer = new THREE.AnimationMixer(fbx);
        if (fbx.animations && fbx.animations.length > 0) {
            this.idleAction = this.mixer.clipAction(fbx.animations[0]);
            this.idleAction.play();
            this.currentAction = this.idleAction;
        }

        const loader = new FBXLoader(globalManager);
        loader.load('/assets/models/Running.fbx', (anim) => {
            this.runAction = this.mixer.clipAction(anim.animations[0]);
        });
        loader.load('/assets/models/Floating.fbx', (anim) => {
            this.floatAction = this.mixer.clipAction(anim.animations[0]);
        });
    }

    update(dt) {
        if (this.isPaused) return;
        const actualDt = Math.min(dt || this.clock.getDelta(), 0.1);

        if (this.playerContainer && this.cityReady) {
            const rayOrigin = this.playerContainer.position.clone().add(new THREE.Vector3(0, 1, 0));
            const hits = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 200).intersectObjects([this.groundMesh, this.cityGroup].filter(Boolean), true);

            if (hits.length > 0) {
                const groundY = hits[0].point.y;
                if (this.playerContainer.position.y <= groundY + 1.2) {
                    this.playerContainer.position.y = THREE.MathUtils.lerp(this.playerContainer.position.y, groundY, 0.25);
                    this.velocityY = 0;
                    this.isOnGround = true;
                } else { this.isOnGround = false; }
            } else { this.isOnGround = false; }

            if (!this.isOnGround) {
                this.velocityY -= 28 * actualDt;
                this.playerContainer.position.y += this.velocityY * actualDt;
            }
        }

        this.handleMovement(actualDt);
        this.handleCamera();
        if (this.mixer) this.mixer.update(actualDt);

        // OPTIMIZED CULLING
        this._cullFrameCount++;
        if (this.cityGroup && this._cullFrameCount % 15 === 0) {
            const cullDistSq = 900 * 900;
            const playerPos = this.playerContainer.position;
            const tempVec = new THREE.Vector3();

            // Only traverse top-level children for speed
            this.cityGroup.children.forEach((child) => {
                child.getWorldPosition(tempVec);
                const distSq = playerPos.distanceToSquared(tempVec);
                child.visible = (distSq < cullDistSq);
            });
        }
    }

    handleMovement(dt) {
        const speed = 6.5;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, forward).normalize();

        const moveDir = new THREE.Vector3();
        if (this.input.forward) moveDir.add(forward);
        if (this.input.backward) moveDir.sub(forward);
        if (this.input.left) moveDir.add(right);
        if (this.input.right) moveDir.sub(right);

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            this.playerContainer.position.add(moveDir.multiplyScalar(speed * dt));
            if (this.playerModel) this.playerModel.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            if (this.isOnGround) this._playAction(this.runAction);
        } else {
            if (this.isOnGround) this._playAction(this.idleAction);
        }
    }

    handleCamera() {
        const player = this.playerContainer.position;
        this.cameraPitch = Math.max(-0.8, Math.min(1.2, this.cameraPitch));
        const radius = 9;
        const camY = player.y + 1.8 + Math.sin(this.cameraPitch) * radius;
        const cx = player.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        const cz = player.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        this.camera.position.set(cx, Math.max(player.y + 0.5, camY), cz);
        this.camera.lookAt(player.x, player.y + 1.8, player.z);
    }

    _playAction(action, fadeIn = 0.2) {
        if (!action || this.currentAction === action) return;
        if (this.currentAction) this.currentAction.fadeOut(fadeIn);
        action.reset().setEffectiveWeight(1).fadeIn(fadeIn).play();
        this.currentAction = action;
    }

    setupInput() {
        document.addEventListener('pointerlockchange', () => this.togglePause(document.pointerLockElement === null));
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.input.forward = true;
            if (e.code === 'KeyS') this.input.backward = true;
            if (e.code === 'KeyA') this.input.left = true;
            if (e.code === 'KeyD') this.input.right = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.input.forward = false;
            if (e.code === 'KeyS') this.input.backward = false;
            if (e.code === 'KeyA') this.input.left = false;
            if (e.code === 'KeyD') this.input.right = false;
        });
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement && !this.isPaused) {
                this.cameraAngle -= e.movementX * 0.003;
                this.cameraPitch += e.movementY * 0.002;
            }
        });
        this.renderer.domElement.addEventListener('click', () => { if (!this.isPaused) this.renderer.domElement.requestPointerLock(); });
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) resumeBtn.addEventListener('click', () => this.renderer.domElement.requestPointerLock());
        const swapBtn = document.getElementById('swap-char-btn');
        if (swapBtn) swapBtn.addEventListener('click', () => this.cycleCharacter());
    }

    togglePause(val) {
        this.isPaused = val;
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.style.display = this.isPaused ? 'flex' : 'none';
    }

    cycleCharacter() {
        const models = ['/assets/models/pilot_timmy.fbx', '/assets/models/pilot_alpha.fbx', '/assets/models/pilot_beta.fbx'];
        this._charIndex = (this._charIndex === undefined) ? 0 : (this._charIndex + 1) % models.length;
        this.loadPilot(models[this._charIndex]);
        this.togglePause(false);
        this.renderer.domElement.requestPointerLock();
    }
}
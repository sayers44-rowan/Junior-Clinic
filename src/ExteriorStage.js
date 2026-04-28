import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ExteriorStage {
    constructor(scene, camera, renderer, gameStateManager) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameStateManager = gameStateManager;

        // State
        this.player = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.controls = null;
        this.van = null;
        this.vanHatch = null;

        // Sequence State
        this.isDriving = false;
        this.hasArrived = false;
        this.vanSpeed = 0;
        this.maxVanSpeed = 55.0;
        this.driveTargetZ = -200;

        // Physics/Movement
        this.playerVelocity = new THREE.Vector3();
        this.input = { w: false, a: false, s: false, d: false, space: false };
        this.isGrounded = true;
        this.gravity = -30;
        this.jumpForce = 9;
        this.speed = 10.0;

        this.isGameStarted = false;
        this.isTransitioning = false;
    }

    async init(params = {}) {
        console.log("Initializing Street Scene (City Exit)...");

        const overlay = document.getElementById('fade-overlay');
        if (overlay) overlay.style.opacity = '0';

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.setupEnvironment();
        this.setupLights();
        this.setupInputs();
        this.setupControls();
        this.createReferenceVan();
        this.loadAssets();

        this.playMissionBriefing();

        // Start camera
        this.camera.position.set(0, 5, 25);
        if (this.controls) {
            this.controls.target.set(0, 2.0, 0);
            this.controls.update();
        }

        this.isGameStarted = true;
    }

    setupEnvironment() {
        // --- Setup Loaders with DRACO ---
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);

        // Invisible Physics Floor
        const catchFloor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshBasicMaterial({ visible: false }));
        catchFloor.rotation.x = -Math.PI / 2;
        this.scene.add(catchFloor);

        // --- Load Skybox GLB ---
        gltfLoader.load('/assets/models/glb/skybox_skydays_3.glb', (gltf) => {
            const skybox = gltf.scene;
            skybox.scale.set(10000, 10000, 10000); // 10x larger
            skybox.traverse(c => {
                if (c.isMesh) {
                    // Make the skybox unlit so it doesn't need light sources
                    const oldMat = c.material;
                    c.material = new THREE.MeshBasicMaterial({
                        map: oldMat.map,
                        side: THREE.BackSide,
                        depthWrite: false
                    });
                    c.renderOrder = -1;
                }
            });
            this.scene.add(skybox);
            console.log("✅ Skybox GLB loaded!");
        }, undefined, (e) => {
            console.warn("Skybox error:", e);
            this.scene.background = new THREE.Color(0x87CEEB);
        });

        this.scene.fog = new THREE.Fog(0xc8ddf0, 200, 2000);

        // --- Load Desert Landscape GLB ---
        gltfLoader.load('/assets/models/glb/desert_landscape.glb', (gltf) => {
            const landscape = gltf.scene;

            // Scale: raw model is ~151x152 wide, 14.5 tall
            // At scale 10 → ~1510 wide, 145 tall
            landscape.scale.set(10, 10, 10);

            // Get scaled box
            const scaledBox = new THREE.Box3().setFromObject(landscape);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

            // The road runs through the MIDDLE of the model height.
            // Center the model vertically so road is near Y=0.
            landscape.position.y = -scaledCenter.y;
            landscape.position.x = -scaledCenter.x;
            landscape.position.z = -scaledCenter.z;

            // Verify
            const finalBox = new THREE.Box3().setFromObject(landscape);
            console.log("🔍 FINAL landscape box:", JSON.stringify({
                min: { x: finalBox.min.x.toFixed(0), y: finalBox.min.y.toFixed(1), z: finalBox.min.z.toFixed(0) },
                max: { x: finalBox.max.x.toFixed(0), y: finalBox.max.y.toFixed(1), z: finalBox.max.z.toFixed(0) }
            }));

            landscape.traverse(c => {
                if (c.isMesh) {
                    c.receiveShadow = true;
                    c.castShadow = true;
                    if (c.material) c.material.roughness = 1.0;
                }
            });

            this.scene.add(landscape);
            console.log("✅ Desert landscape loaded! Road at foot level.");
        }, undefined, (err) => {
            console.error("❌ Error loading desert_landscape.glb:", err);
        });

        // Station Wall
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(100, 40, 10), wallMat);
        wall.position.set(0, 20, 60);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
    }

    setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(50, 150, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -200;
        sun.shadow.camera.right = 200;
        sun.shadow.camera.top = 200;
        sun.shadow.camera.bottom = -200;
        this.scene.add(sun);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 60;
    }

    setupInputs() {
        this.keydownHandler = (e) => this.onKeyChange(e, true);
        this.keyupHandler = (e) => this.onKeyChange(e, false);
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    onKeyChange(e, isD) {
        if (!this.isGameStarted || this.isTransitioning) return;
        switch (e.code) {
            case 'KeyW': this.input.w = isD; break;
            case 'KeyA': this.input.a = isD; break;
            case 'KeyS': this.input.s = isD; break;
            case 'KeyD': this.input.d = isD; break;
            case 'Space': this.input.space = isD; if (isD) this.tryInteract(); break;
        }
    }

    tryInteract() {
        if (!this.player || !this.van) return;
        const dV = this.player.position.distanceTo(this.van.position);
        if (dV < 10 && !this.isDriving && !this.hasArrived) this.startDrivingSequence();
    }

    startDrivingSequence() {
        this.isDriving = true;
        this.player.visible = false;
        const prompt = document.getElementById('interaction-prompt');
        if (prompt) prompt.style.display = 'none';

        // Camera follow van
        if (this.controls) {
            this.controls.minDistance = 10;
            this.controls.maxDistance = 25;
        }
    }

    playMissionBriefing() {
        if (!window.speechSynthesis) return;
        const script = "Excellent work clearing the station. Commander, your transport is ready. We are heading to the Kennedy Launch Center for the miniaturization phase. Step into the van when you're ready.";
        const u = new SpeechSynthesisUtterance(script);
        u.rate = 1.0; u.pitch = 0.95;
        window.speechSynthesis.speak(u);
    }

    createReferenceVan() {
        this.van = new THREE.Group();
        // Position van ON the road (X=0 is road center), facing down the road
        this.van.position.set(0, 0, 10);
        this.van.rotation.y = Math.PI; // Facing driver's direction (negative Z)
        this.scene.add(this.van);

        const loader = new GLTFLoader();
        loader.load('/assets/models/glb/van.glb', (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const s = 7.5 / Math.max(size.x, size.y, size.z);
            model.scale.set(s, s, s);
            const box2 = new THREE.Box3().setFromObject(model);
            model.position.set(
                -box2.getCenter(new THREE.Vector3()).x,
                -box2.min.y,
                -box2.getCenter(new THREE.Vector3()).z
            );
            model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            this.van.add(model);
        });
    }

    loadAssets() {
        const loader = new FBXLoader();
        loader.load('/assets/models/Idle.fbx', (obj) => {
            this.player = obj;
            this.player.scale.set(0.018, 0.018, 0.018);
            this.player.position.set(0, 0, 30);
            this.player.rotation.y = Math.PI;
            this.scene.add(this.player);

            this.mixer = new THREE.AnimationMixer(this.player);
            this.animations['Idle'] = this.mixer.clipAction(obj.animations[0]);
            this.animations['Idle'].play();
            this.currentAction = this.animations['Idle'];

            loader.load('/assets/models/Running.fbx', (r) => {
                this.animations['Run'] = this.mixer.clipAction(r.animations[0]);
            });
        });
    }

    update(delta) {
        if (!this.player || !this.isGameStarted) return;

        if (this.isDriving) {
            this.updateDriving(delta);
        } else {
            this.handlePlayerMovement(delta);
            this.handleInteraction();
        }

        if (this.mixer) this.mixer.update(delta);
        if (this.controls) {
            const target = this.isDriving ? this.van.position : this.player.position;
            this.controls.target.set(target.x, target.y + 2, target.z);
            this.controls.update();
        }
        this.boneLock(this.player);
    }

    updateDriving(delta) {
        if (this.hasArrived) return;

        this.vanSpeed = Math.min(this.vanSpeed + 20 * delta, this.maxVanSpeed);
        // Drive straight down the road — no Y bobbing
        this.van.position.z -= this.vanSpeed * delta;
        this.van.position.y = 0; // Keep the van firmly on the road

        if (this.van.position.z < this.driveTargetZ) {
            this.hasArrived = true;
            this.isTransitioning = true;
            const overlay = document.getElementById('fade-overlay');
            if (overlay) overlay.style.opacity = '1';

            setTimeout(() => {
                this.gameStateManager.transitionTo('LAUNCH_CENTER');
            }, 1000);
        }
    }

    handlePlayerMovement(delta) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3();
        if (this.input.w) moveVec.add(camDir);
        if (this.input.s) moveVec.sub(camDir);
        if (this.input.a) moveVec.sub(camRight);
        if (this.input.d) moveVec.add(camRight);

        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();
            this.player.position.addScaledVector(moveVec, this.speed * delta);
            const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(moveVec.x, moveVec.z));
            this.player.quaternion.slerp(targetQuat, 0.15);
            this.playAnim('Run');
        } else {
            this.playAnim('Idle');
        }
    }

    playAnim(name) {
        const anim = this.animations[name];
        if (anim && anim !== this.currentAction) {
            this.currentAction.fadeOut(0.2);
            anim.reset().fadeIn(0.2).play();
            this.currentAction = anim;
        }
    }

    handleInteraction() {
        const pr = document.getElementById('interaction-prompt');
        if (!pr || !this.player || !this.van) return;
        const dV = this.player.position.distanceTo(this.van.position);
        if (dV < 10) {
            pr.innerText = "[SPACE] ENTER VAN";
            pr.style.display = 'block';
            this.updateFloatingPrompt(this.van, 4.0);
        } else {
            pr.style.display = 'none';
        }
    }

    updateFloatingPrompt(o, offset) {
        const v = new THREE.Vector3();
        o.updateMatrixWorld();
        v.setFromMatrixPosition(o.matrixWorld);
        v.y += offset;
        v.project(this.camera);
        const pr = document.getElementById('interaction-prompt');
        if (pr) {
            pr.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
            pr.style.top = `${(v.y * -0.5 + 0.5) * window.innerHeight}px`;
        }
    }

    boneLock(o) {
        if (!o) return;
        o.traverse(c => {
            if (c.isBone && !c.name.toLowerCase().includes('hand') && !c.name.toLowerCase().includes('finger')) {
                c.position.x = 0; c.position.z = 0;
            }
        });
    }

    cleanup() {
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
    }
}

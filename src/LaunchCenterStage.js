import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class LaunchCenterStage {
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
        this.rocket = null;
        this.rocketDoor = null;

        // Sequence State
        this.isArriving = true;
        this.vanSpeed = 40.0;
        // The terrain center is at Y≈55 in world space (from our -scaledCenter.y grounding)
        this.TERRAIN_Y = 55;
        this.driveTargetZ = -280;

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
        console.log("Initializing Kennedy Launch Center (Desert)...");

        const overlay = document.getElementById('fade-overlay');
        if (overlay) {
            overlay.style.opacity = '1';
            // Fade in after assets have likely started loading
            setTimeout(() => {
                overlay.style.opacity = '0';
            }, 500);
        }

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.setupEnvironment();
        this.setupLights();
        this.setupInputs();
        this.setupControls();
        this.createLaunchCenterSign();
        this.createRocketWithSteps();
        this.createVan();
        this.loadAssets();

        // Start camera following arriving van — cinematic side view
        this.camera.position.set(30, this.TERRAIN_Y + 15, -30);

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
        }, undefined, (err) => {
            console.warn("⚠️ Skybox GLB failed to load, falling back to blue.");
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

            // Road surface is near the model's center Y.
            // Center the model vertically so road is near Y=0.
            landscape.position.y = -scaledCenter.y;
            landscape.position.x = -scaledCenter.x;
            landscape.position.z = -scaledCenter.z;

            landscape.traverse(c => {
                if (c.isMesh) {
                    c.receiveShadow = true;
                    c.castShadow = true;
                    if (c.material) c.material.roughness = 1.0;
                }
            });

            this.scene.add(landscape);
            console.log("✅ Desert landscape loaded at Launch Center!");
        }, undefined, (err) => {
            console.error("❌ Error loading desert_landscape.glb:", err);
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0xd2b48c }));
            ground.rotation.x = -Math.PI / 2;
            this.scene.add(ground);
        });
    }

    setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(100, 200, 100);
        sun.castShadow = true;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -500;
        this.scene.add(sun);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 150;
    }

    createLaunchCenterSign() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 1024, 256);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.strokeRect(20, 20, 984, 216);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('KENNEDY LAUNCH CENTER', 512, 150);

        const tex = new THREE.CanvasTexture(canvas);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(60, 15), new THREE.MeshStandardMaterial({ map: tex }));
        // Move sign OFF ROAD (X=40) and Grounded
        sign.position.set(40, 80, -260); // In front of the rocket area
        this.scene.add(sign);

        // Sign support poles — grounded on terrain (Y=55 offset, half-height pole)
        const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 25, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const p1 = new THREE.Mesh(poleGeo, poleMat);
        p1.position.set(15, 67.5, -260.5); // Adjusted X relative to sign
        this.scene.add(p1);
        const p2 = new THREE.Mesh(poleGeo, poleMat);
        p2.position.set(65, 67.5, -260.5); // Adjusted X relative to sign
        this.scene.add(p2);
    }

    createRocketWithSteps() {
        // Rocket sits BESIDE the road (offset X=40), grounded on terrain (+55 Y)
        this.rocket = new THREE.Group();
        this.rocket.position.set(40, 55, -320);
        this.scene.add(this.rocket);

        const loader = new GLTFLoader();
        loader.load('/assets/models/glb/rocket.glb', (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const s = 100 / size.y;
            model.scale.set(s, s, s);
            const box2 = new THREE.Box3().setFromObject(model);
            model.position.set(
                -box2.getCenter(new THREE.Vector3()).x,
                -box2.min.y,
                -box2.getCenter(new THREE.Vector3()).z
            );
            model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            this.rocket.add(model);
        });

        // Rocket entry door (no stairs)
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        this.rocketDoor = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 2), doorMat);
        this.rocketDoor.position.set(-5, 12, 0);
        this.rocket.add(this.rocketDoor);
    }

    createVan() {
        this.van = new THREE.Group();
        // Start van further back for a cinematic drive-in
        this.van.position.set(0, 55, 500);
        this.van.rotation.y = Math.PI; // Facing forward along road (negative Z)
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
            this.van.add(model);
        });
    }

    loadAssets() {
        const loader = new FBXLoader();
        loader.load('/assets/models/Idle.fbx', (obj) => {
            this.player = obj;
            this.player.scale.set(0.018, 0.018, 0.018);
            this.player.position.set(1000, 0, 0); // Hide initially
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
        if (!this.isGameStarted) return;

        if (this.isArriving && this.van) {
            this.updateArrival(delta);
        } else if (this.player && this.hasArrived) {
            this.handlePlayerMovement(delta);
            this.handleInteraction();
        }

        if (this.mixer) this.mixer.update(delta);
        if (this.controls) {
            const target = !this.hasArrived && this.van
                ? this.van.position
                : (this.player ? this.player.position : new THREE.Vector3(0, 0, -100));
            this.controls.target.set(target.x, target.y + 3, target.z);
            this.controls.update();
        }
        if (this.player) this.boneLock(this.player);
    }

    updateArrival(delta) {
        if (this.hasArrived) return;

        // Van drives down the road (negative Z) at a steady speed, at terrain height
        this.van.position.z -= this.vanSpeed * delta;
        this.van.position.y = this.TERRAIN_Y; // Stay grounded on terrain

        if (this.van.position.z <= this.driveTargetZ) {
            this.van.position.z = this.driveTargetZ;
            this.hasArrived = true;
            this.isArriving = false;

            // Brief flash, then show player exiting van on road side of rocket
            const overlay = document.getElementById('fade-overlay');
            if (overlay) {
                overlay.style.opacity = '1';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    if (this.player) {
                        this.player.position.set(
                            this.van.position.x - 8,  // Road-side of van
                            this.TERRAIN_Y,           // On terrain
                            this.van.position.z
                        );
                        this.player.rotation.y = Math.PI / 2; // Facing toward rocket (X+)
                        this.player.visible = true;
                    }
                }, 600);
            } else {
                if (this.player) {
                    this.player.position.set(
                        this.van.position.x - 8,
                        this.TERRAIN_Y,
                        this.van.position.z
                    );
                    this.player.visible = true;
                }
            }
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
            this.player.position.y = this.TERRAIN_Y; // Always walk on terrain surface
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
        if (!this.player || !this.rocketDoor) return;
        const rocketWorldPos = new THREE.Vector3(40, this.TERRAIN_Y, -320);
        const dR = this.player.position.distanceTo(rocketWorldPos);
        if (dR < 40) {
            this.isTransitioning = true;
            const overlay = document.getElementById('fade-overlay');
            if (overlay) overlay.style.opacity = '1';
            setTimeout(() => {
                this.gameStateManager.transitionTo('ROCKET_INTERIOR');
            }, 1000);
        }
    }

    handleInteraction() {
        const pr = document.getElementById('interaction-prompt');
        if (!pr || !this.player || !this.rocketDoor) return;
        const rocketWorldPos = new THREE.Vector3(40, this.TERRAIN_Y, -320);
        const dR = this.player.position.distanceTo(rocketWorldPos);
        if (dR < 40) {
            pr.innerText = "[SPACE] ENTER ROCKET";
            pr.style.display = 'block';
            this.updateFloatingPrompt(this.rocketDoor, 4.0);
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

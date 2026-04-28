import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class StationStage {
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
        this.radio = null;
        this.wardrobe = null;
        this.door = null;
        this.rocketLight = null;

        // Geometry Furniture
        this.bed = null;
        this.table = null;
        this.alarmClock = null;
        this.desk = null;
        this.pedestal = null;
        this.ceiling = null;
        this.key = null;

        this.pilotName = "PILOT";
        this.dialogueManifest = null;
        this.gameState = 0; // 0: Wake Up, 1: Radio Done, 2: Mirror Done, 3: Key Done
        this.isUIVisible = false;
        this.isTransitioning = false;
        this.isGameStarted = false;
        this.isKeyInteractable = false;

        // Cinematic LERP/Hold
        this.isHoldingIntro = false;
        this.introHoldTimer = 0;
        this.isLerpingCamera = false;
        this.lerpTimer = 0;
        this.lerpDuration = 2.0;
        this.startCamPos = new THREE.Vector3();
        this.startCamTarget = new THREE.Vector3();

        // Physics/Movement
        this.playerVelocity = new THREE.Vector3();
        this.input = { w: false, a: false, s: false, d: false, space: false };
        this.isGrounded = true;
        this.gravity = -30;
        this.jumpForce = 9;
        this.speed = 7.2;

        // Audio
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        this.sounds = {};

        // Constants
        this.lastFootstepTime = 0;
        this.controls = null;
    }

    async init() {
        this.setupMenuHandlers();

        // CAMERA CALIBRATION
        this.camera.far = 2000;
        this.camera.updateProjectionMatrix();

        this.setupEnvironment();
        this.setupLights();
        this.setupInputs();
        this.setupControls();
        this.setupHUD();
        this.loadAssets();

        // Load Narrative Data
        try {
            const resp = await fetch('./assets/models/dialogue_manifest.json');
            this.dialogueManifest = await resp.json();
        } catch (e) {
            console.error("Dialogue Manifest failed to load:", e);
        }

        // INITIAL CINEMATIC: Close-up focus on Alarm Clock face
        this.camera.position.set(-6.5, 0.8, -4.5);
        const alarmTarget = new THREE.Vector3(-6.5, 0.5, -5.5);
        this.camera.lookAt(alarmTarget);
        if (this.controls) {
            this.controls.target.copy(alarmTarget);
            this.controls.update();
        }

        const resA = () => {
            if (this.audioListener.context.state === 'suspended') {
                this.audioListener.context.resume().then(() => {
                    console.log("AUDIO CONTEXT RESUMED");
                    this.audioListener.setMasterVolume(0.5); // Global Volume 50%
                });
            } else {
                this.audioListener.setMasterVolume(0.5);
            }
        };
        document.addEventListener('click', resA);
        document.addEventListener('keydown', resA);
    }

    setupMenuHandlers() {
        const startBtn = document.getElementById('start-mission-btn');
        const confirmBtn = document.getElementById('confirm-name-btn');
        const mainMenu = document.getElementById('main-menu');
        const nameEntry = document.getElementById('name-entry');
        const nameInput = document.getElementById('pilot-name-input');

        if (startBtn) {
            startBtn.onclick = () => {
                this.playUISound();
                mainMenu.style.display = 'none';
                nameEntry.style.display = 'flex';
                nameEntry.style.opacity = '1';
                nameInput.focus();
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const enteredName = nameInput.value.trim();
                if (enteredName) {
                    this.pilotName = enteredName.toUpperCase();
                    this.playUISound();
                    nameEntry.style.opacity = '0';
                    setTimeout(() => {
                        nameEntry.style.display = 'none';
                        this.startGame();
                    }, 500);
                }
            };
        }
        if (nameInput) nameInput.onkeydown = (e) => { if (e.key === 'Enter') confirmBtn.click(); };
    }

    startGame() {
        this.isGameStarted = true;
        this.startSequence();
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false; this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2.5; this.controls.maxDistance = 2.5;
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

        // Anti-Clipping Constraints
        this.controls.maxPolarAngle = Math.PI / 2.1; // Limit downward look to prevent floor clipping
        this.controls.minPolarAngle = 0.1;           // Prevent flipping at the top
        this.controls.target.set(0, 1.4, 0);         // Aim at character's upper body, not feet

        this.controls.update();
        this.controls.enabled = false;
    }

    setupHUD() {
        const panel = document.getElementById('outfit-panel');
        if (panel) {
            panel.innerHTML = `
                <h2>GEAR CHECK</h2>
                <div class="scanning-line"></div>
                <div class="gear-options">
                    <button class="gear-btn selected">STANDARD ISSUE GEAR</button>
                    <button class="gear-btn locked">HAZMAT SUIT (LOCKED)</button>
                    <button class="gear-btn locked">PILOT GEAR (LOCKED)</button>
                </div>
                <button class="confirm-btn">Confirm Selection</button>
            `;
            panel.querySelector('.confirm-btn').onclick = () => { this.playUISound(); this.closeOutfitHUD(); };
        }
    }

    async triggerDialogue(stepIndex) {
        try {
            const resp = await fetch('./assets/models/dialogue_manifest.json');
            const manifest = await resp.json();
            const data = manifest.sequences[stepIndex.toString()];
            if (!data) return;

            const box = document.getElementById('dialogue-box');
            const speaker = document.getElementById('speaker-name');
            const text = document.getElementById('dialogue-text');

            if (speaker) speaker.innerText = data.speaker.replace('[NAME]', this.pilotName);
            if (text) text.innerText = data.text.replace('[NAME]', this.pilotName);
            if (box) box.style.display = 'block';

            if (stepIndex === 0 && this.sounds['wakeUp']) this.sounds['wakeUp'].play();

            setTimeout(() => {
                if (box && box.style.display === 'block' && speaker && speaker.innerText === data.speaker.replace('[NAME]', this.pilotName)) {
                    box.style.display = 'none';
                }
            }, 8000);
        } catch (e) {
            console.error("Dialogue Trigger Error:", e);
        }
    }

    dismissDialogue() {
        const box = document.getElementById('dialogue-box');
        if (box && box.style.display === 'block') {
            box.style.display = 'none';
        }
    }

    playUISound() {
        if (this.sounds['footstep']) { this.sounds['footstep'].setVolume(0.5); this.sounds['footstep'].play(); }
    }

    openOutfitHUD() {
        if (this.isUIVisible) return;
        this.isUIVisible = true;
        const panel = document.getElementById('outfit-panel');
        if (panel) panel.style.display = 'flex';
        this.input = { w: false, a: false, s: false, d: false, space: false };
        if (this.controls) this.controls.enabled = false;
    }

    closeOutfitHUD() {
        this.isUIVisible = false;
        const panel = document.getElementById('outfit-panel');
        if (panel) panel.style.display = 'none';
        if (this.controls) this.controls.enabled = true;

        if (this.gameState === 1) {
            if (this.sounds['objective']) this.sounds['objective'].play();
            this.gameState = 2;
            this.isKeyInteractable = true;
            this.triggerDialogue(2);
            document.getElementById('objective-text').innerText = "GEAR CHECK COMPLETE";
            document.getElementById('subtask-text').innerText = "- Grab vehicle keys from the radio table.";
            this.pulseObjective(this.key);
        }
    }

    setupEnvironment() {
        this.collisionObjects = [];

        // 3-Color Gradient Sky
        const canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#87ceeb');   // SkyBlue
        grad.addColorStop(0.5, '#ff8c00'); // Orange
        grad.addColorStop(1, '#808080');   // Grey
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 2, 512);

        const skyTex = new THREE.CanvasTexture(canvas);
        if (THREE.SRGBColorSpace) skyTex.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = skyTex;
        this.scene.fog = new THREE.Fog(0x333344, 10, 150);

        const texLoader = new THREE.TextureLoader();
        const floorTex = texLoader.load('/assets/images/floor_concrete_texture.png');
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 3);
        const wallTex = texLoader.load('/assets/images/wall_texture.png');
        wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 1);

        const rGrp = new THREE.Group();
        const f = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), new THREE.MeshPhongMaterial({ map: floorTex }));
        f.rotation.x = -Math.PI / 2; rGrp.add(f);

        this.ceiling = new THREE.Mesh(new THREE.BoxGeometry(15, 1, 12), new THREE.MeshPhongMaterial({ color: 0x555555 }));
        this.ceiling.position.set(0, 10, 0); this.scene.add(this.ceiling);

        const wMat = new THREE.MeshPhongMaterial({ map: wallTex, color: 0x808080, specular: 0x222222, shininess: 30 });

        const wSolid = new THREE.Mesh(new THREE.PlaneGeometry(15, 10), wMat); wSolid.position.set(0, 5, 6); wSolid.rotation.y = Math.PI; rGrp.add(wSolid);
        const wL = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), wMat); wL.rotation.y = Math.PI / 2; wL.position.set(-7.5, 5, 0); rGrp.add(wL);
        const wR = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), wMat); wR.rotation.y = -Math.PI / 2; wR.position.set(7.5, 5, 0); rGrp.add(wR);

        const wFGrp = new THREE.Group();
        const wFL = new THREE.Mesh(new THREE.PlaneGeometry(6.25, 10), wMat); wFL.position.set(-4.375, 5, -6); wFGrp.add(wFL);
        const wFR = new THREE.Mesh(new THREE.PlaneGeometry(6.25, 10), wMat); wFR.position.set(4.375, 5, -6); wFGrp.add(wFR);
        const wFT = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 7.1), wMat); wFT.position.set(0, 6.45, -6); wFGrp.add(wFT);
        const wFB = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.1), wMat); wFB.position.set(0, 0.55, -6); wFGrp.add(wFB);
        rGrp.add(wFGrp); this.scene.add(rGrp);

        // WALL COLLIDERS (Static Boxes)
        this.collisionObjects.push({ type: 'static', x: 0, z: 6.1, w: 15, h: 10, d: 0.2 });
        this.collisionObjects.push({ type: 'static', x: 0, z: -6.1, w: 15, h: 10, d: 0.2 });
        this.collisionObjects.push({ type: 'static', x: -7.6, z: 0, w: 0.2, h: 10, d: 12 });
        this.collisionObjects.push({ type: 'static', x: 7.6, z: 0, w: 0.2, h: 10, d: 12 });

        const frameMat = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, metalness: 0.9, roughness: 0.1 });
        const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.3), frameMat); fl.position.set(-1.25, 2.0, -5.85); this.scene.add(fl);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.3), frameMat); fr.position.set(1.25, 2.0, -5.85); this.scene.add(fr);
        const ft = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.3), frameMat); ft.position.set(0, 2.9, -5.85); this.scene.add(ft);
        const fb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.3), frameMat); fb.position.set(0, 1.1, -5.85); this.scene.add(fb);

        const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.8), new THREE.MeshPhongMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
        winGlass.position.set(0, 2.0, -5.9); this.scene.add(winGlass);

        // Ground Mesh
        const groundTex = floorTex.clone();
        groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(100, 100);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshPhongMaterial({ map: groundTex, color: 0x666666 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.position.z = -150; this.scene.add(ground);
        const driveway = new THREE.Mesh(new THREE.PlaneGeometry(12, 200), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
        driveway.rotation.x = -Math.PI / 2; driveway.position.set(0, -0.05, -100); this.scene.add(driveway);

        // Town Meshes
        // Pushed-Back City & Roadside Buildings
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });

        // DISTANT CITY (3x Further Back)
        for (let i = 0; i < 30; i++) {
            const h = 20 + Math.random() * 30; // Taller buildings (65ft to 100ft (20m to 30m))
            const b = new THREE.Mesh(new THREE.BoxGeometry(10, h, 10), buildingMat);
            const zP = -180 - Math.random() * 120; // Pushed back to ~600ft to 1000ft (180m to 300m)
            const xP = (Math.random() - 0.5) * 300;
            b.position.set(xP, h / 2, zP);
            this.scene.add(b);
        }

        // ROADSIDE BUILDINGS (Lining the path)
        for (let i = 0; i < 20; i++) {
            const h = 15 + Math.random() * 10; // 50ft to 80ft (15m to 25m)
            const side = i % 2 === 0 ? 1 : -1;
            const b = new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), buildingMat);

            // Placed along the Z-axis driveway path
            const xP = side * (15 + Math.random() * 5); // Set back from the 40ft (12m) road
            const zP = -10 - (i * 15); // Spread along the path towards the rocket

            b.position.set(xP, h / 2, zP);
            this.scene.add(b);
        }

        // FURNITURE (Metric Proportions + Soft-Box Logic)
        // (this.bed Mesh is created and added in loadAssets)

        this.collisionObjects.push({ type: 'soft-box', x: -5, z: -4, w: 1.2, d: 2.4, h: 3.0 });

        // Upgraded End Table (Metallic Industrial look)
        this.table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.2 }));
        this.table.position.set(-6.5, 0.4, -5); this.scene.add(this.table);
        this.collisionObjects.push({ type: 'soft-box', x: -6.5, z: -5, w: 0.8, d: 0.8, h: 3.0 });

        this.alarmClock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), new THREE.MeshPhongMaterial({ color: 0x222222 }));
        this.alarmClock.position.set(-6.5, 0.9, -5); this.scene.add(this.alarmClock);
        this.create3DLateDisplay(this.alarmClock);

        // Upgraded Radio Pedestal (Dark Carbon/Terminal look)
        this.pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }));
        this.pedestal.position.set(6, 0.5, -5); this.scene.add(this.pedestal);
        this.collisionObjects.push({ type: 'soft-box', x: 6, z: -5, w: 0.6, d: 0.6, h: 3.0 });

        this.radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), new THREE.MeshPhongMaterial({ color: 0x111111 }));
        this.radio.position.set(6, 1.15, -5); this.scene.add(this.radio);

        // Upgraded Lab Desk (High-gloss work surface)
        this.desk = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 }));
        this.desk.position.set(5.5, 0.5, -4.5); this.scene.add(this.desk);
        this.collisionObjects.push({ type: 'soft-box', x: 5.5, z: -4.5, w: 3.0, d: 1.5, h: 3.0 });

        this.collisionObjects.push({ type: 'soft-box', x: 0, z: -5.85, w: 2.5, d: 0.5, h: 3.0 });

        // --- NEW WARDROBE DRESSER (Metric Reference Matching) ---
        this.wardrobe = new THREE.Group();
        const wMainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White Semi-Gloss
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1.0, roughness: 0.1 }); // Gold Hardware

        // Body
        const wardrobeBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.8), wMainMat);
        wardrobeBody.position.y = 1.6; wardrobeBody.castShadow = true; this.wardrobe.add(wardrobeBody);

        // Doors (Paneled look)
        const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.0, 0.05), wMainMat);
        doorL.position.set(-0.395, 2.1, 0.41); this.wardrobe.add(doorL);
        const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.0, 0.05), wMainMat);
        doorR.position.set(0.395, 2.1, 0.41); this.wardrobe.add(doorR);

        // Lower Drawers
        const dr1 = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.45, 0.05), wMainMat);
        dr1.position.set(0, 0.85, 0.41); this.wardrobe.add(dr1);
        const dr2 = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.45, 0.05), wMainMat);
        dr2.position.set(0, 0.35, 0.41); this.wardrobe.add(dr2);

        // Gold Handles
        const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), goldMat);
        h1.rotation.z = Math.PI; h1.position.set(-0.1, 2.15, 0.45); this.wardrobe.add(h1);
        const h2 = h1.clone(); h2.position.x = 0.1; this.wardrobe.add(h2);
        const h3 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3), goldMat);
        h3.rotation.z = Math.PI / 2; h3.position.set(0, 0.85, 0.45); this.wardrobe.add(h3);
        const h4 = h3.clone(); h4.position.y = 0.35; this.wardrobe.add(h4);

        // Clothes Hint (Visible in seams)
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        c1.position.set(0, 2.1, 0.38); this.wardrobe.add(c1);

        // Legs
        [[-0.7, 0, 0.3], [0.7, 0, 0.3], [-0.7, 0, -0.3], [0.7, 0, -0.3]].forEach(p => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.2), wMainMat);
            leg.position.set(...p); leg.position.y = -0.1; this.wardrobe.add(leg);
        });

        this.wardrobe.position.set(-7.2, 0.2, 2); this.wardrobe.rotation.y = Math.PI / 2;
        this.scene.add(this.wardrobe);
        this.collisionObjects.push({ type: 'soft-box', x: -7.2, z: 2, w: 0.8, d: 1.6, h: 4.0 });

        // (this.door Mesh is created and added in loadAssets)

        // Upgraded Modular Rocket (GLB Model with Fallback)
        const rocketGrp = new THREE.Group();
        const rktMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });

        // Placeholder (shown until GLB loads)
        const rktBody = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 20, 32), rktMat);
        rktBody.position.y = 10; rocketGrp.add(rktBody);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 32), new THREE.MeshStandardMaterial({ color: 0xAA0000, metalness: 0.5 }));
        nose.position.y = 24; rocketGrp.add(nose);
        for (let i = 0; i < 4; i++) {
            const thruster = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 4, 16), rktMat);
            const angle = (i / 4) * Math.PI * 2;
            thruster.position.set(Math.cos(angle) * 4, 2, Math.sin(angle) * 4);
            thruster.name = 'lobbyThruster'; rocketGrp.add(thruster);
        }

        // Load real GLB rocket
        const gltfRocket = new GLTFLoader();
        gltfRocket.load('/assets/models/glb/rocket.glb', (gltf) => {
            const m = gltf.scene;
            const box = new THREE.Box3().setFromObject(m);
            const size = box.getSize(new THREE.Vector3());
            const s = 28 / size.y; // Scale to ~28 units (lobby scale)
            m.scale.set(s, s, s);
            const box2 = new THREE.Box3().setFromObject(m);
            const center = box2.getCenter(new THREE.Vector3());
            m.position.set(-center.x, -box2.min.y, -center.z);
            m.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
            rocketGrp.add(m);
            // Hide placeholders
            rktBody.visible = false; nose.visible = false;
            rocketGrp.traverse(c => { if (c.name === 'lobbyThruster') c.visible = false; });
            console.log("✅ Lobby Rocket GLB loaded");
        });

        rocketGrp.position.set(0, 0, -60);
        this.scene.add(rocketGrp);


        // Engine Glow (Red PointLight)
        this.rocketLight = new THREE.PointLight(0xff0000, 3, 50);
        this.rocketLight.position.set(0, 2, -60);
        this.scene.add(this.rocketLight);

        // Launch Pad Lighting
        const rocketBaseLight = new THREE.PointLight(0xffffdd, 4, 80);
        rocketBaseLight.position.set(0, 1, -60);
        this.scene.add(rocketBaseLight);
    }

    setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const p1 = new THREE.PointLight(0x00ffff, 1.2, 20); p1.position.set(0, 9, 0); this.scene.add(p1);
        const pWarm = new THREE.PointLight(0xFFFACD, 1.5, 15); pWarm.position.set(0, 9.8, 0); this.scene.add(pWarm);

        const bedLight = new THREE.PointLight(0xffffff, 2.0, 10);
        bedLight.position.set(-5, 2, -4); this.scene.add(bedLight);

        const radioLight = new THREE.PointLight(0x00ff00, 1.5, 8);
        radioLight.position.set(6, 1.5, -5); this.scene.add(radioLight);
    }

    setupInputs() {
        document.addEventListener('keydown', (e) => this.onKeyChange(e, true));
        document.addEventListener('keyup', (e) => this.onKeyChange(e, false));
        document.addEventListener('mousedown', () => this.dismissDialogue());
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyChange(e, isD) {
        if (isD) this.dismissDialogue();
        if (!this.isGameStarted || this.isUIVisible || this.isTransitioning) return;
        switch (e.code) {
            case 'KeyW': this.input.w = isD; break;
            case 'KeyA': this.input.a = isD; break;
            case 'KeyS': this.input.s = isD; break;
            case 'KeyD': this.input.d = isD; break;
            case 'Space':
                this.input.space = isD;
                if (isD) this.tryInteract(); // Trigger interaction on Space
                break;
            case 'KeyE': if (isD) this.tryInteract(); break;
        }
    }

    loadAssets() {
        const mngr = new THREE.LoadingManager();
        const fbxL = new FBXLoader(mngr);
        const audioL = new THREE.AudioLoader(mngr);

        const loadS = (p, n, v = 0.5) => {
            const s = new THREE.Audio(this.audioListener);
            audioL.load(p, (b) => { s.setBuffer(b); s.setVolume(v); this.sounds[n] = s; });
        };
        loadS('/assets/audio/wake_up.wav', 'wakeUp', 0.5);
        loadS('/assets/audio/normal_footstep.wav', 'footstep', 0.5);
        loadS('/assets/audio/objective_1.wav', 'objective', 0.5);
        loadS('/assets/audio/system_chime.wav', 'chime', 0.5);

        const safeLoad = (p, onS) => {
            fbxL.load(p, (o) => { if (o) onS(o); }, undefined, (e) => console.log("Load Err:", e.message));
        };

        // Replacement Bed Box (Dark Blue/Grey)
        this.bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x2A3B4C }));
        this.bed.position.set(-5, 0.3, -4);
        this.scene.add(this.bed);

        // --- UPGRADED LOBBY EXIT DOOR (Wood Paneled "AI" style) ---
        const dGrp = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 }); // Light Tan Wood
        const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }); // Dark Brown Panels
        const knobMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }); // Black Handle

        // Door Slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.15), woodMat);
        dGrp.add(slab);

        // Panels (Visual representation of the image)
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.05), darkWoodMat);
        p1.position.set(-0.35, 0.65, 0.08); dGrp.add(p1);
        const p2 = p1.clone(); p2.position.set(0.35, 0.65, 0.08); dGrp.add(p2);
        const p3 = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 0.05), darkWoodMat);
        p3.position.set(0, -0.65, 0.08); dGrp.add(p3);

        // Handle
        const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04), knobMat);
        handle.position.set(-0.6, 0, 0.1); dGrp.add(handle);

        this.door = dGrp;
        this.door.position.set(0, 1.1, 5.9);
        this.door.rotation.y = Math.PI; // FLIP: Face panels toward the player
        this.scene.add(this.door);

        // YELLOW BOX KEY
        this.key = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false }));
        this.key.position.set(6.5, 1.1, -5);
        this.key.visible = true;
        this.key.renderOrder = 999;
        this.scene.add(this.key);

        safeLoad('/assets/models/Idle.fbx', (object) => {
            this.player = object;
            this.player.scale.set(0.01, 0.01, 0.01); this.player.visible = false; this.scene.add(this.player);
            this.mixer = new THREE.AnimationMixer(this.player);
            this.animations['Idle'] = this.mixer.clipAction(object.animations[0]);
            this.animations['Idle'].play(); this.currentAction = this.animations['Idle'];
            safeLoad('/assets/models/Running.fbx', (o) => { this.animations['Run'] = this.mixer.clipAction(o.animations[0]); });
            safeLoad('/assets/models/Floating.fbx', (o) => {
                const a = this.mixer.clipAction(o.animations[0]);
                a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true;
                this.animations['Jump'] = a;
            });
            // SPAWN: East side of bed, facing East
            this.player.position.set(-3.5, 0.1, -4);
            this.player.rotation.y = Math.PI / 2;
        });
    }

    create3DLateDisplay(mesh) {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const updateTex = () => {
            ctx.clearRect(0, 0, 128, 64); ctx.fillStyle = '#ff0000'; ctx.font = 'bold 30px Orbitron'; ctx.textAlign = 'center';
            if (Math.sin(Date.now() * 0.01) > 0) ctx.fillText("LATE", 64, 45); tex.needsUpdate = true;
        };
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), mat);
        plane.position.set(0, 0, 0.11); mesh.add(plane);
        plane.onBeforeRender = updateTex;
    }

    startSequence() {
        if (this.player) this.player.visible = true;
        const taskPanel = document.getElementById('task-panel');
        if (taskPanel) taskPanel.style.display = 'block';
        const movementHud = document.getElementById('movement-hud');
        if (movementHud) movementHud.style.display = 'block';
        const objText = document.getElementById('objective-text');
        if (objText) objText.innerText = "SYSTEM REBOOT";
        const subText = document.getElementById('subtask-text');
        if (subText) subText.innerText = `- Welcome back, Pilot ${this.pilotName}. Check the radio.`;

        // CINEMATIC: Start with hold on Alarm Clock
        this.isHoldingIntro = true;
        this.introHoldTimer = 2.5;
        this.startCamPos.set(-6.5, 0.8, -4.5);
        this.startCamTarget.set(-6.5, 0.5, -5.5); // Alarm clock face focus

        if (this.controls) this.controls.enabled = false; // LOCK CONTROLS DURING INTRO

        if (this.sounds['wakeUp']) this.triggerDialogue(0);
    }

    update(delta) {
        if (!this.player || !this.isGameStarted || this.isTransitioning) return;
        // Hard Wall Boundaries: Stops the camera from phasing through the room walls
        this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -7.2, 7.2);
        this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -5.7, 5.7);
        if (this.rocketLight) this.rocketLight.intensity = 2.0 + Math.sin(Date.now() * 0.003) * 2.0;

        if (this.isHoldingIntro) {
            this.introHoldTimer -= delta;
            // Force focus lock during hold
            this.camera.position.set(-6.5, 0.8, -4.5);
            this.camera.lookAt(-6.5, 0.5, -5.5);
            if (this.controls) {
                this.controls.target.set(-6.5, 0.5, -5.5);
                this.controls.update();
            }
            if (this.introHoldTimer <= 0) {
                this.isHoldingIntro = false;
                this.isLerpingCamera = true;
                this.lerpTimer = 0;
            }
        } else if (this.isLerpingCamera) {
            this.lerpTimer += delta;
            const progress = Math.min(this.lerpTimer / this.lerpDuration, 1.0);

            // CUBIC OUT EASING: 1 - Math.pow(1 - t, 3)
            const p = 1 - Math.pow(1 - progress, 3);

            // DUAL INTERPOLATION: Position + Target
            const tP = new THREE.Vector3(this.player.position.x, 2, this.player.position.z + 5);
            const tL = new THREE.Vector3(this.player.position.x, 1.2, this.player.position.z); // Player torso/target sync

            this.camera.position.lerpVectors(this.startCamPos, tP, p);
            const cL = new THREE.Vector3().lerpVectors(this.startCamTarget, tL, p);
            this.camera.lookAt(cL);
            if (this.controls) {
                this.controls.target.copy(cL);
                this.controls.update();
            }

            if (progress >= 1.0) {
                this.isLerpingCamera = false;
                if (this.controls) {
                    this.controls.enabled = true; // RE-ENABLE CONTROLS
                    this.controls.target.copy(tL);
                    this.controls.update();
                }
            }
        }

        if (!this.isUIVisible && !this.isHoldingIntro && !this.isLerpingCamera) {
            this.handleMovement(delta);
            this.handleAnimations(delta);
        }

        // SOFT-BOX COLLISION
        const pR = 0.45;
        const r = 0.1;
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.quaternion);
        const checkPos = this.player.position.clone().add(forward.multiplyScalar(0.2));

        for (const obj of this.collisionObjects) {
            if (this.player.position.y > obj.h) continue;

            const dx = checkPos.x - obj.x, dz = checkPos.z - obj.z;
            const hw = obj.w / 2, hd = obj.d / 2;

            if (obj.type === 'soft-box' || obj.type === 'static') {
                const cx = THREE.MathUtils.clamp(dx, -hw, hw);
                const cz = THREE.MathUtils.clamp(dz, -hd, hd);
                const distSq = (dx - cx) * (dx - cx) + (dz - cz) * (dz - cz);

                const limit = (obj.type === 'soft-box') ? (pR + r) : pR;
                if (distSq < limit * limit) {
                    const dist = Math.sqrt(distSq);
                    const push = (dist === 0) ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3((dx - cx) / dist, 0, (dz - cz) / dist);
                    const overlap = limit - dist;
                    this.player.position.addScaledVector(push, overlap);
                    checkPos.addScaledVector(push, overlap);
                }
            }
        }

        this.handleCamera();
        this.handleInteraction();
        this.boneLock(this.player);
        if (this.mixer) this.mixer.update(delta);
        if (this.controls && !this.isLerpingCamera && !this.isHoldingIntro) this.controls.update();
    }

    handleMovement(delta) {
        const camDir = new THREE.Vector3(); this.camera.getWorldDirection(camDir);
        camDir.y = 0; camDir.normalize();
        const camR = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3();
        if (this.input.w) moveVec.add(camDir);
        if (this.input.s) moveVec.sub(camDir);
        if (this.input.d) moveVec.add(camR);
        if (this.input.a) moveVec.sub(camR);

        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();
            const targetRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(moveVec.x, moveVec.z));
            this.player.quaternion.slerp(targetRot, 0.15);
            this.player.position.addScaledVector(moveVec, this.speed * delta);
        }
        if (this.isGrounded && this.input.space) { this.playerVelocity.y = this.jumpForce; this.isGrounded = false; }
        this.playerVelocity.y += this.gravity * delta;
        this.player.position.y += this.playerVelocity.y * delta;
        if (this.player.position.y <= 0) { this.player.position.y = 0; this.playerVelocity.y = 0; this.isGrounded = true; }
    }

    handleAnimations(delta) {
        const isM = this.input.w || this.input.a || this.input.s || this.input.d;
        let t = this.animations['Idle'];
        if (!this.isGrounded) t = this.animations['Jump'] || this.animations['Idle'];
        else if (isM) t = this.animations['Run'] || this.animations['Idle'];
        if (t && t !== this.currentAction) { this.currentAction.fadeOut(0.2); t.reset().fadeIn(0.2).play(); this.currentAction = t; }
    }

    handleCamera() {
        if (this.controls && this.player && this.isGameStarted && !this.isLerpingCamera && !this.isHoldingIntro) {
            this.controls.target.set(this.player.position.x, this.player.position.y + 1, this.player.position.z);
        }
    }

    handleInteraction() {
        if (!this.player) return;
        const pr = document.getElementById('interaction-prompt');
        let s = false, t = null, offset = 0.8;

        const kPos = new THREE.Vector3(6.5, 1.1, -5);
        const rPos = new THREE.Vector3(6, 1.2, -5);
        const wP = this.wardrobe ? this.wardrobe.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const dPos = new THREE.Vector3(0, 1.1, 5.9);

        if (this.gameState === 0 && this.player.position.distanceTo(rPos) < 2.5) {
            s = true; pr.innerText = "[SPACE] LISTEN TO RADIO"; t = this.pedestal; offset = 0.8;
        } else if (this.gameState === 1 && this.player.position.distanceTo(wP) < 2.5) {
            const pF = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.quaternion);
            const toW = new THREE.Vector3().subVectors(wP, this.player.position).normalize();
            if (pF.dot(toW) > 0.5) { s = true; pr.innerText = "[SPACE] GEAR CHECK"; t = this.wardrobe; offset = 1.6; }
        } else if (this.gameState === 2 && this.isKeyInteractable && this.player.position.distanceTo(kPos) < 2.5) {
            s = true; pr.innerText = "[SPACE] PICK UP CAR KEYS"; t = this.key; offset = 0.5;
        } else if (this.player.position.distanceTo(dPos) < 2.5) {
            s = true;
            pr.innerText = this.gameState === 3 ? "[SPACE] EVACUATE STATION" : "[SPACE] ACCESS DOOR";
            t = this.door;
            offset = 0.8;
        }

        if (pr) {
            if (s && t) { pr.style.display = 'block'; this.updateFloatingPrompt(t, offset); }
            else if (!this.isTransitioning) pr.style.display = 'none';
        }
    }

    updateFloatingPrompt(o, offset = 0.8) {
        const v = new THREE.Vector3(); o.updateMatrixWorld(); v.setFromMatrixPosition(o.matrixWorld);
        v.y += offset; v.project(this.camera);
        const pr = document.getElementById('interaction-prompt');
        if (pr) {
            pr.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
            pr.style.top = `${(v.y * -0.5 + 0.5) * window.innerHeight}px`;
        }
    }

    tryInteract() {
        const kPos = new THREE.Vector3(6.5, 1.1, -5), rPos = new THREE.Vector3(6, 1.2, -5), wP = this.wardrobe ? this.wardrobe.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(), dPos = new THREE.Vector3(0, 1.1, 5.9);
        if (this.gameState === 0 && this.player.position.distanceTo(rPos) < 2.5) {
            this.gameState = 1;
            document.getElementById('objective-text').innerText = "GEAR CHECK REQUIRED";
            document.getElementById('subtask-text').innerText = `- Check the mirror, Pilot ${this.pilotName}.`;
            this.triggerDialogue(1);
            // PULSE DISABLED BASED ON USER FEEDBACK
        } else if (this.gameState === 1 && this.player.position.distanceTo(wP) < 2.5) {
            if (this.sounds['chime']) this.sounds['chime'].play();
            this.openOutfitHUD();
        } else if (this.gameState === 2 && this.isKeyInteractable && this.player.position.distanceTo(kPos) < 2.5) {
            this.gameState = 3;
            if (this.key) this.key.visible = false;
            this.playUISound();
            document.getElementById('objective-text').innerText = "STATION EVACUATION";
            document.getElementById('subtask-text').innerText = "- DOOR ACCESSIBLE -";
            this.triggerDialogue(3);
            // PULSE DISABLED BASED ON USER FEEDBACK
        }
        else if (this.player.position.distanceTo(dPos) < 2.5) {
            // Force transition even if keys are missed, but check state
            if (this.gameState < 3) this.gameState = 3;

            this.isTransitioning = true;
            document.getElementById('interaction-prompt').style.display = 'none';
            document.getElementById('fade-overlay').style.opacity = '1';

            // Door Animation: Rotate open
            if (this.door) {
                const startRot = this.door.rotation.y;
                const targetRot = startRot + Math.PI / 2;
                let startTime = Date.now();
                const animateDoor = () => {
                    let elapsed = (Date.now() - startTime) / 1000;
                    let p = Math.min(elapsed / 0.8, 1.0);
                    // Cubic easing
                    let t = 1 - Math.pow(1 - p, 3);
                    this.door.rotation.y = startRot + (targetRot - startRot) * t;
                    if (p < 1.0) requestAnimationFrame(animateDoor);
                };
                animateDoor();
            }

            setTimeout(() => {
                if (this.gameStateManager) {
                    this.gameStateManager.transitionTo('LAUNCH_CENTER');
                }
            }, 1200);
        }
    }

    pulseObjective(mesh) {
        if (!mesh) return;

        const originalMaterials = new Map();

        mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                originalMaterials.set(child, child.material);

                const pulseMat = child.material.clone();
                pulseMat.emissive = new THREE.Color(0x00ffff);
                pulseMat.emissiveIntensity = 2.0;
                child.material = pulseMat;
            }
        });

        setTimeout(() => {
            mesh.traverse((child) => {
                if (child.isMesh && originalMaterials.has(child)) {
                    child.material = originalMaterials.get(child);
                }
            });
        }, 2000);
    }

    boneLock(o) {
        if (!o) return;
        o.traverse((c) => {
            if (c.isBone) {
                const n = c.name.toLowerCase();
                // EXCLUSION: Filter finger and hand bones to prevent collapses/stretching
                if (n.includes("finger") || n.includes("hand")) return;
                c.position.x = 0; c.position.z = 0;
            }
        });
    }

    cleanup() {
        console.log("Cleaning up StationStage...");

        // Remove UI elements
        const taskPanel = document.getElementById('task-panel');
        if (taskPanel) taskPanel.style.display = 'none';
        const movementHud = document.getElementById('movement-hud');
        if (movementHud) movementHud.style.display = 'none';
        const dialogueBox = document.getElementById('dialogue-box');
        if (dialogueBox) dialogueBox.style.display = 'none';

        // Clear scene
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }

        // Dispose geometries and materials
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        // Reset inputs
        this.input = { w: false, a: false, s: false, d: false, space: false };

        // Disable controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
    }
}

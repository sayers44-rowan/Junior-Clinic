import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { UIManager } from './UIManager.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// ASSET PREP: shared loaders
export const globalManager = new THREE.LoadingManager();
const _texLoader = new THREE.TextureLoader(globalManager);
const _gltfLoader = new GLTFLoader(globalManager);


export class StationStage {
    constructor(scene, camera, renderer, playerName = 'CADET', preloadedFbx = null) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.clock = new THREE.Clock();
        this.isPaused = false;
        this.playerName = playerName;
        this._preloadedFbx = preloadedFbx; // PRELOADER: use cached model if available
        this.assetCache = {}; // GLOBAL ASSET CACHE: Prevents rig UI stutter

        this.playerContainer = new THREE.Group();
        this.scene.add(this.playerContainer);

        this.input = { forward: false, backward: false, left: false, right: false, jump: false, interact: false };
        this.mixer = null;
        this.playerModel = null;

        // Mouse Look State
        this.cameraTheta = Math.PI;
        this.cameraPhi = Math.PI / 3;
        this.cameraAngle = 0;
        this.cameraPitch = 0;
        this.cameraDistance = 6;
        this.cameraTargetY = 1.5;

        // Jump / Physics
        this.velocityY = 0;
        this.isOnGround = true;
        this.isJumping = false;

        // Game-state flags
        this.hasKeys = false;   // KEY SYSTEM: must pick up key before vehicle
        this.isCutsceneActive = false;   // CUTSCENE: locks movement during intro pan
        this._charTintIndex = 0;       // CLOSET: cycles colour tints

        this.init();
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.scene.clear();

        this.setupMission();
        this.setupContainment();

        this.playerContainer = new THREE.Group();
        this.playerContainer.position.set(2, 0, 2); // SPAWN: Safe-Mode extraction to (2, 0, 2)
        this.scene.add(this.playerContainer);

        // CAMERA HARD-RESET: Prevent 'Black Void' on load
        this.camera.position.set(-5, 3, -5);
        this.camera.lookAt(0, 1.5, 0);
        this._cameraLinked = false;
        setTimeout(() => {
            this._cameraLinked = true;
            if (!this.controls) this.controls = {};
            this.controls.enabled = true; // INPUT FORCED-ON: unlocked immediately after load
        }, 100);

        this.setupLights();
        this.setupEnvironment(); // room + vehicle
        this.setupProps();       // bed, clock, radio, closet, key
        this.setupInput();
        this._preloadBaseAnims(); // Eagerly cache shared animation FBXes
        // NOTE: loadPilot() is NOT called here — it is called by GameStateManager._launchGame()
        // with the user's actual selected model path. Calling it here would race against that.

        // Far-plane: exterior city visible up to 600 units
        this.camera.near = 0.1;
        this.camera.far = 600;
        this.camera.updateProjectionMatrix();

        // INTRO CUTSCENE: focus on alarm clock, then pan to player
        this.runIntroSequence();

        this.isPaused = false;

        console.log('STAGE 1 VISUAL FIDELITY ACHIEVED');
        console.log('ABSOLUTE STABILITY: BEDROOM UNLOCKED');
        console.log('REVERSE P LAYOUT & PHYSICS SYNC COMPLETE');
        console.log('DEEP PHYSICS SYNC: FEET SECURED');
        console.log('VISUALS & ANIMATIONS CLEANED');
        console.log('ANIMATION STATE MACHINE & DOOR FRAMES LOCKED');
        console.log('SURGICAL FIX: NO FLAIL & FRAME ADDED');
        console.log('SURGICAL POLISH & T-POSE BROKEN');
        console.log('APARTMENT AESTHETIC & FRAME FIX COMPLETE');
        console.log('DOOR FRAME & ANIMATION SYNC REPAIRED');
        console.log('CRITICAL RECOVERY: GAME UNLOCKED');
        console.log('PULSE RESTORED: CONTINUOUS RENDER ACTIVE');
        console.log('ENGINE RE-SYNC COMPLETE: GAME UNBRICKED');
        console.log('ARCHITECTURE POLISHED & PAUSE RE-ENABLED');
        console.log('ORIENTATION & ARCHITECTURE SYNCED');
        console.log('ARCHITECTURE CLEANED & ORIENTATION CORRECTED');
        console.log('REALISTIC TRIM & VECTOR ORIENTATION ACTIVE');
        console.log('ARMS STRETCHED & GEOMETRY SEALED');
        console.log('TARGETED RESET: RUNNING UNLOCKED');
    }

    setupEnvironment() {
        // Sky set in setupRoom

        // INTERIOR FLOOR: smooth light-grey tile
        const floorGeo = new THREE.PlaneGeometry(10, 10);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.4, metalness: 0.05 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.name = 'floor';
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.setupRoom();
        this.setupVehicle();
    }

    setupRoom() {
        // HIGH-FIDELITY RESTORATION: L-Shaped Outpost
        const mat = new THREE.MeshStandardMaterial({
            color: 0x99aacc, metalness: 0.1, roughness: 0.8,
            side: THREE.DoubleSide
        });

        const roomGroup = new THREE.Group();
        this.roomGroup = roomGroup; // Cache for raycasting

        // FLOOR & CEILING
        // Main Room (12x12)
        const floorMain = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 12), mat);
        floorMain.position.set(0, -0.1, 0); roomGroup.add(floorMain);
        const ceilMain = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 12), mat);
        ceilMain.position.set(0, 3.5, 0); roomGroup.add(ceilMain);

        // Nook (6x6) - Relocated to the Z: 0 to 6 quadrant (Reverse P)
        const floorNook = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 6), mat);
        floorNook.position.set(-9, -0.1, 3); roomGroup.add(floorNook);
        const ceilNook = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 6), mat);
        ceilNook.position.set(-9, 3.5, 3); roomGroup.add(ceilNook);

        // WALLS (Height 3.4 to connect floor at 0 and ceil at 3.5)
        // EXIT DOORWAY SHOULDERS (East exterior wall, with 2m gap from z: -1 to 1)
        const wEastNorth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 5.0), mat);
        wEastNorth.position.set(6.1, 1.7, -3.5); roomGroup.add(wEastNorth); // Spans -6.1 to -1.0

        const wEastSouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 5.0), mat);
        wEastSouth.position.set(6.1, 1.7, 3.5); roomGroup.add(wEastSouth); // Spans 1.0 to 6.1

        // EXIT DOOR: ThinTrim & Upper Wall
        const thinTrimMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide });

        const eTrim1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.05), thinTrimMat);
        eTrim1.position.set(6.1, 1.25, -0.975); this.scene.add(eTrim1);

        const eTrim2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.05), thinTrimMat);
        eTrim2.position.set(6.1, 1.25, 0.975); this.scene.add(eTrim2);

        const eTrimTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 2.0), thinTrimMat);
        eTrimTop.position.set(6.1, 2.5, 0); this.scene.add(eTrimTop);

        // ACTUAL WALL above the door (extended down to 2.4 to stab into trim)
        const wEastUpper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 2.0), mat);
        wEastUpper.position.set(6.1, 2.95, 0); roomGroup.add(wEastUpper);

        const mainDoorMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
        const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 2.0), mainDoorMat);
        mainDoor.position.set(6.1, 1.25, 0); roomGroup.add(mainDoor);

        // HIGH-TECH APARTMENT: Subtle Status Light above East Exit
        const exitStatusMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1.5, roughness: 0.2
        });
        const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.5), exitStatusMat);
        exitSign.position.set(6.05, 2.7, 0); // SIGN OFFSET: 0.05m gap from x=6.1 wall prevents Z-fighting
        roomGroup.add(exitSign);

        const wSouthMain = new THREE.Mesh(new THREE.BoxGeometry(12, 3.4, 0.2), mat);
        wSouthMain.position.set(0, 1.7, 6.1); roomGroup.add(wSouthMain);

        const wSouthNook = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 0.2), mat);
        wSouthNook.position.set(-9, 1.7, 6.1); roomGroup.add(wSouthNook);

        const wWestNook = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 6), mat);
        wWestNook.position.set(-12.1, 1.7, 3); roomGroup.add(wWestNook);

        const wNorthNook = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 0.2), mat);
        wNorthNook.position.set(-9, 1.7, -0.1); roomGroup.add(wNorthNook);

        // DOORWAY SHOULDERS (Main Room West Wall, with 2m gap from z: 2 to 4)
        const wWestMainNorth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 8.1), mat);
        wWestMainNorth.position.set(-6.1, 1.7, -2.05); roomGroup.add(wWestMainNorth); // Spans -6.1 to 2.0

        const wWestMainSouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 2.1), mat);
        wWestMainSouth.position.set(-6.1, 1.7, 5.05); roomGroup.add(wWestMainSouth); // Spans 4.0 to 6.1

        // BEDROOM DOOR: ThinTrim & Upper Wall
        const bTrim1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.05), thinTrimMat);
        bTrim1.position.set(-6.1, 1.25, 2.025); this.scene.add(bTrim1);

        const bTrim2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.05), thinTrimMat);
        bTrim2.position.set(-6.1, 1.25, 3.975); this.scene.add(bTrim2);

        const bTrimTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 2.0), thinTrimMat);
        bTrimTop.position.set(-6.1, 2.5, 3.0); this.scene.add(bTrimTop);

        // ACTUAL WALL above the door (extended down to 2.4 to stab into trim)
        const wWestMainUpper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 2.0), mat);
        wWestMainUpper.position.set(-6.1, 2.95, 3.0); roomGroup.add(wWestMainUpper);

        // North Wall with Window
        const nBot = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 0.2), mat);
        nBot.position.set(0, 0.6, -6.1); roomGroup.add(nBot);
        const nTop = new THREE.Mesh(new THREE.BoxGeometry(12, 2.7, 0.2), mat);
        nTop.position.set(0, 4.55, -6.1); roomGroup.add(nTop);
        const nLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 2.0, 0.2), mat);
        nLeft.position.set(-4.0, 2.2, -6.1); roomGroup.add(nLeft);
        const nRight = new THREE.Mesh(new THREE.BoxGeometry(4, 2.0, 0.2), mat);
        nRight.position.set(4.0, 2.2, -6.1); roomGroup.add(nRight);

        // Window Frame & fully transparent glass pane
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide });
        const f1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.3), frameMat);
        f1.position.set(0, 1.2, -6.1); roomGroup.add(f1);
        const f2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.3), frameMat);
        f2.position.set(0, 3.2, -6.1); roomGroup.add(f2);
        const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.3), frameMat);
        f3.position.set(-2.0, 2.2, -6.1); roomGroup.add(f3);
        const f4 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.3), frameMat);
        f4.position.set(2.0, 2.2, -6.1); roomGroup.add(f4);

        const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15, depthWrite: false });
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), glassMat);
        glass.position.set(0, 2.2, -6.05); roomGroup.add(glass);

        // Z-FIGHTING FIX: Raise entire structure by 0.1
        roomGroup.position.set(0, 0.1, 0);
        this.scene.add(roomGroup);

        // Warm interior light
        const interiorLight = new THREE.PointLight(0xffeedd, 1.2, 15);
        interiorLight.position.set(0, 3, 0);
        this.scene.add(interiorLight);

        // SKY background (fallback; Sky add-on applied in _buildCity)
        this.scene.background = new THREE.Color(0x87ceeb);

        // City exterior
        this._buildCity();

        // CYAN ACCENT lights (interior corners)
        [[4.5, 4.5, 4.5], [-4.5, 4.5, 4.5],
        [4.5, 4.5, -4.5], [-4.5, 4.5, -4.5]].forEach(pos => {
            const light = new THREE.PointLight(0x00f2ff, 1.0, 15);
            light.position.set(...pos); this.scene.add(light);
        });

        console.log('SCALE & ENCLOSURE CORRECTED');
    }

    // CITY EXTERIOR: girthy rocket, 60m blocker, natural skyline, THREE.Sky
    _buildCity() {
        // ── SKY: replace solid color with THREE.Sky for realistic gradient + sun disc
        try {
            const sky = new Sky();
            sky.scale.setScalar(450);
            this.scene.add(sky);
            const skyUniforms = sky.material.uniforms;
            skyUniforms['turbidity'].value = 4;
            skyUniforms['rayleigh'].value = 1.5;
            skyUniforms['mieCoefficient'].value = 0.005;
            skyUniforms['mieDirectionalG'].value = 0.8;
            const sun = new THREE.Vector3();
            const phi = THREE.MathUtils.degToRad(85);   // near horizon
            const theta = THREE.MathUtils.degToRad(160);
            sun.setFromSphericalCoords(1, phi, theta);
            skyUniforms['sunPosition'].value.copy(sun);
            // PMREMGenerator: bake sky into scene environment for PBR reflections
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileEquirectangularShader();
            this.scene.environment = pmrem.fromScene(new THREE.RoomEnvironment()).texture;
        } catch (e) {
            // Fallback if Sky fails
            this.scene.background = new THREE.Color(0x87ceeb);
            console.warn('THREE.Sky unavailable — using flat sky colour', e);
        }

        // GIRTHY ROCKET: radius 5, height 30 — thick proportions
        // Body centre at y=15 → top at y=30; nose extends to y=42
        // 60m skyscraper at (-25, 30, -90) hides body, only nose peeks
        const rocketMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.85, roughness: 0.15 });
        const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 30, 16), rocketMat);
        rocketBody.position.set(-25, 15, -130);
        this.scene.add(rocketBody);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.7, roughness: 0.3 });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 16), noseMat);
        nose.position.set(-25, 36, -130); // top of body (y=30) + half-cone (y=6)
        this.scene.add(nose);
        // Fins
        const finMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.6, roughness: 0.4 });
        for (let i = 0; i < 4; i++) {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 4), finMat);
            const a = (i / 4) * Math.PI * 2;
            fin.position.set(-25 + Math.sin(a) * 7, 4, -130 + Math.cos(a) * 7);
            fin.rotation.y = a;
            this.scene.add(fin);
        }

        // 60m SKYSCRAPER BLOCKER: hides rocket body, only red nose peeks above
        const skyMat = new THREE.MeshStandardMaterial({ color: 0x5a6b7c, metalness: 0.3, roughness: 0.6 });
        const skyscraper = new THREE.Mesh(new THREE.BoxGeometry(18, 60, 14), skyMat);
        skyscraper.position.set(-25, 30, -90); // top at y=60 — rocket top (y=30) fully hidden
        this.scene.add(skyscraper);

        // SUPPORTING CITY BUILDINGS
        [
            { p: [20, 0, -110], s: [8, 25, 8], c: 0x8899aa },
            { p: [-18, 0, -115], s: [7, 20, 7], c: 0x99aaaa },
            { p: [30, 0, -140], s: [10, 35, 10], c: 0x778899 },
            { p: [-35, 0, -145], s: [8, 28, 8], c: 0xaabbcc },
            { p: [10, 0, -180], s: [12, 45, 12], c: 0x667788 },
            { p: [0, 0, -90], s: [6, 22, 6], c: 0x8899bb },
            { p: [-10, 0, -95], s: [5, 30, 5], c: 0x99aabb },
            { p: [15, 0, -125], s: [9, 38, 9], c: 0x6677aa },
            { p: [-42, 0, -110], s: [7, 20, 7], c: 0xaab9c8 },
            { p: [40, 0, -130], s: [11, 42, 11], c: 0x778aaa },
            { p: [-5, 0, -165], s: [8, 33, 8], c: 0x9aabbc },
            { p: [22, 0, -170], s: [6, 24, 6], c: 0x667799 },
            { p: [-30, 0, -190], s: [10, 40, 10], c: 0x8899aa }
        ].forEach(b => {
            const bld = new THREE.Mesh(
                new THREE.BoxGeometry(...b.s),
                new THREE.MeshStandardMaterial({ color: b.c, metalness: 0.2, roughness: 0.7 })
            );
            bld.position.set(b.p[0], b.s[1] / 2, b.p[2]);
            this.scene.add(bld);
        });

        // 3-LAYER TREES: thick trunk + 3 stacked cones for natural silhouette
        [
            { p: [6, 0, -80] }, { p: [6, 0, -95] },
            { p: [14, 0, -80] }, { p: [14, 0, -95] },
            { p: [-6, 0, -92] }, { p: [-14, 0, -85] }
        ].forEach(t => {
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3820, roughness: 0.9 });
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 8), trunkMat);
            trunk.position.set(t.p[0], 1.5, t.p[2]);
            this.scene.add(trunk);
            // 3 stacked leaf cones — bottom wide, top narrow, alternating green shades
            [[4.5, 5, 3, 0x2d8a30], [3.5, 4.5, 5.5, 0x3a9e3a], [2.5, 4, 8, 0x22762a]].forEach(([r, h, y, c]) => {
                const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8),
                    new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
                cone.position.set(t.p[0], y, t.p[2]);
                this.scene.add(cone);
            });
        });

        // GRASS GROUND: Z-fighting fix — lowered to y=-1.0 so it's well below the modular room floor
        const grassTex = _texLoader.load(
            'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
            (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); }
        );
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ map: grassTex, color: 0x88bb55, roughness: 0.95 }));
        ground.rotation.x = -Math.PI / 2; ground.position.set(0, -1.0, -200);
        this.scene.add(ground);

        // ROAD: x:10, outside the house
        const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 400),
            new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
        road.rotation.x = -Math.PI / 2; road.position.set(10, -0.04, -170);
        this.scene.add(road);
    }



    setupVehicle() {
        this.vehicleGroup = new THREE.Group();
        // ROAD PLACEMENT: vehicle sits on the road at x:10, outside the house
        this.vehicleGroup.position.set(10, 0, -20);
        this.vehicleEntered = false;

        // [E] ENTER prompt (shared canvas label, always added first)
        const vc = document.createElement('canvas'); vc.width = 256; vc.height = 64;
        const vx = vc.getContext('2d');
        vx.fillStyle = '#00f2ff'; vx.font = 'bold 26px Courier';
        vx.textAlign = 'center'; vx.fillText('[E] ENTER VEHICLE', 128, 44);
        this.vehiclePrompt = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 0.4),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vc), transparent: true, depthTest: false })
        );
        this.vehiclePrompt.position.set(0, 2.4, 0); this.vehiclePrompt.visible = false;
        this.vehicleGroup.add(this.vehiclePrompt);
        this.scene.add(this.vehicleGroup);

        // NASA TRANSPORT: Rover model
        const VEHICLE_URL = 'https://vazxmixjsiawhamofcre.supabase.co/storage/v1/object/public/models/rover/model.gltf';
        _gltfLoader.load(
            VEHICLE_URL,
            (gltf) => {
                const model = gltf.scene;
                model.scale.setScalar(1.0);
                model.position.set(0, 0, 0);
                // Allow shading
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.vehicleGroup.add(model);
                console.log('CESIUM MILK TRUCK LOADED');
            },
            undefined,
            (err) => console.error('Vehicle GLTF load failed:', err)
        );
    }

    setupLights() {
        // LIGHTING OVERHAUL: Soft, professional glow
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4)); // Smooth dark corners globally

        // LIGHTING FAILSAFE: Bumped Hemisphere to 1.0 to debug the void
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444422, 1.0);
        this.scene.add(hemiLight);

        // Soft RectAreaLights for ceilings
        const rectMain = new THREE.RectAreaLight(0xffeedd, 1.0, 4, 4);
        rectMain.position.set(0, 3.49, 0); rectMain.lookAt(0, 0, 0);
        this.scene.add(rectMain);

        const rectNook = new THREE.RectAreaLight(0xffeedd, 1.0, 4, 4);
        rectNook.position.set(-9, 3.49, 3); rectNook.lookAt(-9, 0, 3);
        this.scene.add(rectNook);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(0, 10, 0);
        dirLight.castShadow = true;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);
    }

    // ── PROPS ──────────────────────────────────────────────────────────────────
    setupProps() {
        // BED GROUP: Moved into the new Sleeping Nook far back-left Z(0 to 6)
        const bedGroup = new THREE.Group();
        bedGroup.scale.set(1.0, 1.0, 1.0); // True scale relative to player sizes
        bedGroup.rotation.y = Math.PI / 2; // Pillow to the right
        bedGroup.position.set(-10.5, 0, 4.5);

        // Bed frame sitting exactly on y=0
        const bedFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.25, 2.0),
            new THREE.MeshStandardMaterial({ color: 0x5c3d1e, metalness: 0.1, roughness: 0.8 })
        );
        bedFrame.position.y = 0.125;
        bedGroup.add(bedFrame);

        // Mattress exactly on top of frame
        const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.15, 1.9),
            new THREE.MeshStandardMaterial({ color: 0xdde8f0, roughness: 0.9 })
        );
        mattress.position.y = 0.325;
        bedGroup.add(mattress);

        // Pillow on top of mattress
        const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.10, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
        );
        pillow.position.set(0, 0.45, -0.6);
        bedGroup.add(pillow);
        this.scene.add(bedGroup);


        // ALARM CLOCK — cutscene focus target, shows "08:47 — LATE"
        const clockCanvas = document.createElement('canvas');
        clockCanvas.width = 256; clockCanvas.height = 128;
        const cctx = clockCanvas.getContext('2d');
        cctx.fillStyle = '#111'; cctx.fillRect(0, 0, 256, 128);
        cctx.fillStyle = '#ff3333'; cctx.font = 'bold 28px Courier';
        cctx.textAlign = 'center'; cctx.fillText('08:47', 128, 55);
        cctx.font = 'bold 22px Courier';
        cctx.fillStyle = '#ff6600'; cctx.fillText('— LATE —', 128, 95);
        const clockTex = new THREE.CanvasTexture(clockCanvas);
        const clockBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.3, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 })
        );
        // Correctly parented visually on top of End Table (Y=0.55+0.15)
        clockBody.position.set(-11.5, 0.70, 5.0);
        this.scene.add(clockBody);
        const clockFace = new THREE.Mesh(
            new THREE.PlaneGeometry(0.32, 0.24),
            new THREE.MeshBasicMaterial({ map: clockTex })
        );
        clockFace.position.set(-11.5, 0.70, 5.0 - 0.091);
        this.scene.add(clockFace);
        // Store world position for cutscene look-at
        this.alarmClockPos = new THREE.Vector3(-11.5, 0.70, 5.0);

        // BEDSIDE TABLE (for clock) GROUNDED at y=0 inside Nook
        const bsTable = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.55, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x4a3010, roughness: 0.85 })
        );
        bsTable.position.set(-11.5, 0.275, 5.0);
        this.scene.add(bsTable);

        // (Doorway Jambs & Lintel deleted here, merged into setupRoom with proper doubleSide material)

        // RADIO TABLE GROUNDED at y=0 height=0.7m
        const radTable = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.7, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 })
        );
        radTable.position.set(0, 0.35, -3.5);
        this.scene.add(radTable);
        this.radioTablePos = new THREE.Vector3(0, 0, -3.5);
        this.radioTablePos = new THREE.Vector3(0, 0, -3.5);

        // BOOMBOX RADIO — GLTF load; scale 0.05
        const BOOMBOX_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF/BoomBox.gltf';
        _gltfLoader.load(
            BOOMBOX_URL,
            (gltf) => {
                const radio = gltf.scene;
                radio.scale.setScalar(0.05); // FIX: extremely small scale to sit on desk organically
                radio.position.set(-0.4, 0.92, -3.5);
                this.scene.add(radio);
                console.log('BOOMBOX RADIO LOADED');
            },
            undefined,
            (err) => {
                console.warn('BoomBox load failed — fallback radio box:', err.message);
                const fb = new THREE.Mesh(
                    new THREE.BoxGeometry(0.35, 0.22, 0.18),
                    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 })
                );
                fb.position.set(-0.4, 0.92, -3.5);
                this.scene.add(fb);
            }
        );

        // GOLD KEY — on radio table; picking it up sets hasKeys
        const keyMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
        const keyGroup = new THREE.Group();
        // Key head (ring)
        const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 16), keyMat);
        keyRing.position.set(0, 0, 0);
        keyGroup.add(keyRing);
        // Key shaft
        const keyShaft = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.12, 0.015), keyMat);
        keyShaft.position.set(0, -0.1, 0);
        keyGroup.add(keyShaft);
        keyGroup.position.set(0.4, 0.935, -3.5);
        keyGroup.rotation.x = Math.PI / 2;
        this.scene.add(keyGroup);
        this.keyMesh = keyGroup; // referenced in update for pick-up

        // APARTMENT VIBE: Moved 2m right (+Z) to open up Living Area (x=3.5, z=-1.5)
        const closetGroup = new THREE.Group();
        closetGroup.position.set(3.5, 0, -1.5);
        closetGroup.rotation.y = -Math.PI / 2; // Flat against right wall

        const closetBody = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 2.8, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.8 })
        );
        closetBody.position.set(0, 1.4, 0);
        closetGroup.add(closetBody);

        // Door panel (slightly lighter)
        const closetDoor = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 2.6, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xA07850, roughness: 0.7 })
        );
        closetDoor.position.set(-0.04, 1.4, 0.32);
        closetGroup.add(closetDoor);

        this.scene.add(closetGroup);
        this.closetPos = new THREE.Vector3(3.5, 1.4, -1.5);

        // Closet prompt sprite
        const cc = document.createElement('canvas'); cc.width = 256; cc.height = 64;
        const cx = cc.getContext('2d');
        cx.fillStyle = '#00f2ff'; cx.font = 'bold 22px Courier';
        cx.textAlign = 'center'; cx.fillText('[E] CHANGE', 128, 44);
        this.closetPrompt = new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 0.35),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthTest: false })
        );
        // Matching the physical position precisely
        this.closetPrompt.position.set(3.5, 3.2, -1.5);
        this.closetPrompt.visible = false;
        this.scene.add(this.closetPrompt);

        console.log('PROPS SPAWNED: bed, clock, radio table, key, closet');
    }

    // ── MORNING CUTSCENE ───────────────────────────────────────────────────────
    runIntroSequence() {
        if (!this.alarmClockPos) return;
        this.isCutsceneActive = true;
        UIManager.isDialogueActive = true;

        // Phase 1: snap camera to look at alarm clock
        const clockFocusPos = this.alarmClockPos.clone().add(new THREE.Vector3(0.5, 0.6, 1.2));
        this.camera.position.copy(clockFocusPos);
        this.camera.lookAt(this.alarmClockPos);
        console.log('CUTSCENE STARTED');

        // Phase 2: after 2s, LERP camera back toward player over 1s
        const lerpDuration = 1200; // ms
        const holdDuration = 2000; // ms
        const startTime = Date.now() + holdDuration;

        // Target: normal player-camera position
        const targetPos = new THREE.Vector3(
            this.playerContainer.position.x,
            this.playerContainer.position.y + 3,
            this.playerContainer.position.z + 6
        );

        const _lerp = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            if (elapsed < 0) { requestAnimationFrame(_lerp); return; }

            const t = Math.min(elapsed / lerpDuration, 1);
            this.camera.position.lerpVectors(clockFocusPos, targetPos, t);
            this.camera.lookAt(
                this.playerContainer.position.x,
                this.playerContainer.position.y + 1.5,
                this.playerContainer.position.z
            );

            if (t < 1) { requestAnimationFrame(_lerp); }
            else {
                // Cutscene done — fire opening dialogue
                this.isCutsceneActive = false;
                if (this._uiManager) {
                    this._uiManager.queueDialogue([
                        { speaker: 'Specialist', text: "*Yawn*... Oh no, I'm late! I need to check Patient 21 and get to the city.", isRadio: false },
                        { speaker: 'Lead Researcher', text: 'Specialist! Wake up! Patient 21 is unstable — check the data!', isRadio: true }
                    ], () => {
                        const objEl = document.getElementById('hub-objective');
                        if (objEl) { objEl.style.visibility = 'visible'; }
                    });
                } else {
                    UIManager.isDialogueActive = false;
                }
                console.log('CUTSCENE COMPLETE');
            }
        };
        requestAnimationFrame(_lerp);
    }


    setupMission() {
        this.missionTable = new THREE.Group();
        this.missionTable.position.set(0, 0, -3);

        const table = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        table.position.y = 0.5;
        this.missionTable.add(table);

        const radio = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xff0000, name: "Radio" }));
        radio.position.set(-0.5, 1.2, 0);
        this.missionTable.add(radio);

        const keycard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0x0000ff, name: "Keycard" }));
        keycard.position.set(0.5, 1.025, 0);
        this.missionTable.add(keycard);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f0'; ctx.font = '30px Courier'; ctx.textAlign = 'center';
        ctx.fillText('[E] ANALYZE', 128, 64);

        this.promptMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
        this.promptMesh.position.set(0, 2, 0);
        this.promptMesh.visible = false;
        this.missionTable.add(this.promptMesh);

        this.scene.add(this.missionTable);
    }

    setupInput() {
        // Fix 2: ESCAPE TOGGLE & P-UNBIND
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === null) {
                // CLOSET DECOUPLING: Do not pause if the closet unlock triggered this
                if (!this._closetOpen) {
                    this.togglePause(true);
                }
            } else {
                this.togglePause(false);
            }
        });

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.onclick = () => {
                this.renderer.domElement.requestPointerLock();
            };
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.isPaused) {
                    this.renderer.domElement.requestPointerLock();
                }
                return;
            }

            // GLOBAL INTERACTION
            if (e.code === 'KeyE') {
                this.input.interact = true; // INTERACT TOGGLE
                if (this.missionTable && this.playerContainer.position.distanceTo(this.missionTable.position) < 3) {
                    console.log('MISSION LOG 01: EQUIPMENT SECURED');
                }
                return;
            }

            switch (e.code) {
                case 'KeyW': this.input.forward = true; break;
                case 'KeyS': this.input.backward = true; break;
                case 'KeyA': this.input.left = true; break;
                case 'KeyD': this.input.right = true; break;
                case 'Space': this.input.jump = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': this.input.forward = false; break;
                case 'KeyS': this.input.backward = false; break;
                case 'KeyA': this.input.left = false; break;
                case 'KeyD': this.input.right = false; break;
                case 'Space': this.input.jump = false; break;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPaused && document.pointerLockElement) {
                const sensitivity = 0.003;
                this.cameraAngle -= e.movementX * sensitivity; // CAMERA TIGHTEN
                // PITCH FIX
                this.cameraPitch += e.movementY * 0.002;
                this.cameraPitch = Math.max(-0.8, Math.min(1.2, this.cameraPitch)); // PITCH EXPANSION
            }
        });

        this.renderer.domElement.addEventListener('click', () => {
            if (!this.isPaused) this.renderer.domElement.requestPointerLock();
        });
    }

    togglePause(val) {
        this.isPaused = val;
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.style.display = this.isPaused ? 'flex' : 'none';

        // HARD PAUSE: Freeze animations natively without breaking render loop
        if (this.mixer) {
            this.mixer.timeScale = this.isPaused ? 0 : 1;
        }

        if (!this.isPaused) this.clock.getDelta();
    }

    // FRESH LOAD PROTOCOL: always loads a new FBX instance — no clone, no cache for pilots
    async loadPilot(modelPath) {
        const path = modelPath || '/assets/models/pilot_timmy.fbx';

        // STUTTER FIX: guard against redundant swap to the same model
        if (this._currentModelPath === path && this.pilot) {
            console.log('REDUNDANT LOAD BLOCKED:', path);
            return this.pilot;
        }
        this._currentModelPath = path;

        // --- DISPOSAL: remove old pilot from scene ---
        if (this.pilot) {
            this.playerContainer.remove(this.pilot);
            this.pilot = null;
            this.playerModel = null;
        }

        // --- MIXER RESET ---
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        this.idleAction = null;
        this.runAction = null;
        this.floatAction = null;
        this.jumpAction = null;

        // Block until shared anim FBXes are ready
        if (this._animsReady) await this._animsReady;

        // Always fresh-load the pilot — never clone, never cache
        return new Promise((resolve, reject) => {
            const loader = new FBXLoader(globalManager);
            loader.load(path, (fbx) => {
                this._setupRig(fbx, path).then(resolve).catch(reject);
            }, undefined, (err) => {
                console.error('Pilot FBX load failed:', err);
                reject(err);
            });
        });
    }

    // Cache shared animation FBXes once at init. 'jump' and 'float' both use Floating.fbx.
    _preloadBaseAnims() {
        this.animCache = this.animCache || {};
        const anims = [
            { key: 'run', path: '/assets/models/Running.fbx' },
            { key: 'float', path: '/assets/models/Floating.fbx' },
        ];
        this._animsReady = Promise.all(anims.map(({ key, path }) => {
            if (this.animCache[key]) return Promise.resolve();
            return new Promise((resolve) => {
                const loader = new FBXLoader(globalManager);
                loader.load(path, (fbx) => {
                    this.animCache[key] = fbx;
                    // 'jump' shares the same FBX as 'float'
                    if (key === 'float') this.animCache['jump'] = fbx;
                    console.log('ANIM CACHE READY:', key);
                    resolve();
                }, undefined, (err) => {
                    console.warn('ANIM PRELOAD FAILED:', key, err);
                    resolve();
                });
            });
        }));
        return this._animsReady;
    }

    // Fresh FBX instance from disk — no cloning, no rebinding needed
    async _setupRig(fbx, path) {
        // SCALE & ORIENTATION
        fbx.scale.set(0.009, 0.009, 0.009);
        fbx.position.set(0, 0, 0);
        fbx.rotation.set(0, 0, 0);
        fbx.name = 'pilotGroup';

        // TRANSPARENCY & SKINNED MESH FIX
        fbx.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => { m.transparent = false; m.opacity = 1.0; });
                } else {
                    child.material.transparent = false;
                    child.material.opacity = 1.0;
                }
            }
            if (child.isSkinnedMesh && path.includes('dummy')) {
                child.normalizeSkinWeights();
            }
        });

        // Attach to scene — playerModel must be set for rotation in updateAnimation
        this.pilot = fbx;
        this.playerModel = fbx;
        this.playerContainer.add(fbx);
        console.log('CHARACTER ATTACHED:', path);

        if (fbx.animations && fbx.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(fbx);
            this.isRunning = false;
            this._animState = 0;

            // IDLE: embedded in the model
            this.idleAction = this.mixer.clipAction(fbx.animations[0]);
            this.idleAction.setEffectiveWeight(1.0);
            this.idleAction.setEffectiveTimeScale(1.0);
            this.idleAction.play();

            // Force matrix update so retargetClip sees valid bone world matrices
            fbx.updateMatrixWorld(true);

            // SHARED ANIMS: retarget from pre-cached FBXes onto fresh fbx
            const verifyRetarget = (clip, name) => {
                if (clip.tracks.length === 0) console.warn(`RETARGET FAILED: ${name} — 0 tracks`);
                else console.log(`RETARGET OK: ${name} (${clip.tracks.length} tracks)`);
                return clip;
            };

            const bindAnim = (key, timeScale) => {
                // JUMP FALLBACK: alias to float if jump key is somehow missing
                const src = this.animCache && (this.animCache[key] || (key === 'jump' ? this.animCache['float'] : null));
                if (src && src.animations && src.animations.length > 0) {
                    try {
                        // Bone names already match perfectly (mixamorig6Hips -> mixamorig6Hips).
                        // Animation FBXes have no SkinnedMesh so retargetClip() would crash.
                        // Three.js AnimationMixer matches tracks to bones by name automatically.
                        const clip = src.animations[0];
                        const action = this.mixer.clipAction(clip);
                        action.enabled = true;
                        action.setEffectiveWeight(0);
                        action.setEffectiveTimeScale(timeScale);
                        action.play();
                        console.log(`ANIM BOUND: ${key} (${clip.tracks.length} tracks)`);
                        return action;
                    } catch (e) {
                        console.error(`ANIM BIND ERROR on ${key}:`, e);
                        return null;
                    }
                }
                console.warn(`ANIM CACHE MISS: ${key}`);
                return null;
            };

            this.runAction = bindAnim('run', 1.0);
            this.jumpAction = bindAnim('jump', 1.1);
            this.floatAction = bindAnim('float', 1.0);

            console.log('MODULAR RIG INITIALIZED — FRESH LOAD');
        } else {
            this.mixer = new THREE.AnimationMixer(fbx);
        }
    }

    update(dt) {
        try {
            // PULSE RESTORED: Continuous render unconditionally active. Removed pause checks.
            const actualDt = dt || this.clock.getDelta();

            // DEEP PHYSICS SYNC: Raycast Grounding
            if (this.roomGroup && this.roomGroup.children && this.roomGroup.children.length > 0 && this.playerContainer) {
                const rayOrigin = this.playerContainer.position.clone();
                rayOrigin.y += 0.5; // Shoot from slightly above feet

                // Only raycast downwards if we are falling or resting
                if (this.velocityY <= 0.01) {
                    const raycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 0.6); // 0.5 origin + 0.1 tolerance
                    const hits = raycaster.intersectObject(this.roomGroup, true);

                    if (hits.length > 0) { // Valid floor hit
                        this.playerContainer.position.y = hits[0].point.y;
                        this.velocityY = 0;

                        if (!this.isOnGround) {
                            this.isOnGround = true;
                            this.isJumping = false;
                            this.isRunning = false;

                            // LANDING HOOK: Structural hard-stop, no fade.
                            if (this.jumpAction) this.jumpAction.stop();
                            if (this.floatAction) this.floatAction.stop();
                            if (this.idleAction) {
                                this.idleAction.play();
                                this.idleAction.setEffectiveWeight(1.0);
                            }
                        }
                    } else {
                        this.isOnGround = false; // Player walked off an edge
                    }
                }
            }

            if (this.scanPlane) {
                // Animate scanning line from y=0 to y=1.8 continuously
                this.scanPlane.position.y = (Math.sin(actualDt * Date.now() * 0.003) * 0.9) + 0.9;
            }

            // SAFETY LIMITERS & HEARTBEATS
            if (!this.playerContainer || !this.mixer) return;
            this.handleMovement(actualDt);

            // CONTAINMENT UNIT interaction
            // BIO-UNIT interaction
            if (this.containmentUnit) {
                const dist = this.playerContainer.position.distanceTo(this.containmentUnit.position);
                const isNear = dist < 3;
                if (this.containmentPrompt) {
                    this.containmentPrompt.visible = isNear;
                    this.containmentPrompt.lookAt(this.camera.position);
                }
                if (isNear && this.input.interact && !this.scanComplete) {
                    this.scanComplete = true;
                    this.input.interact = false;

                    // SCAN PROMPT KILL: Remove from scene entirely
                    if (this.containmentPrompt) {
                        this.scene.remove(this.containmentPrompt);
                        this.containmentPrompt = null;
                    }

                    if (this.alertSprites) this.alertSprites.forEach(s => s.visible = true);
                    if (this._uiManager) {
                        this._uiManager.queueDialogue([
                            { speaker: 'Specialist', text: "This doesn't look good... Patient 21 is deteriorating. I need my keys.", isRadio: false },
                            { speaker: 'Lead Researcher', text: 'Vitals are dropping. Get to your vehicle and head to the launch site NOW!', isRadio: true }
                        ]);
                    }
                    const objEl = document.getElementById('hub-objective');
                    if (objEl) objEl.textContent = 'OBJECTIVE: GET KEYS & ENTER VEHICLE';
                    console.log('SCAN COMPLETE — PATIENT 21');
                }
            }

            // VEHICLE interaction (KEY REQUIRED)
            if (this.vehicleGroup && !this.vehicleEntered) {
                const dist = this.playerContainer.position.distanceTo(this.vehicleGroup.position);
                const isNear = dist < 2.5;
                if (this.vehiclePrompt) {
                    this.vehiclePrompt.visible = isNear;
                    if (isNear) this.vehiclePrompt.lookAt(this.camera.position);
                }
                if (isNear && this.input.interact) {
                    this.input.interact = false;
                    if (!this.hasKeys) {
                        // No keys yet — block entry
                        if (this._uiManager) {
                            this._uiManager.queueDialogue([
                                { speaker: 'Specialist', text: "I need my keys first! Check the radio table.", isRadio: false }
                            ]);
                        }
                    } else {
                        this.vehicleEntered = true;
                        this._triggerVehicleEntry();
                    }
                }
            }

            // KEY PICK-UP
            if (this.keyMesh && !this.hasKeys) {
                const dist = this.playerContainer.position.distanceTo(this.keyMesh.position);
                if (dist < 1.8 && this.input.interact) {
                    this.input.interact = false;
                    this.hasKeys = true;
                    this.scene.remove(this.keyMesh);
                    this.keyMesh = null;
                    if (this._uiManager) {
                        this._uiManager.queueDialogue([
                            { speaker: 'Specialist', text: "Got my keys. Time to go!", isRadio: false }
                        ]);
                    }
                    const objEl = document.getElementById('hub-objective');
                    if (objEl) objEl.textContent = 'OBJECTIVE: ENTER VEHICLE';
                    console.log('KEY ACQUIRED');
                }
            }

            // CLOSET INTERACTION — open Character Select UI
            if (this.closetPos && this.closetPrompt) {
                const dist = this.playerContainer.position.distanceTo(this.closetPos);
                const isNear = dist < 1.5;
                this.closetPrompt.visible = isNear;
                if (isNear) this.closetPrompt.lookAt(this.camera.position);

                if (isNear && this.input.interact && !this._closetOpen) {
                    this.input.interact = false;
                    this._closetOpen = true;

                    // Freeze movement & animations (NOT full isPaused — we still render)
                    this._closetFrozen = true;
                    if (this.mixer) this.mixer.timeScale = 0;

                    // Save camera position so we can restore it on close
                    this._closetCamPos = this.camera.position.clone();

                    // Focus camera on player
                    const pPos = this.playerContainer.position;
                    this.camera.position.set(pPos.x + 2, pPos.y + 1.8, pPos.z + 3);
                    this.camera.lookAt(pPos.x, pPos.y + 1.0, pPos.z);

                    // Unlock mouse pointer so user can click UI
                    document.exitPointerLock();

                    // OPEN the in-game character select overlay
                    if (typeof window.openCharacterSelect === 'function') {
                        window.openCharacterSelect(this._currentModelPath || '/assets/models/pilot_timmy.fbx');
                    }

                    // CONFIRM: swap to selected model, then close
                    window.onCharacterSelected = async (newModelPath) => {
                        try {
                            await this.loadPilot(newModelPath);
                        } catch (e) {
                            console.error('Retargeting crashed:', e);
                        } finally {
                            this._closeCloset();
                            console.log('CLOSET LOCK RELEASED');
                        }
                    };

                    // CANCEL: just close
                    window.onCharacterSelectClosed = () => {
                        this._closeCloset();
                    };

                    console.log('CLOSET INTERACTION — Character Select opened');
                }
            }

            // MISSION TABLE interaction (legacy)
            if (this.missionTable) {
                const dist = this.playerContainer.position.distanceTo(this.missionTable.position);
                const isNear = dist < 3;
                this.promptMesh.visible = isNear;
                this.promptMesh.lookAt(this.camera.position);
                if (isNear && this.input.interact) {
                    console.log('SUCCESS');
                    this.scene.remove(this.missionTable);
                    this.input.interact = false;
                }
            }

            // CAMERA HEARTBEAT: Absolute Loop Bottom
            this.handleCamera();

            // ABSOLUTE END: Run animation mixer updates
            if (this.mixer) {
                this.mixer.update(actualDt);
            }

        } catch (e) {
            console.error("Critical Engine Failure in update():", e);
        }
    }

    _closeCloset() {
        this._closetOpen = false;
        this._closetFrozen = false;
        if (this.mixer) this.mixer.timeScale = this.isPaused ? 0 : 1;
        if (this._closetCamPos) {
            this.camera.position.copy(this._closetCamPos);
            this._closetCamPos = null;
        }
        UIManager.isCharSelectOpen = false;

        // Re-lock mouse pointer to game
        this.renderer.domElement.requestPointerLock();
    }

    // Legacy alias kept for any other callers
    _resumeFromCloset() { this._closeCloset(); }

    _triggerVehicleEntry() {
        // Show dialogue then fade to white
        if (this._uiManager) {
            this._uiManager.queueDialogue([
                { speaker: 'Specialist', text: 'Time to move.', isRadio: false }
            ]);
        }
        // Fade to white overlay
        const fade = document.createElement('div');
        Object.assign(fade.style, {
            position: 'fixed', inset: '0', background: 'white',
            opacity: '0', zIndex: '9999', transition: 'opacity 2s ease',
            pointerEvents: 'none'
        });
        document.body.appendChild(fade);
        // Start fade after dialogue guard (1.2s)
        setTimeout(() => { fade.style.opacity = '1'; }, 1200);
        setTimeout(() => {
            console.log('PHASE 2 COMPLETE - HEADING TO CITY');
        }, 3200);
    }

    // SMOOTH BLEND: fade out all other actions instead of hard-stopping
    _fadeOutOthers(except, duration = 0.2) {
        [this.idleAction, this.runAction, this.floatAction].forEach(action => {
            if (action && action !== except) {
                action.fadeOut(duration);
            }
        });
    }

    // STATE OVERRIDE: smooth entry — target resets to frame 0, others fade out
    _playAction(action, fadeIn = 0.2) {
        if (!action) return;
        this._fadeOutOthers(action, fadeIn);
        action.enabled = true;
        action.setEffectiveTimeScale(1.0);
        // SYNC TRACKS: always reset to ensure animation starts at frame 0
        action.reset().setEffectiveWeight(1).fadeIn(fadeIn).play();
        console.log('TRANSITIONS SMOOTHED');
    }


    handleMovement(dt) {
        if (this.isPaused) return;
        if (this._closetFrozen) return; // Don't move while wardrobe UI is open

        // MOVEMENT LOCK: freeze & idle during dialogue
        if (UIManager.isDialogueActive) {
            if (this.isRunning || this.isJumping) {
                this.isRunning = false;
                this.isJumping = false;
                this.velocityY = 0;
                this._playAction(this.idleAction, 0.2);
            }
            return;
        }

        const speed = 5.0;
        const GRAVITY = -20.0;
        const JUMP_VELOCITY = 8.5; // CEILING PROTECTION: Reduced jump by 15%
        const GROUND_Y = 0.0; // Z-fighting compensation limits base floor

        // JUMP
        if (this.input.jump && this.isOnGround) {
            this.velocityY = JUMP_VELOCITY;
            this.isOnGround = false;
            this.isJumping = true;
            this.isRunning = false;
            this.input.jump = false;
            // STATE OVERRIDE: hard-switch to jump
            this.mixer.stopAllAction();
            if (this.jumpAction) {
                this.jumpAction.setEffectiveWeight(1.0);
                this.jumpAction.setEffectiveTimeScale(1.0);
                this.jumpAction.play();
            } else {
                this._playAction(this.floatAction || this.idleAction, 0.15);
            }
        }

        // Gravity applies strictly if we are airborne
        if (!this.isOnGround) {
            this.velocityY += GRAVITY * dt;
            this.playerContainer.position.y += this.velocityY * dt;
        } else {
            this.velocityY = 0;
        }

        // CAMERA-RELATIVE MOVEMENT
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, forward).normalize();
        const moveDir = new THREE.Vector3();

        if (this.input.forward) moveDir.add(forward);
        if (this.input.backward) moveDir.sub(forward);
        if (this.input.left) moveDir.add(right);
        if (this.input.right) moveDir.sub(right);

        let preX = this.playerContainer.position.x;
        let preZ = this.playerContainer.position.z;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();

            // REVERSE P LAYOUT & DOORWAY FIX
            const r = 0.3; // PLAYER RADIUS
            let nx = preX + (moveDir.x * speed * dt);
            let nz = preZ + (moveDir.z * speed * dt);

            // True rectangles definition (with doorway jump-through header collision)
            const py = this.playerContainer.position.y;
            const inMain = (px, pz) => (px >= -6.0 + r && px <= 6.0 - r) && (pz >= -6.0 + r && pz <= 6.0 - r);
            const inNook = (px, pz) => (px >= -12.0 + r && px <= -6.0 - r) && (pz >= 0.0 + r && pz <= 6.0 - r);
            const inDoor = (px, pz) => (px > -6.0 - r && px < -6.0 + r) && (pz >= 2.0 + r && pz <= 4.0 - r) && py < 1.0;
            const isValidPos = (px, pz) => inMain(px, pz) || inNook(px, pz) || inDoor(px, pz);

            if (isValidPos(nx, nz)) {
                this.playerContainer.position.x = nx;
                this.playerContainer.position.z = nz;
            } else {
                // Try sliding vectors
                if (isValidPos(nx, preZ)) {
                    this.playerContainer.position.x = nx;
                } else if (isValidPos(preX, nz)) {
                    this.playerContainer.position.z = nz;
                }
            }
        }

        const velX = (this.playerContainer.position.x - preX) / Math.max(dt, 0.0001);
        const velZ = (this.playerContainer.position.z - preZ) / Math.max(dt, 0.0001);
        const actualHVel = Math.hypot(velX, velZ);

        // ORIENTATION OFFSET: Explicit velocity vector rotation + 0.2 rad fine-tune
        if (actualHVel > 0.01 && this.playerModel) {
            this.playerModel.rotation.y = Math.atan2(velX, velZ) + 0.2;
        }

        // ANIMATION STATE MACHINE EXECUTOR
        this.updateAnimation(actualHVel);

        // T-POSE FAILSAFE
        if (this.isOnGround && this.idleAction && !this.isRunning) {
            this.idleAction.setEffectiveWeight(1.0);
            this.idleAction.play();
        }
    }

    updateAnimation(speed) {
        if (this.isPaused || !this.mixer) return;

        // VERIFICATION LOG: Ensure movement is firing correctly
        if (speed > 0) console.log("VELOCITY:", speed);

        // EXPLICIT STATE MACHINE
        const STATE_IDLE = 0;
        const STATE_RUN = 1;
        const STATE_JUMP = 2;
        const STATE_FLOAT = 3;

        let newState = STATE_IDLE;
        if (!this.isOnGround) {
            newState = this.isJumping ? STATE_JUMP : STATE_FLOAT;
        } else if (speed > 0.1) {
            newState = STATE_RUN;
        }

        if (this._animState !== newState) {
            this.mixer.stopAllAction(); // Only flush on boundary transition

            // Force reset background weights
            if (this.runAction) this.runAction.setEffectiveWeight(0);
            if (this.idleAction) this.idleAction.setEffectiveWeight(0);
            if (this.jumpAction) this.jumpAction.setEffectiveWeight(0);
            if (this.floatAction) this.floatAction.setEffectiveWeight(0);

            this._animState = newState;

            // Trigger targeted execution
            if (newState === STATE_RUN && this.runAction) {
                this.runAction.setEffectiveWeight(1.0);
                this.runAction.setEffectiveTimeScale(1.5); // TRUE SPRINT OVERRIDE
                this.runAction.play();
            } else if (newState === STATE_IDLE && this.idleAction) {
                this.idleAction.setEffectiveWeight(1.0);
                this.idleAction.setEffectiveTimeScale(1.0);
                this.idleAction.play();
            } else if (newState === STATE_JUMP && this.jumpAction) {
                this.jumpAction.setEffectiveWeight(1.0);
                this.jumpAction.setEffectiveTimeScale(1.0);
                this.jumpAction.play();
            } else if (newState === STATE_FLOAT && this.floatAction) {
                this.floatAction.setEffectiveWeight(1.0);
                this.floatAction.setEffectiveTimeScale(1.0);
                this.floatAction.play();
            }
        } else {
            // ALWAYS enforce 1.0 weight for the active state to crush bleed-through
            if (newState === STATE_RUN && this.runAction) {
                this.runAction.setEffectiveWeight(1.0);
            } else if (newState === STATE_IDLE && this.idleAction) {
                this.idleAction.setEffectiveWeight(1.0);
            }
        }
    }


    handleCamera() {
        if (!this.playerContainer) return; // Prevent Void crash, but do NOT freeze during dialogue or load states

        const player = this.playerContainer.position;
        let radius = Math.max(2.0, 2.5);

        if (this.camera.fov !== 75) {
            this.camera.fov = 75;
            this.camera.updateProjectionMatrix();
        }

        // CLAMP: Prevent camera pitch from flipping character upside down
        // controls.maxPolarAngle approx Math.PI * 0.45 restricts upper hemisphere
        this.cameraPitch = Math.max(-1.2, Math.min(Math.PI * 0.45, this.cameraPitch));

        const pitchNorm = Math.max(-1, Math.min(1, this.cameraPitch / 0.8));
        const targetHeightY = pitchNorm < 0
            ? 1.5 + pitchNorm * (1.5 - 0.5)
            : 1.5 + pitchNorm * (1.8 - 1.5);

        // CEILING SHIELD: Force height to 3.0 if approaching 3.5m roof limit
        let camY = player.y + targetHeightY + Math.sin(this.cameraPitch) * radius;
        if (camY > 3.0) {
            camY = 3.0;
        }

        const x = player.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        const z = player.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;

        // X/Z BOUNDARIES for L-Shape Outpost (Includes Nook Window/North Wall and Lintel bounds)
        let cx = x, cz = z;
        // Basic clamp against outer bounds
        if (cx < -11.8) cx = -11.8;
        if (cx > 5.8) cx = 5.8;
        if (cz < -5.8) cz = -5.8;
        if (cz > 5.8) cz = 5.8;

        // Window-side Nook wall (Camera cannot span across North Nook exterior at z < 0)
        if (cx < -5.8 && cz < 0.2) {
            if (cx - (-5.8) > cz - 0.2) cx = -5.8; else cz = 0.2;
        }

        // Camera cannot phase into the Lintel and Shoulders (Doorway collision array restriction)
        if (cx < -5.8 && cx > -6.2) {
            // Doorway gap is z: 2.0 to 4.0 and y < 2.5
            if (cz < 2.0 || cz > 4.0 || camY >= 2.5) {
                if (cx < -6.0) cx = -6.2; else cx = -5.8;
            }
        }

        this.camera.position.set(cx, Math.max(0.5, camY), cz);
        this.camera.lookAt(player.x, player.y + targetHeightY, player.z);
        if (!this._dfLog) { this._dfLog = true; console.log('DYNAMIC FOCUS & ROOF CLAMP ACTIVE'); }
    }

    setupContainment() {
        this.containmentUnit = new THREE.Group();
        this.containmentUnit.position.set(0, 0, 2);
        this.scanComplete = false;
        this.alertSprites = [];

        // TRANSPARENCY FIX: depthWrite off + high renderOrder so internals always show
        const cylMat = new THREE.MeshStandardMaterial({
            color: 0x00f2ff, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, metalness: 0.1, roughness: 0.0,
            depthWrite: false
        });
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 24, 1, true), cylMat);
        cylinder.position.y = 0.9;
        cylinder.renderOrder = 10;
        this.containmentUnit.add(cylinder);

        // Rim glow rings at top and bottom
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 2 });
        [0, 1.8].forEach(ry => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 32), ringMat);
            ring.position.y = ry; ring.rotation.x = Math.PI / 2;
            this.containmentUnit.add(ring);
        });

        // MEDICAL HOLOGRAM: Simplified Humanoid Outline
        const holoMat = new THREE.MeshLambertMaterial({
            color: 0x00ffcc, transparent: true, opacity: 0.5,
            depthWrite: false, emissive: 0x0088aa
        });

        const addMesh = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
            this.containmentUnit.add(m);
        };

        // HEAD
        addMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), holoMat, 0, 1.6, 0); // Replaced sphere with box for "no spheres"
        // NECK
        addMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.10, 8), holoMat, 0, 1.48, 0);
        // TORSO
        addMesh(new THREE.CylinderGeometry(0.13, 0.11, 0.38, 8), holoMat, 0, 1.18, 0);
        // PELVIS
        addMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), holoMat, 0, 0.88, 0); // Box instead of sphere
        // LEFT ARM
        addMesh(new THREE.CylinderGeometry(0.035, 0.025, 0.4, 6), holoMat, -0.22, 1.15, 0, 0, 0, Math.PI * 0.1);
        // RIGHT ARM
        addMesh(new THREE.CylinderGeometry(0.035, 0.025, 0.4, 6), holoMat, 0.22, 1.15, 0, 0, 0, -Math.PI * 0.1);
        // LEFT LEG
        addMesh(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 6), holoMat, -0.07, 0.55, 0);
        // RIGHT LEG
        addMesh(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 6), holoMat, 0.07, 0.55, 0);

        console.log('SURGICAL PRECISION APPLIED');

        // ALERT SYSTEM: '!' sprites hidden until scan
        const ac = document.createElement('canvas'); ac.width = 64; ac.height = 64;
        const ax = ac.getContext('2d');
        ax.fillStyle = '#ff3300'; ax.font = 'bold 52px sans-serif';
        ax.textAlign = 'center'; ax.textBaseline = 'middle'; ax.fillText('!', 32, 32);
        const alertTex = new THREE.CanvasTexture(ac);
        [[0.3, 1.6, 0], [-0.3, 1.2, 0.2], [0.1, 0.75, -0.2]].forEach(pos => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTex, color: 0xff3300 }));
            s.scale.set(0.25, 0.25, 0.25);
            s.position.set(...pos); s.visible = false;
            this.containmentUnit.add(s);
            this.alertSprites.push(s);
        });

        // [E] Scan prompt
        const pc = document.createElement('canvas'); pc.width = 256; pc.height = 64;
        const px = pc.getContext('2d');
        px.fillStyle = '#00f2ff'; px.font = 'bold 26px Courier';
        px.textAlign = 'center'; px.fillText('[E] SCAN SUBJECT', 128, 42);
        this.containmentPrompt = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.3),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthTest: false })
        );
        this.containmentPrompt.position.set(0, 2.3, 0); this.containmentPrompt.visible = false;
        this.containmentUnit.add(this.containmentPrompt);

        this.scene.add(this.containmentUnit);
    }
}

console.log('LAB ENVIRONMENT STABILIZED');
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RocketInteriorStage {
    constructor(scene, camera, renderer, gameStateManager) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.gameStateManager = gameStateManager;

        this.player = null;
        this.mixer = null;
        this.animations = {};

        this.cockpitGroup = new THREE.Group();
    }

    async init() {
        console.log("Entering Science Lab Interior...");

        // --- 1. THE FADE ---
        const overlay = document.getElementById('fade-overlay');
        if (overlay) {
            overlay.style.opacity = '1';
            setTimeout(() => overlay.style.opacity = '0', 1000);
        }

        this.setupEnvironment();
        this.setupLights();
        this.loadCharacter();
        this.createScientificModules();
        this.loadSpaceshipInterior(); // Try loading GLB interior
        this.setupSubtitles();

        // Cinematic Camera Position (Follow player)
        this.camera.position.set(0, 1.2, 7);
        this.camera.lookAt(0, 0, -10);

        this.scene.add(this.cockpitGroup);

        // Start Briefing
        setTimeout(() => this.playMissionBriefing(), 1500);
    }

    setupEnvironment() {
        // --- 1. OCTAGONAL CORRIDOR HULL (Authentic Scale) ---
        const hullGeo = new THREE.CylinderGeometry(2.5, 2.5, 30, 8, 1, true);
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.BackSide
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.rotation.x = Math.PI / 2;
        hull.rotation.y = Math.PI / 8; // Align flat side to floor
        this.cockpitGroup.add(hull);

        // --- 3. FAR AIRLOCK HATCH ---
        const hatchGrp = new THREE.Group();
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 16, 32), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        const door = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.5 }));
        const handle = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        handle.position.z = 0.1;
        hatchGrp.add(rim); hatchGrp.add(door); hatchGrp.add(handle);
        hatchGrp.position.set(0, 0, -14.8);
        this.cockpitGroup.add(hatchGrp);
    }

    loadSpaceshipInterior() {
        // Try to load a Sketchfab spaceship interior GLB (user manually downloaded)
        const gltfLoader = new GLTFLoader();
        const interiorPaths = [
            '/assets/models/glb/spaceship_interior.glb',  // User-provided Sketchfab model
            '/assets/models/glb/cockpit.glb'              // Alternative interior model
        ];

        const tryLoad = (index) => {
            if (index >= interiorPaths.length) {
                console.log("No custom spaceship interior GLB found, using procedural interior");
                return;
            }
            gltfLoader.load(interiorPaths[index], (gltf) => {
                const interiorModel = gltf.scene;

                // Auto-scale to fit inside the corridor (~5 units wide, ~4 units tall)
                const box = new THREE.Box3().setFromObject(interiorModel);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetSize = 4.0; // Fit within corridor
                const s = targetSize / maxDim;
                interiorModel.scale.set(s, s, s);

                // Center inside the corridor
                const box2 = new THREE.Box3().setFromObject(interiorModel);
                const center = box2.getCenter(new THREE.Vector3());
                interiorModel.position.set(-center.x, -box2.min.y - 1.5, -center.z);

                interiorModel.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                this.cockpitGroup.add(interiorModel);
                console.log("✅ Spaceship interior GLB loaded:", interiorPaths[index]);
            }, undefined, () => {
                tryLoad(index + 1);
            });
        };
        tryLoad(0);
    }

    createScientificModules() {
        // --- MATERIALS ---
        const moduleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
        const blueRailMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.8, roughness: 0.2 });
        const bagMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.9 });
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3b82f6, emissiveIntensity: 0.5 });

        // 1. MODULAR PANELS & GREEBLES
        for (let i = 0; i < 12; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const zP = -12 + (Math.floor(i / 2) * 4);

            // Base Panel
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.4), moduleMat);
            m.position.set(side * 2.15, 0, zP); // Tiny offset from wall (2.1 -> 2.15) to prevent z-fighting
            m.rotation.y = side * -Math.PI / 2;
            m.castShadow = true;
            m.receiveShadow = true;
            this.cockpitGroup.add(m);

            // Add some "Scientific Buttons/Greebles"
            if (i % 3 === 0) {
                // Button Panel
                const bnl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
                bnl.position.set(side * 1.98, 0.3, zP);
                this.cockpitGroup.add(bnl);

                // Glowing Status Lights
                const led = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2 }));
                led.position.set(side * 1.85, 0.5, zP + 0.1);
                this.cockpitGroup.add(led);
            } else if (i % 3 === 1) {
                // Workstation Laptop
                const laptop = new THREE.Group();
                const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0x334155 }));
                const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), screenMat);
                screen.position.set(0, 0.2, -0.15);
                screen.rotation.x = -0.2;
                laptop.add(base); laptop.add(screen);
                laptop.position.set(side * 1.8, -0.2, zP);
                laptop.rotation.y = side * Math.PI / 2;
                this.cockpitGroup.add(laptop);

                // Keyboard Glow
                const kGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 1, transparent: true, opacity: 0.5 }));
                kGlow.rotation.x = -Math.PI / 2;
                kGlow.position.set(side * 1.8, -0.17, zP);
                this.cockpitGroup.add(kGlow);
            } else {
                // Storage Bag / Utility Pack
                const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.4), bagMat);
                bag.position.set(side * 1.9, -0.8, zP);
                // Straps
                const strap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.42), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
                strap.position.set(side * 1.9, -0.8, zP);
                this.cockpitGroup.add(bag); this.cockpitGroup.add(strap);
            }
        }

        // 2. BLUE HANDRAILS (ISS STYLE)
        for (let k = 0; k < 6; k++) {
            const zP = -12 + k * 5;
            // Vertical rails
            [-1.8, 1.8].forEach(x => {
                const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5), blueRailMat);
                rail.position.set(x, 0.5, zP);
                this.cockpitGroup.add(rail);
            });
            // Horizontal rails (Ceiling)
            const hRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.6), blueRailMat);
            hRail.rotation.z = Math.PI / 2;
            hRail.position.set(0, 2.2, zP);
            this.cockpitGroup.add(hRail);
        }

        // 3. CEILING STORAGE BAGS (Dense Cargo Look)
        for (let j = 0; j < 8; j++) {
            const zP = -14 + j * 4;
            const side = (j % 2 === 0 ? 0.6 : -0.6);
            const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), bagMat);
            cargo.position.set(side, 2.3, zP);
            this.cockpitGroup.add(cargo);
        }

        // 4. TUBULAR CEILING LIGHTS
        for (let l = 0; l < 5; l++) {
            const lGeo = new THREE.CylinderGeometry(0.08, 0.08, 4);
            const lMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 });
            const light = new THREE.Mesh(lGeo, lMat);
            light.rotation.z = Math.PI / 2;
            light.position.set(0, 2.4, -12 + l * 6);
            this.cockpitGroup.add(light);
        }

        // 5. WIRING BUNDLES
        const wireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        for (let w = 0; w < 4; w++) {
            const xP = w % 2 === 0 ? 1.9 : -1.9;
            const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30), wireMat);
            wire.rotation.x = Math.PI / 2;
            wire.position.set(xP, 2.1, 0);
            this.cockpitGroup.add(wire);
        }
    }

    setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55)); // Balanced boost
        const dL = new THREE.DirectionalLight(0xffffff, 1.0); // Balanced boost
        dL.position.set(0, 5, 5);
        dL.castShadow = true;
        dL.shadow.mapSize.width = 1024;
        dL.shadow.mapSize.height = 1024;
        dL.shadow.camera.near = 0.5;
        dL.shadow.camera.far = 20;
        this.scene.add(dL);

        // Highlight Player (Rim Light)
        const rim = new THREE.PointLight(0x60a5fa, 1.8, 10);
        rim.position.set(0, 1, 5);
        this.scene.add(rim);

        // Soft internal glow
        const fill = new THREE.PointLight(0x3b82f6, 0.4, 15);
        fill.position.set(0, 0, 0);
        this.scene.add(fill);
    }

    loadCharacter() {
        const fbxL = new FBXLoader();
        fbxL.load('/assets/models/Idle.fbx', (object) => {
            this.player = object;
            this.player.scale.set(0.018, 0.018, 0.018);
            this.scene.add(this.player);

            // --- STANDING POSE (Further into spaceship) ---
            this.player.position.set(0, -2.3, -4);
            this.player.rotation.y = Math.PI; // Face the hatch
            this.player.traverse(c => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
            });

            this.mixer = new THREE.AnimationMixer(this.player);
            const idle = this.mixer.clipAction(object.animations[0]);
            idle.play();
        });
    }

    setupSubtitles() {
        let box = document.getElementById('briefing-subtitles');
        if (!box) {
            box = document.createElement('div');
            box.id = 'briefing-subtitles';
            Object.assign(box.style, {
                position: 'fixed', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
                width: '70%', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '20px',
                borderRadius: '10px', fontSize: '24px', textAlign: 'center', fontFamily: 'Orbitron, sans-serif',
                border: '2px solid #3b82f6', display: 'none', zIndex: '2000'
            });
            document.body.appendChild(box);
        }
        this.subtitleBox = box;

        // Countdown Display
        let count = document.getElementById('briefing-countdown');
        if (!count) {
            count = document.createElement('div');
            count.id = 'briefing-countdown';
            Object.assign(count.style, {
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                fontSize: '180px', fontWeight: 'bold', color: '#3b82f6',
                fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 40px #3b82f6',
                display: 'none', zIndex: '2001'
            });
            document.body.appendChild(count);
        }
        this.countdownDisplay = count;
    }

    playMissionBriefing() {
        if (!window.speechSynthesis) return;
        this.subtitleBox.style.display = 'block';

        const lines = [
            "Welcome Commander. You have entered the main scientific bay of the SPARC Explorer.",
            "Our objective today is unprecedented: the exploration of the human body at a microscopic level.",
            "In a few moments, the miniaturization sequence will begin, shrinking us to the size of a white blood cell.",
            "We will then enter the circulatory system to observe biological functions in real-time.",
            "Prepare yourself. The transition will be intense. We begin in T-minus ten seconds."
        ];

        let index = 0;
        const speakNext = () => {
            if (index >= lines.length) {
                setTimeout(() => {
                    this.subtitleBox.style.display = 'none';
                    this.startCountdown();
                }, 1000);
                return;
            }

            const text = lines[index];
            this.subtitleBox.innerText = text;
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.0; utter.pitch = 0.95;
            utter.onend = () => {
                index++;
                setTimeout(speakNext, 500);
            };
            window.speechSynthesis.speak(utter);
        };

        speakNext();
    }

    startCountdown() {
        this.countdownDisplay.style.display = 'block';
        let count = 10;

        const nextCount = () => {
            this.countdownDisplay.innerText = count;

            // Sound effect if available
            if (this.sounds && this.sounds['chime']) this.sounds['chime'].play();

            if (count === 0) {
                this.countdownDisplay.innerText = "LAUNCH";
                setTimeout(() => {
                    this.countdownDisplay.style.display = 'none';
                    // Transition back to Exterior for takeoff
                    if (this.gameStateManager) {
                        this.gameStateManager.transitionTo('EXTERIOR', { mode: 'TAKEOFF' });
                    }
                }, 1000);
                return;
            }

            count--;
            setTimeout(nextCount, 1000);
        };

        nextCount();
    }

    update(delta) {
        if (this.mixer) this.mixer.update(delta);

        // Very subtle drift (zero-G feel)
        this.cockpitGroup.position.y = Math.sin(Date.now() * 0.002) * 0.05;
        if (this.player) {
            this.player.position.y = -2.3 + Math.sin(Date.now() * 0.001) * 0.04;
        }
    }

    cleanup() {
        console.log("Cleaning up Rocket Interior...");
        while (this.scene.children.length > 0) { this.scene.remove(this.scene.children[0]); }
    }
}

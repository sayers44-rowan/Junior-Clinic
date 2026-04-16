import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

export const globalManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const _gltfLoader = new GLTFLoader(globalManager);
_gltfLoader.setDRACOLoader(dracoLoader);

const lightingPresets = {
    'Preset 1': { ambientInt: 2.745, sunInt: 2.3, sunX: -27, sunY: 24.6, sunZ: 19.7 },
    'Preset 2': { ambientInt: 2.38, sunInt: 1.93, sunX: 30.7, sunY: -9.8, sunZ: -34.4 },
    'Preset 3': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 8.6, sunZ: -11.1 },
    'Preset 4': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 9.8, sunZ: -11 },
    'Preset 5': { ambientInt: 1.085, sunInt: 3.77, sunX: -3.7, sunY: 7.4, sunZ: -7.4 },
    'Custom': {}
};

export class GameStage {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;

        this.clock = new THREE.Clock();
        this.isPaused = false;
        this.cursorUnlocked = false;

        this.playerContainer = new THREE.Group();
        this.input = { forward: false, backward: false, left: false, right: false };
        this.mixer = null;
        this.playerModel = null;
        this.cameraAngle = 0;
        this.cameraPitch = 0.1;
        this.velocityY = 0;
        this.isOnGround = true;
        this.mapReady = false;
        this._cullFrameCount = 0;
        this._lastMoveAngle = 0;

        this._mapParams = { x: 3.60, y: 0.09, z: 65.00 };

        this._lightParams = {
            activePreset: 'Preset 1',
            ambientInt: 2.745,
            sunInt: 2.3,
            sunX: -27, sunY: 24.6, sunZ: 19.7
        };

        this._camParams = { radius: 2.5, heightOffset: 1.4, pitchOffset: 1.0 };
        this._charParams = {
            rotationOffset: 0,
            idleRotationOffset: 0,
            moveSpeed: 6.5,
            animSpeed: 1.0,
            armX: 0, armY: 0, armZ: 0
        };

        this._skyParams = { intensity: 1.0, tint: '#ffffff' };
        this.skyMaterials = [];

        // ADDED: Dedicated parameters for the dust simulation
        this._vfxParams = {
            dustSize: 0.18,
            dustOpacity: 0.39,
            dustSpeed: 5.0
        };

        this._injectPauseUIStyles();
        this.init();
    }

    _injectPauseUIStyles() {
        const style = document.createElement('style');
        style.innerText = `
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&display=swap');
            #pause-overlay {
                background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 100%) !important;
                backdrop-filter: blur(6px);
                font-family: 'Fredoka', sans-serif !important;
                display: none; flex-direction: column; justify-content: center; align-items: center;
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999;
            }
            #pause-overlay h1 {
                color: #fff; font-size: 4rem; text-shadow: 0 4px 15px rgba(0,0,0,1); margin-bottom: 40px; letter-spacing: 8px; font-weight: 700; text-transform: uppercase;
            }
            #resume-btn {
                background: transparent !important; color: #fff !important; border: 2px solid rgba(255,255,255,0.6) !important;
                padding: 15px 60px !important; font-size: 1.3rem !important; font-weight: bold !important; cursor: pointer;
                border-radius: 4px; letter-spacing: 5px; transition: all 0.2s ease; text-transform: uppercase;
                text-shadow: 0 2px 5px rgba(0,0,0,0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important; outline: none;
            }
            #resume-btn:hover {
                background: rgba(255,255,255,1) !important; color: #000 !important;
                box-shadow: 0 0 25px rgba(255,255,255,0.6) !important; border-color: #ffffff !important; text-shadow: none; transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.scene.clear();
        this.scene.add(this.playerContainer);
        this.scene.background = new THREE.Color('#333333');

        this.playerContainer.position.set(0, 1.5, 0);
        this.camera.position.set(0, 1.5, 10);

        this.setupLights();
        this._setupDustVFX();
        this._loadSkybox();
        this._loadDesertMap();
        this._loadVan();
        this.setupInput();
        this._buildDebugGUI();

        this.camera.near = 0.1;
        this.camera.far = 15000;
        this.camera.updateProjectionMatrix();

        const floorGeo = new THREE.PlaneGeometry(10000, 10000);
        this.groundMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ visible: false }));
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.groundMesh);

        const pilotName = (localStorage.getItem('selectedPilot') || 'timmy').toLowerCase();
        const pilotPath = `/assets/models/pilot_${pilotName}.fbx`;
        await this.loadPilot(pilotPath);
    }

    _setupDustVFX() {
        this.dustCount = 250; // Extremely sparse and subtle

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.dustCount * 3);
        const velocities = new Float32Array(this.dustCount * 3);

        for (let i = 0; i < this.dustCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

            // FIXED: Generates random positive AND negative drift for all axes
            velocities[i * 3] = (Math.random() - 0.5) * 0.8;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(237, 204, 168, 1)');
        gradient.addColorStop(0.5, 'rgba(237, 204, 168, 0.5)');
        gradient.addColorStop(1, 'rgba(237, 204, 168, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 16, 16);

        const texture = new THREE.CanvasTexture(canvas);

        const material = new THREE.PointsMaterial({
            color: 0xedcca8,
            size: this._vfxParams.dustSize,
            map: texture,
            transparent: true,
            opacity: this._vfxParams.dustOpacity,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        this.dustParticles = new THREE.Points(geometry, material);
        this.scene.add(this.dustParticles);
    }

    _loadSkybox() {
        _gltfLoader.load('/assets/models/skybox_skydays_3.glb', (gltf) => {
            const skyboxModel = gltf.scene;
            skyboxModel.scale.set(0.0002, 0.0002, 0.0002);
            skyboxModel.position.set(0, 0, 0);

            skyboxModel.traverse(child => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.renderOrder = -1;

                    if (child.material) {
                        child.material.side = THREE.DoubleSide;
                        child.material.depthWrite = false;
                        child.material.fog = false;
                        child.material.emissive = new THREE.Color(this._skyParams.tint);
                        child.material.emissiveIntensity = this._skyParams.intensity;

                        if (child.material.map) {
                            child.material.emissiveMap = child.material.map;
                        }

                        const tex = child.material.map || child.material.emissiveMap;
                        if (tex) {
                            tex.colorSpace = THREE.SRGBColorSpace;
                            tex.generateMipmaps = false;
                            tex.minFilter = THREE.LinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.needsUpdate = true;
                        }

                        this.skyMaterials.push(child.material);
                    }
                }
            });
            this.skybox = skyboxModel;
            this.scene.add(skyboxModel);
        });
    }

    _loadDesertMap() {
        _gltfLoader.load('/assets/models/desert_landscape.glb', (gltf) => {
            const map = gltf.scene;
            map.position.set(this._mapParams.x, this._mapParams.y, this._mapParams.z);
            map.traverse(child => {
                if (child.isMesh) {
                    child.receiveShadow = true;
                    child.castShadow = true;
                }
            });
            this.mapGroup = map;
            this.scene.add(map);
            this.mapReady = true;
        });
    }

    _loadVan() {
        _gltfLoader.load('/assets/models/van.glb', (gltf) => {
            const van = gltf.scene;
            van.scale.set(0.67, 0.67, 0.67);
            van.position.set(1.6, 0.18, 1.5);
            van.rotation.set(0, 1.0807, 0);
            van.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(van);
        });
    }

    _buildDebugGUI() {
        try {
            this.gui = new GUI({ title: 'Engine Controls' });

            const camFolder = this.gui.addFolder('Camera Controls');
            camFolder.add(this._camParams, 'radius', 2, 3, 0.05).name('Zoom (Radius)').listen();
            camFolder.add(this._camParams, 'heightOffset', 0, 5, 0.1).name('Camera Height').listen();
            camFolder.add(this._camParams, 'pitchOffset', 0, 5, 0.1).name('Target Height').listen();

            const charFolder = this.gui.addFolder('Character Tuning');
            charFolder.add(this._charParams, 'rotationOffset', -Math.PI, Math.PI, 0.01).name('Run Rotation Offset').listen();
            charFolder.add(this._charParams, 'idleRotationOffset', -Math.PI, Math.PI, 0.01).name('Idle Rotation Offset').listen();
            charFolder.add(this._charParams, 'moveSpeed', 1, 15, 0.1).name('Movement Speed').listen();
            charFolder.add(this._charParams, 'animSpeed', 0.1, 3, 0.05).name('Run Anim Speed').onChange(v => {
                if (this.runAction) this.runAction.timeScale = v;
            }).listen();

            charFolder.add(this._charParams, 'armX', -1.5, 1.5, 0.01).name('Arm Flare (X)').listen();
            charFolder.add(this._charParams, 'armY', -1.5, 1.5, 0.01).name('Arm Flare (Y)').listen();
            charFolder.add(this._charParams, 'armZ', -1.5, 1.5, 0.01).name('Arm Flare (Z)').listen();

            const mapFolder = this.gui.addFolder('Map Transform');
            const range = { min: -2000, max: 2000, step: 0.01 };
            mapFolder.add(this._mapParams, 'x', range.min, range.max, range.step).name('Map X').onChange(v => { if (this.mapGroup) this.mapGroup.position.x = v; });
            mapFolder.add(this._mapParams, 'y', range.min, range.max, range.step).name('Map Y').onChange(v => { if (this.mapGroup) this.mapGroup.position.y = v; });
            mapFolder.add(this._mapParams, 'z', range.min, range.max, range.step).name('Map Z').onChange(v => { if (this.mapGroup) this.mapGroup.position.z = v; });

            const lightFolder = this.gui.addFolder('Lighting Tweaks');
            lightFolder.add(this._lightParams, 'activePreset', Object.keys(lightingPresets)).name('Preset').onChange(presetName => {
                if (presetName !== 'Custom') {
                    const p = lightingPresets[presetName];
                    this._lightParams.ambientInt = p.ambientInt;
                    this._lightParams.sunInt = p.sunInt;
                    this._lightParams.sunX = p.sunX;
                    this._lightParams.sunY = p.sunY;
                    this._lightParams.sunZ = p.sunZ;
                    this.ambientLight.intensity = p.ambientInt;
                    this.sunLight.intensity = p.sunInt;
                }
            });
            lightFolder.add(this._lightParams, 'ambientInt', 0, 5).name('Ambient Power').listen().onChange(v => { this.ambientLight.intensity = v; });
            lightFolder.add(this._lightParams, 'sunInt', 0, 10).name('Sun Power').listen().onChange(v => { this.sunLight.intensity = v; });
            lightFolder.add(this._lightParams, 'sunX', -50, 50).name('Sun X').listen();
            lightFolder.add(this._lightParams, 'sunY', -50, 50).name('Sun Y').listen();
            lightFolder.add(this._lightParams, 'sunZ', -50, 50).name('Sun Z').listen();

            const skyFolder = this.gui.addFolder('Skybox Tuning');
            skyFolder.add(this._skyParams, 'intensity', 0, 2, 0.01).name('Sky Brightness').onChange(v => {
                this.skyMaterials.forEach(m => m.emissiveIntensity = v);
            });
            skyFolder.addColor(this._skyParams, 'tint').name('Sky Tint').onChange(v => {
                this.skyMaterials.forEach(m => m.emissive.set(v));
            });

            // ADDED: Real-time manipulation for the dust particles
            const vfxFolder = this.gui.addFolder('VFX Tuning');
            vfxFolder.add(this._vfxParams, 'dustSize', 0.01, 1.0, 0.01).name('Dust Size').onChange(v => {
                if (this.dustParticles) this.dustParticles.material.size = v;
            });
            vfxFolder.add(this._vfxParams, 'dustOpacity', 0.0, 1.0, 0.01).name('Dust Opacity').onChange(v => {
                if (this.dustParticles) this.dustParticles.material.opacity = v;
            });
            vfxFolder.add(this._vfxParams, 'dustSpeed', 0.0, 5.0, 0.1).name('Dust Speed');

        } catch (e) {
            console.warn('lil-gui not available:', e);
        }
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffeedd, this._lightParams.ambientInt);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaeb, this._lightParams.sunInt);
        this.sunLight.castShadow = true;

        this.sunLight.shadow.mapSize.set(4096, 4096);
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 150;
        this.sunLight.shadow.camera.left = -15;
        this.sunLight.shadow.camera.right = 15;
        this.sunLight.shadow.camera.top = 15;
        this.sunLight.shadow.camera.bottom = -15;
        this.sunLight.shadow.bias = -0.0005;

        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);
    }

    async loadPilot(modelPath) {
        const path = modelPath || '/assets/models/pilot_timmy.fbx';
        const charId = path.split('_')[1].split('.')[0].toLowerCase();

        this._charParams.rotationOffset = 0;
        this._charParams.idleRotationOffset = 0;
        this._charParams.moveSpeed = 6.5;
        this._charParams.animSpeed = 1.0;
        this._charParams.armX = 0;
        this._charParams.armY = 0;
        this._charParams.armZ = 0;

        if (charId === 'timmy') {
            this._charParams.idleRotationOffset = 0.23;
            this._charParams.moveSpeed = 4;
        } else if (charId === 'ami') {
            this._charParams.moveSpeed = 3.5;
            this._charParams.armX = 0.11;
            this._charParams.armY = 0.22;
            this._charParams.armZ = 0.04;
        } else if (charId === 'bryce') {
            this._charParams.moveSpeed = 4.2;
            this._charParams.animSpeed = 0.85;
        } else if (charId === 'adam') {
            this._charParams.moveSpeed = 4.5;
            this._charParams.animSpeed = 0.95;
        } else if (charId === 'jackie') {
            this._charParams.moveSpeed = 4.4;
            this._charParams.animSpeed = 0.9;
        } else if (charId === 'michelle') {
            this._charParams.moveSpeed = 4.9;
            this._charParams.armX = 0.22;
            this._charParams.armY = 0.07;
            this._charParams.armZ = 0.18;
        }

        if (this.gui) {
            this.gui.controllersRecursive().forEach(c => c.updateDisplay());
        }

        if (this.pilot) this.playerContainer.remove(this.pilot);
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }

        return new Promise((resolve, reject) => {
            const loader = new FBXLoader(globalManager);
            loader.load(path, (fbx) => {
                fbx.scale.set(0.009, 0.009, 0.009);

                const xOffset = (charId === 'jackie' || charId === 'michelle') ? 0.15 : 0;
                fbx.position.set(xOffset, 0, 0);
                fbx.rotation.set(0, 0, 0);

                this._forceModelVisibility(fbx);

                this._leftArm = null;
                this._rightArm = null;
                fbx.traverse(child => {
                    if (child.isBone) {
                        const pureName = child.name.replace(/^.*[:_]/, '').replace(/^mixamorig/i, '').toLowerCase();
                        if (pureName === 'leftarm') this._leftArm = child;
                        if (pureName === 'rightarm') this._rightArm = child;
                    }
                });

                this.pilot = fbx;
                this.playerModel = fbx;
                this.playerContainer.add(fbx);

                this._setupAnims(fbx);
                resolve(fbx);
            });
        });
    }

    _forceModelVisibility(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = false;

                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    const newMats = [];

                    mats.forEach(m => {
                        const matName = m.name ? m.name.toLowerCase() : '';
                        const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator');
                        const isHair = matName.includes('hair') || matName.includes('beard') || matName.includes('mustache') || matName.includes('lash') || matName.includes('brow') || matName.includes('translucent');

                        let newMat = new THREE.MeshStandardMaterial({
                            name: m.name,
                            color: m.color || 0xffffff,
                            map: m.map || null,
                            normalMap: m.normalMap || null,
                            roughness: 0.8,
                            metalness: 0.1,
                            side: THREE.DoubleSide
                        });

                        if (isGlass) {
                            newMat.transparent = true;
                            newMat.opacity = 0.65;
                            newMat.depthWrite = false;
                            newMat.color.setHex(0x111111);
                        } else if (isHair) {
                            newMat.transparent = false;
                            newMat.depthWrite = true;
                            newMat.alphaTest = 0.4;
                        } else {
                            newMat.transparent = false;
                            newMat.depthWrite = true;
                            if (newMat.map) {
                                newMat.alphaTest = 0.5;
                            }
                        }

                        newMats.push(newMat);
                    });

                    child.material = newMats.length === 1 ? newMats[0] : newMats;
                }
            }
        });
    }

    _retargetAnimation(clip, targetModel, isExternal = false) {
        clip.tracks = clip.tracks.filter(t => !t.name.includes('.scale'));

        let prefix = '';
        let targetRestY = 0;

        targetModel.traverse(child => {
            if (child.isBone && !prefix) {
                const match = child.name.match(/(.*)Hips/i);
                if (match) {
                    prefix = match[1];
                    targetRestY = child.position.y;
                }
            }
        });

        let coreBones = [
            'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End',
            'LeftShoulder', 'LeftArm', 'LeftForeArm',
            'RightShoulder', 'RightArm', 'RightForeArm',
            'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'LeftToe_End',
            'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'RightToe_End'
        ];

        if (!isExternal) {
            coreBones.push(
                'LeftHand', 'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3', 'LeftHandThumb4',
                'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3', 'LeftHandIndex4',
                'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3', 'LeftHandMiddle4',
                'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3', 'LeftHandRing4',
                'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3', 'LeftHandPinky4',
                'RightHand', 'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3', 'RightHandThumb4',
                'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3', 'RightHandIndex4',
                'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3', 'RightHandMiddle4',
                'RightHandRing1', 'RightHandRing2', 'RightHandRing3', 'RightHandRing4',
                'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3', 'RightHandPinky4'
            );
        }

        coreBones.sort((a, b) => b.length - a.length);

        const newTracks = [];

        clip.tracks.forEach(track => {
            const parts = track.name.split('.');
            const property = parts[1];

            const coreBone = coreBones.find(b => track.name.includes(b));
            if (coreBone) {
                if (property === 'position' && coreBone !== 'Hips') {
                    return;
                }

                const newTrack = track.clone();
                newTrack.name = `${prefix}${coreBone}.${property}`;

                if (property === 'position' && coreBone === 'Hips' && isExternal) {
                    const sourceFirstFrameY = newTrack.values[1];
                    const yOffset = targetRestY - sourceFirstFrameY;

                    for (let i = 1; i < newTrack.values.length; i += 3) {
                        newTrack.values[i] += yOffset;
                    }
                }

                newTracks.push(newTrack);
            }
        });

        clip.tracks = newTracks;
        return clip;
    }

    _setupAnims(fbx) {
        this.mixer = new THREE.AnimationMixer(fbx);

        if (fbx.animations && fbx.animations.length > 0) {
            const idleClip = this._retargetAnimation(fbx.animations[0].clone(), fbx, false);
            this.idleAction = this.mixer.clipAction(idleClip);
            this.idleAction.play();
            this.currentAction = this.idleAction;
        }

        const loader = new FBXLoader(globalManager);
        loader.load('/assets/models/Running.fbx', (anim) => {
            if (anim.animations && anim.animations.length > 0) {
                const runClip = this._retargetAnimation(anim.animations[0].clone(), fbx, true);
                this.runAction = this.mixer.clipAction(runClip);
                this.runAction.timeScale = this._charParams.animSpeed;
            }
        });

        loader.load('/assets/models/Floating.fbx', (anim) => {
            if (anim.animations && anim.animations.length > 0) {
                const floatClip = this._retargetAnimation(anim.animations[0].clone(), fbx, true);
                this.floatAction = this.mixer.clipAction(floatClip);
            }
        });
    }

    update(dt) {
        if (this.isPaused) return;

        const actualDt = Math.min(dt || this.clock.getDelta(), 0.1);

        if (this.skybox) {
            this.skybox.position.copy(this.camera.position);
            this.skybox.rotation.y += 0.005 * actualDt;
        }

        if (this.sunLight && this.playerContainer) {
            this.sunLight.position.set(
                this.playerContainer.position.x + this._lightParams.sunX,
                this.playerContainer.position.y + this._lightParams.sunY,
                this.playerContainer.position.z + this._lightParams.sunZ
            );
            this.sunLight.target.position.copy(this.playerContainer.position);
        }

        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            const velocities = this.dustParticles.geometry.attributes.velocity.array;
            const camPos = this.camera.position;
            const speedMult = this._vfxParams.dustSpeed;

            for (let i = 0; i < this.dustCount; i++) {
                // Apply randomized directional drift multiplied by your GUI speed slider
                positions[i * 3] -= velocities[i * 3] * actualDt * speedMult;
                positions[i * 3 + 1] -= velocities[i * 3 + 1] * actualDt * speedMult;
                positions[i * 3 + 2] -= velocities[i * 3 + 2] * actualDt * speedMult;

                if (positions[i * 3] < camPos.x - 50) positions[i * 3] += 100;
                if (positions[i * 3] > camPos.x + 50) positions[i * 3] -= 100;

                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] += 15;
                if (positions[i * 3 + 1] > 15) positions[i * 3 + 1] -= 15;

                if (positions[i * 3 + 2] < camPos.z - 50) positions[i * 3 + 2] += 100;
                if (positions[i * 3 + 2] > camPos.z + 50) positions[i * 3 + 2] -= 100;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }

        if (this.playerContainer && this.mapReady) {
            const rayOrigin = this.playerContainer.position.clone().add(new THREE.Vector3(0, 1, 0));
            const targets = [this.groundMesh, this.mapGroup].filter(Boolean);
            const hits = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 200)
                .intersectObjects(targets, true);

            if (hits.length > 0) {
                const groundY = hits[0].point.y;
                if (this.playerContainer.position.y <= groundY + 1.2) {
                    this.playerContainer.position.y = THREE.MathUtils.lerp(
                        this.playerContainer.position.y, groundY, 0.25
                    );
                    this.velocityY = 0;
                    this.isOnGround = true;
                } else {
                    this.isOnGround = false;
                }
            } else {
                this.isOnGround = false;
            }

            if (!this.isOnGround && this.mapReady) {
                this.velocityY -= 28 * actualDt;
                this.playerContainer.position.y += this.velocityY * actualDt;
            }
        }

        if (!this.cursorUnlocked) {
            this.handleMovement(actualDt);
        } else {
            if (this.playerModel && this._lastMoveAngle !== undefined) {
                this.playerModel.rotation.y = this._lastMoveAngle + this._charParams.idleRotationOffset;
            }
            if (this.isOnGround) this._playAction(this.idleAction);
        }

        this.handleCamera();

        if (this.mixer) this.mixer.update(actualDt);

        if (this.currentAction === this.runAction && (this._charParams.armX !== 0 || this._charParams.armY !== 0 || this._charParams.armZ !== 0)) {
            if (this._leftArm) {
                this._leftArm.rotateX(this._charParams.armX);
                this._leftArm.rotateY(this._charParams.armY);
                this._leftArm.rotateZ(this._charParams.armZ);
            }
            if (this._rightArm) {
                this._rightArm.rotateX(this._charParams.armX);
                this._rightArm.rotateY(-this._charParams.armY);
                this._rightArm.rotateZ(-this._charParams.armZ);
            }
        }

        this._cullFrameCount++;
        if (this.mapGroup && this._cullFrameCount % 15 === 0) {
            const cullDistSq = 900 * 900;
            const playerPos = this.playerContainer.position;
            const tempVec = new THREE.Vector3();
            this.mapGroup.children.forEach(child => {
                child.getWorldPosition(tempVec);
                child.visible = playerPos.distanceToSquared(tempVec) < cullDistSq;
            });
        }
    }

    handleMovement(dt) {
        const speed = this._charParams.moveSpeed;
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
            if (this.playerModel) {
                this._lastMoveAngle = Math.atan2(moveDir.x, moveDir.z);
                this.playerModel.rotation.y = this._lastMoveAngle + this._charParams.rotationOffset;
            }
            if (this.isOnGround) this._playAction(this.runAction);
        } else {
            if (this.playerModel && this._lastMoveAngle !== undefined) {
                this.playerModel.rotation.y = this._lastMoveAngle + this._charParams.idleRotationOffset;
            }
            if (this.isOnGround) this._playAction(this.idleAction);
        }
    }

    handleCamera() {
        const player = this.playerContainer.position;
        this.cameraPitch = Math.max(-0.8, Math.min(1.2, this.cameraPitch));

        const radius = this._camParams.radius;
        const camY = player.y + this._camParams.pitchOffset + Math.sin(this.cameraPitch) * radius;
        const cx = player.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        const cz = player.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;

        this.camera.position.set(cx, Math.max(player.y + this._camParams.heightOffset, camY), cz);
        this.camera.lookAt(player.x, player.y + this._camParams.pitchOffset, player.z);
    }

    _playAction(action, fadeIn = 0.2) {
        if (!action || this.currentAction === action) return;
        if (this.currentAction) this.currentAction.fadeOut(fadeIn);
        action.reset().setEffectiveWeight(1).fadeIn(fadeIn).play();
        this.currentAction = action;
    }

    setupInput() {
        document.addEventListener('pointerlockchange', () => {
            const isLocked = document.pointerLockElement !== null;
            if (!isLocked && !this.cursorUnlocked) {
                this.togglePause(true);
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.input.forward = true;
            if (e.code === 'KeyS') this.input.backward = true;
            if (e.code === 'KeyA') this.input.left = true;
            if (e.code === 'KeyD') this.input.right = true;

            if (e.code === 'KeyM') {
                this.cursorUnlocked = !this.cursorUnlocked;
                if (this.cursorUnlocked) {
                    document.exitPointerLock();
                    this.togglePause(false);
                } else {
                    this.renderer.domElement.requestPointerLock();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.input.forward = false;
            if (e.code === 'KeyS') this.input.backward = false;
            if (e.code === 'KeyA') this.input.left = false;
            if (e.code === 'KeyD') this.input.right = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement && !this.isPaused && !this.cursorUnlocked) {
                this.cameraAngle -= e.movementX * 0.003;
                this.cameraPitch += e.movementY * 0.002;
            }
        });

        window.addEventListener('wheel', (e) => {
            if (!this.isPaused && !this.cursorUnlocked) {
                this._camParams.radius += Math.sign(e.deltaY) * 0.15;
                this._camParams.radius = Math.max(2, Math.min(3, this._camParams.radius));
            }
        }, { passive: true });

        this.renderer.domElement.addEventListener('click', () => {
            if (!this.isPaused && !this.cursorUnlocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        const overlay = document.getElementById('pause-overlay');
        if (overlay && !overlay.querySelector('h1')) {
            overlay.innerHTML = `<h1>PAUSED</h1>` + overlay.innerHTML;
        }

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) resumeBtn.addEventListener('click', () => {
            this.togglePause(false);
            this.cursorUnlocked = false;
            this.renderer.domElement.requestPointerLock();
        });
    }

    togglePause(val) {
        this.isPaused = val;
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.style.display = this.isPaused ? 'flex' : 'none';
    }
}
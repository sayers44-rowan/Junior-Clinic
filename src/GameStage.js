import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';


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
    'Sunset': { ambientInt: 0.8, sunInt: 2.5, sunX: -5, sunY: 22, sunZ: -80 },
    'Custom': {}
};

const R_CURVE_POINTS = [
    new THREE.Vector3(103.45, 1.76, 29.42), new THREE.Vector3(103.12, 1.20, 44.62), new THREE.Vector3(102.40, 0.69, 57.58),
    new THREE.Vector3(102.37, 1.22, 70.64), new THREE.Vector3(102.06, 1.35, 76.59), new THREE.Vector3(99.52, 0.53, 100.67),
    new THREE.Vector3(96.25, 0.50, 114.28), new THREE.Vector3(90.24, 0.49, 132.63), new THREE.Vector3(81.22, 0.49, 151.89),
    new THREE.Vector3(72.03, 0.49, 166.71), new THREE.Vector3(61.56, 0.49, 175.72), new THREE.Vector3(56.40, 0.49, 181.43),
    new THREE.Vector3(51.91, 0.49, 184.55), new THREE.Vector3(43.59, 0.49, 187.22), new THREE.Vector3(36.18, 0.49, 188.90),
    new THREE.Vector3(21.74, 0.07, 188.47)
];
const vanCurve = new THREE.CatmullRomCurve3(R_CURVE_POINTS);

export class GameStage {
    constructor(scene, camera, renderer, gameStateManager) {
        this.gameStateManager = gameStateManager;
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;

        this.clock = new THREE.Clock();
        this.isPaused = false;
        this.isWaitingForStart = true;
        this.cursorUnlocked = false;
        this.isNoclip = false;

        this.playerContainer = new THREE.Group();
        this.input = { forward: false, backward: false, left: false, right: false, up: false, down: false };
        this.mixer = null;
        this.playerModel = null;
        this.cameraAngle = 0;
        this.cameraPitch = 0.1;
        this.velocityY = 0;
        this.isOnGround = true;
        this.mapReady = false;
        this._cullFrameCount = 0;
        this._lastMoveAngle = 0;

        this.vanProgress = 0.0;
        this.vanSpeed = 0.049;
        this.vanModel = null;
        this.vanGroup = null;

        this.rocketProp = null;
        this.padProp = null;
        this.billboardProp = null;

        this._mapParams = { x: 6.3, y: 0.07, z: 109.8, rot: 0, scale: 1.71 };
        this._vfxParams = { dustCount: 300, dustSize: 0.19, dustOpacity: 0.51, dustSpeed: 1.0, dustMaxHeight: 4.5 };
        this._lightParams = { activePreset: 'Sunset', ambientInt: 0.8, sunInt: 2.5, sunX: -5, sunY: 22, sunZ: -80 };
        this._skyParams = { intensity: 1.0, tint: '#ffffff', sunX: -0.05, sunY: 0.22, sunZ: -0.8 };
        this._vanFXParams = { hlIntensity: 13.3, hlX: 0.58, hlY: 0.46, hlZ: 1.11, dustRate: 2, dustSize: 33.0, dustOpacity: 0.11, dustX: 0.58, dustY: -0.02, dustZ: -1.35 };
        this._loggerParams = { enabled: false, showWalls: false };

        this._propParams = {
            rocketX: 25.9, rocketY: -0.2, rocketZ: 170.6, rocketRotY: 0.25, rocketScale: 2.25,
            padX: 21.2, padY: -0.5, padZ: 171.8, padRotY: -1.31, padScale: 0.7,
            billboardX: 139.4, billboardY: 2.2, billboardZ: 123, billboardRotY: -2.7, billboardScale: 2.12,
            doorX: 16.55, doorY: 0.4, doorZ: 175.7, doorRotY: -2.86, doorScale: 1,
            bbTextX: 16.3, bbTextY: 6.5, bbTextZ: -2.6, bbTextRotX: -3.14159, bbTextRotY: -3.14159, bbTextRotZ: -3.14159, bbTextScaleX: 15, bbTextScaleY: 8
        };

        this.waypoints = [];
        this.waypointSpheres = [];
        this.waypointLine = null;

        this._camParams = { radius: 2.5, heightOffset: 1.4, pitchOffset: 1.0 };
        this._charParams = { rotationOffset: 0, idleRotationOffset: 0, moveSpeed: 6.5, animSpeed: 1.0, armX: 0, armY: 0, armZ: 0 };
        this.skyMaterials = [];

        this._injectPauseUIStyles();
        this.init();
    }

    _injectPauseUIStyles() {
        const style = document.createElement('style');
        style.innerText = `
            @keyframes jump { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            .loading-dot { display: inline-block; animation: jump 1s infinite; }
            .loading-dot:nth-child(1) { animation-delay: 0.0s; }
            .loading-dot:nth-child(2) { animation-delay: 0.15s; }
            .loading-dot:nth-child(3) { animation-delay: 0.3s; }
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&display=swap');
            #pause-overlay {
                background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 100%) !important;
                backdrop-filter: blur(6px); font-family: 'Fredoka', sans-serif !important;
                display: none; flex-direction: column; justify-content: center; align-items: center;
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999;
            }
            #pause-overlay h1 { color: #fff; font-size: 4rem; text-shadow: 0 4px 15px rgba(0,0,0,1); margin-bottom: 40px; letter-spacing: 8px; font-weight: 700; text-transform: uppercase; }
            #resume-btn {
                background: transparent !important; color: #fff !important; border: 2px solid rgba(255,255,255,0.6) !important;
                padding: 15px 60px !important; font-size: 1.3rem !important; font-weight: bold !important; cursor: pointer;
                border-radius: 4px; letter-spacing: 5px; transition: all 0.2s ease; text-transform: uppercase;
                text-shadow: 0 2px 5px rgba(0,0,0,0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important; outline: none;
            }
            #resume-btn:hover { background: rgba(255,255,255,1) !important; color: #000 !important; box-shadow: 0 0 25px rgba(255,255,255,0.6) !important; border-color: #ffffff !important; text-shadow: none; transform: scale(1.05); }
            .music_toggle { 
                position: fixed; top: 20px; right: 20px; width: 45px; height: 45px; 
                background: rgba(0,0,0,0.6); border: 2px solid rgba(255,255,255,0.8); 
                border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                cursor: pointer; z-index: 100000; color: #fff; font-size: 1.4rem; 
                transition: all 0.2s ease; backdrop-filter: blur(4px); pointer-events: auto;
            }
            .music_toggle:hover { transform: scale(1.1); background: rgba(255,119,0,0.4); border-color: #ff7700; }
        `;
        document.head.appendChild(style);
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.scene.clear();
        this.scene.add(this.playerContainer);
        this.playerContainer.position.set(0, 1.5, 0);
        this.camera.position.set(0, 1.5, 10);

        this.setupLights();
        this._setupDustVFX();
        this._setupVanDust();
        this._loadSkybox();
        this._loadDesertMap();
        this._loadVan();
        this._loadProps();

        this.engineAudio = new Audio('/assets/audio/engine.mp3');
        this.engineAudio.preload = 'auto';
        this.engineAudio.loop = true;
        this.engineAudio.volume = 0.05;
        this.engineAudio.addEventListener('timeupdate', () => { if (this.engineAudio.duration && this.engineAudio.currentTime >= this.engineAudio.duration - 0.15) { this.engineAudio.currentTime = 0.05; } });

        this.voiceAlmost = new Audio("/assets/audio/hey_we're_almost_at_the_site.mp3"); this.voiceAlmost.preload = 'auto'; this.voiceAlmost.volume = 1.0;
        this.voiceInside = new Audio("/assets/audio/let's_get_inside.mp3"); this.voiceInside.preload = 'auto'; this.voiceInside.volume = 1.0;

        this.interactUI = document.createElement('div');
        this.interactUI.id = 'sparc_interact_prompt';
        this.interactUI.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); color:#fff; font-family:"Fredoka",sans-serif; font-size:2.5rem; font-weight:800; letter-spacing:4px; text-shadow:0 4px 15px rgba(0,0,0,1); display:none; z-index:9999; text-align:center; pointer-events:none;';
        this.interactUI.innerHTML = 'PRESS <span style="color:#ff7700;">[E]</span> TO ENTER';
        document.body.appendChild(this.interactUI);

        const pathPts = [new THREE.Vector3(21.00, 0.5, 189.69), new THREE.Vector3(19.81, 0.5, 189.67), new THREE.Vector3(18.58, 0.5, 188.30), new THREE.Vector3(17.54, 0.5, 186.54), new THREE.Vector3(16.96, 0.5, 183.25), new THREE.Vector3(16.66, 0.5, 180.01), new THREE.Vector3(16.55, 0.5, 177.32)];
        const pathCurve = new THREE.CatmullRomCurve3(pathPts);
        const tubeGeo = new THREE.TubeGeometry(pathCurve, 64, 0.4, 8, false);
        const dashCanvas = document.createElement('canvas'); dashCanvas.width = 256; dashCanvas.height = 64; const dCtx = dashCanvas.getContext('2d');
        dCtx.clearRect(0, 0, 256, 64); dCtx.fillStyle = '#ffffff'; dCtx.fillRect(0, 0, 128, 64);
        const dashTex = new THREE.CanvasTexture(dashCanvas); dashTex.wrapS = THREE.RepeatWrapping; dashTex.repeat.set(15, 1);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, map: dashTex, alphaMap: dashTex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        this.guidePath = new THREE.Mesh(tubeGeo, tubeMat);
        this.guidePath.scale.set(1, 0.1, 1);
        this.guidePath.frustumCulled = false;
        this.guidePath.visible = false;
        this.scene.add(this.guidePath);

        this.wallGroup = new THREE.Group();
        const buildWalls = (pts) => {
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = new THREE.Vector3(pts[i][0], 0, pts[i][1]); const p2 = new THREE.Vector3(pts[i + 1][0], 0, pts[i + 1][1]);
                const dist = p1.distanceTo(p2); const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
                const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, dist), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
                wallMesh.position.set((p1.x + p2.x) / 2, 5, (p1.z + p2.z) / 2); wallMesh.rotation.y = angle; this.wallGroup.add(wallMesh);
            }
        };
        buildWalls([[26.71, 193.11], [14.71, 196.43], [8.37, 177.61], [13.23, 174.04], [18.28, 172.95], [25.08, 177.32], [25.73, 178.61], [29.70, 177.55], [29.76, 188.89], [26.75, 193.16]]);
        buildWalls([[20.18, 187.61], [19.91, 187.95], [19.87, 189.01], [20.15, 189.20], [22.88, 189.39], [23.22, 189.07], [23.16, 187.89], [22.91, 187.66], [20.34, 187.62]]);
        buildWalls([[19.59, 174.86], [18.85, 175.87], [13.48, 177.10], [12.74, 176.79], [12.07, 174.79], [18.04, 172.72], [20.20, 174.35], [19.51, 175.13]]);
        this.wallGroup.visible = false; this.scene.add(this.wallGroup);
        this.setupInput();

        this.iris = document.createElement('div');
        this.iris.id = 'sparc_game_iris';
        this.iris.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:0px;height:0px;border-radius:50%;box-shadow:0 0 0 300vmax #000;z-index:999999;pointer-events:none;';
        document.body.appendChild(this.iris);

        this.camera.near = 0.1;
        this.camera.far = 15000;
        this.camera.updateProjectionMatrix();

        this.loadingText = document.createElement('div');
        this.loadingText.innerHTML = 'LOADING<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>';
        this.loadingText.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:sans-serif;font-size:3rem;z-index:9999999;font-weight:bold;letter-spacing:5px;';
        document.body.appendChild(this.loadingText);

        const oldUI = document.getElementById('sparc_objective_box'); if (oldUI) oldUI.remove();
        const ui = document.createElement('div'); ui.id = 'sparc_objective_box';
        ui.style.cssText = 'position:fixed; top:16px; left:16px; width:220px; background:#fdf9f1; border:4px solid #d4b878; border-radius:10px; padding:10px 14px; box-sizing:border-box; box-shadow:0 12px 30px rgba(0,0,0,0.5); cursor:pointer; font-family:"Fredoka",sans-serif; z-index:9999; overflow:hidden; transition:max-height 0.4s ease; max-height:58px; pointer-events:auto;';
        ui.innerHTML = `<div id="sparc_obj_content"><div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;"><span style="font-family:'Fredoka',sans-serif;font-size:0.65rem;font-weight:800;color:#ff7700;letter-spacing:2px;text-transform:uppercase;">Objective</span></div><div style="font-family:'Fredoka',sans-serif;font-size:1rem;color:#333;font-weight:700;">ENTER THE ROCKET <span style="font-size:0.7rem;color:#ff7700;">&#9660;</span></div><div id="sparc_obj_desc" style="display:block;margin-top:10px;font-size:0.9rem;color:#555;line-height:1.5;text-align:left;background:#fff;padding:12px;border-radius:8px;border:1px solid rgba(212,184,120,0.5);box-shadow:0 2px 8px rgba(0,0,0,0.05);">You were running late and need to hurry to the rocket via launch site to proceed.</div></div>`;
        ui.onclick = () => { ui.style.maxHeight = ui.style.maxHeight === '58px' ? '300px' : '58px'; };
        document.body.appendChild(ui);

        const musicBtn = document.createElement('div');
        musicBtn.id = 'sparc_music_toggle';
        musicBtn.className = 'music_toggle';
        musicBtn.innerHTML = '🔊';
        musicBtn.onclick = (e) => {
            e.stopPropagation();
            if (!this.musicAudio) return;
            if (this.musicAudio.paused) {
                this.musicAudio.play().catch(err => console.warn(err));
                musicBtn.innerHTML = '🔊';
                musicBtn.style.borderColor = 'rgba(255,255,255,0.8)';
            } else {
                this.musicAudio.pause();
                musicBtn.innerHTML = '🔇';
                musicBtn.style.borderColor = 'rgba(255,255,255,0.3)';
            }
        };
        document.body.appendChild(musicBtn);

        const floorGeo = new THREE.PlaneGeometry(10000, 10000);
        this.groundMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ visible: false }));
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.groundMesh);

        const pilotName = (localStorage.getItem('selectedPilot') || 'timmy').toLowerCase();
        await this.loadPilot(`/assets/models/pilot_${pilotName}.fbx`);
    }

    _setupDustVFX() {
        const maxDust = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxDust * 3);
        const velocities = new Float32Array(maxDust * 3);
        const phases = new Float32Array(maxDust);

        for (let i = 0; i < maxDust; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * this._vfxParams.dustMaxHeight;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            velocities[i * 3] = (Math.random() - 0.5) * 0.8;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
            phases[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
        geometry.setDrawRange(0, this._vfxParams.dustCount);

        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(237, 204, 168, 1)');
        gradient.addColorStop(0.5, 'rgba(237, 204, 168, 0.5)');
        gradient.addColorStop(1, 'rgba(237, 204, 168, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 16, 16);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pointTexture: { value: new THREE.CanvasTexture(canvas) },
                baseColor: { value: new THREE.Color(0xedcca8) },
                globalOpacity: { value: this._vfxParams.dustOpacity },
                size: { value: this._vfxParams.dustSize * 100.0 }
            },
            vertexShader: `
                attribute vec3 velocity; attribute float phase; varying float vAlpha; uniform float time; uniform float size;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (10.0 / (-mvPosition.z));
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = (sin(time * 0.5 + phase) + 1.0) * 0.5;
                }`,
            fragmentShader: `
                uniform sampler2D pointTexture; uniform vec3 baseColor; uniform float globalOpacity; varying float vAlpha;
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    gl_FragColor = vec4(baseColor, texColor.a * vAlpha * globalOpacity);
                }`,
            transparent: true, depthWrite: false, blending: THREE.NormalBlending
        });

        this.dustParticles = new THREE.Points(geometry, material);
        this.dustParticles.frustumCulled = false;
        this.scene.add(this.dustParticles);
    }

    _setupVanDust() {
        const maxParticles = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxParticles * 3);
        const velocities = new Float32Array(maxParticles * 3);
        const lifetimes = new Float32Array(maxParticles);
        const maxLifetimes = new Float32Array(maxParticles);

        for (let i = 0; i < maxParticles; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = 0;
            velocities[i * 3 + 2] = 0;
            lifetimes[i] = 0;
            maxLifetimes[i] = 0.5 + Math.random() * 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));

        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(210, 180, 140, 1)');
        gradient.addColorStop(0.5, 'rgba(210, 180, 140, 0.5)');
        gradient.addColorStop(1, 'rgba(210, 180, 140, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 16, 16);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: new THREE.CanvasTexture(canvas) },
                baseColor: { value: new THREE.Color(0xd2b48c) },
                sizeMult: { value: this._vanFXParams.dustSize },
                globalOp: { value: this._vanFXParams.dustOpacity }
            },
            vertexShader: `
                attribute vec3 velocity; attribute float lifetime; attribute float maxLifetime; varying float vAlpha; uniform float sizeMult;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float lifePct = lifetime / maxLifetime;
                    gl_PointSize = (1.0 - lifePct) * sizeMult * (10.0 / (-mvPosition.z));
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = 1.0 - lifePct;
                }`,
            fragmentShader: `
                uniform sampler2D pointTexture; uniform vec3 baseColor; uniform float globalOp; varying float vAlpha;
                void main() {
                    if (vAlpha <= 0.0) discard;
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    gl_FragColor = vec4(baseColor, texColor.a * vAlpha * globalOp);
                }`,
            transparent: true, depthWrite: false, blending: THREE.NormalBlending
        });

        this.vanDustParticles = new THREE.Points(geometry, material);
        this.vanDustParticles.frustumCulled = false;
        this.scene.add(this.vanDustParticles);
        this.dustIndex = 0;
    }

    _updateVanDust(dt) {
        if (!this.vanDustParticles || !this.vanGroup) return;

        const positions = this.vanDustParticles.geometry.attributes.position.array;
        const velocities = this.vanDustParticles.geometry.attributes.velocity.array;
        const lifetimes = this.vanDustParticles.geometry.attributes.lifetime.array;
        const maxLifetimes = this.vanDustParticles.geometry.attributes.maxLifetime.array;
        const maxParticles = 200;

        if (this.vanSpeed > 0) {
            const spawnRate = this._vanFXParams.dustRate;
            const dx = this._vanFXParams.dustX; const dy = this._vanFXParams.dustY; const dz = this._vanFXParams.dustZ;
            const offsetL = new THREE.Vector3(-dx, dy, dz).applyQuaternion(this.vanGroup.quaternion);
            const offsetR = new THREE.Vector3(dx, dy, dz).applyQuaternion(this.vanGroup.quaternion);
            for (let i = 0; i < spawnRate; i++) {
                [offsetL, offsetR].forEach(offset => {
                    const idx = this.dustIndex % maxParticles;
                    const spawnPos = this.vanGroup.position.clone().add(offset);
                    positions[idx * 3] = spawnPos.x + (Math.random() - 0.5) * 0.2;
                    positions[idx * 3 + 1] = spawnPos.y + Math.random() * 0.2;
                    positions[idx * 3 + 2] = spawnPos.z + (Math.random() - 0.5) * 0.2;
                    const bDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.vanGroup.quaternion);
                    velocities[idx * 3] = bDir.x * 2.0 + (Math.random() - 0.5) * 0.5;
                    velocities[idx * 3 + 1] = 0.5 + Math.random() * 0.5;
                    velocities[idx * 3 + 2] = bDir.z * 2.0 + (Math.random() - 0.5) * 0.5;
                    lifetimes[idx] = 0; maxLifetimes[idx] = 0.5 + Math.random() * 0.5;
                    this.dustIndex++;
                });
            }
        }

        for (let i = 0; i < maxParticles; i++) {
            if (lifetimes[i] < maxLifetimes[i]) {
                lifetimes[i] += dt;
                positions[i * 3] += velocities[i * 3] * dt;
                positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
                positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
            } else {
                lifetimes[i] = maxLifetimes[i] + 1;
                positions[i * 3 + 1] = -1000;
            }
        }

        this.vanDustParticles.geometry.attributes.position.needsUpdate = true;
        this.vanDustParticles.geometry.attributes.lifetime.needsUpdate = true;
    }

    _loadSkybox() {
        const skyGeo = new THREE.SphereGeometry(8000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: { sunPos: { value: new THREE.Vector3(this._skyParams.sunX, this._skyParams.sunY, this._skyParams.sunZ) } },
            vertexShader: `
                varying vec3 vDir;
                void main() {
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunPos; varying vec3 vDir;
                void main() {
                    vec3 dir = normalize(vDir); float h = dir.y;
                    vec3 colorBot = vec3(1.0, 0.7, 0.1); vec3 colorMid = vec3(0.9, 0.1, 0.5); vec3 colorTop = vec3(0.05, 0.05, 0.2);
                    vec3 skyColor = mix(colorBot, colorMid, smoothstep(-0.2, 0.4, h));
                    skyColor = mix(skyColor, colorTop, smoothstep(0.4, 1.0, h));
                    vec3 sunDir = normalize(sunPos); float sunDot = dot(dir, sunDir);
                    float sunShape = smoothstep(0.995, 0.997, sunDot); vec3 sunColor = vec3(1.0, 1.0, 0.8);
                    float sunGlow = smoothstep(0.95, 0.995, sunDot) * 0.5;
                    gl_FragColor = vec4(mix(skyColor, sunColor, sunShape) + (vec3(1.0, 0.6, 0.0) * sunGlow), 1.0);
                }
            `,
            side: THREE.BackSide, depthWrite: false, fog: false
        });

        this.skybox = new THREE.Mesh(skyGeo, skyMat);
        this.skybox.renderOrder = -1;
        this.skybox.frustumCulled = false;
        this.scene.add(this.skybox);
    }

    _loadDesertMap() {
        _gltfLoader.load('/assets/models/desert_landscape.glb', (gltf) => {
            const map = gltf.scene;
            map.position.set(this._mapParams.x, this._mapParams.y, this._mapParams.z);
            map.rotation.y = this._mapParams.rot;
            map.scale.set(this._mapParams.scale, this._mapParams.scale, this._mapParams.scale);
            map.traverse(child => { if (child.isMesh) { child.receiveShadow = true; child.castShadow = true; } });
            this.mapGroup = map;
            this.scene.add(map);
            this.mapReady = true;
        });
    }

    _loadVan() {
        _gltfLoader.load('/assets/models/van.glb', (gltf) => {
            const van = gltf.scene;
            van.scale.set(0.67, 0.67, 0.67);
            van.rotation.set(0, Math.PI / 2, 0);
            van.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });

            this.hlL = new THREE.SpotLight(0xffffee, this._vanFXParams.hlIntensity, 150, 0.6, 0.5, 1);
            const hx = this._vanFXParams.hlX; const hy = this._vanFXParams.hlY; const hz = this._vanFXParams.hlZ;
            this.hlL.position.set(hx, hy, hz); this.hlL.target.position.set(hx, hy, hz + 20);
            this.hlR = this.hlL.clone(); this.hlR.position.set(-hx, hy, hz); this.hlR.target.position.set(-hx, hy, hz + 20);
            this.vanGroup = new THREE.Group();
            this.vanGroup.add(van);
            this.vanGroup.add(this.hlL); this.vanGroup.add(this.hlL.target);
            this.vanGroup.add(this.hlR); this.vanGroup.add(this.hlR.target);
            this.vanModel = van;

            this.scene.add(this.vanGroup);
        });
    }

    _loadProps() {
        _gltfLoader.load('/assets/models/rocket_asset.glb', (gltf) => {
            this.rocketProp = gltf.scene;
            this.rocketProp.position.set(this._propParams.rocketX, this._propParams.rocketY, this._propParams.rocketZ);
            this.rocketProp.rotation.y = this._propParams.rocketRotY;
            this.rocketProp.scale.set(this._propParams.rocketScale, this._propParams.rocketScale, this._propParams.rocketScale);
            this.rocketProp.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            this.scene.add(this.rocketProp);
        });

        _gltfLoader.load('/assets/models/low_poly_launch_pad.glb', (gltf) => {
            this.padProp = gltf.scene;
            this.padProp.position.set(this._propParams.padX, this._propParams.padY, this._propParams.padZ);
            this.padProp.rotation.y = this._propParams.padRotY;
            this.padProp.scale.set(this._propParams.padScale, this._propParams.padScale, this._propParams.padScale);
            this.padProp.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            this.scene.add(this.padProp);
        });

        _gltfLoader.load('/assets/models/low_poly_billboard.glb', (gltf) => {
            this.billboardProp = gltf.scene;
            this.billboardProp.position.set(this._propParams.billboardX, this._propParams.billboardY, this._propParams.billboardZ);
            this.billboardProp.rotation.y = this._propParams.billboardRotY;
            this.billboardProp.scale.set(this._propParams.billboardScale, this._propParams.billboardScale, this._propParams.billboardScale);
            this.billboardProp.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });

            const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080; const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1920, 1080);
            ctx.fillStyle = '#0a3d6b'; ctx.fillRect(0, 0, 1920, 300);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 110px "Arial", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SPACE COMMAND', 960, 210);
            ctx.fillStyle = '#f0a500'; ctx.fillRect(0, 300, 1920, 30);
            ctx.fillStyle = '#222222'; ctx.font = '900 100px "Arial", sans-serif'; ctx.fillText('KENNEDY SPACE CENTER', 960, 650);
            ctx.fillStyle = '#555555'; ctx.font = 'bold 70px "Arial", sans-serif'; ctx.letterSpacing = '5px'; ctx.fillText('LAUNCH SITE AHEAD', 960, 850);
            ctx.strokeStyle = '#222222'; ctx.lineWidth = 30; ctx.strokeRect(40, 40, 1840, 1000);
            const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true;
            const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex }));
            this.billboardText = textPlane;
            this.billboardText.position.set(this._propParams.bbTextX, this._propParams.bbTextY, this._propParams.bbTextZ);
            this.billboardText.rotation.set(this._propParams.bbTextRotX, this._propParams.bbTextRotY, this._propParams.bbTextRotZ);
            this.billboardText.scale.set(this._propParams.bbTextScaleX, this._propParams.bbTextScaleY, 1);
            this.billboardProp.add(this.billboardText);

            this.scene.add(this.billboardProp);
        });

        _gltfLoader.load('/assets/models/space_door.glb', (gltf) => {
            this.doorProp = gltf.scene; this.doorProp.position.set(this._propParams.doorX, this._propParams.doorY, this._propParams.doorZ);
            this.doorProp.rotation.y = this._propParams.doorRotY; this.doorProp.scale.set(this._propParams.doorScale, this._propParams.doorScale, this._propParams.doorScale);
            this.doorProp.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            this.scene.add(this.doorProp);
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
            charFolder.add(this._charParams, 'animSpeed', 0.1, 3, 0.05).name('Run Anim Speed').onChange(v => { if (this.runAction) this.runAction.timeScale = v; }).listen();

            const mapFolder = this.gui.addFolder('Map Transform');
            mapFolder.add(this._mapParams, 'x', -2000, 2000, 0.1).name('Map X').onChange(v => { if (this.mapGroup) this.mapGroup.position.x = v; });
            mapFolder.add(this._mapParams, 'y', -10, 10, 0.01).name('Map Y').onChange(v => { if (this.mapGroup) this.mapGroup.position.y = v; });
            mapFolder.add(this._mapParams, 'z', -2000, 2000, 0.1).name('Map Z').onChange(v => { if (this.mapGroup) this.mapGroup.position.z = v; });
            mapFolder.add(this._mapParams, 'rot', -Math.PI, Math.PI, 0.01).name('Map Rotation').onChange(v => { if (this.mapGroup) this.mapGroup.rotation.y = v; });
            mapFolder.add(this._mapParams, 'scale', 0.1, 10, 0.01).name('Map Scale').onChange(v => { if (this.mapGroup) this.mapGroup.scale.set(v, v, v); });

            const lightFolder = this.gui.addFolder('Lighting Tweaks');
            lightFolder.add(this._lightParams, 'activePreset', Object.keys(lightingPresets)).name('Preset').onChange(presetName => {
                if (presetName !== 'Custom') {
                    const p = lightingPresets[presetName];
                    this._lightParams.ambientInt = p.ambientInt; this._lightParams.sunInt = p.sunInt;
                    this._lightParams.sunX = p.sunX; this._lightParams.sunY = p.sunY; this._lightParams.sunZ = p.sunZ;
                    this.ambientLight.intensity = p.ambientInt; this.sunLight.intensity = p.sunInt;
                    this.sunLight.position.set(p.sunX, p.sunY, p.sunZ);
                }
            });
            lightFolder.add(this._lightParams, 'ambientInt', 0, 5).name('Ambient Power').listen().onChange(v => { this.ambientLight.intensity = v; });
            lightFolder.add(this._lightParams, 'sunInt', 0, 10).name('Sun Power').listen().onChange(v => { this.sunLight.intensity = v; });
            lightFolder.add(this._lightParams, 'sunX', -50, 50).name('Sun X').listen().onChange(v => { this.sunLight.position.x = v; });
            lightFolder.add(this._lightParams, 'sunY', -50, 50).name('Sun Y').listen().onChange(v => { this.sunLight.position.y = v; });
            lightFolder.add(this._lightParams, 'sunZ', -50, 50).name('Sun Z').listen().onChange(v => { this.sunLight.position.z = v; });

            const skyFolder = this.gui.addFolder('Skybox Tuning');
            skyFolder.add(this._skyParams, 'intensity', 0, 2, 0.01).name('Sky Brightness').onChange(v => { this.skyMaterials.forEach(m => m.emissiveIntensity = v); });
            skyFolder.addColor(this._skyParams, 'tint').name('Sky Tint').onChange(v => { this.skyMaterials.forEach(m => m.emissive.set(v)); });
            skyFolder.add(this._skyParams, 'sunX', -1, 1, 0.01).name('Sun X').onChange(v => { if (this.skybox) this.skybox.material.uniforms.sunPos.value.x = v; });
            skyFolder.add(this._skyParams, 'sunY', -1, 1, 0.01).name('Sun Y').onChange(v => { if (this.skybox) this.skybox.material.uniforms.sunPos.value.y = v; });
            skyFolder.add(this._skyParams, 'sunZ', -1, 1, 0.01).name('Sun Z').onChange(v => { if (this.skybox) this.skybox.material.uniforms.sunPos.value.z = v; });

            const vanFolder = this.gui.addFolder('Van Controls');
            vanFolder.add(this, 'vanSpeed', 0.0, 0.5, 0.001).name('Van Speed').listen();
            vanFolder.add(this._vanFXParams, 'hlIntensity', 0, 50, 0.1).name('Headlights').onChange(v => { if (this.hlL) { this.hlL.intensity = v; this.hlR.intensity = v; } });
            vanFolder.add(this._vanFXParams, 'dustRate', 0, 10, 1).name('Dust Spawn Rate');
            vanFolder.add(this._vanFXParams, 'dustSize', 10, 200, 1).name('Dust Size').onChange(v => { if (this.vanDustParticles) this.vanDustParticles.material.uniforms.sizeMult.value = v; });
            vanFolder.add(this._vanFXParams, 'dustOpacity', 0.0, 1.0, 0.01).name('Dust Opacity').onChange(v => { if (this.vanDustParticles) this.vanDustParticles.material.uniforms.globalOp.value = v; });
            vanFolder.add(this._vanFXParams, 'dustX', 0, 2, 0.01).name('Dust Offset X');
            vanFolder.add(this._vanFXParams, 'dustY', -1, 1, 0.01).name('Dust Offset Y');
            vanFolder.add(this._vanFXParams, 'dustZ', -5, 5, 0.01).name('Dust Offset Z');
            vanFolder.add(this._vanFXParams, 'hlX', 0, 2, 0.01).name('Headlight X').onChange(v => { if (this.hlL) { this.hlL.position.x = v; this.hlL.target.position.x = v; this.hlR.position.x = -v; this.hlR.target.position.x = -v; } });
            vanFolder.add(this._vanFXParams, 'hlY', -1, 2, 0.01).name('Headlight Y').onChange(v => { if (this.hlL) { this.hlL.position.y = v; this.hlL.target.position.y = v; this.hlR.position.y = v; this.hlR.target.position.y = v; } });
            vanFolder.add(this._vanFXParams, 'hlZ', -5, 5, 0.01).name('Headlight Z').onChange(v => { if (this.hlL) { this.hlL.position.z = v; this.hlL.target.position.z = v + 20; this.hlR.position.z = v; this.hlR.target.position.z = v + 20; } });

            const vfxFolder = this.gui.addFolder('VFX Tuning');
            vfxFolder.add(this._vfxParams, 'dustCount', 0, 1000, 1).name('Dust Count').onChange(v => { if (this.dustParticles) this.dustParticles.geometry.setDrawRange(0, v); });
            vfxFolder.add(this._vfxParams, 'dustSize', 0.01, 1.0, 0.01).name('Dust Size').onChange(v => { if (this.dustParticles) this.dustParticles.material.uniforms.size.value = v * 100.0; });
            vfxFolder.add(this._vfxParams, 'dustOpacity', 0.0, 1.0, 0.01).name('Dust Opacity').onChange(v => { if (this.dustParticles) this.dustParticles.material.uniforms.globalOpacity.value = v; });
            vfxFolder.add(this._vfxParams, 'dustMaxHeight', 1, 50, 0.5).name('Dust Max Height');
            vfxFolder.add(this._vfxParams, 'dustSpeed', 0.0, 5.0, 0.1).name('Dust Speed');

            const loggerFolder = this.gui.addFolder('Track Logger (Spline Tool)');
            loggerFolder.add(this._loggerParams, 'enabled').name('Enable Logger').onChange(v => {
                if (v && this.cursorUnlocked === false) { document.exitPointerLock(); this.cursorUnlocked = true; }
            });
            loggerFolder.add(this._loggerParams, 'showWalls').name('Debug Invisible Walls').onChange(v => {
                if (this.wallGroup) this.wallGroup.children.forEach(w => { w.material.transparent = true; w.material.opacity = v ? 0.3 : 0; w.material.color.setHex(0xff0000); });
                if (this.wallGroup) this.wallGroup.visible = true;
            });
            loggerFolder.add({ clearPath: () => this.clearPath() }, 'clearPath').name('Clear Path');
            loggerFolder.add({ printPath: () => this.printPath() }, 'printPath').name('Print Path to Console');

            const propFolder = this.gui.addFolder('Prop Placement');
            propFolder.add(this._propParams, 'rocketX', -500, 500, 0.1).name('Rocket X').onChange(v => { if (this.rocketProp) this.rocketProp.position.x = v; });
            propFolder.add(this._propParams, 'rocketY', -500, 500, 0.1).name('Rocket Y').onChange(v => { if (this.rocketProp) this.rocketProp.position.y = v; });
            propFolder.add(this._propParams, 'rocketZ', -500, 500, 0.1).name('Rocket Z').onChange(v => { if (this.rocketProp) this.rocketProp.position.z = v; });
            propFolder.add(this._propParams, 'rocketRotY', -Math.PI, Math.PI, 0.01).name('Rocket RotY').onChange(v => { if (this.rocketProp) this.rocketProp.rotation.y = v; });
            propFolder.add(this._propParams, 'rocketScale', 0.01, 50, 0.01).name('Rocket Scale').onChange(v => { if (this.rocketProp) this.rocketProp.scale.set(v, v, v); });

            propFolder.add(this._propParams, 'padX', -500, 500, 0.1).name('Pad X').onChange(v => { if (this.padProp) this.padProp.position.x = v; });
            propFolder.add(this._propParams, 'padY', -500, 500, 0.1).name('Pad Y').onChange(v => { if (this.padProp) this.padProp.position.y = v; });
            propFolder.add(this._propParams, 'padZ', -500, 500, 0.1).name('Pad Z').onChange(v => { if (this.padProp) this.padProp.position.z = v; });
            propFolder.add(this._propParams, 'padRotY', -Math.PI, Math.PI, 0.01).name('Pad RotY').onChange(v => { if (this.padProp) this.padProp.rotation.y = v; });
            propFolder.add(this._propParams, 'padScale', 0.01, 50, 0.01).name('Pad Scale').onChange(v => { if (this.padProp) this.padProp.scale.set(v, v, v); });

            propFolder.add(this._propParams, 'billboardX', -500, 500, 0.1).name('Billboard X').onChange(v => { if (this.billboardProp) this.billboardProp.position.x = v; });
            propFolder.add(this._propParams, 'billboardY', -500, 500, 0.1).name('Billboard Y').onChange(v => { if (this.billboardProp) this.billboardProp.position.y = v; });
            propFolder.add(this._propParams, 'billboardZ', -500, 500, 0.1).name('Billboard Z').onChange(v => { if (this.billboardProp) this.billboardProp.position.z = v; });
            propFolder.add(this._propParams, 'billboardRotY', -Math.PI, Math.PI, 0.01).name('Billboard RotY').onChange(v => { if (this.billboardProp) this.billboardProp.rotation.y = v; });
            propFolder.add(this._propParams, 'billboardScale', 0.01, 50, 0.01).name('Billboard Scale').onChange(v => { if (this.billboardProp) this.billboardProp.scale.set(v, v, v); });
            propFolder.add(this._propParams, 'bbTextX', -500, 500, 0.01).name('BB Text X').onChange(v => { if (this.billboardText) this.billboardText.position.x = v; });
            propFolder.add(this._propParams, 'bbTextY', -100, 100, 0.01).name('BB Text Y').onChange(v => { if (this.billboardText) this.billboardText.position.y = v; });
            propFolder.add(this._propParams, 'bbTextZ', -500, 500, 0.01).name('BB Text Z').onChange(v => { if (this.billboardText) this.billboardText.position.z = v; });
            propFolder.add(this._propParams, 'bbTextRotX', -Math.PI, Math.PI, 0.01).name('BB Text RotX').onChange(v => { if (this.billboardText) this.billboardText.rotation.x = v; });
            propFolder.add(this._propParams, 'bbTextRotY', -Math.PI, Math.PI, 0.01).name('BB Text RotY').onChange(v => { if (this.billboardText) this.billboardText.rotation.y = v; });
            propFolder.add(this._propParams, 'bbTextRotZ', -Math.PI, Math.PI, 0.01).name('BB Text RotZ').onChange(v => { if (this.billboardText) this.billboardText.rotation.z = v; });
            propFolder.add(this._propParams, 'bbTextScaleX', 0, 50, 0.01).name('BB Text ScaleX').onChange(v => { if (this.billboardText) this.billboardText.scale.x = v; });
            propFolder.add(this._propParams, 'bbTextScaleY', 0, 50, 0.01).name('BB Text ScaleY').onChange(v => { if (this.billboardText) this.billboardText.scale.y = v; });
            propFolder.add(this._propParams, 'doorX', -500, 500, 0.1).name('Door X').onChange(v => { if (this.doorProp) this.doorProp.position.x = v; });
            propFolder.add(this._propParams, 'doorY', -500, 500, 0.1).name('Door Y').onChange(v => { if (this.doorProp) this.doorProp.position.y = v; });
            propFolder.add(this._propParams, 'doorZ', -500, 500, 0.1).name('Door Z').onChange(v => { if (this.doorProp) this.doorProp.position.z = v; });
            propFolder.add(this._propParams, 'doorRotY', -Math.PI, Math.PI, 0.01).name('Door RotY').onChange(v => { if (this.doorProp) this.doorProp.rotation.y = v; });
            propFolder.add(this._propParams, 'doorScale', 0.01, 50, 0.01).name('Door Scale').onChange(v => { if (this.doorProp) this.doorProp.scale.set(v, v, v); });

        } catch (e) {
            console.warn('lil-gui not available:', e);
        }
    }

    clearPath() {
        this.waypoints = [];
        if (this.waypointLine) this.waypointLine.geometry.setFromPoints([]);
        this.waypointSpheres.forEach(s => this.scene.remove(s));
        this.waypointSpheres = [];
    }

    printPath() {
        if (this.waypoints.length === 0) return console.warn("No waypoints logged.");
        const str = this.waypoints.map(w => `[${w.x.toFixed(2)}, ${w.y.toFixed(2)}, ${w.z.toFixed(2)}]`).join(',\n    ');
        console.log("Path:\n[\n    " + str + "\n]");
        alert("Path dumped to Browser Console (F12). Copy it.");
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffeedd, 0.8);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaeb, 2.5);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(4096, 4096);
        this.sunLight.shadow.camera.near = 0.5; this.sunLight.shadow.camera.far = 2000;
        this.sunLight.shadow.camera.left = -250; this.sunLight.shadow.camera.right = 250;
        this.sunLight.shadow.camera.top = 250; this.sunLight.shadow.camera.bottom = -250;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        this.fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(this.fillLight);
    }

    async loadPilot(modelPath) {
        const path = modelPath || '/assets/models/pilot_timmy.fbx';
        const charId = path.split('_')[1].split('.')[0].toLowerCase();

        this._charParams.rotationOffset = 0; this._charParams.idleRotationOffset = 0; this._charParams.moveSpeed = 6.5; this._charParams.animSpeed = 1.0;
        if (charId === 'timmy') { this._charParams.idleRotationOffset = 0.23; this._charParams.moveSpeed = 4; }
        else if (charId === 'ami') { this._charParams.moveSpeed = 3.5; }
        else if (charId === 'bryce') { this._charParams.moveSpeed = 4.2; this._charParams.animSpeed = 0.85; }
        else if (charId === 'adam') { this._charParams.moveSpeed = 4.5; this._charParams.animSpeed = 0.95; }
        else if (charId === 'jackie') { this._charParams.moveSpeed = 4.4; this._charParams.animSpeed = 0.9; }
        else if (charId === 'michelle') { this._charParams.moveSpeed = 4.9; }

        if (this.gui) this.gui.controllersRecursive().forEach(c => c.updateDisplay());

        if (this.pilot) this.playerContainer.remove(this.pilot);
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }

        return new Promise((resolve) => {
            const loader = new FBXLoader(globalManager);
            loader.load(path, (fbx) => {
                fbx.scale.set(0.009, 0.009, 0.009);
                const xOffset = 0;
                fbx.position.set(xOffset, 0, 0); fbx.rotation.set(0, 0, 0);

                fbx.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true; child.receiveShadow = true; child.frustumCulled = false;
                        if (child.material) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            const newMats = mats.map(m => {
                                const matName = m.name ? m.name.toLowerCase() : '';
                                const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator');
                                const isHair = matName.includes('hair') || matName.includes('beard') || matName.includes('mustache') || matName.includes('lash') || matName.includes('brow');
                                let newMat = new THREE.MeshStandardMaterial({ name: m.name, color: m.color || 0xffffff, map: m.map || null, normalMap: m.normalMap || null, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide });
                                if (isGlass) { newMat.transparent = true; newMat.opacity = 0.65; newMat.depthWrite = false; newMat.color.setHex(0x111111); }
                                else if (isHair) { newMat.transparent = false; newMat.depthWrite = true; newMat.alphaTest = 0.4; }
                                else { newMat.transparent = false; newMat.depthWrite = true; if (newMat.map) newMat.alphaTest = 0.5; }
                                return newMat;
                            });
                            child.material = newMats.length === 1 ? newMats[0] : newMats;
                        }
                    }
                });

                this.pilot = fbx; this.playerModel = fbx; this.playerContainer.add(fbx);
                this._setupAnims(fbx);
                resolve(fbx);
            });
        });
    }

    _retargetAnimation(clip, targetModel, isExternal = false) {
        clip.tracks = clip.tracks.filter(t => !t.name.includes('.scale'));
        let prefix = ''; let targetRestY = 0;
        targetModel.traverse(child => {
            if (child.isBone && !prefix) { const match = child.name.match(/(.*)Hips/i); if (match) { prefix = match[1]; targetRestY = child.position.y; } }
        });
        let coreBones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'RightShoulder', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'LeftToe_End', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'RightToe_End'];
        coreBones.sort((a, b) => b.length - a.length);
        const newTracks = [];
        clip.tracks.forEach(track => {
            const parts = track.name.split('.'); const property = parts[1];
            const coreBone = coreBones.find(b => track.name.includes(b));
            if (coreBone) {
                if (property === 'position' && coreBone !== 'Hips') return;
                const newTrack = track.clone();
                newTrack.name = `${prefix}${coreBone}.${property}`;
                if (property === 'position' && coreBone === 'Hips' && isExternal) {
                    const sourceFirstFrameY = newTrack.values[1]; const yOffset = targetRestY - sourceFirstFrameY;
                    for (let i = 1; i < newTrack.values.length; i += 3) newTrack.values[i] += yOffset;
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
            this.idleAction = this.mixer.clipAction(idleClip); this.idleAction.play(); this.currentAction = this.idleAction;
        }
        const loader = new FBXLoader(globalManager);
        loader.load('/assets/models/Running.fbx', (anim) => {
            if (anim.animations && anim.animations.length > 0) {
                const runClip = this._retargetAnimation(anim.animations[0].clone(), fbx, true);
                this.runAction = this.mixer.clipAction(runClip); this.runAction.timeScale = this._charParams.animSpeed;
            }
        });
    }

    onAssetsLoaded() {
        if (this.iris) {
            this.loadingText.innerHTML = '<span style="font-size:2rem;letter-spacing:2px;animation: pulse 1.5s infinite;cursor:pointer;">PRESS ANY KEY TO CONTINUE</span>';
            const style = document.createElement('style'); style.innerHTML = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }'; document.head.appendChild(style);
            this.musicAudio = new Audio('/assets/audio/title_music.mp3');
            this.musicAudio.preload = 'auto';
            this.musicAudio.loop = true;
            this.musicAudio.volume = 0.03;
            const startSequence = () => {
                window.removeEventListener('keydown', startSequence); window.removeEventListener('mousedown', startSequence);
                this.isWaitingForStart = false;

                const mBtn = document.getElementById('sparc_music_toggle');
                if (mBtn) { mBtn.innerHTML = '🔊'; mBtn.style.borderColor = 'rgba(255,255,255,0.8)'; }

                try { this.musicAudio.currentTime = 37; } catch (e) { }
                this.musicAudio.play().catch(e => console.warn("Music blocked:", e));
                if (this.vanSpeed > 0) this.engineAudio.play().catch(e => console.warn("Engine blocked:", e));
                setTimeout(() => {
                    if (this.voiceAlmost && !this.endingTriggered) {
                        this.voiceAlmost.play().catch(e => console.warn(e));
                    }
                }, 7000);

                void this.iris.offsetWidth;
                this.iris.style.transition = 'width 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)';
                this.iris.style.width = '300vmax'; this.iris.style.height = '300vmax';
                this.loadingText.style.transition = 'opacity 0.8s ease'; this.loadingText.style.opacity = '0';
                setTimeout(() => { if (this.iris && this.iris.parentNode) this.iris.parentNode.removeChild(this.iris); if (this.loadingText) this.loadingText.remove(); }, 850);
            };
            window.addEventListener('keydown', startSequence); window.addEventListener('mousedown', startSequence);
        }

        if (this.vanGroup && this.playerContainer) {
            this.scene.remove(this.playerContainer);
            this.vanGroup.add(this.playerContainer);
            this.playerContainer.position.set(0, 0, 0);

            if (this.playerModel) {
                this.playerModel.visible = false;
            }
        }

        this._camParams.radius = 6;
        this._camParams.heightOffset = 2.5;
        this._camParams.pitchOffset = 1.5;
    }

    onStateChange(newState) {
        if (newState === 'STATE_EXPLORING') {
            if (this.vanGroup && this.playerContainer) {
                this.vanGroup.remove(this.playerContainer);
                this.scene.add(this.playerContainer);

                this.playerContainer.position.set(20.58, 0.07, 190.44);
            }

            if (this.playerModel) {
                this.playerModel.visible = true;
            }

            this._camParams.radius = 2.5;
            this._camParams.heightOffset = 1.4;
            this._camParams.pitchOffset = 1.0;
            if (this.voiceInside) this.voiceInside.play().catch(e => console.warn(e));
        }
    }

    update(dt, currentState) {
        if (this.isPaused || this.isWaitingForStart) return;

        const actualDt = Math.min(dt || this.clock.getDelta(), 0.1);

        if (this.skybox) { this.skybox.position.copy(this.camera.position); }
        if (this.sunLight && this.playerContainer) {
            this.sunLight.position.set(this._lightParams.sunX, this._lightParams.sunY, this._lightParams.sunZ);
            this.sunLight.target.position.set(0, 0, 0);
        }

        if (this.vanGroup && this.vanModel && this.vanSpeed > 0) {
            this.vanModel.position.y = Math.sin(Date.now() * 0.05) * 0.005;
            this.vanModel.position.x = Math.cos(Date.now() * 0.1) * 0.002;
        } else if (this.vanModel) {
            this.vanModel.position.set(0, 0, 0);
        }

        this._updateVanDust(actualDt);

        if (this.dustParticles) {
            this.dustParticles.material.uniforms.time.value = this.clock.getElapsedTime();
            const positions = this.dustParticles.geometry.attributes.position.array;
            const velocities = this.dustParticles.geometry.attributes.velocity.array;
            const camPos = this.camera.position;
            const speedMult = this._vfxParams.dustSpeed;
            const maxH = this._vfxParams.dustMaxHeight;

            for (let i = 0; i < 1000; i++) {
                positions[i * 3] -= velocities[i * 3] * actualDt * speedMult;
                positions[i * 3 + 1] -= velocities[i * 3 + 1] * actualDt * speedMult;
                positions[i * 3 + 2] -= velocities[i * 3 + 2] * actualDt * speedMult;

                if (positions[i * 3] < camPos.x - 50) positions[i * 3] += 100;
                if (positions[i * 3] > camPos.x + 50) positions[i * 3] -= 100;
                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] += maxH;
                if (positions[i * 3 + 1] > maxH) positions[i * 3 + 1] -= maxH;
                if (positions[i * 3 + 2] < camPos.z - 50) positions[i * 3 + 2] += 100;
                if (positions[i * 3 + 2] > camPos.z + 50) positions[i * 3 + 2] -= 100;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }

        if (this.playerContainer && this.mapReady && !this.isNoclip) {
            const rayOrigin = this.playerContainer.position.clone().add(new THREE.Vector3(0, 1, 0));
            const targets = [this.groundMesh, this.mapGroup].filter(Boolean);
            const hits = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 200).intersectObjects(targets, true);
            if (hits.length > 0) {
                const groundY = hits[0].point.y;
                if (this.playerContainer.position.y <= groundY + 1.2) {
                    this.playerContainer.position.y = THREE.MathUtils.lerp(this.playerContainer.position.y, groundY, 0.25);
                    this.velocityY = 0; this.isOnGround = true;
                } else { this.isOnGround = false; }
            } else { this.isOnGround = false; }

            if (!this.isOnGround && currentState === 'STATE_EXPLORING') {
                this.velocityY -= 28 * actualDt; this.playerContainer.position.y += this.velocityY * actualDt;
            }
        } else if (this.isNoclip) {
            this.isOnGround = true;
            this.velocityY = 0;
        }

        if (currentState === 'STATE_DRIVING' || currentState === 'STATE_ARRIVING') {
            if (currentState === 'STATE_DRIVING' && this.vanProgress >= 0.98) {
                if (this.gameStateManager) this.gameStateManager.setState('STATE_ARRIVING');
            }
            this.vanProgress += this.vanSpeed * actualDt;
            if (this.vanProgress >= 1.0) {
                this.vanProgress = 1.0; this.vanSpeed = 0;
                if (currentState === 'STATE_ARRIVING' && this.gameStateManager) this.gameStateManager.setState('STATE_EXPLORING');
            }
            if (this.vanGroup) {
                const p1 = vanCurve.getPointAt(this.vanProgress);
                this.vanGroup.position.copy(p1);
                if (this.vanProgress < 0.999) { const p2 = vanCurve.getPointAt(Math.min(1.0, this.vanProgress + 0.01)); this.vanGroup.lookAt(p2); }
            }

            if (this.vanGroup) {
                const vanPos = this.vanGroup.position;
                const radius = this._camParams.radius;
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vanGroup.quaternion);

                const cx = vanPos.x - forward.x * radius;
                const cz = vanPos.z - forward.z * radius;
                const camY = vanPos.y + this._camParams.heightOffset;

                this.camera.position.set(cx, camY, cz);
                this.camera.lookAt(vanPos.x, vanPos.y + this._camParams.pitchOffset, vanPos.z);
            }
        }

        if (currentState === 'STATE_EXPLORING') {
            this.handleMovement(actualDt);
            this.handleCamera();
            if (!this.endingTriggered) {
                const dist = this.playerContainer.position.distanceTo(new THREE.Vector3(16.55, 0.07, 175.7));
                if (dist < 3.5) {
                    this.interactUI.style.display = 'block';
                    this.canEnterRocket = true;
                } else {
                    this.interactUI.style.display = 'none';
                    this.canEnterRocket = false;
                }
            }
        } else {
            if (this.isOnGround && !this.isNoclip) this._playAction(this.idleAction);
        }

        if (this.mixer) this.mixer.update(actualDt);

        this._cullFrameCount++;
        if (this.mapGroup && this._cullFrameCount % 15 === 0) {
            const cullDistSq = 900 * 900; const playerPos = this.playerContainer.position; const tempVec = new THREE.Vector3();
            this.mapGroup.children.forEach(child => { child.getWorldPosition(tempVec); child.visible = playerPos.distanceToSquared(tempVec) < cullDistSq; });
        }

        if ((currentState === 'STATE_DRIVING' || currentState === 'STATE_ARRIVING') && this.vanSpeed > 0) {
            if (this.engineAudio && this.engineAudio.paused) this.engineAudio.play().catch(() => { });
        } else {
            if (this.engineAudio && !this.engineAudio.paused) this.engineAudio.pause();
        }
        if (currentState === 'STATE_EXPLORING' && this.guidePath) {
            this.guidePath.visible = true;
            this.guidePath.material.map.offset.x -= 2.0 * actualDt;
        } else if (this.guidePath) {
            this.guidePath.visible = false;
        }
    }

    handleMovement(dt) {
        let speed = this._charParams.moveSpeed;
        if (this.isNoclip) speed *= 6;

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);

        if (!this.isNoclip) {
            forward.y = 0;
            forward.normalize();
        }

        const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, forward).normalize();
        const moveDir = new THREE.Vector3();

        if (this.input.forward) moveDir.add(forward);
        if (this.input.backward) moveDir.sub(forward);
        if (this.input.left) moveDir.add(right);
        if (this.input.right) moveDir.sub(right);

        if (this.isNoclip) {
            if (this.input.up) moveDir.y += 1;
            if (this.input.down) moveDir.y -= 1;
        }

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            if (!this.isNoclip) {
                let speedX = moveDir.x * speed * dt; let speedZ = moveDir.z * speed * dt;
                let canMoveX = true; let canMoveZ = true;
                const rayOrigin = this.playerContainer.position.clone().add(new THREE.Vector3(0, 1, 0));

                if (this.wallGroup) {
                    if (Math.abs(speedX) > 0.001) {
                        const rayX = new THREE.Raycaster(rayOrigin, new THREE.Vector3(Math.sign(speedX), 0, 0), 0, 0.8 + Math.abs(speedX));
                        if (rayX.intersectObject(this.wallGroup, true).length > 0) canMoveX = false;
                    }
                    if (Math.abs(speedZ) > 0.001) {
                        const rayZ = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, 0, Math.sign(speedZ)), 0, 0.8 + Math.abs(speedZ));
                        if (rayZ.intersectObject(this.wallGroup, true).length > 0) canMoveZ = false;
                    }
                }
                if (canMoveX) this.playerContainer.position.x += speedX;
                if (canMoveZ) this.playerContainer.position.z += speedZ;

                if (canMoveX || canMoveZ) {
                    const horizDir = new THREE.Vector3(canMoveX ? moveDir.x : 0, 0, canMoveZ ? moveDir.z : 0);
                    if (horizDir.lengthSq() > 0.01) this._lastMoveAngle = Math.atan2(horizDir.x, horizDir.z);
                    if (this.isOnGround) this._playAction(this.runAction);
                } else {
                    if (this.isOnGround) this._playAction(this.idleAction);
                }
            } else {
                this.playerContainer.position.add(moveDir.multiplyScalar(speed * dt));
                const horizDir = new THREE.Vector3(moveDir.x, 0, moveDir.z);
                if (horizDir.lengthSq() > 0.01) this._lastMoveAngle = Math.atan2(horizDir.x, horizDir.z);
            }
        } else {
            if (this.isOnGround && !this.isNoclip) this._playAction(this.idleAction);
        }

        if (this.isNoclip) {
            this._playAction(this.idleAction);
        }

        if (this.playerModel && !this.isNoclip) {
            let moveAngle = (this._lastMoveAngle !== undefined ? this._lastMoveAngle : 0);
            let targetAngle = moveAngle + (moveDir.lengthSq() > 0 ? this._charParams.rotationOffset : this._charParams.idleRotationOffset);

            let diff = targetAngle - this.playerModel.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.playerModel.rotation.y += diff * 24.0 * dt;
        }
    }

    handleCamera() {
        const player = this.playerContainer.position;
        if (this.isNoclip) {
            this.cameraPitch = Math.max(-0.5, Math.min(0.8, this.cameraPitch));
        } else {
            this.cameraPitch = Math.max(-0.5, Math.min(0.8, this.cameraPitch));
        }
        const radius = this._camParams.radius;
        const camY = player.y + this._camParams.pitchOffset + Math.sin(this.cameraPitch) * radius;
        const cx = player.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        const cz = player.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * radius;
        const finalCamY = this.isNoclip ? camY : Math.max(player.y + 0.8, camY);
        this.camera.position.set(cx, finalCamY, cz);
        this.camera.lookAt(player.x, player.y + this._camParams.pitchOffset, player.z);
    }

    _playAction(action) {
        if (!action || this.currentAction === action) return;
        if (this.currentAction) this.currentAction.stop();
        action.reset().setEffectiveWeight(1).play();
        this.currentAction = action;
    }

    setupInput() {
        document.addEventListener('pointerlockchange', () => {
            const isLocked = document.pointerLockElement !== null;
            if (!isLocked && !this.cursorUnlocked) this.togglePause(true);
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.input.forward = true;
            if (e.code === 'KeyS') this.input.backward = true;
            if (e.code === 'KeyA') this.input.left = true;
            if (e.code === 'KeyD') this.input.right = true;
            if (e.code === 'Space') this.input.up = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.down = true;

            if (e.code === 'KeyV') {
                this.isNoclip = !this.isNoclip;
                console.log('Noclip Mode:', this.isNoclip);
            }

            if (e.code === 'KeyM') {
                this.cursorUnlocked = !this.cursorUnlocked;
                if (this.cursorUnlocked) { document.exitPointerLock(); this.togglePause(false); }
                else { this.renderer.domElement.requestPointerLock(); }
            }
            if (e.code === 'KeyE' && this.canEnterRocket && !this.endingTriggered) { this.triggerEnding(); }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.input.forward = false;
            if (e.code === 'KeyS') this.input.backward = false;
            if (e.code === 'KeyA') this.input.left = false;
            if (e.code === 'KeyD') this.input.right = false;
            if (e.code === 'Space') this.input.up = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.down = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement && !this.isPaused && !this.cursorUnlocked) {
                this.cameraAngle -= e.movementX * 0.003; this.cameraPitch += e.movementY * 0.002;
            }
        });

        window.addEventListener('wheel', (e) => {
            if (!this.isPaused && !this.cursorUnlocked) {
                this._camParams.radius += Math.sign(e.deltaY) * 0.15;
                this._camParams.radius = Math.max(1.0, Math.min(10.0, this._camParams.radius));
            }
        }, { passive: true });

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (this._loggerParams.enabled) {
                const rect = this.renderer.domElement.getBoundingClientRect();
                const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
                const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(mouse, this.camera);
                if (this.mapGroup) {
                    const hits = raycaster.intersectObject(this.mapGroup, true);
                    if (hits.length > 0) {
                        const pt = hits[0].point; this.waypoints.push(pt);
                        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                        sphere.position.copy(pt); this.scene.add(sphere); this.waypointSpheres.push(sphere);
                        if (this.waypointLine) { this.waypointLine.geometry.setFromPoints(this.waypoints); }
                        else {
                            this.waypointLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.waypoints), new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 }));
                            this.scene.add(this.waypointLine);
                        }
                    }
                }
            } else if (!this.isPaused && !this.cursorUnlocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        const overlay = document.getElementById('pause-overlay');
        if (overlay && !overlay.querySelector('h1')) overlay.innerHTML = `<h1>PAUSED</h1>` + overlay.innerHTML;
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) resumeBtn.addEventListener('click', () => { this.togglePause(false); this.cursorUnlocked = false; this.renderer.domElement.requestPointerLock(); });
    }

    triggerEnding() {
        this.endingTriggered = true;
        this.isPaused = true;
        this.canEnterRocket = false;
        if (this.interactUI) this.interactUI.style.display = 'none';
        const objBox = document.getElementById('sparc_objective_box');
        if (objBox) objBox.style.display = 'none';

        const endIris = document.createElement('div');
        endIris.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:300vmax;height:300vmax;border-radius:50%;box-shadow:0 0 0 300vmax #000;z-index:999999;pointer-events:all;transition:width 1.5s cubic-bezier(0.85, 0, 0.15, 1), height 1.5s cubic-bezier(0.85, 0, 0.15, 1);';
        document.body.appendChild(endIris);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                endIris.style.width = '0px';
                endIris.style.height = '0px';
            });
        });

        setTimeout(() => {
            if (this.musicAudio) this.musicAudio.pause();
            if (this.engineAudio) this.engineAudio.pause();
            if (this.voiceAlmost) this.voiceAlmost.pause();
            if (this.voiceInside) this.voiceInside.pause();
        }, 1500);
    }

    togglePause(val) {
        this.isPaused = val;
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.style.display = this.isPaused ? 'flex' : 'none';

        if (this.isPaused) {
            this._resumeMusic = this.musicAudio && !this.musicAudio.paused;
            this._resumeEngine = this.engineAudio && !this.engineAudio.paused;
            if (this._resumeMusic) this.musicAudio.pause();
            if (this._resumeEngine) this.engineAudio.pause();
        } else {
            if (this._resumeMusic && this.musicAudio) this.musicAudio.play().catch(e => console.warn(e));
            if (this._resumeEngine && this.engineAudio) this.engineAudio.play().catch(e => console.warn(e));
        }
    }
}
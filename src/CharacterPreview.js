import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

import pilotTimmyUrl from '../assets/models/pilot_timmy.fbx?url';
import pilotAmiUrl from '../assets/models/pilot_ami.fbx?url';
import pilotBryceUrl from '../assets/models/pilot_bryce.fbx?url';
import pilotAdamUrl from '../assets/models/pilot_adam.fbx?url';
import pilotJackieUrl from '../assets/models/pilot_jackie.fbx?url';
import pilotMichelleUrl from '../assets/models/pilot_michelle.fbx?url';

import desertUrl from '../assets/models/desert_landscape.glb?url';
import skyboxUrl from '../assets/models/skybox_skydays_3.glb?url';
import vanUrl from '../assets/models/van.glb?url';
import birdsUrl from '../assets/models/birds.glb?url';
import singularBirdUrl from '../assets/models/4kbird.glb?url';

import carJeepUrl from '../assets/models/car_jeep_wrangler_white.glb?url';
import carSuvYUrl from '../assets/models/car_suv_yellow.glb?url';
import carTruckUrl from '../assets/models/car_truck_orange.glb?url';

import bgBonesUrl from '../assets/images/bg_bones.png?url';
import bgLungsUrl from '../assets/images/bg_lungs.png?url';
import bgCellsUrl from '../assets/images/bg_cells.png?url';

import engineSoundUrl from '../assets/audio/engine.mp3?url';
import ambientSoundUrl from '../assets/audio/ambient_desert.mp3?url';

let scene, camera, renderer, roomModel, skyboxModel, vanModel, gui, dustParticles, singleBirdModel, flockModel, orbitControls;
let audioListener, engineAudioBuffer, ambientAudio;
const clock = new THREE.Clock();
let activeMixer = null;
const envMixers = [];
const modelCache = {};
let activeCharacter = null;
let modelsLoadedCount = 0;
const TOTAL_MODELS = 6;
let targetProgress = 0;
let currentProgress = 0;
let skyMaterials = [];

const waypoints = [];
const waypointSpheres = [];
let waypointLine = null;

const MAX_DUST = 1000;
const MAX_TRAIL_PARTICLES = 500;

const DEFAULT_CAM = new THREE.Vector3(-0.2622108185501598, 1.4499852635894692, -4.443412469553862);
const DEFAULT_TARGET = new THREE.Vector3(-0.2230511292118383, 0.89570560165883, -0.049192076267895325);

const carPrototypes = {};
const activeCars = [];
const curves = {};
let sharedTrailTexture = null;

const pilots = [
    { id: 'timmy', name: 'Timmy' },
    { id: 'ami', name: 'Ami' },
    { id: 'bryce', name: 'Bryce' },
    { id: 'adam', name: 'Adam' },
    { id: 'jackie', name: 'Jackie' },
    { id: 'michelle', name: 'Michelle' }
];
let currentPilotIndex = 0;

const lightingPresets = {
    'Preset 1': { ambientInt: 2.745, sunInt: 2.3, sunX: -27, sunY: 24.6, sunZ: 19.7 },
    'Preset 2': { ambientInt: 2.38, sunInt: 1.93, sunX: 30.7, sunY: -9.8, sunZ: -34.4 },
    'Preset 3': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 8.6, sunZ: -11.1 },
    'Preset 4': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 9.8, sunZ: -11 },
    'Preset 5': { ambientInt: 1.085, sunInt: 3.77, sunX: -3.7, sunY: 7.4, sunZ: -7.4 },
    'Custom': {}
};

const settings = {
    mouseMode: 'Rotate Character',
    charRotation: 3.13,
    charYOffset: 0.07,
    activePreset: 'Preset 1',
    ambientInt: 2.745,
    sunInt: 2.3,
    sunX: -27, sunY: 24.6, sunZ: 19.7,
    skyIntensity: 1.0,
    skyTint: '#ffffff',
    camX: DEFAULT_CAM.x,
    camY: DEFAULT_CAM.y,
    camZ: DEFAULT_CAM.z,
    targetX: DEFAULT_TARGET.x,
    targetY: DEFAULT_TARGET.y,
    targetZ: DEFAULT_TARGET.z,
    camDistance: 4.429213506895924,
    mapX: 6.3,
    mapY: 0.07,
    mapZ: 109.8,
    mapRot: 0,
    mapScale: 1.71,
    dustCount: 300,
    dustSize: 0.19,
    dustOpacity: 0.51,
    dustSpeed: 1.0,
    dustMaxHeight: 4.5,
    birdX: 1.23,
    birdY: 2.37,
    birdZ: 0.72,
    birdRot: -2.39,
    birdScale: 0.56,
    birdAnimIndex: 1,
    flockX: -7.4,
    flockY: 7.4,
    flockZ: 46.7,
    flockRot: 1.62,
    flockScale: 1.46,
    leftSpeed: 0.066,
    rightSpeed: 0.059,
    switchSpeed: 0.084,
    loggerEnabled: false,
    resetTraffic: () => {
        settings.leftSpeed = 0.066;
        settings.rightSpeed = 0.059;
        settings.switchSpeed = 0.084;

        carSettings.jeep.scale = 0.77; carSettings.jeep.rotY = 0; carSettings.jeep.offsetX = 0; carSettings.jeep.offsetY = 0.96; carSettings.jeep.offsetZ = 0;
        carSettings.jeep.trailZ = -3.0; carSettings.jeep.trailY = -1.0; carSettings.jeep.wheelWidth = 0.8; carSettings.jeep.trailSpread = 0.8; carSettings.jeep.trailSize = 0.8; carSettings.jeep.trailLifetime = 0.3; carSettings.jeep.trailCount = 500; carSettings.jeep.trailOpacity = 0.02; carSettings.jeep.trailColor = '#dcd0c2';

        carSettings.suvy.scale = 1.3; carSettings.suvy.rotY = 0; carSettings.suvy.offsetX = 0; carSettings.suvy.offsetY = 0.36; carSettings.suvy.offsetZ = 0;
        carSettings.suvy.trailZ = -0.9; carSettings.suvy.trailY = -0.2; carSettings.suvy.wheelWidth = 0.4; carSettings.suvy.trailSpread = 0.8; carSettings.suvy.trailSize = 0.8; carSettings.suvy.trailLifetime = 0.3; carSettings.suvy.trailCount = 500; carSettings.suvy.trailOpacity = 0.02; carSettings.suvy.trailColor = '#ece9dd';

        carSettings.truck.scale = 1.26; carSettings.truck.rotY = 0; carSettings.truck.offsetX = 0; carSettings.truck.offsetY = 0.03; carSettings.truck.offsetZ = 0;
        carSettings.truck.trailZ = -1.2; carSettings.truck.trailY = 0.2; carSettings.truck.wheelWidth = 0.7; carSettings.truck.trailSpread = 0.8; carSettings.truck.trailSize = 0.8; carSettings.truck.trailLifetime = 0.3; carSettings.truck.trailCount = 500; carSettings.truck.trailOpacity = 0.03; carSettings.truck.trailColor = '#5c5c5c';

        if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
    },
    resetCamera: () => {
        if (camera && orbitControls) {
            camera.position.copy(DEFAULT_CAM);
            orbitControls.target.copy(DEFAULT_TARGET);
            orbitControls.update();
            settings.camX = DEFAULT_CAM.x;
            settings.camY = DEFAULT_CAM.y;
            settings.camZ = DEFAULT_CAM.z;
            settings.targetX = DEFAULT_TARGET.x;
            settings.targetY = DEFAULT_TARGET.y;
            settings.targetZ = DEFAULT_TARGET.z;
            settings.camDistance = camera.position.distanceTo(orbitControls.target);
        }
    },
    printPath: () => {
        if (waypoints.length === 0) return console.warn("No waypoints logged.");
        const str = waypoints.map(w => `new THREE.Vector3(${w.x.toFixed(2)}, ${w.y.toFixed(2)}, ${w.z.toFixed(2)})`).join(',\n    ');
        console.log("[\n    " + str + "\n]");
        alert("Path dumped to Browser Console (F12). Copy it.");
    },
    clearPath: () => {
        waypoints.length = 0;
        if (waypointLine) waypointLine.geometry.setFromPoints([]);
        waypointSpheres.forEach(s => scene.remove(s));
        waypointSpheres.length = 0;
    }
};

const carSettings = {
    jeep: { scale: 0.77, rotY: 0, offsetX: 0, offsetY: 0.96, offsetZ: 0, trailZ: -3.0, trailY: -1.0, wheelWidth: 0.8, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.02, trailColor: '#dcd0c2' },
    suvy: { scale: 1.3, rotY: 0, offsetX: 0, offsetY: 0.36, offsetZ: 0, trailZ: -0.9, trailY: -0.2, wheelWidth: 0.4, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.02, trailColor: '#ece9dd' },
    truck: { scale: 1.26, rotY: 0, offsetX: 0, offsetY: 0.03, offsetZ: 0, trailZ: -1.2, trailY: 0.2, wheelWidth: 0.7, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.03, trailColor: '#5c5c5c' }
};

const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&display=swap';
document.head.appendChild(fontLink);

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes barShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .bottom-gradient { position: absolute; bottom: 0; left: 0; width: 100vw; height: 250px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); z-index: 99; pointer-events: none; }
    .hud-wrapper { position: absolute; bottom: 70px; left: 46%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 100; font-family: 'Fredoka', sans-serif; pointer-events: none; }
    .hud-controls { display: flex; align-items: center; gap: 30px; margin-bottom: 10px; pointer-events: auto; }
    .arrow-btn { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 2.8rem; cursor: pointer; transition: all 0.2s ease; padding: 0; outline: none; text-shadow: 0 4px 10px rgba(0,0,0,0.8); }
    .arrow-btn:hover { color: #ffffff; transform: scale(1.15); text-shadow: 0 0 20px rgba(255,255,255,0.8); }
    .indicator-num { color: #ffffff; font-size: 2.8rem; font-weight: 700; min-width: 50px; text-align: center; text-shadow: 0 4px 15px rgba(0,0,0,1), 0 0 20px rgba(255,255,255,0.2); }
    .start-btn { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.6); padding: 10px 40px; font-size: 1.1rem; font-weight: bold; cursor: pointer; border-radius: 4px; letter-spacing: 5px; transition: all 0.2s ease; text-transform: uppercase; text-shadow: 0 2px 5px rgba(0,0,0,0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.5); pointer-events: auto; }
    .start-btn:hover { background: rgba(255,255,255,1); color: #000; text-shadow: none; box-shadow: 0 0 25px rgba(255,255,255,0.5); border-color: #ffffff; }
`;
document.head.appendChild(styleSheet);

const loadingData = [
    { bg: bgBonesUrl, color: '#00ffff', fact: "Babies are born with 300 bones, but adults only have 206!", layout: 'top', textTop: '3.5vh', barBottom: '5vh', barWidth: '90%' },
    { bg: bgLungsUrl, color: '#ff66b3', fact: "Your lungs can hold about 1.5 gallons (6 liters) of air!", layout: 'right', rightOffset: '14vw' },
    { bg: bgCellsUrl, color: '#ff3333', fact: "Normal red blood cells are shaped like inner tubes, but sickle cells look like crescent moons!", layout: 'top', textTop: '1.5vh', factFontSize: '1.8vw', barBottom: '5vh', barWidth: '90%' }
];
const selectedScreen = loadingData[Math.floor(Math.random() * loadingData.length)];

const fadeUI = document.createElement('div');
fadeUI.id = "sparc-master-loading-screen";
fadeUI.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-image: url(${selectedScreen.bg}); background-size: cover; background-position: center; z-index: 99999; transition: opacity 1.5s ease-in-out; font-family: 'Fredoka', sans-serif; pointer-events: none; overflow: hidden;`;

const noiseOverlay = document.createElement('div');
noiseOverlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.12; pointer-events: none;`;
fadeUI.appendChild(noiseOverlay);

if (selectedScreen.layout === 'top') {
    fadeUI.innerHTML = `
        <div style="position: absolute; top: ${selectedScreen.textTop}; left: 50%; transform: translateX(-50%); width: 85%; max-width: 1400px; text-align: center;">
            <div style="font-size: 1.1vw; font-weight: 700; letter-spacing: 3px; color: ${selectedScreen.color}; margin-bottom: 2px; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);">FUN FACT</div>
            <h1 style="font-size: ${selectedScreen.factFontSize || '3.2vw'}; font-weight: 700; margin: 0; line-height: 1.2; color: #ffffff; text-shadow: 0px 4px 12px rgba(0,0,0,1);">${selectedScreen.fact}</h1>
        </div>
        <div style="position: absolute; bottom: ${selectedScreen.barBottom}; left: 50%; transform: translateX(-50%); width: ${selectedScreen.barWidth || '40%'}; display: flex; flex-direction: column; align-items: center;">
            <div id="loading-text" style="font-size: 1.1vw; font-weight: 700; margin-bottom: 8px; color: #ffffff; text-shadow: 0px 2px 6px rgba(0,0,0,1);">LOADING... 0%</div>
            <div style="width: 100%; height: 12px; background: rgba(0,0,0,0.7); border-radius: 20px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);"><div id="loading-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, ${selectedScreen.color} 0%, #ffffff 50%, ${selectedScreen.color} 100%); background-size: 200% 100%; animation: barShimmer 2s infinite linear; box-shadow: 0 0 15px ${selectedScreen.color};"></div></div>
        </div>
    `;
} else {
    fadeUI.innerHTML = `
        <div style="position: absolute; top: 50%; right: ${selectedScreen.rightOffset}; transform: translateY(-50%); width: 35vw; display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
            <div style="font-size: 1.1vw; font-weight: 700; letter-spacing: 3px; color: ${selectedScreen.color}; margin-bottom: 2px; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);">FUN FACT</div>
            <h1 style="font-size: 3vw; font-weight: 700; margin: 0; margin-bottom: 4vh; line-height: 1.2; color: #ffffff; text-shadow: 0px 4px 12px rgba(0,0,0,1);">${selectedScreen.fact}</h1>
            <div style="width: 100%; display: flex; flex-direction: column; align-items: flex-end;">
                <div id="loading-text" style="font-size: 1.1vw; font-weight: 700; margin-bottom: 8px; color: #ffffff; text-shadow: 0px 2px 6px rgba(0,0,0,1);">LOADING... 0%</div>
                <div style="width: 100%; height: 12px; background: rgba(0,0,0,0.7); border-radius: 20px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);"><div id="loading-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, ${selectedScreen.color} 0%, #ffffff 50%, ${selectedScreen.color} 100%); background-size: 200% 100%; animation: barShimmer 2s infinite linear; box-shadow: 0 0 15px ${selectedScreen.color};"></div></div>
            </div>
        </div>
    `;
}

function createPilotSelectUI(container) {
    const gradient = document.createElement('div');
    gradient.className = 'bottom-gradient';
    container.appendChild(gradient);

    const nav = document.createElement('div');
    nav.className = 'hud-wrapper';

    const controls = document.createElement('div');
    controls.className = 'hud-controls';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'arrow-btn';
    leftBtn.innerHTML = '&#10094;';
    leftBtn.onclick = () => {
        currentPilotIndex = (currentPilotIndex - 1 + pilots.length) % pilots.length;
        updatePilotSelection();
    };

    const currentNumDisplay = document.createElement('div');
    currentNumDisplay.id = 'current-pilot-num';
    currentNumDisplay.className = 'indicator-num';
    currentNumDisplay.innerText = '1';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'arrow-btn';
    rightBtn.innerHTML = '&#10095;';
    rightBtn.onclick = () => {
        currentPilotIndex = (currentPilotIndex + 1) % pilots.length;
        updatePilotSelection();
    };

    controls.appendChild(leftBtn);
    controls.appendChild(currentNumDisplay);
    controls.appendChild(rightBtn);
    nav.appendChild(controls);

    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn';
    startBtn.innerText = "SELECT";
    startBtn.onclick = () => {
        localStorage.setItem('selectedPilot', pilots[currentPilotIndex].name);
        window.location.href = 'game.html';
    };
    nav.appendChild(startBtn);

    container.appendChild(nav);
}

function updatePilotSelection() {
    document.getElementById('current-pilot-num').innerText = (currentPilotIndex + 1).toString();
    loadPreviewModel(pilots[currentPilotIndex].id);
}

function setupDustVFX() {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_DUST * 3);
    const velocities = new Float32Array(MAX_DUST * 3);
    const phases = new Float32Array(MAX_DUST);

    for (let i = 0; i < MAX_DUST; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = Math.random() * settings.dustMaxHeight;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

        velocities[i * 3] = (Math.random() - 0.5) * 0.8;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

        phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setDrawRange(0, settings.dustCount);

    const dustVertexShader = `
        attribute vec3 velocity;
        attribute float phase;
        varying float vAlpha;
        uniform float time;
        uniform float size;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (10.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            vAlpha = (sin(time * 0.5 + phase) + 1.0) * 0.5;
        }
    `;

    const dustFragmentShader = `
        uniform sampler2D pointTexture;
        uniform vec3 baseColor;
        uniform float globalOpacity;
        varying float vAlpha;
        void main() {
            vec4 texColor = texture2D(pointTexture, gl_PointCoord);
            gl_FragColor = vec4(baseColor, texColor.a * vAlpha * globalOpacity);
        }
    `;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            pointTexture: { value: texture },
            baseColor: { value: new THREE.Color(0xedcca8) },
            globalOpacity: { value: settings.dustOpacity },
            size: { value: settings.dustSize * 100.0 }
        },
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    dustParticles = new THREE.Points(geometry, material);
    dustParticles.frustumCulled = false;
    scene.add(dustParticles);

    const tCanvas = document.createElement('canvas');
    tCanvas.width = 64; tCanvas.height = 64;
    const tCtx = tCanvas.getContext('2d');
    tCtx.beginPath();
    tCtx.arc(32, 32, 28, 0, Math.PI * 2);
    tCtx.fillStyle = 'rgba(255, 255, 255, 1)';
    tCtx.fill();
    sharedTrailTexture = new THREE.CanvasTexture(tCanvas);
}

function processCarModel(model, id) {
    model.traverse(child => {
        if (child.isMesh) {
            const n = child.name.toLowerCase();
            const matN = child.material && child.material.name ? child.material.name.toLowerCase() : '';
            if (n.includes('wheel') || n.includes('tire') || matN.includes('wheel') || matN.includes('tire') || n.includes('roda') || n.includes('pneu')) {
                child.material = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0.1 });
            }
        }
    });
    carPrototypes[id] = model;
}

function spawnRandomCarScenario() {
    const keys = Object.keys(carPrototypes);
    if (keys.length < 3) return;

    const roll = Math.random();

    function getCar(exclude) {
        let c;
        do {
            c = keys[Math.floor(Math.random() * keys.length)];
        } while (exclude.includes(c));
        return c;
    }

    if (roll < 0.33) {
        const car1 = getCar(['truck']);
        spawnCar(curves.left, car1, 'leftSpeed', -0.15);
    } else if (roll < 0.66) {
        const car1 = getCar([]);
        spawnCar(curves.right, car1, 'rightSpeed', -0.15);
    } else {
        const car1 = getCar([]);
        const car2 = getCar([car1]);
        spawnCar(curves.right, car1, 'rightSpeed', -0.15);
        spawnCar(curves.rtol, car2, 'switchSpeed', -0.35);
    }
}

function spawnCar(curve, modelId, speedSetting, startProgress) {
    if (!carPrototypes[modelId]) return;
    const mesh = carPrototypes[modelId].clone();
    mesh.visible = false;

    const tuning = carSettings[modelId];
    const trailGeo = new THREE.BufferGeometry();
    const tPos = new Float32Array(MAX_TRAIL_PARTICLES * 3);
    const tAge = new Float32Array(MAX_TRAIL_PARTICLES);

    for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
        tAge[i] = 999.0;
    }

    trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    trailGeo.setAttribute('age', new THREE.BufferAttribute(tAge, 1));

    const trailVertexShader = `
        attribute float age;
        varying float vAlpha;
        uniform float maxAge;
        uniform float size;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float life = age / maxAge;
            float currentSize = size * (1.0 + life * 2.0); 
            gl_PointSize = currentSize * (10.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            vAlpha = max(0.0, 1.0 - life);
        }
    `;

    const trailFragmentShader = `
        uniform sampler2D pointTexture;
        uniform vec3 baseColor;
        uniform float masterOpacity;
        varying float vAlpha;
        void main() {
            vec4 texColor = texture2D(pointTexture, gl_PointCoord);
            if (texColor.a < 0.5) discard;
            gl_FragColor = vec4(baseColor, vAlpha * masterOpacity);
        }
    `;

    const trailMat = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: sharedTrailTexture },
            baseColor: { value: new THREE.Color(tuning.trailColor) },
            maxAge: { value: tuning.trailLifetime },
            masterOpacity: { value: tuning.trailOpacity },
            size: { value: tuning.trailSize * 100.0 }
        },
        vertexShader: trailVertexShader,
        fragmentShader: trailFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    const trail = new THREE.Points(trailGeo, trailMat);
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);

    let audio1 = null, audio2 = null;
    let audioDuration = 0;

    if (engineAudioBuffer) {
        const rate = 0.8 + Math.random() * 0.4;
        audioDuration = engineAudioBuffer.duration / rate;

        audio1 = new THREE.PositionalAudio(audioListener);
        audio1.setBuffer(engineAudioBuffer);
        audio1.setRefDistance(3);
        audio1.setMaxDistance(65);
        audio1.setDistanceModel('linear');
        audio1.setRolloffFactor(1);
        audio1.setVolume(0.20);
        audio1.setPlaybackRate(rate);

        audio2 = new THREE.PositionalAudio(audioListener);
        audio2.setBuffer(engineAudioBuffer);
        audio2.setRefDistance(3);
        audio2.setMaxDistance(65);
        audio2.setDistanceModel('linear');
        audio2.setRolloffFactor(1);
        audio2.setVolume(0.20);
        audio2.setPlaybackRate(rate);

        mesh.add(audio1);
        mesh.add(audio2);
    }

    scene.add(mesh);
    activeCars.push({ mesh, curve, speedSetting, progress: startProgress, modelId, trail, audio1, audio2, activeAudio: 1, audioTimer: 0, audioDuration });
}

export function initPreview(container) {
    if (!document.getElementById("sparc-master-loading-screen")) { document.body.appendChild(fadeUI); }
    createPilotSelectUI(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#333333');

    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 15000);
    camera.position.copy(DEFAULT_CAM);

    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(engineSoundUrl, (buffer) => {
        engineAudioBuffer = buffer;
    });

    ambientAudio = new THREE.Audio(audioListener);
    audioLoader.load(ambientSoundUrl, (buffer) => {
        ambientAudio.setBuffer(buffer);
        ambientAudio.setLoop(true);
        ambientAudio.setVolume(0.65);
    });

    document.body.addEventListener('mousedown', () => {
        if (audioListener.context.state === 'suspended') {
            audioListener.context.resume();
        }
        if (ambientAudio && !ambientAudio.isPlaying) {
            ambientAudio.play();
        }
    }, { once: true });

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.copy(DEFAULT_TARGET);
    orbitControls.enabled = (settings.mouseMode === 'Camera Orbit' && !settings.loggerEnabled);
    orbitControls.update();

    curves.left = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.42, 0.21, -9.01), new THREE.Vector3(-2.52, 0.21, 3.33), new THREE.Vector3(-4.45, 0.26, 31.54),
        new THREE.Vector3(-6.89, 0.35, 50.77), new THREE.Vector3(-9.88, 0.44, 66.22), new THREE.Vector3(-13.30, 0.48, 79.10),
        new THREE.Vector3(-17.77, 0.49, 92.42), new THREE.Vector3(-27.95, 0.49, 120.26), new THREE.Vector3(-29.98, 0.49, 126.96),
        new THREE.Vector3(-30.40, 0.49, 129.73), new THREE.Vector3(-28.60, 0.49, 147.65), new THREE.Vector3(-28.35, 0.49, 162.36),
        new THREE.Vector3(-29.15, 0.49, 177.65), new THREE.Vector3(-31.20, 0.49, 197.09), new THREE.Vector3(-31.23, 0.49, 200.03),
        new THREE.Vector3(-30.45, 0.49, 202.47), new THREE.Vector3(-29.25, 0.49, 203.94), new THREE.Vector3(-26.94, 0.49, 205.04),
        new THREE.Vector3(-24.35, 0.49, 205.41), new THREE.Vector3(-20.78, 0.49, 204.78), new THREE.Vector3(-13.82, 0.49, 202.87)
    ]);
    curves.right = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.33, 0.21, -7.58), new THREE.Vector3(-5.36, 0.21, 7.58), new THREE.Vector3(-7.13, 0.26, 31.14),
        new THREE.Vector3(-9.43, 0.35, 50.12), new THREE.Vector3(-12.49, 0.44, 65.06), new THREE.Vector3(-16.27, 0.48, 78.83),
        new THREE.Vector3(-20.49, 0.49, 91.57), new THREE.Vector3(-30.81, 0.49, 119.86), new THREE.Vector3(-32.66, 0.49, 126.84),
        new THREE.Vector3(-33.11, 0.49, 129.52), new THREE.Vector3(-32.30, 0.49, 136.70), new THREE.Vector3(-31.30, 0.49, 148.53),
        new THREE.Vector3(-31.00, 0.49, 162.77), new THREE.Vector3(-31.84, 0.49, 177.47), new THREE.Vector3(-33.76, 0.49, 197.39),
        new THREE.Vector3(-33.51, 0.49, 201.45), new THREE.Vector3(-32.27, 0.49, 203.94), new THREE.Vector3(-30.65, 0.49, 206.08),
        new THREE.Vector3(-28.08, 0.49, 207.56), new THREE.Vector3(-24.86, 0.49, 208.34), new THREE.Vector3(-20.80, 0.49, 208.07),
        new THREE.Vector3(14.53, 0.49, 198.03), new THREE.Vector3(35.25, 0.49, 192.16)
    ]);
    curves.rtol = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.28, 0.21, -7.60), new THREE.Vector3(-4.97, 0.21, 1.87), new THREE.Vector3(-5.51, 0.21, 7.58),
        new THREE.Vector3(-7.06, 0.26, 31.15), new THREE.Vector3(-6.87, 0.35, 51.04), new THREE.Vector3(-9.87, 0.44, 66.02),
        new THREE.Vector3(-13.28, 0.48, 79.09), new THREE.Vector3(-17.67, 0.49, 92.72), new THREE.Vector3(-27.94, 0.49, 120.58),
        new THREE.Vector3(-29.92, 0.49, 126.87), new THREE.Vector3(-30.35, 0.49, 129.23), new THREE.Vector3(-28.66, 0.49, 147.49),
        new THREE.Vector3(-28.18, 0.49, 162.33), new THREE.Vector3(-29.06, 0.49, 177.21), new THREE.Vector3(-30.74, 0.49, 195.03),
        new THREE.Vector3(-31.17, 0.49, 198.49), new THREE.Vector3(-30.90, 0.49, 201.42), new THREE.Vector3(-29.58, 0.49, 203.86),
        new THREE.Vector3(-27.06, 0.49, 205.31), new THREE.Vector3(-24.07, 0.49, 205.64), new THREE.Vector3(-20.38, 0.49, 204.93),
        new THREE.Vector3(-13.80, 0.49, 203.01), new THREE.Vector3(16.38, 0.49, 194.44), new THREE.Vector3(40.87, 0.49, 187.75),
        new THREE.Vector3(48.36, 0.49, 185.62), new THREE.Vector3(51.28, 0.49, 184.63)
    ]);

    gui = new GUI({ title: 'God Mode Tools' });

    gui.add(settings, 'mouseMode', ['Camera Orbit', 'Rotate Character']).name('Left Click Action').onChange(v => {
        if (orbitControls) orbitControls.enabled = (v === 'Camera Orbit' && !settings.loggerEnabled);
    });

    const camFolder = gui.addFolder('Camera Setup (Live Values)');
    camFolder.add(settings, 'resetCamera').name('Reset Camera');
    camFolder.add(settings, 'camDistance').name('Cam Distance (Zoom)').listen().disable();
    camFolder.add(settings, 'camX').name('Cam X').listen().disable();
    camFolder.add(settings, 'camY').name('Cam Y').listen().disable();
    camFolder.add(settings, 'camZ').name('Cam Z').listen().disable();
    camFolder.add(settings, 'targetX').name('Target X').listen().disable();
    camFolder.add(settings, 'targetY').name('Target Y').listen().disable();
    camFolder.add(settings, 'targetZ').name('Target Z').listen().disable();

    const mapFolder = gui.addFolder('Map Transform');
    mapFolder.add(settings, 'mapX', -500, 500, 0.1).name('Map X');
    mapFolder.add(settings, 'mapY', -10, 10, 0.01).name('Map Y');
    mapFolder.add(settings, 'mapZ', -2000, 2000, 0.1).name('Map Z');
    mapFolder.add(settings, 'mapRot', -Math.PI, Math.PI, 0.01).name('Map Rotation');
    mapFolder.add(settings, 'mapScale', 0.1, 10, 0.01).name('Map Scale');

    const charFolder = gui.addFolder('Character Controls');
    charFolder.add(settings, 'charRotation', -Math.PI, Math.PI).name('Model Rotation').listen();
    charFolder.add(settings, 'charYOffset', -1, 1, 0.01).name('Model Height (Y)').listen();

    const trafficFolder = gui.addFolder('Traffic Tuning');
    trafficFolder.add(settings, 'resetTraffic').name('Reset Traffic & Cars');
    trafficFolder.add(settings, 'leftSpeed', 0, 0.5, 0.001).name('Left Speed').listen();
    trafficFolder.add(settings, 'rightSpeed', 0, 0.5, 0.001).name('Right Speed').listen();
    trafficFolder.add(settings, 'switchSpeed', 0, 0.5, 0.001).name('Switch Speed').listen();

    const carTuningFolder = gui.addFolder('Car Tuning (Live)');
    ['jeep', 'suvy', 'truck'].forEach(id => {
        const f = carTuningFolder.addFolder(id.toUpperCase());
        f.add(carSettings[id], 'scale', 0.01, 5.0, 0.01).name('Scale').listen();
        f.add(carSettings[id], 'rotY', -Math.PI, Math.PI, 0.01).name('Rot Y (Yaw)').listen();
        f.add(carSettings[id], 'offsetX', -5, 5, 0.01).name('Offset X (Left/Right)').listen();
        f.add(carSettings[id], 'offsetY', -5, 5, 0.01).name('Offset Y (Up/Down)').listen();
        f.add(carSettings[id], 'offsetZ', -5, 5, 0.01).name('Offset Z (Fwd/Back)').listen();
        f.add(carSettings[id], 'trailZ', -10, 10, 0.1).name('Dust Z (Front/Back)').listen();
        f.add(carSettings[id], 'trailY', -2, 5, 0.1).name('Dust Y (Height)').listen();
        f.add(carSettings[id], 'wheelWidth', 0.1, 5, 0.1).name('Wheel Width').listen();
        f.add(carSettings[id], 'trailSpread', 0, 5, 0.1).name('Dust Spread').listen();
        f.add(carSettings[id], 'trailSize', 0.1, 5, 0.1).name('Particle Size').listen();
        f.add(carSettings[id], 'trailLifetime', 0.1, 5, 0.1).name('Lifetime').listen();
        f.add(carSettings[id], 'trailCount', 0, MAX_TRAIL_PARTICLES, 1).name('Dust Count').listen();
        f.add(carSettings[id], 'trailOpacity', 0, 1, 0.01).name('Opacity').listen();
        f.addColor(carSettings[id], 'trailColor').name('Color').listen();
    });

    const ambientLight = new THREE.AmbientLight(0xffeedd, settings.ambientInt);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaeb, settings.sunInt);
    sunLight.position.set(settings.sunX, settings.sunY, settings.sunZ);
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const lightFolder = gui.addFolder('Lighting Tweaks');
    lightFolder.add(settings, 'activePreset', Object.keys(lightingPresets)).name('Preset').onChange(presetName => {
        if (presetName !== 'Custom') {
            const p = lightingPresets[presetName];
            settings.ambientInt = p.ambientInt;
            settings.sunInt = p.sunInt;
            settings.sunX = p.sunX;
            settings.sunY = p.sunY;
            settings.sunZ = p.sunZ;

            ambientLight.intensity = p.ambientInt;
            sunLight.intensity = p.sunInt;
            sunLight.position.set(p.sunX, p.sunY, p.sunZ);
        }
    });

    lightFolder.add(settings, 'ambientInt', 0, 5).name('Ambient Power').listen().onChange(v => { ambientLight.intensity = v; });
    lightFolder.add(settings, 'sunInt', 0, 10).name('Sun Power').listen().onChange(v => { sunLight.intensity = v; });
    lightFolder.add(settings, 'sunX', -50, 50).name('Sun X').listen().onChange(v => { sunLight.position.x = v; });
    lightFolder.add(settings, 'sunY', -50, 50).name('Sun Y').listen().onChange(v => { sunLight.position.y = v; });
    lightFolder.add(settings, 'sunZ', -50, 50).name('Sun Z').listen().onChange(v => { sunLight.position.z = v; });

    const skyFolder = gui.addFolder('Skybox Tuning');
    skyFolder.add(settings, 'skyIntensity', 0, 2, 0.01).name('Sky Brightness').onChange(v => {
        skyMaterials.forEach(m => m.emissiveIntensity = v);
    });
    skyFolder.addColor(settings, 'skyTint').name('Sky Tint').onChange(v => {
        skyMaterials.forEach(m => m.emissive.set(v));
    });

    const vfxFolder = gui.addFolder('VFX Tuning');
    vfxFolder.add(settings, 'dustCount', 0, MAX_DUST, 1).name('Dust Count').onChange(v => {
        if (dustParticles) dustParticles.geometry.setDrawRange(0, v);
    });
    vfxFolder.add(settings, 'dustSize', 0.01, 1.0, 0.01).name('Dust Size').onChange(v => {
        if (dustParticles) dustParticles.material.uniforms.size.value = v * 100.0;
    });
    vfxFolder.add(settings, 'dustOpacity', 0.0, 1.0, 0.01).name('Dust Opacity').onChange(v => {
        if (dustParticles) dustParticles.material.uniforms.globalOpacity.value = v;
    });
    vfxFolder.add(settings, 'dustMaxHeight', 1, 50, 0.5).name('Dust Max Height');
    vfxFolder.add(settings, 'dustSpeed', 0.0, 5.0, 0.1).name('Dust Speed');

    const birdFolder = gui.addFolder('Singular Bird Tuning');
    birdFolder.add(settings, 'birdX', -10, 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.x = v; });
    birdFolder.add(settings, 'birdY', -5, 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.y = v; });
    birdFolder.add(settings, 'birdZ', -10, 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.z = v; });
    birdFolder.add(settings, 'birdRot', -Math.PI, Math.PI, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.rotation.y = v; });
    birdFolder.add(settings, 'birdScale', 0.1, 5, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.scale.set(v, v, v); });

    const flockFolder = gui.addFolder('Flock Tuning');
    flockFolder.add(settings, 'flockX', -500, 500, 0.1).onChange(v => { if (flockModel) flockModel.position.x = v; });
    flockFolder.add(settings, 'flockY', -10, 150, 0.1).onChange(v => { if (flockModel) flockModel.position.y = v; });
    flockFolder.add(settings, 'flockZ', -500, 500, 0.1).onChange(v => { if (flockModel) flockModel.position.z = v; });
    flockFolder.add(settings, 'flockRot', -Math.PI, Math.PI, 0.01).onChange(v => { if (flockModel) flockModel.rotation.y = v; });
    flockFolder.add(settings, 'flockScale', 0.01, 5, 0.01).onChange(v => { if (flockModel) flockModel.scale.set(v, v, v); });

    const loggerFolder = gui.addFolder('Track Logger (Spline Tool)');
    loggerFolder.add(settings, 'loggerEnabled').name('Enable Logger').onChange(v => {
        if (orbitControls) orbitControls.enabled = (!v && settings.mouseMode === 'Camera Orbit');
    });
    loggerFolder.add(settings, 'clearPath').name('Clear Path');
    loggerFolder.add(settings, 'printPath').name('Print Path to Console');

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    setupDustVFX();

    gltfLoader.load(carJeepUrl, gltf => processCarModel(gltf.scene, 'jeep'));
    gltfLoader.load(carSuvYUrl, gltf => processCarModel(gltf.scene, 'suvy'));
    gltfLoader.load(carTruckUrl, gltf => processCarModel(gltf.scene, 'truck'));

    gltfLoader.load(birdsUrl, (gltf) => {
        flockModel = gltf.scene;
        flockModel.position.set(settings.flockX, settings.flockY, settings.flockZ);
        flockModel.rotation.y = settings.flockRot;
        flockModel.scale.set(settings.flockScale, settings.flockScale, settings.flockScale);
        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(flockModel);
            mixer.clipAction(gltf.animations[0]).play();
            envMixers.push(mixer);
        }
        scene.add(flockModel);
    });

    gltfLoader.load(singularBirdUrl, (gltf) => {
        singleBirdModel = gltf.scene;
        singleBirdModel.position.set(settings.birdX, settings.birdY, settings.birdZ);
        singleBirdModel.rotation.y = settings.birdRot;
        singleBirdModel.scale.set(settings.birdScale, settings.birdScale, settings.birdScale);

        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(singleBirdModel);
            const initialIdx = Math.min(settings.birdAnimIndex, gltf.animations.length - 1);
            let currentBirdAction = mixer.clipAction(gltf.animations[initialIdx]);
            currentBirdAction.play();
            envMixers.push(mixer);

            const animOptions = {};
            gltf.animations.forEach((a, i) => { animOptions[`Animation ${i}`] = i; });

            birdFolder.add(settings, 'birdAnimIndex', animOptions).name('Select Animation').onChange(idx => {
                currentBirdAction.stop();
                currentBirdAction = mixer.clipAction(gltf.animations[idx]);
                currentBirdAction.play();
            });
        }
        scene.add(singleBirdModel);
    });

    gltfLoader.load(skyboxUrl, (gltf) => {
        skyboxModel = gltf.scene;
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

                    child.material.emissive = new THREE.Color(settings.skyTint);
                    child.material.emissiveIntensity = settings.skyIntensity;

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

                    skyMaterials.push(child.material);
                }
            }
        });
        scene.add(skyboxModel);
    });

    gltfLoader.load(desertUrl, (gltf) => {
        roomModel = gltf.scene;
        roomModel.scale.set(settings.mapScale, settings.mapScale, settings.mapScale);
        roomModel.position.set(settings.mapX, settings.mapY, settings.mapZ);
        roomModel.rotation.y = settings.mapRot;
        roomModel.traverse(child => { if (child.isMesh) { child.receiveShadow = true; child.castShadow = true; } });
        scene.add(roomModel);
    });

    gltfLoader.load(vanUrl, (gltf) => {
        vanModel = gltf.scene;
        vanModel.scale.set(0.67, 0.67, 0.67);
        vanModel.position.set(1.6, 0.18, 1.5);
        vanModel.rotation.set(0, 1.08070, 0);
        vanModel.traverse(child => {
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
            }
        });
        scene.add(vanModel);
    });

    preloadAllCharacters();

    let isDragging = false;
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (settings.loggerEnabled) {
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / container.clientWidth) * 2 - 1,
                -((e.clientY - rect.top) / container.clientHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            if (roomModel) {
                const intersects = raycaster.intersectObject(roomModel, true);
                if (intersects.length > 0) {
                    const pt = intersects[0].point;
                    waypoints.push(pt);

                    const geo = new THREE.SphereGeometry(0.3);
                    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const sphere = new THREE.Mesh(geo, mat);
                    sphere.position.copy(pt);
                    scene.add(sphere);
                    waypointSpheres.push(sphere);

                    if (waypointLine) {
                        waypointLine.geometry.setFromPoints(waypoints);
                    } else {
                        const lGeo = new THREE.BufferGeometry().setFromPoints(waypoints);
                        const lMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
                        waypointLine = new THREE.Line(lGeo, lMat);
                        scene.add(waypointLine);
                    }
                }
            }
            return;
        }
        isDragging = true;
    });
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && !settings.loggerEnabled && settings.mouseMode === 'Rotate Character') {
            settings.charRotation += e.movementX * 0.01;
            if (settings.charRotation > Math.PI) settings.charRotation -= Math.PI * 2;
            if (settings.charRotation < -Math.PI) settings.charRotation += Math.PI * 2;
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
    animate();
}

function preloadAllCharacters() {
    const loader = new FBXLoader();
    const characters = pilots.map(p => {
        let path;
        switch (p.id) {
            case 'timmy': path = pilotTimmyUrl; break;
            case 'ami': path = pilotAmiUrl; break;
            case 'bryce': path = pilotBryceUrl; break;
            case 'adam': path = pilotAdamUrl; break;
            case 'jackie': path = pilotJackieUrl; break;
            case 'michelle': path = pilotMichelleUrl; break;
        }
        return { id: p.id, path: path };
    });

    characters.forEach(char => {
        loader.load(char.path, (fbx) => {
            fbx.scale.set(0.009, 0.009, 0.009);

            const xOffset = (char.id === 'jackie' || char.id === 'michelle') ? 0.15 : 0;
            fbx.position.set(xOffset, 0.1, 0);

            fbx.visible = true;

            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        const newMats = [];

                        mats.forEach(m => {
                            const matName = m.name ? m.name.toLowerCase() : '';
                            const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator');
                            const isHair = matName.includes('hair') || matName.includes('beard') || matName.includes('mustache') || matName.includes('lash') || matName.includes('brow');

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
                                newMat.transparent = true;
                                newMat.depthWrite = true;
                                newMat.alphaTest = 0.3;
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

            if (fbx.animations && fbx.animations.length > 0) {
                const charMixer = new THREE.AnimationMixer(fbx);
                charMixer.clipAction(fbx.animations[0]).play();
                fbx.userData.mixer = charMixer;
            }

            scene.add(fbx);
            modelCache[char.id] = fbx;
            modelsLoadedCount++;
            targetProgress = (modelsLoadedCount / TOTAL_MODELS) * 100;

            if (modelsLoadedCount === TOTAL_MODELS) {
                renderer.compile(scene, camera);
                setTimeout(() => {
                    Object.values(modelCache).forEach(model => { model.visible = false; });

                    loadPreviewModel(pilots[currentPilotIndex].id);

                    const checkFull = setInterval(() => {
                        if (currentProgress >= 99) {
                            clearInterval(checkFull);
                            fadeUI.style.opacity = '0';
                            setTimeout(() => { if (document.body.contains(fadeUI)) document.body.removeChild(fadeUI); }, 1500);
                        }
                    }, 100);
                }, 5000);
            }
        });
    });
}

export function loadPreviewModel(name) {
    const n = name.toLowerCase();
    if (activeCharacter === n || modelsLoadedCount < TOTAL_MODELS) return;
    activeCharacter = n;
    Object.values(modelCache).forEach(model => { model.visible = false; });
    activeMixer = null;
    if (modelCache[n]) { activateModel(n); }
}

function activateModel(name) {
    const model = modelCache[name];
    if (!model) return;
    model.visible = true;

    if (model.userData.mixer) { activeMixer = model.userData.mixer; }
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const safeDt = Math.min(dt, 0.1);

    if (currentProgress < targetProgress) {
        currentProgress += 0.4;
        const textEl = document.getElementById('loading-text');
        const barEl = document.getElementById('loading-bar');
        if (textEl) textEl.innerText = `LOADING... ${Math.floor(currentProgress)}%`;
        if (barEl) barEl.style.width = `${currentProgress}%`;
    }

    if (activeCharacter && modelCache[activeCharacter]) {
        const offset = (activeCharacter === 'timmy') ? 0.353 : 0;
        modelCache[activeCharacter].rotation.y = settings.charRotation + offset;
        modelCache[activeCharacter].position.y = settings.charYOffset;
    }

    if (roomModel) {
        roomModel.position.set(settings.mapX, settings.mapY, settings.mapZ);
        roomModel.rotation.y = settings.mapRot;
        roomModel.scale.set(settings.mapScale, settings.mapScale, settings.mapScale);
    }

    if (orbitControls && settings.mouseMode === 'Camera Orbit' && !settings.loggerEnabled) {
        orbitControls.update();
        settings.camX = camera.position.x;
        settings.camY = camera.position.y;
        settings.camZ = camera.position.z;
        settings.targetX = orbitControls.target.x;
        settings.targetY = orbitControls.target.y;
        settings.targetZ = orbitControls.target.z;
        settings.camDistance = camera.position.distanceTo(orbitControls.target);
    }

    if (activeMixer) activeMixer.update(safeDt);

    envMixers.forEach(m => m.update(safeDt));

    if (skyboxModel) skyboxModel.rotation.y += 0.000005;

    if (activeCars.length === 0 && Object.keys(carPrototypes).length >= 3) {
        spawnRandomCarScenario();
    }

    for (let i = activeCars.length - 1; i >= 0; i--) {
        let c = activeCars[i];
        const tuning = carSettings[c.modelId];
        const currentSpeed = settings[c.speedSetting];

        c.progress += currentSpeed * safeDt;

        if (c.progress >= 1.0) {
            if (c.audio1 && c.audio1.isPlaying) c.audio1.stop();
            if (c.audio2 && c.audio2.isPlaying) c.audio2.stop();
            scene.remove(c.mesh);
            if (c.trail) scene.remove(c.trail);
            activeCars.splice(i, 1);
            continue;
        }

        let currentVol = 0.20;
        if (c.progress > 0.8) {
            currentVol = 0.20 * Math.max(0, (1.0 - c.progress) / 0.2);
        }
        if (c.audio1) c.audio1.setVolume(currentVol);
        if (c.audio2) c.audio2.setVolume(currentVol);

        if (c.progress < 0) {
            c.mesh.visible = false;
            if (c.trail) c.trail.visible = false;

            const pt0 = c.curve.getPointAt(0);
            const tan0 = c.curve.getTangentAt(0);
            c.mesh.position.copy(pt0).addScaledVector(tan0, c.progress * 300.0);
            const target = c.mesh.position.clone().add(tan0);
            c.mesh.lookAt(target);

            if (c.audio1 && audioListener.context.state === 'running') {
                if (c.audioTimer === 0 && !c.audio1.isPlaying && !c.audio2.isPlaying) {
                    c.audio1.play();
                }
                c.audioTimer += safeDt;
                if (c.audioTimer >= c.audioDuration - 0.4) {
                    if (c.activeAudio === 1) {
                        c.audio2.play();
                        c.activeAudio = 2;
                    } else {
                        c.audio1.play();
                        c.activeAudio = 1;
                    }
                    c.audioTimer = 0;
                }
            }
            continue;
        } else {
            c.mesh.visible = true;
            if (c.trail) c.trail.visible = true;

            if (c.audio1 && audioListener.context.state === 'running') {
                if (c.audioTimer === 0 && !c.audio1.isPlaying && !c.audio2.isPlaying) {
                    c.audio1.play();
                }
                c.audioTimer += safeDt;
                if (c.audioTimer >= c.audioDuration - 0.4) {
                    if (c.activeAudio === 1) {
                        c.audio2.play();
                        c.activeAudio = 2;
                    } else {
                        c.audio1.play();
                        c.activeAudio = 1;
                    }
                    c.audioTimer = 0;
                }
            }
        }

        const pt = c.curve.getPointAt(c.progress);
        const tangent = c.curve.getTangentAt(c.progress);

        c.mesh.position.copy(pt);
        const target = pt.clone().add(tangent);
        c.mesh.lookAt(target);

        c.mesh.scale.set(tuning.scale, tuning.scale, tuning.scale);
        c.mesh.rotateY(tuning.rotY);
        c.mesh.translateY(tuning.offsetY);
        c.mesh.translateX(tuning.offsetX);
        c.mesh.translateZ(tuning.offsetZ);

        if (c.trail && c.trail.visible) {
            c.trail.material.uniforms.size.value = tuning.trailSize * 100.0;
            c.trail.material.uniforms.baseColor.value.set(tuning.trailColor);
            c.trail.material.uniforms.masterOpacity.value = tuning.trailOpacity;
            c.trail.geometry.setDrawRange(0, tuning.trailCount);

            const pos = c.trail.geometry.attributes.position.array;
            const age = c.trail.geometry.attributes.age.array;

            let emitCount = 0;
            if (currentSpeed > 0) {
                const emitRate = tuning.trailCount / tuning.trailLifetime;
                emitCount = Math.ceil(emitRate * safeDt);
            }

            const emitPosL = new THREE.Vector3(-tuning.wheelWidth, tuning.trailY, tuning.trailZ);
            const emitPosR = new THREE.Vector3(tuning.wheelWidth, tuning.trailY, tuning.trailZ);
            c.mesh.localToWorld(emitPosL);
            c.mesh.localToWorld(emitPosR);

            for (let j = 0; j < tuning.trailCount; j++) {
                age[j] += safeDt;
                if (emitCount > 0 && age[j] > tuning.trailLifetime) {
                    age[j] = 0.0;
                    const emitPos = (j % 2 === 0) ? emitPosL : emitPosR;
                    pos[j * 3] = emitPos.x + (Math.random() - 0.5) * tuning.trailSpread;
                    pos[j * 3 + 1] = emitPos.y + (Math.random() - 0.5) * tuning.trailSpread;
                    pos[j * 3 + 2] = emitPos.z + (Math.random() - 0.5) * tuning.trailSpread;
                    emitCount--;
                }
                if (age[j] <= tuning.trailLifetime) {
                    pos[j * 3 + 1] += safeDt * 0.2;
                }
            }
            c.trail.geometry.attributes.position.needsUpdate = true;
            c.trail.geometry.attributes.age.needsUpdate = true;
        }
    }

    if (dustParticles) {
        dustParticles.material.uniforms.time.value = clock.getElapsedTime();
        const positions = dustParticles.geometry.attributes.position.array;
        const velocities = dustParticles.geometry.attributes.velocity.array;
        const camPos = camera.position;
        const speedMult = settings.dustSpeed;
        const maxH = settings.dustMaxHeight;

        for (let i = 0; i < MAX_DUST; i++) {
            positions[i * 3] -= velocities[i * 3] * safeDt * speedMult;
            positions[i * 3 + 1] -= velocities[i * 3 + 1] * safeDt * speedMult;
            positions[i * 3 + 2] -= velocities[i * 3 + 2] * safeDt * speedMult;

            if (positions[i * 3] < camPos.x - 50) positions[i * 3] += 100;
            if (positions[i * 3] > camPos.x + 50) positions[i * 3] -= 100;

            if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] += maxH;
            if (positions[i * 3 + 1] > maxH) positions[i * 3 + 1] -= maxH;

            if (positions[i * 3 + 2] < camPos.z - 50) positions[i * 3 + 2] += 100;
            if (positions[i * 3 + 2] > camPos.z + 50) positions[i * 3 + 2] -= 100;
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
}
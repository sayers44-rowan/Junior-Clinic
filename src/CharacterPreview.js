import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
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

import bgBonesUrl from '../assets/images/bg_bones.png?url';
import bgLungsUrl from '../assets/images/bg_lungs.png?url';
import bgCellsUrl from '../assets/images/bg_cells.png?url';

import portraitTimmyUrl from '../assets/images/portrait_timmy.png?url';
import portraitAmiUrl from '../assets/images/portrait_ami.png?url';
import portraitBryceUrl from '../assets/images/portrait_bryce.png?url';
import portraitAdamUrl from '../assets/images/portrait_adam.png?url';
import portraitJackieUrl from '../assets/images/portrait_jackie.png?url';
import portraitMichelleUrl from '../assets/images/portrait_michelle.png?url';

let scene, camera, renderer, roomModel, skyboxModel, vanModel, gui;
const clock = new THREE.Clock();
let activeMixer = null;
const modelCache = {};
let activeCharacter = null;
let modelsLoadedCount = 0;
const TOTAL_MODELS = 6;
let targetProgress = 0;
let currentProgress = 0;

const lightingPresets = {
    'Preset 1': { ambientInt: 2.745, sunInt: 2.3, sunX: -27, sunY: 24.6, sunZ: 19.7 },
    'Preset 2': { ambientInt: 2.38, sunInt: 1.93, sunX: 30.7, sunY: -9.8, sunZ: -34.4 },
    'Preset 3': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 8.6, sunZ: -11.1 },
    'Preset 4': { ambientInt: 0.965, sunInt: 4.39, sunX: -6.1, sunY: 9.8, sunZ: -11 },
    'Preset 5': { ambientInt: 1.085, sunInt: 3.77, sunX: -3.7, sunY: 7.4, sunZ: -7.4 },
    'Custom': {} // Placeholder if they manually drag a slider
};

const settings = {
    charRotation: 0,
    activePreset: 'Preset 1',
    // Defaulting to Preset 1 to start
    ambientInt: 2.745,
    sunInt: 2.3,
    sunX: -27, sunY: 24.6, sunZ: 19.7
};

const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&display=swap';
document.head.appendChild(fontLink);

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes barShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .pilot-tile { display: flex; align-items: center; padding: 10px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; margin-bottom: 8px; }
    .pilot-tile:hover { background: rgba(255, 255, 255, 0.1); transform: translateX(5px); border-color: rgba(255, 255, 255, 0.3); }
    .pilot-tile.active { background: rgba(255, 255, 255, 0.12); border-width: 2px; }
    .pilot-portrait { width: 50px; height: 50px; object-fit: contain; margin-right: 12px; }
    .pilot-name { color: white; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; }
    #pilot-select-sidebar { display: flex !important; visibility: visible !important; pointer-events: auto !important; }
    .start-btn { margin-top: 15px; background: #4CAF50; color: #fff; border: 2px solid #45a049; padding: 15px; font-size: 1.2rem; font-weight: bold; font-family: 'Fredoka', sans-serif; cursor: pointer; border-radius: 12px; letter-spacing: 2px; transition: all 0.2s; text-align: center; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4); }
    .start-btn:hover { background: #66BB6A; transform: scale(1.05); box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6); border-color: #81C784; }
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
    const pilots = [
        { id: 'timmy', name: 'Timmy', portrait: portraitTimmyUrl, color1: '#FF0000', color2: '#FFFFFF' },
        { id: 'ami', name: 'Ami', portrait: portraitAmiUrl, color1: '#00FFFF', color2: '#FFFFFF' },
        { id: 'bryce', name: 'Bryce', portrait: portraitBryceUrl, color1: '#A52A2A', color2: '#FF0000' },
        { id: 'adam', name: 'Adam', portrait: portraitAdamUrl, color1: '#FFFFFF', color2: '#CCCCCC' },
        { id: 'jackie', name: 'Jackie', portrait: portraitJackieUrl, color1: '#CCCCFF', color2: '#DDA0DD' },
        { id: 'michelle', name: 'Michelle', portrait: portraitMichelleUrl, color1: '#FFA500', color2: '#FFFF00' }
    ];

    const menu = document.createElement('div');
    menu.id = "pilot-select-sidebar";
    menu.style.cssText = `position: absolute; left: 25px; top: 50%; transform: translateY(-50%); width: 260px; background: rgba(10, 10, 10, 0.45); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 25px 15px; display: flex; flex-direction: column; z-index: 100; box-shadow: 0 15px 50px rgba(0,0,0,0.6);`;

    const title = document.createElement('div');
    title.innerText = "PILOT ROSTER";
    title.style.cssText = `color: white; font-family: 'Fredoka', sans-serif; text-align: center; margin-bottom: 20px; letter-spacing: 2px; font-size: 1.2rem; font-weight: 700; opacity: 0.8;`;
    menu.appendChild(title);

    pilots.forEach(pilot => {
        const tile = document.createElement('div');
        tile.className = "pilot-tile";
        tile.id = `tile-${pilot.id}`;
        tile.innerHTML = `<img src="${pilot.portrait}" class="pilot-portrait"><span class="pilot-name">${pilot.name}</span>`;

        tile.onclick = () => {
            document.querySelectorAll('.pilot-tile').forEach(t => { t.classList.remove('active'); t.style.borderImage = 'none'; t.style.borderColor = 'transparent'; t.style.boxShadow = 'none'; });
            tile.classList.add('active');
            tile.style.borderImage = `linear-gradient(to right, ${pilot.color1}, ${pilot.color2}) 1`;
            tile.style.boxShadow = `0 0 25px -3px ${pilot.color1}, 0 0 15px -3px ${pilot.color2}`;
            loadPreviewModel(pilot.id);
        };
        menu.appendChild(tile);
    });

    const startBtn = document.createElement('button');
    startBtn.id = 'sidebar-start-btn';
    startBtn.className = 'start-btn';
    startBtn.innerText = "START";
    startBtn.onclick = () => {
        const activeTile = document.querySelector('.pilot-tile.active');
        if (activeTile) {
            const selectedName = activeTile.querySelector('.pilot-name').innerText;
            localStorage.setItem('selectedPilot', selectedName);
            window.location.href = 'game.html';
        }
    };
    menu.appendChild(startBtn);
    container.appendChild(menu);
}

export function initPreview(container) {
    if (!document.getElementById("sparc-master-loading-screen")) { document.body.appendChild(fadeUI); }
    createPilotSelectUI(container);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 15000);

    // LOCKED CAMERA
    camera.position.set(-0.0967297942535286, 1.6394077121228656, -5.358637838752932);
    camera.lookAt(0, 1.301620731987245, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // GUI INITIALIZATION
    gui = new GUI({ title: 'God Mode Tools' });

    const charFolder = gui.addFolder('Character Controls');
    charFolder.add(settings, 'charRotation', -Math.PI, Math.PI).name('Model Rotation').listen();

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

    // PRESET DROPDOWN LOGIC
    lightFolder.add(settings, 'activePreset', Object.keys(lightingPresets)).name('Preset').onChange(presetName => {
        if (presetName !== 'Custom') {
            const p = lightingPresets[presetName];

            // Update Settings Object
            settings.ambientInt = p.ambientInt;
            settings.sunInt = p.sunInt;
            settings.sunX = p.sunX;
            settings.sunY = p.sunY;
            settings.sunZ = p.sunZ;

            // Update Actual Lights
            ambientLight.intensity = p.ambientInt;
            sunLight.intensity = p.sunInt;
            sunLight.position.set(p.sunX, p.sunY, p.sunZ);
        }
    });

    // MANUAL SLIDERS (Using .listen() so they snap to the preset values)
    lightFolder.add(settings, 'ambientInt', 0, 5).name('Ambient Power').listen().onChange(v => { ambientLight.intensity = v; });
    lightFolder.add(settings, 'sunInt', 0, 10).name('Sun Power').listen().onChange(v => { sunLight.intensity = v; });
    lightFolder.add(settings, 'sunX', -50, 50).name('Sun X').listen().onChange(v => { sunLight.position.x = v; });
    lightFolder.add(settings, 'sunY', -50, 50).name('Sun Y').listen().onChange(v => { sunLight.position.y = v; });
    lightFolder.add(settings, 'sunZ', -50, 50).name('Sun Z').listen().onChange(v => { sunLight.position.z = v; });

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(skyboxUrl, (gltf) => {
        skyboxModel = gltf.scene;
        skyboxModel.scale.set(500, 500, 500);
        skyboxModel.position.set(0, -50, 0);
        skyboxModel.traverse(child => {
            if (child.isMesh) {
                child.frustumCulled = false;
                child.renderOrder = -1;
                if (child.material) {
                    child.material.side = THREE.BackSide;
                    child.material.depthWrite = false;
                    child.material.fog = false;
                }
            }
        });
        scene.add(skyboxModel);
    });

    gltfLoader.load(desertUrl, (gltf) => {
        roomModel = gltf.scene;
        roomModel.scale.set(1, 1, 1);
        // LOCKED MAP
        roomModel.position.set(3.6, 0.09, 65);
        roomModel.traverse(child => { if (child.isMesh) { child.receiveShadow = true; child.castShadow = true; } });
        scene.add(roomModel);
    });

    gltfLoader.load(vanUrl, (gltf) => {
        vanModel = gltf.scene;
        // LOCKED VAN
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

    // MOUSE DRAG ROTATION (Camera controls stripped)
    let isDragging = false;
    renderer.domElement.addEventListener('mousedown', () => { isDragging = true; });
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
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
    const characters = [{ id: 'timmy', path: pilotTimmyUrl }, { id: 'ami', path: pilotAmiUrl }, { id: 'bryce', path: pilotBryceUrl }, { id: 'adam', path: pilotAdamUrl }, { id: 'jackie', path: pilotJackieUrl }, { id: 'michelle', path: pilotMichelleUrl }];

    characters.forEach(char => {
        loader.load(char.path, (fbx) => {
            fbx.scale.set(0.009, 0.009, 0.009);
            fbx.position.set(0, 0.1, 0);
            fbx.visible = true;

            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        const newMats = []; // Creating an array for the rebuilt materials

                        mats.forEach(m => {
                            const matName = m.name ? m.name.toLowerCase() : '';
                            const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator');

                            // THE NUCLEAR OPTION: Build a completely fresh material
                            let newMat = new THREE.MeshStandardMaterial({
                                name: m.name,
                                color: m.color || 0xffffff,
                                map: m.map || null,
                                normalMap: m.normalMap || null,
                                roughness: 0.8,
                                metalness: 0.1,
                                side: THREE.DoubleSide // Fixes hollow hair and clothes
                            });

                            if (isGlass) {
                                newMat.transparent = true;
                                newMat.opacity = 0.65;
                                newMat.depthWrite = false;
                                newMat.color.setHex(0x111111);
                            } else {
                                newMat.transparent = false; // Forces Jackie to be completely solid
                                newMat.depthWrite = true;

                                // Hardware-level cutout for hair/eyelashes
                                if (newMat.map) {
                                    newMat.alphaTest = 0.5; // Discards invisible pixels so they don't block shadows or geometry
                                }
                            }

                            newMats.push(newMat);
                        });

                        // Apply the freshly built materials back to the mesh
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
                    const targetChar = activeCharacter || 'timmy';
                    activateModel(targetChar);
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

    settings.charRotation = 0;

    if (model.userData.mixer) { activeMixer = model.userData.mixer; }
    const tile = document.getElementById(`tile-${name}`);
    if (tile && !tile.classList.contains('active')) { tile.click(); }
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (currentProgress < targetProgress) {
        currentProgress += 0.4;
        const textEl = document.getElementById('loading-text');
        const barEl = document.getElementById('loading-bar');
        if (textEl) textEl.innerText = `LOADING... ${Math.floor(currentProgress)}%`;
        if (barEl) barEl.style.width = `${currentProgress}%`;
    }

    if (activeCharacter && modelCache[activeCharacter]) {
        modelCache[activeCharacter].rotation.y = settings.charRotation;
    }

    if (activeMixer) activeMixer.update(dt);
    if (skyboxModel) skyboxModel.rotation.y += 0.0005;
    renderer.render(scene, camera);
}
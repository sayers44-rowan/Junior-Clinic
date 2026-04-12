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

let scene, camera, renderer, roomModel, skyboxModel, vanModel, gui;
const clock = new THREE.Clock();
let activeMixer = null;
const modelCache = {};
let activeCharacter = null;
let modelsLoadedCount = 0;
const TOTAL_MODELS = 6;
let targetProgress = 0;
let currentProgress = 0;

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
    charRotation: 3.13,
    activePreset: 'Preset 1',
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
    
    .bottom-gradient { position: absolute; bottom: 0; left: 0; width: 100vw; height: 250px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); z-index: 99; pointer-events: none; }
    
    /* Pulled down very very slightly from 80px to 70px */
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

export function initPreview(container) {
    if (!document.getElementById("sparc-master-loading-screen")) { document.body.appendChild(fadeUI); }
    createPilotSelectUI(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#333333');

    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 15000);
    // Preserving your specific coordinates
    camera.position.set(0.07271779979744147, 1.4540482035505606, -5.22652829437905);
    camera.lookAt(-0.24188220020255968, 1.0890482035505586, -0.029528294379020787);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

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

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

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

                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = 1.0;

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
                }
            }
        });
        scene.add(skyboxModel);
    });

    gltfLoader.load(desertUrl, (gltf) => {
        roomModel = gltf.scene;
        roomModel.scale.set(1, 1, 1);
        roomModel.position.set(3.6, 0.09, 65);
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
            fbx.position.set(0, 0.1, 0);
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
    }

    if (activeMixer) activeMixer.update(dt);
    if (skyboxModel) skyboxModel.rotation.y += 0.000005;

    renderer.render(scene, camera);
}
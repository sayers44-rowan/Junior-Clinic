import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import pilotTimmyUrl from '../assets/models/pilot_timmy.fbx?url';
import pilotAmiUrl from '../assets/models/pilot_ami.fbx?url';
import pilotBryceUrl from '../assets/models/pilot_bryce.fbx?url';
import pilotAdamUrl from '../assets/models/pilot_adam.fbx?url';
import pilotJackieUrl from '../assets/models/pilot_jackie.fbx?url';
import pilotMichelleUrl from '../assets/models/pilot_michelle.fbx?url';
import livingRoomUrl from '../assets/models/our_little_living_room.glb?url';
import skyboxUrl from '../assets/models/skybox_skydays_3.glb?url';

import bgBonesUrl from '../assets/images/bg_bones.png?url';
import bgLungsUrl from '../assets/images/bg_lungs.png?url';
import bgCellsUrl from '../assets/images/bg_cells.png?url';

import portraitTimmyUrl from '../assets/images/portrait_timmy.png?url';
import portraitAmiUrl from '../assets/images/portrait_ami.png?url';
import portraitBryceUrl from '../assets/images/portrait_bryce.png?url';
import portraitAdamUrl from '../assets/images/portrait_adam.png?url';
import portraitJackieUrl from '../assets/images/portrait_jackie.png?url';
import portraitMichelleUrl from '../assets/images/portrait_michelle.png?url';

let scene, camera, renderer, roomModel, skyboxModel;
const clock = new THREE.Clock();
let activeMixer = null;
let isDragging = false;
const modelCache = {};
let activeCharacter = null;
let modelsLoadedCount = 0;
const TOTAL_MODELS = 6;
let targetProgress = 0;
let currentProgress = 0;

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
    { bg: bgLungsUrl, color: '#ff66b3', fact: "Your lungs can hold about 1.5 gallons <span style='white-space: nowrap;'>(6 liters)</span> of air!", layout: 'right', rightOffset: '14vw' },
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
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 5000);
    camera.position.set(0.1, 1.25, 2.7);
    camera.lookAt(0, 0.9, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 4.2);
    sunLight.position.set(2, 12.5, -2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(skyboxUrl, (gltf) => {
        skyboxModel = gltf.scene;
        skyboxModel.scale.set(100, 100, 100);
        scene.add(skyboxModel);
    });

    gltfLoader.load(livingRoomUrl, (gltf) => {
        roomModel = gltf.scene;
        roomModel.position.set(-0.2, 0, 1.1);
        roomModel.rotation.set(0, -0.48, 0);
        roomModel.traverse((child) => { if (child.isMesh) { child.receiveShadow = true; child.castShadow = true; } });
        scene.add(roomModel);
    });

    preloadAllCharacters();

    renderer.domElement.addEventListener('mousedown', () => { isDragging = true; });
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && activeCharacter && modelCache[activeCharacter]) {
            modelCache[activeCharacter].rotation.y += e.movementX * 0.01;
        }
    });
    window.addEventListener('resize', () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); });
    animate();
}

function preloadAllCharacters() {
    const loader = new FBXLoader();
    const characters = [{ id: 'timmy', path: pilotTimmyUrl }, { id: 'ami', path: pilotAmiUrl }, { id: 'bryce', path: pilotBryceUrl }, { id: 'adam', path: pilotAdamUrl }, { id: 'jackie', path: pilotJackieUrl }, { id: 'michelle', path: pilotMichelleUrl }];

    characters.forEach(char => {
        loader.load(char.path, (fbx) => {
            fbx.scale.set(0.009, 0.009, 0.009);
            fbx.position.set(0, 0.1, 0);
            fbx.visible = true; // KEEP TRUE FOR PRE-RENDER COMPILE

            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        const newMats = [];

                        mats.forEach(m => {
                            const matName = m.name ? m.name.toLowerCase() : '';
                            const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator') || (m.opacity < 0.9 && !m.map);

                            let newMat = new THREE.MeshStandardMaterial({
                                name: m.name,
                                color: m.color,
                                map: m.map,
                                normalMap: m.normalMap,
                                roughness: 0.8,
                                metalness: 0.1,
                                side: THREE.DoubleSide
                            });

                            if (isGlass) {
                                // HARDCODED DARK TINTED GLASS
                                newMat.color.setHex(0x111111);
                                newMat.transparent = true;
                                newMat.opacity = 0.65;
                                newMat.roughness = 0.1;
                                newMat.metalness = 0.8;
                                newMat.depthWrite = false;
                            }
                            else if (newMat.map) {
                                newMat.transparent = true;
                                newMat.alphaTest = 0.5;
                                newMat.depthWrite = true;
                            }
                            else {
                                newMat.transparent = false;
                                newMat.depthWrite = true;
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
                renderer.render(scene, camera);

                // 5 SECOND BRUTE FORCE GPU CACHE DELAY
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
    if (activeCharacter === n) return;
    activeCharacter = n;
    if (modelsLoadedCount < TOTAL_MODELS) return;

    Object.values(modelCache).forEach(model => { model.visible = false; });
    activeMixer = null;

    if (modelCache[n]) { activateModel(n); }
}

function activateModel(name) {
    const model = modelCache[name];
    if (!model) return;

    model.visible = true;
    model.rotation.set(0, 0, 0);

    if (model.userData.mixer) { activeMixer = model.userData.mixer; }

    const tile = document.getElementById(`tile-${name}`);
    if (tile && !tile.classList.contains('active')) { tile.click(); }
}

function animate() {
    requestAnimationFrame(animate);
    if (currentProgress < targetProgress) {
        currentProgress += 0.4;
        if (currentProgress > targetProgress) currentProgress = targetProgress;
        const textEl = document.getElementById('loading-text');
        const barEl = document.getElementById('loading-bar');
        if (textEl) textEl.innerText = `LOADING... ${Math.floor(currentProgress)}%`;
        if (barEl) barEl.style.width = `${currentProgress}%`;
    }
    if (activeMixer) { activeMixer.update(clock.getDelta()); }
    if (skyboxModel) { skyboxModel.rotation.y += 0.0005; }
    renderer.render(scene, camera);
}
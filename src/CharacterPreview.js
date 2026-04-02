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

let scene, camera, renderer, currentModel, roomModel, skyboxModel;
const clock = new THREE.Clock();
let mixer;
let isDragging = false;

// PRELOAD SYSTEM
const modelCache = {};
const loadingState = {};
let activeCharacter = null;

export function initPreview(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0.1, 1.25, 2.7);
    camera.lookAt(0, 0.9, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
    scene.add(ambientLight);

    const roomLight = new THREE.PointLight(0xffddaa, 0.5, 5);
    roomLight.position.set(0, 2.5, 0);
    scene.add(roomLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 4.2);
    sunLight.position.set(2, 12.5, -2);
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    sunLight.shadow.camera.left = -3;
    sunLight.shadow.camera.right = 3;
    sunLight.shadow.camera.top = 4;
    sunLight.shadow.camera.bottom = -2;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const gltfLoader = new GLTFLoader();

    gltfLoader.load(skyboxUrl, (gltf) => {
        skyboxModel = gltf.scene;
        skyboxModel.scale.set(500, 500, 500);
        skyboxModel.rotation.set(-Math.PI / 2, Math.random() * Math.PI * 2, 0);

        skyboxModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = false;
                child.receiveShadow = false;
                if (child.material) {
                    const basicMat = new THREE.MeshBasicMaterial({
                        map: child.material.map,
                        side: THREE.BackSide,
                        depthWrite: false
                    });
                    child.material = basicMat;
                }
            }
        });
        scene.add(skyboxModel);
    });

    gltfLoader.load(livingRoomUrl, (gltf) => {
        roomModel = gltf.scene;
        roomModel.scale.set(1, 1, 1);
        roomModel.position.set(-0.2, 0, 1.1);
        roomModel.rotation.set(0, -0.48, 0);

        roomModel.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;

                if (child.material) {
                    const matName = child.material.name.toLowerCase();
                    if (matName.includes('glass') || matName.includes('window')) {
                        child.material.transparent = true;
                        child.material.opacity = 0.2;
                        child.material.depthWrite = false;
                        child.material.side = THREE.DoubleSide;
                    }
                }
            }
        });
        scene.add(roomModel);
    });

    // Start fetching all characters in the background immediately
    preloadAllCharacters();

    renderer.domElement.addEventListener('mousedown', () => { isDragging = true; });
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
    renderer.domElement.addEventListener('mouseleave', () => { isDragging = false; });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && currentModel) {
            currentModel.rotation.y += e.movementX * 0.01;
        }
    });

    let previousTouchX = 0;
    renderer.domElement.addEventListener('touchstart', (e) => {
        isDragging = true;
        previousTouchX = e.touches[0].clientX;
    });
    renderer.domElement.addEventListener('touchend', () => { isDragging = false; });
    renderer.domElement.addEventListener('touchmove', (e) => {
        if (isDragging && currentModel) {
            const touchX = e.touches[0].clientX;
            const deltaX = touchX - previousTouchX;
            currentModel.rotation.y += deltaX * 0.01;
            previousTouchX = touchX;
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
    const characters = [
        { id: 'timmy', path: pilotTimmyUrl },
        { id: 'ami', path: pilotAmiUrl },
        { id: 'bryce', path: pilotBryceUrl },
        { id: 'adam', path: pilotAdamUrl },
        { id: 'jackie', path: pilotJackieUrl },
        { id: 'michelle', path: pilotMichelleUrl }
    ];

    characters.forEach(char => {
        loadingState[char.id] = true;
        loader.load(char.path, (fbx) => {
            fbx.scale.set(0.009, 0.009, 0.009);
            fbx.position.set(0, 0.1, 0);
            fbx.rotation.set(0, 0, 0);

            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => { m.transparent = false; m.opacity = 1.0; m.side = THREE.DoubleSide; });
                        } else {
                            child.material.transparent = false; child.material.opacity = 1.0; child.material.side = THREE.DoubleSide;
                        }
                    }
                }
                if (child.isSkinnedMesh && child.geometry && child.geometry.attributes.skinWeight) {
                    child.normalizeSkinWeights();
                }
            });

            // CRITICAL: Add to scene so shaders compile, but hide them immediately
            fbx.visible = false;
            scene.add(fbx);

            modelCache[char.id] = fbx;
            loadingState[char.id] = false;

            // If the user clicked this character while it was still downloading in the background
            if (activeCharacter === char.id) {
                activateModel(char.id);
            }
        }, undefined, (err) => {
            console.error(`Error preloading model ${char.id}:`, err);
            loadingState[char.id] = false;
        });
    });
}

export function loadPreviewModel(name) {
    const n = name.toLowerCase();

    // Ignore if they click the character they are already looking at
    if (activeCharacter === n) return;
    activeCharacter = n;

    // Hide everything instantly
    Object.values(modelCache).forEach(model => {
        model.visible = false;
    });

    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }
    currentModel = null;

    // If the model finished its background preload, show it instantly
    if (modelCache[n]) {
        activateModel(n);
    }
    // If it's still downloading, it will automatically show itself when it finishes (handled in preloadAllCharacters)
}

function activateModel(name) {
    const model = modelCache[name];
    if (!model) return;

    model.visible = true;
    model.rotation.set(0, 0, 0); // Snap back to facing forward
    currentModel = model; // Bind to mouse controls

    if (model.animations && model.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(model.animations[0]).play();
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());
    if (skyboxModel) skyboxModel.rotation.y += 0.0005;
    renderer.render(scene, camera);
}
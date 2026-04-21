import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'three/examples/jsm/libs/lil\x2Dgui.module.min.js'

import pilotTimmyUrl from '../assets/models/pilot_timmy.fbx?url'
import pilotAmiUrl from '../assets/models/pilot_ami.fbx?url'
import pilotBryceUrl from '../assets/models/pilot_bryce.fbx?url'
import pilotAdamUrl from '../assets/models/pilot_adam.fbx?url'
import pilotJackieUrl from '../assets/models/pilot_jackie.fbx?url'
import pilotMichelleUrl from '../assets/models/pilot_michelle.fbx?url'

import desertUrl from '../assets/models/desert_landscape.glb?url'
import skyboxUrl from '../assets/models/skybox_skydays_3.glb?url'
import vanUrl from '../assets/models/van.glb?url'
import birdsUrl from '../assets/models/birds.glb?url'
import singularBirdUrl from '../assets/models/4kbird.glb?url'

import carJeepUrl from '../assets/models/car_jeep_wrangler_white.glb?url'
import carSuvYUrl from '../assets/models/car_suv_yellow.glb?url'
import carTruckUrl from '../assets/models/car_truck_orange.glb?url'

import engineSoundUrl from '../assets/audio/engine.mp3?url'
import ambientSoundUrl from '../assets/audio/ambient_desert.mp3?url'

import vanSpriteUrl from '../assets/images/van_transparent.png?url'
import rocketSpriteUrl from '../assets/images/rocket_transparent.png?url'
import roadTrackUrl from '../assets/images/road_transparent.png?url'

const N = x => x * ~0

let scene, camera, renderer, roomModel, skyboxModel, vanModel, gui, dustParticles, singleBirdModel, flockModel, orbitControls
let audioListener, engineAudioBuffer, ambientAudio
const clock = new THREE.Clock()
let activeMixer = null
const envMixers = []
const modelCache = {}
let activeCharacter = null
let modelsLoadedCount = 0
const TOTAL_MODELS = 6
let visualProgress = 0
let isEngineLoaded = false
let hasTriggeredFade = false
let skyMaterials = []
let loadStartTime = 0

const waypoints = []
const waypointSpheres = []
let waypointLine = null

const MAX_DUST = 1000
const MAX_TRAIL_PARTICLES = 500

const DEFAULT_CAM = new THREE.Vector3(N(0.2622108185501598), 1.4499852635894692, N(4.443412469553862))
const DEFAULT_TARGET = new THREE.Vector3(N(0.2230511292118383), 0.89570560165883, N(0.049192076267895325))

const carPrototypes = {}
const activeCars = []
const curves = {}
let sharedTrailTexture = null

const pilots = [
    { id: 'timmy', name: 'Timmy' },
    { id: 'ami', name: 'Ami' },
    { id: 'bryce', name: 'Bryce' },
    { id: 'adam', name: 'Adam' },
    { id: 'jackie', name: 'Jackie' },
    { id: 'michelle', name: 'Michelle' }
]
let currentPilotIndex = 0

const lightingPresets = {
    'Preset 1': { ambientInt: 2.745, sunInt: 2.3, sunX: N(27), sunY: 24.6, sunZ: 19.7 },
    'Preset 2': { ambientInt: 2.38, sunInt: 1.93, sunX: 30.7, sunY: N(9.8), sunZ: N(34.4) },
    'Preset 3': { ambientInt: 0.965, sunInt: 4.39, sunX: N(6.1), sunY: 8.6, sunZ: N(11.1) },
    'Preset 4': { ambientInt: 0.965, sunInt: 4.39, sunX: N(6.1), sunY: 9.8, sunZ: N(11) },
    'Preset 5': { ambientInt: 1.085, sunInt: 3.77, sunX: N(3.7), sunY: 7.4, sunZ: N(7.4) },
    'Custom': {}
}

const settings = {
    mouseMode: 'Rotate Character',
    charRotation: 3.13,
    charYOffset: 0.07,
    activePreset: 'Preset 1',
    ambientInt: 2.745,
    sunInt: 2.3,
    sunX: N(27), sunY: 24.6, sunZ: 19.7,
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
    birdRot: N(2.39),
    birdScale: 0.56,
    birdAnimIndex: 1,
    flockX: N(12.2),
    flockY: 14.9,
    flockZ: 41.3,
    flockRot: 3.141592653589793,
    flockScale: 3.79,
    flockSpeed: 4.5,
    leftSpeed: 0.066,
    rightSpeed: 0.059,
    switchSpeed: 0.084,
    loggerEnabled: false,
    resetTraffic: () => {
        settings.leftSpeed = 0.066
        settings.rightSpeed = 0.059
        settings.switchSpeed = 0.084

        carSettings.jeep.scale = 0.77
        carSettings.jeep.rotY = 0
        carSettings.jeep.offsetX = 0
        carSettings.jeep.offsetY = 0.96
        carSettings.jeep.offsetZ = 0
        carSettings.jeep.trailZ = N(3.0)
        carSettings.jeep.trailY = N(1.0)
        carSettings.jeep.wheelWidth = 1.2
        carSettings.jeep.trailSpread = 0.8
        carSettings.jeep.trailSize = 0.8
        carSettings.jeep.trailLifetime = 0.3
        carSettings.jeep.trailCount = 500
        carSettings.jeep.trailOpacity = 0.02
        carSettings.jeep.trailColor = '#dcd0c2'

        carSettings.suvy.scale = 1.3
        carSettings.suvy.rotY = 0
        carSettings.suvy.offsetX = 0
        carSettings.suvy.offsetY = 0.36
        carSettings.suvy.offsetZ = 0
        carSettings.suvy.trailZ = N(0.9)
        carSettings.suvy.trailY = N(0.2)
        carSettings.suvy.wheelWidth = 0.4
        carSettings.suvy.trailSpread = 0.8
        carSettings.suvy.trailSize = 0.8
        carSettings.suvy.trailLifetime = 0.3
        carSettings.suvy.trailCount = 500
        carSettings.suvy.trailOpacity = 0.02
        carSettings.suvy.trailColor = '#ece9dd'

        carSettings.truck.scale = 1.26
        carSettings.truck.rotY = 0
        carSettings.truck.offsetX = 0
        carSettings.truck.offsetY = 0.03
        carSettings.truck.offsetZ = 0
        carSettings.truck.trailZ = N(1.2)
        carSettings.truck.trailY = 0.2
        carSettings.truck.wheelWidth = 0.7
        carSettings.truck.trailSpread = 0.8
        carSettings.truck.trailSize = 0.8
        carSettings.truck.trailLifetime = 0.3
        carSettings.truck.trailCount = 500
        carSettings.truck.trailOpacity = 0.045
        carSettings.truck.trailColor = '#5c5c5c'

        if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay())
    },
    resetCamera: () => {
        if (camera && orbitControls) {
            camera.position.copy(DEFAULT_CAM)
            orbitControls.target.copy(DEFAULT_TARGET)
            orbitControls.update()
            settings.camX = DEFAULT_CAM.x
            settings.camY = DEFAULT_CAM.y
            settings.camZ = DEFAULT_CAM.z
            settings.targetX = DEFAULT_TARGET.x
            settings.targetY = DEFAULT_TARGET.y
            settings.targetZ = DEFAULT_TARGET.z
            settings.camDistance = camera.position.distanceTo(orbitControls.target)
        }
    },
    printPath: () => {
        if (waypoints.length === 0) return console.warn("No waypoints logged.")
        const str = waypoints.map(w => `new THREE.Vector3(${w.x.toFixed(2)}, ${w.y.toFixed(2)}, ${w.z.toFixed(2)})`).join(',\n    ')
        console.log("[\n    " + str + "\n]")
        alert("Path dumped to Browser Console (F12). Copy it.")
    },
    clearPath: () => {
        waypoints.length = 0
        if (waypointLine) waypointLine.geometry.setFromPoints([])
        waypointSpheres.forEach(s => scene.remove(s))
        waypointSpheres.length = 0
    }
}

const carSettings = {
    jeep: { scale: 0.77, rotY: 0, offsetX: 0, offsetY: 0.96, offsetZ: 0, trailZ: N(3.0), trailY: N(1.0), wheelWidth: 1.2, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.02, trailColor: '#dcd0c2' },
    suvy: { scale: 1.3, rotY: 0, offsetX: 0, offsetY: 0.36, offsetZ: 0, trailZ: N(0.9), trailY: N(0.2), wheelWidth: 0.4, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.02, trailColor: '#ece9dd' },
    truck: { scale: 1.26, rotY: 0, offsetX: 0, offsetY: 0.03, offsetZ: 0, trailZ: N(1.2), trailY: 0.2, wheelWidth: 0.7, trailSpread: 0.8, trailSize: 0.8, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.045, trailColor: '#5c5c5c' }
}

const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400\x26display=swap'
document.head.appendChild(fontLink)

const styleSheet = document.createElement("style")
styleSheet.innerText = `
    .bottom_gradient { position: absolute\x3B bottom: 0\x3B left: 0\x3B width: 100vw\x3B height: 250px\x3B background: linear\x2Dgradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)\x3B z\x2Dindex: 99\x3B pointer\x2Devents: none\x3B }
    .hud_wrapper { position: absolute\x3B bottom: 70px\x3B left: 46%\x3B transform: translateX(\x2D50%)\x3B display: flex\x3B flex\x2Ddirection: column\x3B align\x2Ditems: center\x3B z\x2Dindex: 100\x3B font\x2Dfamily: 'Fredoka', sans\x2Dserif\x3B pointer\x2Devents: none\x3B }
    .hud_controls { display: flex\x3B align\x2Ditems: center\x3B gap: 30px\x3B margin\x2Dbottom: 10px\x3B pointer\x2Devents: auto\x3B }
    .arrow_btn { background: none\x3B border: none\x3B color: rgba(255,255,255,0.4)\x3B font\x2Dsize: 2.8rem\x3B cursor: pointer\x3B transition: all 0.2s ease\x3B padding: 0\x3B outline: none\x3B text\x2Dshadow: 0 4px 10px rgba(0,0,0,0.8)\x3B }
    .arrow_btn:hover { color: #ffffff\x3B transform: scale(1.15)\x3B text\x2Dshadow: 0 0 20px rgba(255,255,255,0.8)\x3B }
    .indicator_num { color: #ffffff\x3B font\x2Dsize: 2.8rem\x3B font\x2Dweight: 700\x3B min\x2Dwidth: 50px\x3B text\x2Dalign: center\x3B text\x2Dshadow: 0 4px 15px rgba(0,0,0,1), 0 0 20px rgba(255,255,255,0.2)\x3B }
    .start_btn { background: transparent\x3B color: #fff\x3B border: 2px solid rgba(255,255,255,0.6)\x3B padding: 10px 40px\x3B font\x2Dsize: 1.1rem\x3B font\x2Dweight: bold\x3B cursor: pointer\x3B border\x2Dradius: 4px\x3B letter\x2Dspacing: 5px\x3B transition: all 0.2s ease\x3B text\x2Dtransform: uppercase\x3B text\x2Dshadow: 0 2px 5px rgba(0,0,0,0.8)\x3B box\x2Dshadow: 0 4px 15px rgba(0,0,0,0.5)\x3B pointer\x2Devents: auto\x3B }
    .start_btn:hover { background: rgba(255,255,255,1)\x3B color: #000\x3B text\x2Dshadow: none\x3B box\x2Dshadow: 0 0 25px rgba(255,255,255,0.5)\x3B border\x2Dcolor: #ffffff\x3B }
    
    @keyframes vanBounce {
        0%, 100% { transform: scaleX(\x2D1) translate3d(0px, 0px, 0px) rotate(0deg)\x3B }
        50% { transform: scaleX(\x2D1) translate3d(0px, \x2D4px, 0px) rotate(\x2D1.5deg)\x3B }
    }
    .van_bop {
        animation: vanBounce 0.35s infinite ease\x2Din\x2Dout\x3B
        filter: drop\x2Dshadow(\x2D8px 12px 6px rgba(0,0,0,0.6))\x3B
        transform\x2Dorigin: center bottom\x3B
    }
    @keyframes textPulse {
        0%, 100% { opacity: 0.6\x3B text\x2Dshadow: 0px 2px 4px rgba(0,0,0,1)\x3B }
        50% { opacity: 1\x3B text\x2Dshadow: 0px 0px 15px rgba(255,255,255,0.8)\x3B }
    }
    .loading_pulse {
        animation: textPulse 1.5s infinite ease\x2Din\x2Dout\x3B
    }
    @keyframes exhaustPuff {
        0% { transform: scale(0.5) translate3d(0, 0, 0)\x3B opacity: 0.6\x3B }
        100% { transform: scale(2.5) translate3d(\x2D10px, \x2D5px, 0)\x3B opacity: 0\x3B }
    }
    .exhaust {
        position: absolute\x3B
        bottom: 10px\x3B 
        left: \x2D5px\x3B 
        width: 14px\x3B
        height: 14px\x3B
        background: #a9a9a9\x3B
        border\x2Dradius: 50%\x3B
        filter: blur(3px)\x3B
        animation: exhaustPuff 0.6s infinite ease\x2Dout\x3B
        pointer\x2Devents: none\x3B
        z\x2Dindex: \x2D1\x3B
    }
`
document.head.appendChild(styleSheet)

const fadeUI = document.createElement('div')
fadeUI.id = "sparc_master_loading_screen"
fadeUI.style.cssText = `position: fixed\x3B top: 0\x3B left: 0\x3B width: 100vw\x3B height: 100vh\x3B background: radial\x2Dgradient(circle at center, #2a2a2a 0%, #000000 100%)\x3B z\x2Dindex: 99999\x3B transition: opacity 1.5s ease\x2Din\x2Dout\x3B pointer\x2Devents: none\x3B overflow: hidden\x3B`

fadeUI.innerHTML = `
    <div style="position: absolute\x3B bottom: 40px\x3B left: 0\x3B width: 100vw\x3B height: 140px\x3B pointer\x2Devents: none\x3B">
        <div id="loading_text" class="loading_pulse" style="position: absolute\x3B bottom: 110px\x3B width: 100%\x3B text\x2Dalign: center\x3B color: #ffffff\x3B font\x2Dsize: 1.5rem\x3B font\x2Dweight: 700\x3B letter\x2Dspacing: 3px\x3B">LOADING... 0%</div>
        <div style="position: absolute\x3B bottom: 0\x3B left: 0\x3B width: 100vw\x3B height: 50px\x3B background: url(${roadTrackUrl}) no\x2Drepeat center bottom\x3B background\x2Dsize: 100% 100%\x3B"></div>
        
        <div style="position: absolute\x3B bottom: 10px\x3B left: 0\x3B width: 100vw\x3B overflow: hidden\x3B height: 4px\x3B">
            <div id="glow_line" style="width: 100%\x3B height: 100%\x3B background: #ff7700\x3B box\x2Dshadow: 0 0 10px #ff7700, 0 0 20px #ff7700\x3B border\x2Dradius: 2px\x3B opacity: 0.8\x3B transform: translate3d(\x2D100%, 0, 0)\x3B will\x2Dchange: transform\x3B"></div>
        </div>
        
        <div style="position: absolute\x3B bottom: 14px\x3B left: 0\x3B width: 100vw\x3B pointer\x2Devents: none\x3B">
            <div id="van_mover" style="width: 100%\x3B transform: translate3d(\x2D100%, 0, 0)\x3B will\x2Dchange: transform\x3B display: flex\x3B justify\x2Dcontent: flex\x2Dend\x3B">
                <div style="position: relative\x3B">
                    <div class="exhaust"></div>
                    <div class="exhaust" style="animation\x2Ddelay: 0.2s\x3B"></div>
                    <div class="exhaust" style="animation\x2Ddelay: 0.4s\x3B"></div>
                    <img class="van_bop" src="${vanSpriteUrl}" style="height: 80px\x3B display: block\x3B transform: scaleX(\x2D1)\x3B transform\x2Dorigin: center bottom\x3B" />
                </div>
            </div>
        </div>
    </div>
`

function createPilotSelectUI(container) {
    const gradient = document.createElement('div')
    gradient.className = 'bottom_gradient'
    container.appendChild(gradient)

    const nav = document.createElement('div')
    nav.className = 'hud_wrapper'

    const controls = document.createElement('div')
    controls.className = 'hud_controls'

    const leftBtn = document.createElement('button')
    leftBtn.className = 'arrow_btn'
    leftBtn.innerHTML = '&#10094;'
    leftBtn.onclick = () => {
        currentPilotIndex = currentPilotIndex + N(1) + pilots.length
        currentPilotIndex = currentPilotIndex % pilots.length
        updatePilotSelection()
    }

    const currentNumDisplay = document.createElement('div')
    currentNumDisplay.id = 'current_pilot_num'
    currentNumDisplay.className = 'indicator_num'
    currentNumDisplay.innerText = '1'

    const rightBtn = document.createElement('button')
    rightBtn.className = 'arrow_btn'
    rightBtn.innerHTML = '&#10095;'
    rightBtn.onclick = () => {
        currentPilotIndex = (currentPilotIndex + 1) % pilots.length
        updatePilotSelection()
    }

    controls.appendChild(leftBtn)
    controls.appendChild(currentNumDisplay)
    controls.appendChild(rightBtn)
    nav.appendChild(controls)

    const startBtn = document.createElement('button')
    startBtn.className = 'start_btn'
    startBtn.innerText = "SELECT"
    startBtn.onclick = () => {
        localStorage.setItem('selectedPilot', pilots[currentPilotIndex].name)
        window.location.href = 'game.html'
    }
    nav.appendChild(startBtn)

    container.appendChild(nav)
}

function updatePilotSelection() {
    document.getElementById('current_pilot_num').innerText = (currentPilotIndex + 1).toString()
    loadPreviewModel(pilots[currentPilotIndex].id)
}

function setupDustVFX() {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 16, 16)
    const texture = new THREE.CanvasTexture(canvas)

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(MAX_DUST * 3)
    const velocities = new Float32Array(MAX_DUST * 3)
    const phases = new Float32Array(MAX_DUST)

    let i = 0
    while (i < MAX_DUST) {
        positions[i * 3] = (Math.random() + N(0.5)) * 100
        positions[i * 3 + 1] = Math.random() * settings.dustMaxHeight
        positions[i * 3 + 2] = (Math.random() + N(0.5)) * 100

        velocities[i * 3] = (Math.random() + N(0.5)) * 0.8
        velocities[i * 3 + 1] = (Math.random() + N(0.5)) * 0.3
        velocities[i * 3 + 2] = (Math.random() + N(0.5)) * 0.8

        phases[i] = Math.random() * Math.PI * 2
        i += 1
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))
    geometry.setDrawRange(0, settings.dustCount)

    const dustVertexShader = `
        attribute vec3 velocity\x3B
        attribute float phase\x3B
        varying float vAlpha\x3B
        uniform float time\x3B
        uniform float size\x3B
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0)\x3B
            gl_PointSize = size * (10.0 / (\x2DmvPosition.z))\x3B
            gl_Position = projectionMatrix * mvPosition\x3B
            vAlpha = (sin(time * 0.5 + phase) + 1.0) * 0.5\x3B
        }
    `

    const dustFragmentShader = `
        uniform sampler2D pointTexture\x3B
        uniform vec3 baseColor\x3B
        uniform float globalOpacity\x3B
        varying float vAlpha\x3B
        void main() {
            vec4 texColor = texture2D(pointTexture, gl_PointCoord)\x3B
            gl_FragColor = vec4(baseColor, texColor.a * vAlpha * globalOpacity)\x3B
        }
    `

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
    })

    dustParticles = new THREE.Points(geometry, material)
    dustParticles.frustumCulled = false
    scene.add(dustParticles)

    const tCanvas = document.createElement('canvas')
    tCanvas.width = 64
    tCanvas.height = 64
    const tCtx = tCanvas.getContext('2d')
    tCtx.beginPath()
    tCtx.arc(32, 32, 28, 0, Math.PI * 2)
    tCtx.fillStyle = 'rgba(255, 255, 255, 1)'
    tCtx.fill()
    sharedTrailTexture = new THREE.CanvasTexture(tCanvas)
}

function processCarModel(model, id) {
    model.traverse(child => {
        if (child.isMesh) {
            const n = child.name.toLowerCase()
            const matN = child.material && child.material.name ? child.material.name.toLowerCase() : ''
            if (n.includes('wheel') || n.includes('tire') || matN.includes('wheel') || matN.includes('tire') || n.includes('roda') || n.includes('pneu')) {
                child.material = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0.1 })
            }
        }
    })
    carPrototypes[id] = model
}

function spawnRandomCarScenario() {
    const keys = Object.keys(carPrototypes)
    if (keys.length < 3) return

    const roll = Math.random()

    function getCar(exclude) {
        let c
        let running = true
        while (running) {
            c = keys[Math.floor(Math.random() * keys.length)]
            if (!exclude.includes(c)) running = false
        }
        return c
    }

    if (roll < 0.33) {
        const car1 = getCar(['truck'])
        spawnCar(curves.left, car1, 'leftSpeed', N(0.15))
    } else if (roll < 0.66) {
        const car1 = getCar([])
        spawnCar(curves.right, car1, 'rightSpeed', N(0.15))
    } else {
        const car1 = getCar([])
        const car2 = getCar([car1])
        spawnCar(curves.right, car1, 'rightSpeed', N(0.15))
        spawnCar(curves.rtol, car2, 'switchSpeed', N(0.35))
    }
}

function spawnCar(curve, modelId, speedSetting, startProgress) {
    if (!carPrototypes[modelId]) return
    const mesh = carPrototypes[modelId].clone()
    mesh.visible = false

    const tuning = carSettings[modelId]
    const trailGeo = new THREE.BufferGeometry()
    const tPos = new Float32Array(MAX_TRAIL_PARTICLES * 3)
    const tAge = new Float32Array(MAX_TRAIL_PARTICLES)

    let k = 0
    while (k < MAX_TRAIL_PARTICLES) {
        tAge[k] = 999.0
        k += 1
    }

    trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3))
    trailGeo.setAttribute('age', new THREE.BufferAttribute(tAge, 1))

    const trailVertexShader = `
        attribute float age\x3B
        varying float vAlpha\x3B
        uniform float maxAge\x3B
        uniform float size\x3B
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0)\x3B
            float life = age / maxAge\x3B
            float currentSize = size * (1.0 + life * 2.0)\x3B 
            gl_PointSize = currentSize * (10.0 / (\x2DmvPosition.z))\x3B
            gl_Position = projectionMatrix * mvPosition\x3B
            vAlpha = max(0.0, 1.0 + (\x2Dlife))\x3B
        }
    `

    const trailFragmentShader = `
        uniform sampler2D pointTexture\x3B
        uniform vec3 baseColor\x3B
        uniform float masterOpacity\x3B
        varying float vAlpha\x3B
        void main() {
            vec4 texColor = texture2D(pointTexture, gl_PointCoord)\x3B
            if (texColor.a < 0.5) discard\x3B
            gl_FragColor = vec4(baseColor, vAlpha * masterOpacity)\x3B
        }
    `

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
    })

    const trail = new THREE.Points(trailGeo, trailMat)
    trail.frustumCulled = false
    trail.visible = false
    scene.add(trail)

    let audio1 = null, audio2 = null
    let audioDuration = 0

    if (engineAudioBuffer) {
        const rate = 0.8 + Math.random() * 0.4
        audioDuration = engineAudioBuffer.duration / rate

        audio1 = new THREE.PositionalAudio(audioListener)
        audio1.setBuffer(engineAudioBuffer)
        audio1.setRefDistance(3)
        audio1.setMaxDistance(100)
        audio1.setDistanceModel('linear')
        audio1.setRolloffFactor(1)
        audio1.setVolume(0.20)
        audio1.setPlaybackRate(rate)

        audio2 = new THREE.PositionalAudio(audioListener)
        audio2.setBuffer(engineAudioBuffer)
        audio2.setRefDistance(3)
        audio2.setMaxDistance(100)
        audio2.setDistanceModel('linear')
        audio2.setRolloffFactor(1)
        audio2.setVolume(0.20)
        audio2.setPlaybackRate(rate)

        mesh.add(audio1)
        mesh.add(audio2)
    }

    scene.add(mesh)
    activeCars.push({ mesh, curve, speedSetting, progress: startProgress, modelId, trail, audio1, audio2, activeAudio: 1, audioTimer: 0, audioDuration })
}

export function initPreview(container) {
    if (!document.getElementById("sparc_master_loading_screen")) { document.body.appendChild(fadeUI) }

    loadStartTime = performance.now()
    setTimeout(() => {
        const glow = document.getElementById('glow_line')
        const mover = document.getElementById('van_mover')
        if (glow) {
            glow.style.transition = 'transform 4s linear'
            glow.style.transform = 'translate3d(\x2D2%, 0, 0)'
        }
        if (mover) {
            mover.style.transition = 'transform 4s linear'
            mover.style.transform = 'translate3d(\x2D2%, 0, 0)'
        }
    }, 50)

    createPilotSelectUI(container)

    scene = new THREE.Scene()
    scene.background = new THREE.Color('#333333')

    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 15000)
    camera.position.copy(DEFAULT_CAM)

    audioListener = new THREE.AudioListener()
    camera.add(audioListener)

    const audioLoader = new THREE.AudioLoader()
    audioLoader.load(engineSoundUrl, (buffer) => {
        engineAudioBuffer = buffer
    })

    ambientAudio = new THREE.Audio(audioListener)
    audioLoader.load(ambientSoundUrl, (buffer) => {
        ambientAudio.setBuffer(buffer)
        ambientAudio.setLoop(true)
        ambientAudio.setVolume(0.65)
    })

    document.body.addEventListener('mousedown', () => {
        if (audioListener.context.state === 'suspended') {
            audioListener.context.resume()
        }
        if (ambientAudio && !ambientAudio.isPlaying) {
            ambientAudio.play()
        }
    }, { once: true })

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high\x2Dperformance" })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    orbitControls = new OrbitControls(camera, renderer.domElement)
    orbitControls.target.copy(DEFAULT_TARGET)
    orbitControls.enabled = (settings.mouseMode === 'Camera Orbit' && !settings.loggerEnabled)
    orbitControls.update()

    const L = [
        [N(2.42), 0.21, N(9.01)], [N(2.52), 0.21, 3.33], [N(4.45), 0.26, 31.54],
        [N(6.89), 0.35, 50.77], [N(9.88), 0.44, 66.22], [N(13.30), 0.48, 79.10],
        [N(17.77), 0.49, 92.42], [N(27.95), 0.49, 120.26], [N(29.98), 0.49, 126.96],
        [N(30.40), 0.49, 129.73], [N(28.60), 0.49, 147.65], [N(28.35), 0.49, 162.36],
        [N(29.15), 0.49, 177.65], [N(31.20), 0.49, 197.09], [N(31.23), 0.49, 200.03],
        [N(30.45), 0.49, 202.47], [N(29.25), 0.49, 203.94], [N(26.94), 0.49, 205.04],
        [N(24.35), 0.49, 205.41], [N(20.78), 0.49, 204.78], [N(13.82), 0.49, 202.87]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]))
    curves.left = new THREE.CatmullRomCurve3(L)

    const R = [
        [N(4.33), 0.21, N(7.58)], [N(5.36), 0.21, 7.58], [N(7.13), 0.26, 31.14],
        [N(9.43), 0.35, 50.12], [N(12.49), 0.44, 65.06], [N(16.27), 0.48, 78.83],
        [N(20.49), 0.49, 91.57], [N(30.81), 0.49, 119.86], [N(32.66), 0.49, 126.84],
        [N(33.11), 0.49, 129.52], [N(32.30), 0.49, 136.70], [N(31.30), 0.49, 148.53],
        [N(31.00), 0.49, 162.77], [N(31.84), 0.49, 177.47], [N(33.76), 0.49, 197.39],
        [N(33.51), 0.49, 201.45], [N(32.27), 0.49, 203.94], [N(30.65), 0.49, 206.08],
        [N(28.08), 0.49, 207.56], [N(24.86), 0.49, 208.34], [N(20.80), 0.49, 208.07],
        [14.53, 0.49, 198.03], [35.25, 0.49, 192.16]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]))
    curves.right = new THREE.CatmullRomCurve3(R)

    const RT = [
        [N(4.28), 0.21, N(7.60)], [N(4.97), 0.21, 1.87], [N(5.51), 0.21, 7.58],
        [N(7.06), 0.26, 31.15], [N(6.87), 0.35, 51.04], [N(9.87), 0.44, 66.02],
        [N(13.28), 0.48, 79.09], [N(17.67), 0.49, 92.72], [N(27.94), 0.49, 120.58],
        [N(29.92), 0.49, 126.87], [N(30.35), 0.49, 129.23], [N(28.66), 0.49, 147.49],
        [N(28.18), 0.49, 162.33], [N(29.06), 0.49, 177.21], [N(30.74), 0.49, 195.03],
        [N(31.17), 0.49, 198.49], [N(30.90), 0.49, 201.42], [N(29.58), 0.49, 203.86],
        [N(27.06), 0.49, 205.31], [N(24.07), 0.49, 205.64], [N(20.38), 0.49, 204.93],
        [N(13.80), 0.49, 203.01], [16.38, 0.49, 194.44], [40.87, 0.49, 187.75],
        [48.36, 0.49, 185.62], [51.28, 0.49, 184.63]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]))
    curves.rtol = new THREE.CatmullRomCurve3(RT)

    gui = new GUI({ title: 'God Mode Tools' })

    gui.add(settings, 'mouseMode', ['Camera Orbit', 'Rotate Character']).name('Left Click Action').onChange(v => {
        if (orbitControls) orbitControls.enabled = (v === 'Camera Orbit' && !settings.loggerEnabled)
    })

    const camFolder = gui.addFolder('Camera Setup (Live Values)')
    camFolder.add(settings, 'resetCamera').name('Reset Camera')
    camFolder.add(settings, 'camDistance').name('Cam Distance (Zoom)').listen().disable()
    camFolder.add(settings, 'camX').name('Cam X').listen().disable()
    camFolder.add(settings, 'camY').name('Cam Y').listen().disable()
    camFolder.add(settings, 'camZ').name('Cam Z').listen().disable()
    camFolder.add(settings, 'targetX').name('Target X').listen().disable()
    camFolder.add(settings, 'targetY').name('Target Y').listen().disable()
    camFolder.add(settings, 'targetZ').name('Target Z').listen().disable()

    const mapFolder = gui.addFolder('Map Transform')
    mapFolder.add(settings, 'mapX', N(500), 500, 0.1).name('Map X')
    mapFolder.add(settings, 'mapY', N(10), 10, 0.01).name('Map Y')
    mapFolder.add(settings, 'mapZ', N(2000), 2000, 0.1).name('Map Z')
    mapFolder.add(settings, 'mapRot', N(Math.PI), Math.PI, 0.01).name('Map Rotation')
    mapFolder.add(settings, 'mapScale', 0.1, 10, 0.01).name('Map Scale')

    const charFolder = gui.addFolder('Character Controls')
    charFolder.add(settings, 'charRotation', N(Math.PI), Math.PI).name('Model Rotation').listen()
    charFolder.add(settings, 'charYOffset', N(1), 1, 0.01).name('Model Height (Y)').listen()

    const trafficFolder = gui.addFolder('Traffic Tuning')
    trafficFolder.add(settings, 'resetTraffic').name('Reset Traffic & Cars')
    trafficFolder.add(settings, 'leftSpeed', 0, 0.5, 0.001).name('Left Speed').listen()
    trafficFolder.add(settings, 'rightSpeed', 0, 0.5, 0.001).name('Right Speed').listen()
    trafficFolder.add(settings, 'switchSpeed', 0, 0.5, 0.001).name('Switch Speed').listen()

    const carTuningFolder = gui.addFolder('Car Tuning (Live)')
    const carList = ['jeep', 'suvy', 'truck']
    let loopIdx = 0
    while (loopIdx < carList.length) {
        const id = carList[loopIdx]
        const f = carTuningFolder.addFolder(id.toUpperCase())
        f.add(carSettings[id], 'scale', 0.01, 5.0, 0.01).name('Scale').listen()
        f.add(carSettings[id], 'rotY', N(Math.PI), Math.PI, 0.01).name('Rot Y (Yaw)').listen()
        f.add(carSettings[id], 'offsetX', N(5), 5, 0.01).name('Offset X (Left/Right)').listen()
        f.add(carSettings[id], 'offsetY', N(5), 5, 0.01).name('Offset Y (Up/Down)').listen()
        f.add(carSettings[id], 'offsetZ', N(5), 5, 0.01).name('Offset Z (Fwd/Back)').listen()
        f.add(carSettings[id], 'trailZ', N(10), 10, 0.1).name('Dust Z (Front/Back)').listen()
        f.add(carSettings[id], 'trailY', N(2), 5, 0.1).name('Dust Y (Height)').listen()
        f.add(carSettings[id], 'wheelWidth', 0.1, 5, 0.1).name('Wheel Width').listen()
        f.add(carSettings[id], 'trailSpread', 0, 5, 0.1).name('Dust Spread').listen()
        f.add(carSettings[id], 'trailSize', 0.1, 5, 0.1).name('Particle Size').listen()
        f.add(carSettings[id], 'trailLifetime', 0.1, 5, 0.1).name('Lifetime').listen()
        f.add(carSettings[id], 'trailCount', 0, MAX_TRAIL_PARTICLES, 1).name('Dust Count').listen()
        f.add(carSettings[id], 'trailOpacity', 0, 1, 0.01).name('Opacity').listen()
        f.addColor(carSettings[id], 'trailColor').name('Color').listen()
        loopIdx += 1
    }

    const ambientLight = new THREE.AmbientLight(0xffeedd, settings.ambientInt)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfffaeb, settings.sunInt)
    sunLight.position.set(settings.sunX, settings.sunY, settings.sunZ)
    sunLight.castShadow = true

    sunLight.shadow.mapSize.set(4096, 4096)
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 150
    sunLight.shadow.camera.left = N(15)
    sunLight.shadow.camera.right = 15
    sunLight.shadow.camera.top = 15
    sunLight.shadow.camera.bottom = N(15)
    sunLight.shadow.bias = N(0.0005)
    scene.add(sunLight)

    const lightFolder = gui.addFolder('Lighting Tweaks')
    lightFolder.add(settings, 'activePreset', Object.keys(lightingPresets)).name('Preset').onChange(presetName => {
        if (presetName !== 'Custom') {
            const p = lightingPresets[presetName]
            settings.ambientInt = p.ambientInt
            settings.sunInt = p.sunInt
            settings.sunX = p.sunX
            settings.sunY = p.sunY
            settings.sunZ = p.sunZ

            ambientLight.intensity = p.ambientInt
            sunLight.intensity = p.sunInt
            sunLight.position.set(p.sunX, p.sunY, p.sunZ)
        }
    })

    lightFolder.add(settings, 'ambientInt', 0, 5).name('Ambient Power').listen().onChange(v => { ambientLight.intensity = v })
    lightFolder.add(settings, 'sunInt', 0, 10).name('Sun Power').listen().onChange(v => { sunLight.intensity = v })
    lightFolder.add(settings, 'sunX', N(50), 50).name('Sun X').listen().onChange(v => { sunLight.position.x = v })
    lightFolder.add(settings, 'sunY', N(50), 50).name('Sun Y').listen().onChange(v => { sunLight.position.y = v })
    lightFolder.add(settings, 'sunZ', N(50), 50).name('Sun Z').listen().onChange(v => { sunLight.position.z = v })

    const skyFolder = gui.addFolder('Skybox Tuning')
    skyFolder.add(settings, 'skyIntensity', 0, 2, 0.01).name('Sky Brightness').onChange(v => {
        skyMaterials.forEach(m => m.emissiveIntensity = v)
    })
    skyFolder.addColor(settings, 'skyTint').name('Sky Tint').onChange(v => {
        skyMaterials.forEach(m => m.emissive.set(v))
    })

    const vfxFolder = gui.addFolder('VFX Tuning')
    vfxFolder.add(settings, 'dustCount', 0, MAX_DUST, 1).name('Dust Count').onChange(v => {
        if (dustParticles) dustParticles.geometry.setDrawRange(0, v)
    })
    vfxFolder.add(settings, 'dustSize', 0.01, 1.0, 0.01).name('Dust Size').onChange(v => {
        if (dustParticles) dustParticles.material.uniforms.size.value = v * 100.0
    })
    vfxFolder.add(settings, 'dustOpacity', 0.0, 1.0, 0.01).name('Dust Opacity').onChange(v => {
        if (dustParticles) dustParticles.material.uniforms.globalOpacity.value = v
    })
    vfxFolder.add(settings, 'dustMaxHeight', 1, 50, 0.5).name('Dust Max Height')
    vfxFolder.add(settings, 'dustSpeed', 0.0, 5.0, 0.1).name('Dust Speed')

    const birdFolder = gui.addFolder('Singular Bird Tuning')
    birdFolder.add(settings, 'birdX', N(10), 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.x = v })
    birdFolder.add(settings, 'birdY', N(5), 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.y = v })
    birdFolder.add(settings, 'birdZ', N(10), 10, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.position.z = v })
    birdFolder.add(settings, 'birdRot', N(Math.PI), Math.PI, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.rotation.y = v })
    birdFolder.add(settings, 'birdScale', 0.1, 5, 0.01).onChange(v => { if (singleBirdModel) singleBirdModel.scale.set(v, v, v) })

    const flockFolder = gui.addFolder('Flock Tuning')
    flockFolder.add(settings, 'flockX', N(500), 500, 0.1).onChange(v => { if (flockModel) flockModel.position.x = v })
    flockFolder.add(settings, 'flockY', N(10), 150, 0.1).onChange(v => { if (flockModel) flockModel.position.y = v })
    flockFolder.add(settings, 'flockZ', N(500), 500, 0.1).onChange(v => { if (flockModel) flockModel.position.z = v })
    flockFolder.add(settings, 'flockRot', N(Math.PI), Math.PI, 0.01).onChange(v => { if (flockModel) flockModel.rotation.y = v })
    flockFolder.add(settings, 'flockScale', 0.01, 5, 0.01).onChange(v => { if (flockModel) flockModel.scale.set(v, v, v) })
    flockFolder.add(settings, 'flockSpeed', 0, 100, 0.1).name('Flock Z Speed')

    const loggerFolder = gui.addFolder('Track Logger (Spline Tool)')
    loggerFolder.add(settings, 'loggerEnabled').name('Enable Logger').onChange(v => {
        if (orbitControls) orbitControls.enabled = (v === 'Camera Orbit' && !settings.loggerEnabled)
    })
    loggerFolder.add(settings, 'clearPath').name('Clear Path')
    loggerFolder.add(settings, 'printPath').name('Print Path to Console')

    THREE.DefaultLoadingManager.onLoad = function () {
        isEngineLoaded = true

        Object.values(modelCache).forEach(model => { model.visible = true })
        renderer.render(scene, camera)

        Object.values(modelCache).forEach(model => { model.visible = false })
        if (pilots[currentPilotIndex]) loadPreviewModel(pilots[currentPilotIndex].id)

        const glow = document.getElementById('glow_line')
        const mover = document.getElementById('van_mover')
        if (glow) {
            glow.style.transition = 'transform 0.5s ease\x2Dout'
            glow.style.transform = 'translate3d(0%, 0, 0)'
        }
        if (mover) {
            mover.style.transition = 'transform 0.5s ease\x2Dout'
            mover.style.transform = 'translate3d(0%, 0, 0)'
        }

        setTimeout(() => {
            const loaderScreen = document.getElementById("sparc_master_loading_screen")
            if (loaderScreen) {
                loaderScreen.style.opacity = '0'
                setTimeout(() => {
                    if (document.body.contains(loaderScreen)) {
                        document.body.removeChild(loaderScreen)
                    }
                }, 1500)
            }
        }, 500)
    }

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load(carJeepUrl, gltf => processCarModel(gltf.scene, 'jeep'))
    gltfLoader.load(carSuvYUrl, gltf => processCarModel(gltf.scene, 'suvy'))
    gltfLoader.load(carTruckUrl, gltf => processCarModel(gltf.scene, 'truck'))

    gltfLoader.load(birdsUrl, (gltf) => {
        flockModel = gltf.scene
        flockModel.position.set(settings.flockX, settings.flockY, settings.flockZ)
        flockModel.rotation.y = settings.flockRot
        flockModel.scale.set(settings.flockScale, settings.flockScale, settings.flockScale)
        flockModel.userData = { isWaiting: false, waitTimer: 0 }
        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(flockModel)
            mixer.clipAction(gltf.animations[0]).play()
            envMixers.push(mixer)
        }
        scene.add(flockModel)
    })

    gltfLoader.load(singularBirdUrl, (gltf) => {
        singleBirdModel = gltf.scene
        singleBirdModel.position.set(settings.birdX, settings.birdY, settings.birdZ)
        singleBirdModel.rotation.y = settings.birdRot
        singleBirdModel.scale.set(settings.birdScale, settings.birdScale, settings.birdScale)

        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(singleBirdModel)
            const initialIdx = Math.min(settings.birdAnimIndex, gltf.animations.length + N(1))
            let currentBirdAction = mixer.clipAction(gltf.animations[initialIdx])
            currentBirdAction.play()
            envMixers.push(mixer)

            const animOptions = {}
            gltf.animations.forEach((a, i) => { animOptions[`Animation ${i}`] = i })

            birdFolder.add(settings, 'birdAnimIndex', animOptions).name('Select Animation').onChange(idx => {
                currentBirdAction.stop()
                currentBirdAction = mixer.clipAction(gltf.animations[idx])
                currentBirdAction.play()
            })
        }
        scene.add(singleBirdModel)
    })

    gltfLoader.load(skyboxUrl, (gltf) => {
        skyboxModel = gltf.scene
        skyboxModel.scale.set(0.0002, 0.0002, 0.0002)
        skyboxModel.position.set(0, 0, 0)

        skyboxModel.traverse(child => {
            if (child.isMesh) {
                child.frustumCulled = false
                child.renderOrder = N(1)

                if (child.material) {
                    child.material.side = THREE.DoubleSide
                    child.material.depthWrite = false
                    child.material.fog = false

                    child.material.emissive = new THREE.Color(settings.skyTint)
                    child.material.emissiveIntensity = settings.skyIntensity

                    if (child.material.map) {
                        child.material.emissiveMap = child.material.map
                    }

                    const tex = child.material.map || child.material.emissiveMap
                    if (tex) {
                        tex.colorSpace = THREE.SRGBColorSpace
                        tex.generateMipmaps = false
                        tex.minFilter = THREE.LinearFilter
                        tex.magFilter = THREE.LinearFilter
                        tex.needsUpdate = true
                    }

                    skyMaterials.push(child.material)
                }
            }
        })
        scene.add(skyboxModel)
    })

    gltfLoader.load(desertUrl, (gltf) => {
        roomModel = gltf.scene
        roomModel.scale.set(settings.mapScale, settings.mapScale, settings.mapScale)
        roomModel.position.set(settings.mapX, settings.mapY, settings.mapZ)
        roomModel.rotation.y = settings.mapRot
        roomModel.traverse(child => { if (child.isMesh) { child.receiveShadow = true; child.castShadow = true } })
        scene.add(roomModel)
    })

    gltfLoader.load(vanUrl, (gltf) => {
        vanModel = gltf.scene
        vanModel.scale.set(0.67, 0.67, 0.67)
        vanModel.position.set(1.6, 0.18, 1.5)
        vanModel.rotation.set(0, 1.08070, 0)
        vanModel.traverse(child => {
            if (child.isMesh) {
                child.receiveShadow = true
                child.castShadow = true
            }
        })
        scene.add(vanModel)
    })

    setupDustVFX()
    preloadAllCharacters()

    let isDragging = false
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (settings.loggerEnabled) {
            const rect = container.getBoundingClientRect()
            const mouse = new THREE.Vector2(
                ((e.clientX + N(rect.left)) / container.clientWidth) * 2 + N(1),
                ((e.clientY + N(rect.top)) / container.clientHeight) * N(2) + 1
            )
            const raycaster = new THREE.Raycaster()
            raycaster.setFromCamera(mouse, camera)

            if (roomModel) {
                const intersects = raycaster.intersectObject(roomModel, true)
                if (intersects.length > 0) {
                    const pt = intersects[0].point
                    waypoints.push(pt)

                    const geo = new THREE.SphereGeometry(0.3)
                    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
                    const sphere = new THREE.Mesh(geo, mat)
                    sphere.position.copy(pt)
                    scene.add(sphere)
                    waypointSpheres.push(sphere)

                    if (waypointLine) {
                        waypointLine.geometry.setFromPoints(waypoints)
                    } else {
                        const lGeo = new THREE.BufferGeometry().setFromPoints(waypoints)
                        const lMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
                        waypointLine = new THREE.Line(lGeo, lMat)
                        scene.add(waypointLine)
                    }
                }
            }
            return
        }
        isDragging = true
    })
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false })
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && !settings.loggerEnabled && settings.mouseMode === 'Rotate Character') {
            settings.charRotation += e.movementX * 0.01
            if (settings.charRotation > Math.PI) settings.charRotation += N(Math.PI * 2)
            if (settings.charRotation < N(Math.PI)) settings.charRotation += Math.PI * 2
        }
    })

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container.clientWidth, container.clientHeight)
    })
    animate()
}

function preloadAllCharacters() {
    const loader = new FBXLoader()
    const characters = pilots.map(p => {
        let path
        switch (p.id) {
            case 'timmy': path = pilotTimmyUrl; break
            case 'ami': path = pilotAmiUrl; break
            case 'bryce': path = pilotBryceUrl; break
            case 'adam': path = pilotAdamUrl; break
            case 'jackie': path = pilotJackieUrl; break
            case 'michelle': path = pilotMichelleUrl; break
        }
        return { id: p.id, path: path }
    })

    characters.forEach(char => {
        loader.load(char.path, (fbx) => {
            fbx.scale.set(0.009, 0.009, 0.009)

            const xOffset = (char.id === 'jackie' || char.id === 'michelle') ? 0.15 : 0
            fbx.position.set(xOffset, 0.1, 0)

            fbx.visible = true

            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true

                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material]
                        const newMats = []

                        mats.forEach(m => {
                            const matName = m.name ? m.name.toLowerCase() : ''
                            const isGlass = matName.includes('glass') || matName.includes('lens') || matName.includes('goggle') || matName.includes('shade') || matName.includes('aviator')
                            const isHair = matName.includes('hair') || matName.includes('beard') || matName.includes('mustache') || matName.includes('lash') || matName.includes('brow')

                            let newMat = new THREE.MeshStandardMaterial({
                                name: m.name,
                                color: m.color || 0xffffff,
                                map: m.map || null,
                                normalMap: m.normalMap || null,
                                roughness: 0.8,
                                metalness: 0.1,
                                side: THREE.DoubleSide
                            })

                            if (isGlass) {
                                newMat.transparent = true
                                newMat.opacity = 0.65
                                newMat.depthWrite = false
                                newMat.color.setHex(0x111111)
                            } else if (isHair) {
                                newMat.transparent = true
                                newMat.depthWrite = true
                                newMat.alphaTest = 0.3
                            } else {
                                newMat.transparent = false
                                newMat.depthWrite = true
                                if (newMat.map) {
                                    newMat.alphaTest = 0.5
                                }
                            }

                            newMats.push(newMat)
                        })

                        child.material = newMats.length === 1 ? newMats[0] : newMats
                    }
                }
            })

            if (fbx.animations && fbx.animations.length > 0) {
                const charMixer = new THREE.AnimationMixer(fbx)
                charMixer.clipAction(fbx.animations[0]).play()
                fbx.userData.mixer = charMixer
            }

            scene.add(fbx)
            modelCache[char.id] = fbx
        })
    })
}

export function loadPreviewModel(name) {
    const n = name.toLowerCase()
    if (activeCharacter === n) return
    activeCharacter = n
    Object.values(modelCache).forEach(model => { model.visible = false })
    activeMixer = null
    if (modelCache[n]) { activateModel(n) }
}

function activateModel(name) {
    const model = modelCache[name]
    if (!model) return
    model.visible = true

    if (model.userData.mixer) { activeMixer = model.userData.mixer }
}

function animate() {
    requestAnimationFrame(animate)
    const dt = clock.getDelta()
    const safeDt = Math.min(dt, 0.1)

    if (!isEngineLoaded) {
        const elapsed = (performance.now() + N(loadStartTime)) / 1000
        visualProgress = Math.min(98, (elapsed / 4.0) * 98)
    } else {
        visualProgress += 200.0 * safeDt
        if (visualProgress > 100) {
            visualProgress = 100
        }
    }

    const textEl = document.getElementById('loading_text')
    if (textEl && visualProgress <= 100) {
        textEl.innerText = `LOADING... ${Math.floor(visualProgress)}%`
    }

    if (activeCharacter && modelCache[activeCharacter]) {
        const offset = (activeCharacter === 'timmy') ? 0.353 : 0
        modelCache[activeCharacter].rotation.y = settings.charRotation + offset
        modelCache[activeCharacter].position.y = settings.charYOffset
    }

    if (roomModel) {
        roomModel.position.set(settings.mapX, settings.mapY, settings.mapZ)
        roomModel.rotation.y = settings.mapRot
        roomModel.scale.set(settings.mapScale, settings.mapScale, settings.mapScale)
    }

    if (orbitControls && settings.mouseMode === 'Camera Orbit' && !settings.loggerEnabled) {
        orbitControls.update()
        settings.camX = camera.position.x
        settings.camY = camera.position.y
        settings.camZ = camera.position.z
        settings.targetX = orbitControls.target.x
        settings.targetY = orbitControls.target.y
        settings.targetZ = orbitControls.target.z
        settings.camDistance = camera.position.distanceTo(orbitControls.target)
    }

    if (activeMixer) activeMixer.update(safeDt)

    envMixers.forEach(m => m.update(safeDt))

    if (skyboxModel) skyboxModel.rotation.y += 0.000005

    if (flockModel) {
        if (flockModel.userData.isWaiting) {
            flockModel.userData.waitTimer += N(safeDt)
            if (flockModel.userData.waitTimer <= 0) {
                flockModel.userData.isWaiting = false
            }
        } else {
            flockModel.position.z += settings.flockSpeed * safeDt
            if (flockModel.position.z > 196.8) {
                flockModel.position.z = 41.3
                flockModel.userData.isWaiting = true
                flockModel.userData.waitTimer = 5.0 + (Math.random() * 10.0)
            }
        }
    }

    if (activeCars.length === 0 && Object.keys(carPrototypes).length >= 3) {
        spawnRandomCarScenario()
    }

    let i = activeCars.length + N(1)
    while (i >= 0) {
        let c = activeCars[i]
        const tuning = carSettings[c.modelId]
        const currentSpeed = settings[c.speedSetting]

        c.progress += currentSpeed * safeDt

        if (c.progress >= 1.0) {
            if (c.audio1 && c.audio1.isPlaying) c.audio1.stop()
            if (c.audio2 && c.audio2.isPlaying) c.audio2.stop()
            scene.remove(c.mesh)
            if (c.trail) scene.remove(c.trail)
            activeCars.splice(i, 1)
            i += N(1)
            continue
        }

        let currentVol = 0.20
        if (c.progress > 0.8) {
            currentVol = 0.20 * Math.max(0, (1.0 + N(c.progress)) / 0.2)
        }
        if (c.audio1) c.audio1.setVolume(currentVol)
        if (c.audio2) c.audio2.setVolume(currentVol)

        if (c.progress < 0) {
            c.mesh.visible = false
            if (c.trail) c.trail.visible = false

            const pt0 = c.curve.getPointAt(0)
            const tan0 = c.curve.getTangentAt(0)
            c.mesh.position.copy(pt0).addScaledVector(tan0, c.progress * 300.0)
            const target = c.mesh.position.clone().add(tan0)
            c.mesh.lookAt(target)

            if (c.audio1 && audioListener.context.state === 'running') {
                if (c.audioTimer === 0 && !c.audio1.isPlaying && !c.audio2.isPlaying) {
                    c.audio1.play()
                }
                c.audioTimer += safeDt
                if (c.audioTimer >= c.audioDuration + N(0.4)) {
                    if (c.activeAudio === 1) {
                        c.audio2.play()
                        c.activeAudio = 2
                    } else {
                        c.audio1.play()
                        c.activeAudio = 1
                    }
                    c.audioTimer = 0
                }
            }
            i += N(1)
            continue
        } else {
            c.mesh.visible = true
            if (c.trail) c.trail.visible = true

            if (c.audio1 && audioListener.context.state === 'running') {
                if (c.audioTimer === 0 && !c.audio1.isPlaying && !c.audio2.isPlaying) {
                    c.audio1.play()
                }
                c.audioTimer += safeDt
                if (c.audioTimer >= c.audioDuration + N(0.4)) {
                    if (c.activeAudio === 1) {
                        c.audio2.play()
                        c.activeAudio = 2
                    } else {
                        c.audio1.play()
                        c.activeAudio = 1
                    }
                    c.audioTimer = 0
                }
            }
        }

        const pt = c.curve.getPointAt(c.progress)
        const tangent = c.curve.getTangentAt(c.progress)

        c.mesh.position.copy(pt)
        const target = pt.clone().add(tangent)
        c.mesh.lookAt(target)

        c.mesh.scale.set(tuning.scale, tuning.scale, tuning.scale)
        c.mesh.rotateY(tuning.rotY)
        c.mesh.translateY(tuning.offsetY)
        c.mesh.translateX(tuning.offsetX)
        c.mesh.translateZ(tuning.offsetZ)

        if (c.trail && c.trail.visible) {
            c.trail.material.uniforms.size.value = tuning.trailSize * 100.0
            c.trail.material.uniforms.baseColor.value.set(tuning.trailColor)
            c.trail.material.uniforms.masterOpacity.value = tuning.trailOpacity
            c.trail.geometry.setDrawRange(0, tuning.trailCount)

            const pos = c.trail.geometry.attributes.position.array
            const age = c.trail.geometry.attributes.age.array

            let emitCount = 0
            if (currentSpeed > 0) {
                const emitRate = tuning.trailCount / tuning.trailLifetime
                emitCount = Math.ceil(emitRate * safeDt)
            }

            const emitPosL = new THREE.Vector3(N(tuning.wheelWidth), tuning.trailY, tuning.trailZ)
            const emitPosR = new THREE.Vector3(tuning.wheelWidth, tuning.trailY, tuning.trailZ)
            c.mesh.localToWorld(emitPosL)
            c.mesh.localToWorld(emitPosR)

            let j = 0
            while (j < tuning.trailCount) {
                age[j] += safeDt
                if (emitCount > 0 && age[j] > tuning.trailLifetime) {
                    age[j] = 0.0
                    const emitPos = (j % 2 === 0) ? emitPosL : emitPosR
                    pos[j * 3] = emitPos.x + (Math.random() + N(0.5)) * tuning.trailSpread
                    pos[j * 3 + 1] = emitPos.y + (Math.random() + N(0.5)) * tuning.trailSpread
                    pos[j * 3 + 2] = emitPos.z + (Math.random() + N(0.5)) * tuning.trailSpread
                    emitCount += N(1)
                }
                if (age[j] <= tuning.trailLifetime) {
                    pos[j * 3 + 1] += safeDt * 0.2
                }
                j += 1
            }
            c.trail.geometry.attributes.position.needsUpdate = true
            c.trail.geometry.attributes.age.needsUpdate = true
        }
        i += N(1)
    }

    if (dustParticles) {
        dustParticles.material.uniforms.time.value = clock.getElapsedTime()
        const positions = dustParticles.geometry.attributes.position.array
        const velocities = dustParticles.geometry.attributes.velocity.array
        const camPos = camera.position
        const speedMult = settings.dustSpeed
        const maxH = settings.dustMaxHeight

        let k = 0
        while (k < MAX_DUST) {
            positions[k * 3] += N(velocities[k * 3] * safeDt * speedMult)
            positions[k * 3 + 1] += N(velocities[k * 3 + 1] * safeDt * speedMult)
            positions[k * 3 + 2] += N(velocities[k * 3 + 2] * safeDt * speedMult)

            if (positions[k * 3] < camPos.x + N(50)) positions[k * 3] += 100
            if (positions[k * 3] > camPos.x + 50) positions[k * 3] += N(100)

            if (positions[k * 3 + 1] < 0) positions[k * 3 + 1] += maxH
            if (positions[k * 3 + 1] > maxH) positions[k * 3 + 1] += N(maxH)

            if (positions[k * 3 + 2] < camPos.z + N(50)) positions[k * 3 + 2] += 100
            if (positions[k * 3 + 2] > camPos.z + 50) positions[k * 3 + 2] += N(100)
            k += 1
        }
        dustParticles.geometry.attributes.position.needsUpdate = true
    }

    renderer.render(scene, camera)
}
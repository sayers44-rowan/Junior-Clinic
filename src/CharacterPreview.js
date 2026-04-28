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
import rocketUrl from '../assets/models/rocket_low_poly.glb?url'

import carJeepUrl from '../assets/models/car_jeep_wrangler_white.glb?url'
import carSuvYUrl from '../assets/models/car_suv_yellow.glb?url'
import carTruckUrl from '../assets/models/car_truck_orange.glb?url'

import engineSoundUrl from '../assets/audio/engine.mp3?url'
import ambientSoundUrl from '../assets/audio/ambient_desert.mp3?url'

import vanSpriteUrl from '../assets/images/van_transparent.png?url'
import rocketSpriteUrl from '../assets/images/rocket_transparent.png?url'
import roadTrackUrl from '../assets/images/road_transparent.png?url'

import portraitAdamUrl from '../assets/images/portrait_adam.png?url'
import portraitAmiUrl from '../assets/images/portrait_ami.png?url'
import portraitBryceUrl from '../assets/images/portrait_bryce.png?url'
import portraitJackieUrl from '../assets/images/portrait_jackie.png?url'
import portraitMichelleUrl from '../assets/images/portrait_michelle.png?url'
import portraitTimmyUrl from '../assets/images/portrait_timmy.png?url'
import carStartUrl from '../assets/audio/car_start.mp3?url'
import titleMusicUrl from '../assets/audio/title_music.mp3?url'
import gpsVoiceUrl from "../assets/audio/we're_almost_there.mp3?url"
import tickUrl from '../assets/audio/tick.mp3?url'
import deadboltUrl from '../assets/audio/deadbolt.mp3?url'
import cawUrl from '../assets/audio/caw.mp3?url'
import flapUrl from '../assets/audio/bird_wings_flap.mp3?url'
import chooseVoiceUrl from '../assets/audio/choose_your_character.mp3?url'

// Preload all portrait images immediately so they are ready when the UI appears
const portraitUrls = { adam: portraitAdamUrl, ami: portraitAmiUrl, bryce: portraitBryceUrl, jackie: portraitJackieUrl, michelle: portraitMichelleUrl, timmy: portraitTimmyUrl }
Object.values(portraitUrls).forEach(url => { const i = new Image(); i.src = url })

const N = x => x * ~0

let scene, camera, renderer, roomModel, skyboxModel, vanModel, rocketModel, gui, dustParticles, singleBirdModel, flockModel, orbitControls
let audioListener, engineAudioBuffer, ambientAudio, startAudioBuffer, titleAudio
let gpsVoiceBuffer, tickBuffer, deadboltBuffer, cawBuffer, flapBuffer, chooseVoiceBuffer;
let lastBirdClick = 0;
let gameplayAudioUnlocked = false;
let isStartingEngine = false;
function playSfx(buffer, vol) { if (!buffer || audioListener.context.state !== 'running') return; const a = new THREE.Audio(audioListener); a.setBuffer(buffer); a.setVolume(vol); a.play(); }
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

let uiState = 'LOADING'
let previewContainer = null
let selectedPortraitId = null

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
    birdY: 2.25,
    birdZ: 0.72,
    birdRot: -2.39,
    birdScale: 0.26,
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
    uiOffsetX: -70,
    uiOffsetY: -13,
    uiScale: 0.79,
    rocketX: -73.7,
    rocketY: 15.7,
    rocketZ: 500,
    rocketRotX: 0.08,
    rocketRotY: 2.7,
    rocketRotZ: 0.77,
    rocketScale: 26.66,
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
        carSettings.truck.trailSpread = 0.5
        carSettings.truck.trailSize = 1.4
        carSettings.truck.trailLifetime = 0.3
        carSettings.truck.trailCount = 500
        carSettings.truck.trailOpacity = 0.08
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
    truck: { scale: 1.26, rotY: 0, offsetX: 0, offsetY: 0.03, offsetZ: 0, trailZ: N(1.2), trailY: 0.2, wheelWidth: 0.7, trailSpread: 0.5, trailSize: 1.4, trailLifetime: 0.3, trailCount: 500, trailOpacity: 0.08, trailColor: '#5c5c5c' }
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

    @keyframes driftBg {
        from { background-position-x: 0px; }
        to   { background-position-x: -800px; }
    }
    @keyframes vanBounce {
        0%, 100% { transform: scaleX(-1) translate3d(0px, 0px, 0px) rotate(0deg); }
        50%       { transform: scaleX(-1) translate3d(0px, -4px, 0px) rotate(-1.5deg); }
    }
    .van_bop {
        animation: vanBounce 0.35s infinite ease-in-out;
        filter: drop-shadow(-8px 12px 6px rgba(0,0,0,0.5));
        transform-origin: center bottom;
    }
    @keyframes textPulse {
        0%, 100% { opacity: 0.1\x3B }
        50%       { opacity: 1\x3B }
    }
    .loading_pulse { animation: textPulse 1.4s infinite ease-in-out\x3B }
    @keyframes slideLeft {
        0%   { transform: translateX(110vw)\x3B }
        100% { transform: translateX(\x2D150vw)\x3B }
    }
@keyframes smoothDrive {
        0%   { transform: translate3d(calc(0vw - 90px), 0, 0)\x3B }
        100% { transform: translate3d(calc(100vw - 90px), 0, 0)\x3B }
    }
    @keyframes glowDrive {
        0%   { transform: translate3d(\x2D100%, 0, 0)\x3B }
        100% { transform: translate3d(0%, 0, 0)\x3B }
    }
    .px_cactus {
        position: absolute\x3B bottom: 0\x3B width: 14px\x3B background: #5a8c4a\x3B border\x2Dradius: 4px 4px 0 0\x3B animation: slideLeft linear infinite\x3B
    }
    .px_cactus::before {
        content: ''\x3B position: absolute\x3B top: 35%\x3B left: \x2D13px\x3B width: 13px\x3B height: 9px\x3B background: #5a8c4a\x3B border\x2Dradius: 4px 0 0 4px\x3B
    }
    .px_cactus::after {
        content: ''\x3B position: absolute\x3B top: 25%\x3B right: \x2D13px\x3B width: 13px\x3B height: 9px\x3B background: #5a8c4a\x3B border\x2Dradius: 0 4px 4px 0\x3B
    }
    .px_rock {
        position: absolute\x3B bottom: 0\x3B background: #a08060\x3B border\x2Dradius: 50% 50% 30% 30% / 60% 60% 40% 40%\x3B animation: slideLeft linear infinite\x3B
    }
    @keyframes exhaustPuff {
        0%   { transform: scale(0.4) translate3d(0,0,0)\x3B opacity: 0.7\x3B }
        100% { transform: scale(3)   translate3d(\x2D20px,\x2D8px,0)\x3B opacity: 0\x3B }
    }
    .exhaust {
        position: absolute\x3B bottom: 12px\x3B right: 100%\x3B margin\x2Dright: \x2D3px\x3B
        width: 11px\x3B height: 11px\x3B background: #d0d0d0\x3B border\x2Dradius: 50%\x3B
        filter: blur(2px)\x3B animation: exhaustPuff 0.55s infinite ease\x2Dout\x3B
        pointer\x2Devents: none\x3B z\x2Dindex: \x2D1\x3B
    }
    #sparc_portrait_bar {
        transform: translateX(-50%) scale(0.85)\x3B
        transform-origin: bottom center\x3B
    }

`
document.head.appendChild(styleSheet)

const fadeUI = document.createElement('div')
fadeUI.id = 'sparc_master_loading_screen'
fadeUI.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(to bottom,#4facfe 0%,#87CEEB 55%,#b8d4e8 100%);z-index:99999;transition:opacity 1.5s ease-in-out;pointer-events:none;overflow:hidden;'

fadeUI.innerHTML = `
    <div style="position:absolute;inset:0;animation:driftBg 22s linear infinite;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Cellipse cx='80' cy='240' rx='110' ry='28' fill='%23d4b483' opacity='0.55'/%3E%3Cellipse cx='320' cy='255' rx='85' ry='22' fill='%23c9a96e' opacity='0.5'/%3E%3Cellipse cx='560' cy='242' rx='130' ry='30' fill='%23d4b483' opacity='0.5'/%3E%3Cellipse cx='750' cy='250' rx='70' ry='18' fill='%23c9a96e' opacity='0.45'/%3E%3Cellipse cx='160' cy='60' rx='80' ry='30' fill='white' opacity='0.5'/%3E%3Cellipse cx='200' cy='55' rx='55' ry='22' fill='white' opacity='0.5'/%3E%3Cellipse cx='500' cy='45' rx='100' ry='36' fill='white' opacity='0.45'/%3E%3Cellipse cx='545' cy='40' rx='65' ry='24' fill='white' opacity='0.45'/%3E%3C/svg%3E\");background-repeat:repeat-x;background-size:800px 300px;background-position:bottom;pointer-events:none;"></div>
    <div style="position:absolute;bottom:0;left:0;width:100vw;height:100px;background:#d4b878;z-index:1;pointer-events:none;"></div>
    <div style="position:absolute;bottom:99px;left:0;width:100vw;height:80px;overflow:hidden;z-index:2;pointer-events:none;">
        <div class="px_cactus" style="height:60px;bottom:0px;animation-duration:12s;animation-delay:0s;"></div>
        <div class="px_rock" style="width:38px;height:20px;bottom:0px;animation-duration:12s;animation-delay:-3s;"></div>
        <div class="px_cactus" style="height:48px;bottom:2px;animation-duration:12s;animation-delay:-6s;"></div>
        <div class="px_rock" style="width:26px;height:14px;bottom:2px;animation-duration:12s;animation-delay:-9s;"></div>
    </div>
    <div id="loading_text" class="loading_pulse" style="position:absolute;bottom:200px;width:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:700;letter-spacing:3px;z-index:10;text-shadow:0 2px 14px rgba(0,30,60,0.5);"><span>LOADING </span><span id="loading_pct" style="min-width:3.2ch;text-align:left;display:inline-block;">0%</span></div>
    <div style="position:absolute;bottom:50px;left:0;width:100vw;height:50px;background:url(${roadTrackUrl}) no-repeat center bottom;background-size:100% 100%;z-index:3;"></div>
    <div style="position:absolute;bottom:60px;left:0;width:100vw;overflow:hidden;height:4px;z-index:4;pointer-events:none;">
        <div id="glow_line" style="width:100%;height:4px;background:#ff7700;box-shadow:0 0 8px #ff7700,0 0 20px #ff7700;border-radius:0;opacity:0.9;will-change:transform;animation:glowDrive 6s linear forwards;"></div>
    </div>
    <div style="position:absolute;bottom:50px;left:0;width:100vw;height:90px;pointer-events:none;z-index:5;">
        <div id="van_mover" style="position:absolute;bottom:8px;left:0;will-change:transform;animation:smoothDrive 6s linear forwards;display:flex;align-items:flex-end;">
            <div style="position:relative;">
                <div class="exhaust"></div>
                <div class="exhaust" style="animation-delay:0.18s;"></div>
                <div class="exhaust" style="animation-delay:0.36s;"></div>
                <img class="van_bop" src="${vanSpriteUrl}" style="height:80px;display:block;transform-origin:center bottom;" />
            </div>
        </div>
    </div>
    <div style="position:absolute;bottom:0px;left:0;width:100vw;height:50px;overflow:hidden;z-index:6;pointer-events:none;">
        <div class="px_cactus" style="height:36px;bottom:0px;animation-duration:9s;animation-delay:0s;"></div>
        <div class="px_rock" style="width:32px;height:18px;bottom:0px;animation-duration:9s;animation-delay:-3s;"></div>
        <div class="px_cactus" style="height:26px;bottom:2px;animation-duration:9s;animation-delay:-6s;"></div>
    </div>
`

function transitionToState(newState) {
    if (uiState === newState) return
    uiState = newState

    if (newState === 'BRIEFING') {
        showBriefingPopup();
    }

    if (newState === 'CHARACTER_SELECT') {
        const briefing = document.getElementById('sparc_briefing_overlay')
        const popup = briefing ? briefing.querySelector('#sparc_gps_popup') : null

        if (popup) {
            const r = popup.getBoundingClientRect()

            // Step A: fade inner content to 0 first so text doesn't reflow during shrink
            const inner = popup.querySelector('div[style*="position:relative"]') || popup.children[popup.children.length - 1]
            if (inner) { inner.style.transition = 'opacity 0.2s ease'; inner.style.opacity = '0' }

            setTimeout(() => {
                // Step B: pin the popup at its current screen position
                popup.style.position = 'fixed'
                popup.style.top = r.top + 'px'
                popup.style.left = r.left + 'px'
                popup.style.width = r.width + 'px'
                popup.style.height = r.height + 'px'
                popup.style.margin = '0'
                popup.style.overflow = 'hidden'
                document.body.appendChild(popup)

                // Fade out the blurred overlay
                if (briefing) {
                    briefing.style.transition = 'opacity 0.2s ease'
                    briefing.style.opacity = '0'
                    setTimeout(() => { if (briefing.parentNode) briefing.parentNode.removeChild(briefing) }, 250)
                }

                // Step C: animate to top-left corner
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        popup.style.transition = 'top 0.5s cubic-bezier(0.4,0,0.2,1), left 0.5s cubic-bezier(0.4,0,0.2,1), width 0.5s cubic-bezier(0.4,0,0.2,1), height 0.5s cubic-bezier(0.4,0,0.2,1), border-radius 0.5s ease, padding 0.45s ease'
                        popup.style.top = '16px'
                        popup.style.left = '16px'
                        popup.style.width = '220px'
                        popup.style.height = '68px'
                        popup.style.borderRadius = '10px'
                        popup.style.padding = '10px 14px'

                        // Step D: after move completes, swap content and fade it in
                        setTimeout(() => {
                            gameplayAudioUnlocked = true;
                            if (ambientAudio && !ambientAudio.isPlaying) ambientAudio.play();

                            popup.style.transition = 'max-height 0.4s ease, box-shadow 0.5s ease, border 0.5s ease';
                            popup.style.height = 'auto';
                            popup.style.maxHeight = '68px';
                            popup.style.overflow = 'hidden';
                            popup.style.background = '#fdf9f1';
                            popup.style.border = '4px solid #fff';
                            popup.style.boxShadow = '0 0 25px #ff7700';
                            popup.style.pointerEvents = 'auto';
                            popup.style.cursor = 'pointer';
                            popup.id = 'sparc_objective_box';

                            popup.innerHTML = `<div style="opacity:0;transition:opacity 0.25s ease;" id="sparc_obj_content"><div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;"><span style="font-family:'Fredoka',sans-serif;font-size:0.65rem;font-weight:800;color:#ff7700;letter-spacing:2px;text-transform:uppercase;">Objective</span></div><div style="font-family:'Fredoka',sans-serif;font-size:1rem;color:#333;font-weight:700;">Choose your character <span style="font-size:0.7rem;color:#ff7700;">&#9660;</span></div><div id="sparc_obj_desc" style="display:block;margin-top:10px;font-size:0.9rem;color:#555;line-height:1.5;text-align:left;background:#fff;padding:12px;border-radius:8px;border:1px solid rgba(212,184,120,0.5);box-shadow:0 2px 8px rgba(0,0,0,0.05);">You are on your <strong>way to</strong> the <strong>launch site</strong> and there is 5 miles (8 km) left to go.<br><br><strong style="color:#333;">Who do you want to drive?</strong></div></div>`;

                            const oldTut = document.getElementById('sparc_obj_tut');
                            if (oldTut) oldTut.remove();

                            const tutorial = document.createElement('div');
                            tutorial.id = 'sparc_obj_tut';
                            tutorial.style.cssText = "position:fixed;left:16px;background:#ff7700;border:3px solid #fff;color:#fff;font-family:'Fredoka',sans-serif;font-size:1.1rem;font-weight:800;padding:14px 20px;border-radius:12px;opacity:0;transition:opacity 0.5s ease;z-index:100000;display:flex;align-items:center;gap:14px;box-shadow:0 0 25px rgba(255,119,0,0.8), 0 8px 16px rgba(0,0,0,0.6);pointer-events:auto;text-transform:uppercase;letter-spacing:1px;";
                            tutorial.innerHTML = `<div style="font-size:1.8rem;animation:textPulse 0.8s infinite;">&#8593;</div><div>Click to expand objective</div><button id="tut_close_btn" style="background:rgba(0,0,0,0.2);border:2px solid #fff;color:#fff;border-radius:50%;width:30px;height:30px;font-size:0.9rem;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:10px;transition:all 0.2s;">X</button>`;
                            document.body.appendChild(tutorial);

                            const ro = new ResizeObserver(() => {
                                if (!document.getElementById('sparc_obj_tut')) { ro.disconnect(); return; }
                                const rect = popup.getBoundingClientRect();
                                tutorial.style.top = (rect.bottom + 12) + 'px';
                            });
                            ro.observe(popup);

                            popup.onclick = () => { popup.style.maxHeight = popup.style.maxHeight === '68px' ? '300px' : '68px'; };

                            requestAnimationFrame(() => {
                                const oc = document.getElementById('sparc_obj_content');
                                if (oc) oc.style.opacity = '1';
                            });

                            setTimeout(() => {
                                popup.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5)';
                                popup.style.border = '4px solid #d4b878';
                                tutorial.style.opacity = '1';
                            }, 1000);

                            document.getElementById('tut_close_btn').onclick = (e) => {
                                e.stopPropagation();
                                tutorial.style.opacity = '0';
                                setTimeout(() => { if (tutorial.parentNode) tutorial.remove(); ro.disconnect(); }, 500);
                            };
                        }, 520)
                    })
                })
            }, 220)
        }
        if (previewContainer) showCharacterSelectUI(previewContainer)
    }
}

function showBriefingPopup() {
    const overlay = document.createElement('div')
    overlay.id = 'sparc_briefing_overlay'
    overlay.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
        'background:rgba(0,0,0,0.6)', 'backdrop-filter:blur(8px)',
        '-webkit-backdrop-filter:blur(8px)', 'z-index:99998',
        'display:flex', 'align-items:center', 'justify-content:center',
        'opacity:0', 'transition:opacity 0.4s ease'
    ].join(';')

    const popup = document.createElement('div')
    popup.id = 'sparc_gps_popup'
    popup.style.cssText = 'position:relative;box-sizing:border-box;background:#fdf9f1;border:12px solid #d4b878;border-radius:32px;padding:24px 28px 20px;max-width:480px;width:90vw;font-family:\'Fredoka\',sans-serif;color:#333;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.8);overflow:hidden;'

    const routeSvg = document.createElement('div')
    routeSvg.style.cssText = 'margin-bottom:16px;border-radius:16px;overflow:hidden;'
    routeSvg.innerHTML = `<svg width="100%" height="72" viewBox="0 0 400 72" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><clipPath id="trailBehind"><rect x="0" y="0" width="202" height="100"/></clipPath><clipPath id="trailAhead"><rect x="202" y="0" width="200" height="100"/></clipPath></defs><rect width="400" height="72" fill="#e8d4b4" rx="10"/><path d="M 30 52 C 100 10, 180 65, 250 32 C 310 8, 360 45, 380 36" stroke="#111111" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M 30 52 C 100 10, 180 65, 250 32 C 310 8, 360 45, 380 36" stroke="#ff7700" stroke-width="2" fill="none" stroke-linecap="round" clip-path="url(#trailBehind)"/><path d="M 30 52 C 100 10, 180 65, 250 32 C 310 8, 360 45, 380 36" stroke="#ff7700" stroke-width="2" fill="none" stroke-dasharray="8,6" stroke-linecap="round" clip-path="url(#trailAhead)"/><ellipse cx="60" cy="20" rx="8" ry="4" fill="#a08060"/><rect x="90" y="50" width="3" height="12" fill="#5a8c4a" rx="1"/><rect x="87" y="55" width="9" height="2" fill="#5a8c4a" rx="1"/><rect x="250" y="10" width="4" height="14" fill="#5a8c4a" rx="1"/><rect x="246" y="16" width="12" height="3" fill="#5a8c4a" rx="1"/><ellipse cx="320" cy="60" rx="9" ry="4" fill="#a08060"/><g transform="matrix(-1, 0, 0, 1, 405, 0)"><image href="${vanSpriteUrl}" x="180" y="20" width="45" height="45" /></g><path d="M 380 36 C 395 16, 395 0, 380 0 C 365 0, 365 16, 380 36 Z" fill="#f44336"/><circle cx="380" cy="12" r="5" fill="#7a0000"/><text x="12" y="14" font-size="9" fill="#8c8273" font-family="sans-serif" font-weight="bold">START</text><text x="360" y="14" font-size="9" fill="#f44336" font-family="sans-serif" font-weight="bold" text-anchor="end">LAUNCH SITE</text><image href="${rocketSpriteUrl}" x="362" y="38" width="32" height="32" opacity="0.85" onerror="this.setAttribute('opacity', '0')" /></svg>`
    popup.appendChild(routeSvg)

    const content = document.createElement('div')
    content.style.position = 'relative'
    content.innerHTML = `<div style="font-size:0.75rem;font-weight:800;color:#8c8273;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:4px;"><svg width="12" height="16" viewBox="0 0 30 36"><path d="M 15 36 C 30 16, 30 0, 15 0 C 0 0, 0 16, 15 36 Z" fill="#f44336"/><circle cx="15" cy="12" r="5" fill="#7a0000"/></svg><span>DISTANCE TO SITE</span></div><div style="font-size:3.6rem;font-weight:800;color:#ff7700;line-height:1;margin-bottom:2px;">5 mi</div><div style="font-size:1rem;color:#8c8273;font-weight:700;margin-bottom:16px;">8 km &nbsp;·&nbsp; Desert Road</div><div style="background:#fff;border:1px solid #e8d4b4;border-radius:16px;padding:14px 18px;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);font-size:1.15rem;font-weight:800;color:#333;line-height:1.4;">We're almost there! 🚀</div>`
    popup.appendChild(content)

    const tapHint = document.createElement('div')
    tapHint.id = 'sparc_tap_hint'
    tapHint.style.cssText = 'position:relative;width:100%;text-align:center;color:#ff7700;font-size:0.85rem;font-weight:800;letter-spacing:5px;text-transform:uppercase;animation:textPulse 1.5s infinite ease-in-out;text-shadow:0 4px 10px rgba(0,0,0,0.8);pointer-events:none;opacity:0;transition:opacity 0.4s ease;'
    tapHint.textContent = 'TAP OR PRESS ANY KEY'

    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:20px;'
    wrapper.appendChild(popup)
    wrapper.appendChild(tapHint)
    overlay.appendChild(wrapper)
    document.body.appendChild(overlay)

    requestAnimationFrame(() => { requestAnimationFrame(() => { overlay.style.opacity = '1'; }); });

    function onContinue() {
        document.removeEventListener('keydown', onContinue);
        overlay.removeEventListener('click', onContinue);
        playSfx(chooseVoiceBuffer, 1.0);
        transitionToState('CHARACTER_SELECT');
    }

    const safeDuration = (gpsVoiceBuffer && isFinite(gpsVoiceBuffer.duration)) ? (gpsVoiceBuffer.duration * 1000) : 2500;
    const lockDelay = 700 + safeDuration; // 700ms for Iris Open + Audio Length

    setTimeout(() => {
        tapHint.style.opacity = '1';
        document.addEventListener('keydown', onContinue, { once: true });
        overlay.addEventListener('click', onContinue, { once: true });
    }, lockDelay);
}

function showCharacterSelectUI(container) {
    const gradient = document.createElement('div')
    gradient.className = 'bottom_gradient'
    container.appendChild(gradient)

    const portraitOrder = [ { id: 'timmy', label: 'TIMMY' }, { id: 'adam', label: 'ADAM' }, { id: 'ami', label: 'AMI' }, { id: 'bryce', label: 'BRYCE' }, { id: 'jackie', label: 'JACKIE' }, { id: 'michelle', label: 'MICHELLE' } ]
    const len = portraitOrder.length
    let currentIdx = 0
    selectedPortraitId = portraitOrder[0].id
    loadPreviewModel(selectedPortraitId)

    // ── Centralized start sequence ───────────────────────────────────────────
    function startGameSequence() {
        if (isStartingEngine) return; isStartingEngine = true;
        if (titleAudio && titleAudio.isPlaying) { titleAudio.stop() }
        if (startAudioBuffer && audioListener.context.state === 'running') {
            const a = new THREE.Audio(audioListener)
            a.setBuffer(startAudioBuffer)
            a.setVolume(0.4)
            a.play()
        }
        const pilotObj = pilots.find(p => p.id === (selectedPortraitId || pilots[0].id))
        localStorage.setItem('selectedPilot', pilotObj ? pilotObj.name : pilots[0].name)
        if (singleBirdModel && singleBirdModel.userData.mixer && singleBirdModel.userData.clips) {
            const targetClip = singleBirdModel.userData.clips[2] || singleBirdModel.userData.clips[1] || singleBirdModel.userData.clips[0]
            singleBirdModel.userData.mixer.stopAllAction()
            singleBirdModel.userData.mixer.clipAction(targetClip).reset().play()
            playSfx(cawBuffer, 1.0); playSfx(flapBuffer, 1.0);
        }
        setTimeout(() => { triggerIrisClose() }, 1200)
    }

    function promptStartModal() {
        if (document.getElementById('sparc_start_modal')) return
        const modal = document.createElement('div')
        modal.id = 'sparc_start_modal'
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;'
        modal.innerHTML = `<div style="background:#fdf9f1;border:4px solid #d4b878;border-radius:16px;padding:30px 40px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.8);"><h2 style="font-family:'Fredoka',sans-serif;color:#333;margin:0 0 20px 0;font-size:1.5rem;">Select ${portraitOrder[currentIdx].label} as your character and start the car?</h2><div style="display:flex;gap:20px;justify-content:center;"><button id="sparc_modal_yes" style="background:#2e7d32;color:#fff;border:none;padding:10px 30px;font-family:'Fredoka',sans-serif;font-size:1.2rem;font-weight:700;border-radius:8px;cursor:pointer;">YES</button><button id="sparc_modal_no" style="background:#d32f2f;color:#fff;border:none;padding:10px 30px;font-family:'Fredoka',sans-serif;font-size:1.2rem;font-weight:700;border-radius:8px;cursor:pointer;">NO</button></div></div>`
        document.body.appendChild(modal)
        document.getElementById('sparc_modal_yes').onclick = () => { playSfx(tickBuffer, 0.45); document.body.removeChild(modal); startGameSequence(); }
        document.getElementById('sparc_modal_no').onclick = () => { playSfx(tickBuffer, 0.45); document.body.removeChild(modal); }
    }

    // ── Master positioned container (driven by GUI settings) ────────────────
    const masterWrap = document.createElement('div')
    masterWrap.id = 'sparc_carousel_master'
    masterWrap.style.cssText = `position:absolute;left:50%;bottom:${settings.uiOffsetY}px;transform:translateX(calc(-50% + ${settings.uiOffsetX}px)) scale(${settings.uiScale});display:flex;flex-direction:column;align-items:center;gap:20px;z-index:100;transition:opacity 0.5s ease;opacity:0;`
    container.appendChild(masterWrap)

    // ── Carousel shell ───────────────────────────────────────────────────────
    const carouselWrap = document.createElement('div')
    carouselWrap.id = 'sparc_carousel_wrap'
    carouselWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;'

    // Left arrow
    const arrowL = document.createElement('button')
    arrowL.style.cssText = 'background:none;border:none;cursor:pointer;color:#fff;font-size:1.8rem;padding:0 8px;align-self:center;opacity:0.7;transition:opacity 0.15s;flex-shrink:0;z-index:10;position:relative;'
    arrowL.innerHTML = '&#9664;'
    arrowL.addEventListener('mouseenter', () => { arrowL.style.opacity = '1' })
    arrowL.addEventListener('mouseleave', () => { arrowL.style.opacity = '0.7' })

    // Right arrow
    const arrowR = document.createElement('button')
    arrowR.style.cssText = 'background:none;border:none;cursor:pointer;color:#fff;font-size:1.8rem;padding:0 8px;align-self:center;opacity:0.7;transition:opacity 0.15s;flex-shrink:0;z-index:10;position:relative;'
    arrowR.innerHTML = '&#9654;'
    arrowR.addEventListener('mouseenter', () => { arrowR.style.opacity = '1' })
    arrowR.addEventListener('mouseleave', () => { arrowR.style.opacity = '0.7' })

    // Slot stage — fixed size, cards are absolute children
    const slotWrap = document.createElement('div')
    slotWrap.style.cssText = 'position:relative;width:500px;height:160px;flex-shrink:0;overflow:visible;clip-path:inset(-40px 0px -40px 0px);'

    // Build all 6 cards once — never cloned, only mutated by renderCarousel
    const cards = portraitOrder.map(p => {
        const card = document.createElement('div')
        card.id = `portrait_card_${p.id}`
        card.style.cssText = [
            'position:absolute', 'left:50%', 'bottom:0',
            'display:flex', 'flex-direction:column', 'align-items:center',
            'cursor:pointer',
            'transform-origin:bottom center',
            'will-change:transform,opacity'
        ].join(';')

        const img = document.createElement('img')
        img.id = `portrait_img_${p.id}`
        img.src = portraitUrls[p.id]
        img.alt = p.label
        img.style.cssText = 'width:90px;height:120px;object-fit:cover;object-position:top;border-radius:6px 6px 0 0;border:2px solid rgba(0,0,0,0.4);display:block;'

        const nameTag = document.createElement('div')
        nameTag.id = `portrait_tag_${p.id}`
        nameTag.style.cssText = [
            'width:90px', 'text-align:center',
            "font-family:'Courier New',Courier,monospace",
            'font-size:0.6rem', 'font-weight:bold', 'letter-spacing:3px', 'color:#ffffff',
            'background:rgba(0,0,0,0.7)', 'padding:5px 0',
            'border:2px solid rgba(0,0,0,0.4)',
            'border-top:none', 'border-radius:0 0 6px 6px', 'text-transform:uppercase'
        ].join(';')
        nameTag.innerText = p.label

        card.appendChild(img)
        card.appendChild(nameTag)
        slotWrap.appendChild(card)
        return card
    })

    // Select button (appended to masterWrap below carousel)
    const selectBtn = document.createElement('button')
    selectBtn.style.cssText = "background:#2e7d32;border:2px solid #4caf50;color:#fff;padding:10px 30px;border-radius:8px;font-family:'Fredoka',sans-serif;font-size:1.1rem;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:2px;box-shadow:0 4px 12px rgba(0,0,0,0.5);transition:all 0.2s ease;"
    selectBtn.onmouseover = () => { selectBtn.style.background = '#388e3c' }
    selectBtn.onmouseout = () => { selectBtn.style.background = '#2e7d32' }
    selectBtn.onclick = () => { playSfx(tickBuffer, 0.45); promptStartModal(); }

    // Render carousel: mutate existing cards in place for smooth CSS transitions
    function renderCarousel() {
        selectBtn.innerText = 'SELECT'
        const oldIdx = masterWrap.dataset.cIdx !== undefined ? parseInt(masterWrap.dataset.cIdx) : currentIdx
        let dir = 0
        if (currentIdx !== oldIdx) {
            dir = (currentIdx - oldIdx === 1 || currentIdx - oldIdx < -1) ? 1 : -1
        }
        masterWrap.dataset.cIdx = currentIdx

        cards.forEach((card, i) => {
            const img = card.querySelector('img')
            const tag = card.querySelector('div')

            let rawOffset = i - currentIdx
            while (rawOffset > 3) rawOffset -= 6
            while (rawOffset < -2) rawOffset += 6

            let offset = rawOffset
            if (Math.abs(offset) === 3) offset = dir > 0 ? 3 : -3

            const prevOffset = card.dataset.offset !== undefined ? parseInt(card.dataset.offset) : offset
            const jumped = Math.abs(prevOffset - offset) > 1

            let targetX = 0
            let scale = 0.85
            if (offset === 0) { targetX = 0; scale = 1.05 }
            else if (offset === 1) { targetX = 100; scale = 0.95 }
            else if (offset === -1) { targetX = -100; scale = 0.95 }
            else if (offset === 2) { targetX = 190; scale = 0.85 }
            else if (offset === -2) { targetX = -190; scale = 0.85 }
            else if (offset === 3) { targetX = 280; scale = 0.85 }
            else if (offset === -3) { targetX = -280; scale = 0.85 }

            if (jumped) {
                card.style.transition = 'none'
                const startX = offset > 0 ? 280 : -280
                card.style.transform = `translateX(calc(-50% + ${startX}px)) translateY(0px) scale(0.85)`
                void card.offsetHeight // FORCE REFLOW — makes the teleport invisible before re-enabling transition
            }

            card.style.transition = 'transform 0.4s cubic-bezier(0.25,0.8,0.25,1), opacity 0.4s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.4s ease'
            card.dataset.offset = String(offset)
            card.style.transform = `translateX(calc(-50% + ${targetX}px)) translateY(${offset === 0 ? '-12px' : '0px'}) scale(${scale})`

            if (offset === 0) {
                card.style.opacity = '1'; card.style.zIndex = '5'; card.style.pointerEvents = 'none'
                card.style.webkitMaskImage = 'none'; card.style.maskImage = 'none'
                if (img) { img.style.boxShadow = '0 0 0 2px #fff, 0 4px 14px rgba(255,255,255,0.25)'; img.style.borderColor = '#fff' }
                if (tag) tag.style.borderColor = '#fff'
            } else if (Math.abs(offset) === 1) {
                card.style.opacity = '1'; card.style.zIndex = '4'; card.style.pointerEvents = 'auto'
                card.style.webkitMaskImage = 'none'; card.style.maskImage = 'none'
                if (img) { img.style.boxShadow = 'none'; img.style.borderColor = 'rgba(0,0,0,0.4)' }
                if (tag) tag.style.borderColor = 'rgba(0,0,0,0.4)'
            } else if (Math.abs(offset) === 2) {
                card.style.opacity = '0.6'; card.style.zIndex = '3'; card.style.pointerEvents = 'none'
                const mask = offset < 0 ? 'linear-gradient(to right, transparent 0%, black 100%)' : 'linear-gradient(to left, transparent 0%, black 100%)'
                card.style.webkitMaskImage = mask; card.style.maskImage = mask
                if (img) { img.style.boxShadow = 'none'; img.style.borderColor = 'rgba(0,0,0,0.4)' }
                if (tag) tag.style.borderColor = 'rgba(0,0,0,0.4)'
            } else {
                card.style.opacity = '0'; card.style.zIndex = '-1'; card.style.pointerEvents = 'none'
                if (img) { img.style.boxShadow = 'none'; img.style.borderColor = 'rgba(0,0,0,0.4)' }
                if (tag) tag.style.borderColor = 'rgba(0,0,0,0.4)'
            }
        })
        // Re-wire click handlers
        cards.forEach((card, i) => {
            card.onclick = () => {
                let rawOffset = i - currentIdx
                while (rawOffset > 3) rawOffset -= 6
                while (rawOffset < -2) rawOffset += 6
                if (rawOffset === 0) return
                playSfx(tickBuffer, 0.45);
                currentIdx = (currentIdx + rawOffset + len) % len
                selectedPortraitId = portraitOrder[currentIdx].id
                loadPreviewModel(selectedPortraitId)
                renderCarousel()
            }
        })
    }

    arrowL.addEventListener('click', () => {
        playSfx(tickBuffer, 0.45);
        currentIdx = (currentIdx - 1 + len) % len
        selectedPortraitId = portraitOrder[currentIdx].id
        loadPreviewModel(selectedPortraitId)
        renderCarousel()
    })
    arrowR.addEventListener('click', () => {
        playSfx(tickBuffer, 0.45);
        currentIdx = (currentIdx + 1) % len
        selectedPortraitId = portraitOrder[currentIdx].id
        loadPreviewModel(selectedPortraitId)
        renderCarousel()
    })

    renderCarousel()

    carouselWrap.appendChild(arrowL)
    carouselWrap.appendChild(slotWrap)
    carouselWrap.appendChild(arrowR)
    masterWrap.appendChild(carouselWrap)
    masterWrap.appendChild(selectBtn)

    // ── Key fob — fully decoupled, absolute bottom-left ──────────────────────
    const fobWrap = document.createElement('div')
    fobWrap.id = 'sparc_fob_wrap'
    fobWrap.style.cssText = 'position:absolute;left:40px;bottom:40px;z-index:100;cursor:pointer;width:72px;display:flex;align-items:center;flex-direction:column;'

    const fobBtn = document.createElement('button')
    fobBtn.id = 'sparc_keyfob_btn'
    fobBtn.style.cssText = [
        'width:62px', 'height:110px',
        'background:#1a1a1a',
        'border:1px solid #222', 'border-radius:16px',
        'cursor:pointer', 'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center', 'gap:7px',
        'transition:all 0.2s ease',
        'box-shadow:0 2px 8px rgba(0,0,0,0.9)',
        'position:relative', 'z-index:1'
    ].join(';')
    fobBtn.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;width:100%;padding:8px 0;align-items:center;"><div style="width:26px;height:26px;border-radius:50%;background:#181818;border:1px solid #333;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 2px 4px rgba(0,0,0,0.8);"><svg width="12" height="12" viewBox="0 0 24 24" fill="#888"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg></div><div style="width:26px;height:26px;border-radius:50%;background:#181818;border:1px solid #333;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 2px 4px rgba(0,0,0,0.8);"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ccc"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg></div><div id="fob_panic_btn" style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#b00,#500);border:1px solid #ff3300;display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-5h2v2h-2zm0-8h2v6h-2z"/></svg></div></div>`
    fobBtn.addEventListener('mouseenter', () => {
        fobBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.8)'
        fobBtn.style.borderColor = '#333'
    })
    fobBtn.addEventListener('mouseleave', () => {
        fobBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.9)'
        fobBtn.style.borderColor = '#222'
    })

    const blade = document.createElement('div')
    blade.id = 'sparc_blade'
    blade.style.cssText = [
        'opacity:0',
        'position:absolute',
        'left:50%',
        'margin-left:-7px',
        'bottom:100%',
        'width:14px', 'height:80px',
        'background:linear-gradient(180deg,#e8e8e8,#909090)',
        'clip-path:polygon(50% 0%, 100% 15%, 100% 25%, 60% 30%, 100% 35%, 60% 40%, 100% 45%, 60% 50%, 100% 55%, 100% 100%, 0% 100%, 0% 15%)',
        'transform-origin:bottom center',
        'transform:rotate(180deg)',
        'z-index:-1',
        'transition:transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.1s ease'
    ].join(';')

    fobWrap.appendChild(fobBtn)
    fobWrap.appendChild(blade)

    fobWrap.addEventListener('mouseenter', () => {
        blade.style.opacity = '1'
        blade.style.transform = 'rotate(0deg)'
    })
    fobWrap.addEventListener('mouseleave', () => {
        blade.style.opacity = '0'
        blade.style.transform = 'rotate(180deg)'
    })
    fobWrap.addEventListener('click', (e) => { if (e.target.closest('#fob_panic_btn')) { promptStartModal(); } else { playSfx(deadboltBuffer, 0.25); } });
    container.appendChild(fobWrap)

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            masterWrap.style.opacity = '1'
        })
    })
}

function triggerIrisClose() {
    const iris = document.createElement('div');
    iris.id = 'sparc_iris_close';
    iris.style.cssText = [
        'position:fixed', 'top:50%', 'left:50%',
        'transform:translate(-50%,-50%)', 'width:250vmax', 'height:250vmax',
        'border-radius:50%', 'box-shadow:0 0 0 300vmax #000',
        'z-index:999999', 'transition:width 0.85s cubic-bezier(0.85, 0, 0.15, 1), height 0.85s cubic-bezier(0.85, 0, 0.15, 1)',
        'pointer-events:all'
    ].join(';');
    document.body.appendChild(iris);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            iris.style.width = '0px';
            iris.style.height = '0px';
        });
    });

    let p1Done = false;
    const p1Complete = () => {
        if (p1Done) return;
        p1Done = true;
        
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 300);
    };

    iris.addEventListener('transitionend', p1Complete, { once: true });
    setTimeout(p1Complete, 1000);
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

    previewContainer = container
    loadStartTime = performance.now()

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

    audioLoader.load(carStartUrl, (buffer) => { startAudioBuffer = buffer })

    ambientAudio = new THREE.Audio(audioListener)
    audioLoader.load(ambientSoundUrl, (buffer) => {
        ambientAudio.setBuffer(buffer)
        ambientAudio.setLoop(true)
        ambientAudio.setVolume(0.65)
    })

    titleAudio = new THREE.Audio(audioListener)
    audioLoader.load(titleMusicUrl, (buffer) => {
        titleAudio.setBuffer(buffer)
        titleAudio.setLoop(true)
        titleAudio.setVolume(0.03)
    })
    audioLoader.load(gpsVoiceUrl, b => gpsVoiceBuffer = b);
    audioLoader.load(tickUrl, b => tickBuffer = b);
    audioLoader.load(deadboltUrl, b => deadboltBuffer = b);
    audioLoader.load(cawUrl, b => cawBuffer = b);
    audioLoader.load(flapUrl, b => flapBuffer = b);
    audioLoader.load(chooseVoiceUrl, b => chooseVoiceBuffer = b);

    document.body.addEventListener('mousedown', () => { 
        if (audioListener.context.state === 'suspended') { 
            audioListener.context.resume(); 
        } 
    }, { once: true });

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

    const uiFolder = gui.addFolder('UI Transform')
    uiFolder.add(settings, 'uiOffsetX', -500, 500, 1).name('X Offset').onChange(v => { const w = document.getElementById('sparc_carousel_master'); if (w) w.style.transform = `translateX(calc(-50% + ${v}px)) scale(${settings.uiScale})` })
    uiFolder.add(settings, 'uiOffsetY', -200, 500, 1).name('Y Offset').onChange(v => { const w = document.getElementById('sparc_carousel_master'); if (w) w.style.bottom = v + 'px' })
    uiFolder.add(settings, 'uiScale', 0.5, 2.0, 0.01).name('Scale').onChange(v => { const w = document.getElementById('sparc_carousel_master'); if (w) w.style.transform = `translateX(calc(-50% + ${settings.uiOffsetX}px)) scale(${v})` })

    const rocketFolder = gui.addFolder('Rocket Tuning')
    rocketFolder.add(settings, 'rocketX', N(500), 500, 0.1).name('Pos X').onChange(v => { if (rocketModel) rocketModel.position.x = v })
    rocketFolder.add(settings, 'rocketY', N(100), 500, 0.1).name('Pos Y').onChange(v => { if (rocketModel) rocketModel.position.y = v })
    rocketFolder.add(settings, 'rocketZ', N(500), 500, 0.1).name('Pos Z').onChange(v => { if (rocketModel) rocketModel.position.z = v })
    rocketFolder.add(settings, 'rocketRotX', N(Math.PI), Math.PI, 0.01).name('Rot X').onChange(v => { if (rocketModel) rocketModel.rotation.x = v })
    rocketFolder.add(settings, 'rocketRotY', N(Math.PI), Math.PI, 0.01).name('Rot Y').onChange(v => { if (rocketModel) rocketModel.rotation.y = v })
    rocketFolder.add(settings, 'rocketRotZ', N(Math.PI), Math.PI, 0.01).name('Rot Z').onChange(v => { if (rocketModel) rocketModel.rotation.z = v })
    rocketFolder.add(settings, 'rocketScale', 0.01, 100, 0.01).name('Scale').onChange(v => { if (rocketModel) rocketModel.scale.set(v, v, v) })

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
            singleBirdModel.userData.mixer = mixer
            singleBirdModel.userData.clips = gltf.animations
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

    gltfLoader.load(rocketUrl, (gltf) => {
        rocketModel = gltf.scene
        rocketModel.position.set(settings.rocketX, settings.rocketY, settings.rocketZ)
        rocketModel.rotation.set(settings.rocketRotX, settings.rocketRotY, settings.rocketRotZ)
        rocketModel.scale.set(settings.rocketScale, settings.rocketScale, settings.rocketScale)
        rocketModel.traverse(child => {
            if (child.isMesh) {
                child.receiveShadow = true
                child.castShadow = true
            }
        })
        scene.add(rocketModel)
    })

    setupDustVFX()
    preloadAllCharacters()

    let isDragging = false
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (singleBirdModel) { const rect = container.getBoundingClientRect(); const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(mouse, camera); if (rc.intersectObject(singleBirdModel, true).length > 0) { const now = performance.now(); if (now - lastBirdClick > 1000) { playSfx(cawBuffer, 1.0); lastBirdClick = now; } } }
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

    const elapsed = performance.now() - loadStartTime
    let targetPct = (elapsed / 6000) * 100
    if (!isEngineLoaded && targetPct > 99) targetPct = 99
    visualProgress = Math.min(targetPct, 100)
    if (visualProgress >= 100 && isEngineLoaded && !hasTriggeredFade) {
        hasTriggeredFade = true;
        const pctEl = document.getElementById('loading_pct');
        if (pctEl) pctEl.textContent = '100%';
        
        const loadingText = document.getElementById('loading_text');
        if (loadingText) {
            loadingText.innerHTML = '<span style="font-size:2.2rem;color:#ff7700;animation:textPulse 1s infinite;cursor:pointer;text-shadow:0 0 15px rgba(255,119,0,0.8);pointer-events:auto;">CLICK TO START</span>';
        }

        const unlockEngine = () => {
            document.removeEventListener('mousedown', unlockEngine);
            document.removeEventListener('keydown', unlockEngine);
            if (audioListener.context.state === 'suspended') audioListener.context.resume();
            if (titleAudio && !titleAudio.isPlaying) titleAudio.play();

            const iris = document.createElement('div');
            iris.id = 'sparc_intro_iris';
            iris.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:250vmax;height:250vmax;border-radius:50%;box-shadow:0 0 0 300vmax #000;z-index:999999;transition:width 0.6s cubic-bezier(0.85, 0, 0.15, 1), height 0.6s cubic-bezier(0.85, 0, 0.15, 1);pointer-events:all;';
            document.body.appendChild(iris);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    iris.style.width = '0px';
                    iris.style.height = '0px';
                });
            });

            let p1Done = false;
            const p1Complete = () => {
                if (p1Done) return;
                p1Done = true;

                const loadingScreen = document.getElementById('sparc_master_loading_screen');
                if (loadingScreen) loadingScreen.remove();

                // 300ms cinematic blackout hold before spawning UI and opening Iris
                setTimeout(() => {
                    transitionToState('BRIEFING');
                    
                    void iris.offsetWidth; // Force reflow
                    iris.style.transition = 'width 0.6s cubic-bezier(0.85, 0, 0.15, 1), height 0.6s cubic-bezier(0.85, 0, 0.15, 1)';
                    iris.style.width = '250vmax';
                    iris.style.height = '250vmax';

                    let p2Done = false;
                    const p2Complete = () => {
                        if (p2Done) return;
                        p2Done = true;
                        playSfx(gpsVoiceBuffer, 1.0);
                        iris.remove();
                    };
                    iris.addEventListener('transitionend', p2Complete, { once: true });
                    setTimeout(p2Complete, 700);
                }, 300);
            };

            iris.addEventListener('transitionend', p1Complete, { once: true });
            setTimeout(p1Complete, 700);
        };

        document.addEventListener('mousedown', unlockEngine);
        document.addEventListener('keydown', unlockEngine);
    }

    const pctEl = document.getElementById('loading_pct')

    if (pctEl && visualProgress <= 100) {
        pctEl.textContent = Math.floor(visualProgress) + '%'
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
            if (c.audio1 && c.audio1.isPlaying) c.audio1.stop();
            if (c.audio2 && c.audio2.isPlaying) c.audio2.stop();
            scene.remove(c.mesh);
            if (c.trail) {
                scene.remove(c.trail);
                const t = c.trail;
                requestIdleCallback(() => {
                    t.geometry.dispose();
                    t.material.dispose();
                });
            }
            activeCars.splice(i, 1);
            i += N(1);
            continue;
        }

        let currentVol = 0.20; if (c.progress > 0.8) { currentVol = 0.20 * Math.max(0, (1.0 + N(c.progress)) / 0.2); } const finalVol = gameplayAudioUnlocked ? currentVol : 0; if (c.audio1) c.audio1.setVolume(finalVol); if (c.audio2) c.audio2.setVolume(finalVol);

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

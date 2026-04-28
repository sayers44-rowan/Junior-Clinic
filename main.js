import * as THREE from 'three';
import { GameStateManager } from './src/GameStateManager.js';

class SparcGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        this.init();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // High-DPI support (capped at 2 for performance)
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Smoother shadows
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic lighting
        this.renderer.toneMappingExposure = 0.9;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct colors

        document.getElementById('app').appendChild(this.renderer.domElement);
        this.gameManager = new GameStateManager(this.scene, this.camera, this.renderer);
        this.gameManager.start();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        if (this.gameManager) this.gameManager.update(delta);
        this.renderer.render(this.scene, this.camera);
    }
}
new SparcGame();

// PART INTEGRATION PLACEHOLDERS
window.startPart2 = () => { console.log("Part 2 Placeholder: Launching Vehicle Bay..."); };
window.startPart3 = () => { console.log("Part 3 Placeholder: Initiating Planet Descent..."); };


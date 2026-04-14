import * as THREE from 'three';
import { GameStateManager } from './src/GameStateManager.js';

class SparcGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        this.init();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // GameStage reads selectedPilot from localStorage internally — no path needed here
        this.gameManager = new GameStateManager(this.scene, this.camera, this.renderer);
        this.gameManager.start();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        try {
            const delta = this.clock.getDelta();
            if (this.gameManager) this.gameManager.update(delta);
            this.renderer.render(this.scene, this.camera);
        } catch (e) {
            console.error(e);
        }
    }
}
new SparcGame();

// PART INTEGRATION PLACEHOLDERS
window.startPart2 = () => { console.log("Part 2 Placeholder: Launching Vehicle Bay..."); };
window.startPart3 = () => { console.log("Part 3 Placeholder: Initiating Planet Descent..."); };
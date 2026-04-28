import * as THREE from 'three';
import { GameStage, globalManager } from './GameStage.js';

export class GameStateManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentStage = null;
        this.started = false;

        // PRELOADER: Hook into the global loading manager from GameStage
        globalManager.onLoad = () => {
            console.log('ALL ASSETS LOADED');
            if (this.currentStage && this.currentStage.onAssetsLoaded) {
                this.currentStage.onAssetsLoaded();
            }
        };

        // Instantiate GameStage — it reads selectedPilot from localStorage internally
        this.currentStage = new GameStage(scene, camera, renderer);
    }

    start() {
        // COMPLETE UIManager PURGE
        this.ui = null;
        this._launchGame('CADET', 'Alpha', 'Default');
        console.log('PHASE 0 BYPASSED - UIMANAGER PURGED');
    }

    _launchGame(playerName, selectedChar, selectedModel) {
        console.log(`LAUNCHING: ${playerName} as ${selectedChar} (${selectedModel})`);
        this.started = true;
        this.currentStage.playerName = playerName;

        const callsign = document.getElementById('hub-callsign');
        if (callsign) callsign.textContent = playerName.toUpperCase();
    }

    update(delta) {
        if (this.started && this.currentStage) {
            this.currentStage.update(delta);
        }
    }
}
import * as THREE from 'three';
import { StationStage, globalManager } from './StationStage.js';
import { UIManager } from './UIManager.js';

export class GameStateManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentStage = null;
        this.started = false;

        // PRELOADER: Hook into the global loading manager from StationStage
        globalManager.onLoad = () => {
            console.log('ALL ASSETS LOADED (PX POLISH)');
            if (this.ui) this.ui.enableStartButton();
        };

        // Instantiate StationStage early so it begins loading immediately
        this.currentStage = new StationStage(scene, camera, renderer, 'CADET', null);
    }

    _preloadPilot() {
        const loader = new FBXLoader();
        loader.load('/assets/models/pilot_timmy.fbx', (fbx) => {
            this._preloadedFbx = fbx;
            console.log('PILOT PRELOADED');
        }, undefined, (err) => {
            console.warn('Preload failed (will retry on launch):', err);
        });
    }

    start() {
        this.ui = new UIManager((playerName, selectedChar, selectedModel) => {
            this._launchGame(playerName, selectedChar, selectedModel);
        });
        this.ui.showMainMenu();
        console.log('PHASE 0 INITIALIZED');
    }

    _launchGame(playerName, selectedChar, selectedModel) {
        console.log(`LAUNCHING: ${playerName} as ${selectedChar} (${selectedModel})`);
        this.started = true;
        this.currentStage.playerName = playerName;
        this.currentStage._uiManager = this.ui;
        // Load the chosen model (Clean Swap handles disposal if already loaded)
        this.currentStage.loadPilot(selectedModel || '/assets/models/pilot_timmy.fbx');
        const callsign = document.getElementById('hub-callsign');
        if (callsign) callsign.textContent = playerName.toUpperCase();
    }

    update(delta) {
        if (this.started && this.currentStage) {
            this.currentStage.update(delta);
        }
    }
}

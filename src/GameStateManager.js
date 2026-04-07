import * as THREE from 'three';
import { StationStage, globalManager } from './StationStage.js';

export class GameStateManager {
    constructor(scene, camera, renderer, pilotPath = null) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.pilotPath = pilotPath;
        this.currentStage = null;
        this.started = false;

        // PRELOADER: Hook into the global loading manager from StationStage
        globalManager.onLoad = () => {
            console.log('ALL ASSETS LOADED (PX POLISH)');
            if (this.ui) this.ui.enableStartButton();
        };

        // Instantiate StationStage early so it begins loading immediately
        this.currentStage = new StationStage(scene, camera, renderer, 'CADET', this.pilotPath);
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
        // COMPLETE UIManager PURGE
        this.ui = null;
        this._launchGame('CADET', 'Alpha', 'Default');
        console.log('PHASE 0 BYPASSED - UIMANAGER PURGED');
    }

    _launchGame(playerName, selectedChar, selectedModel) {
        console.log(`LAUNCHING: ${playerName} as ${selectedChar} (${selectedModel})`);
        this.started = true;
        this.currentStage.playerName = playerName;
        this.currentStage._uiManager = this.ui;
        // Load the chosen model (Clean Swap handles disposal if already loaded)
        this.currentStage.loadPilot(this.pilotPath || '/assets/models/pilot_timmy.fbx');
        const callsign = document.getElementById('hub-callsign');
        if (callsign) callsign.textContent = playerName.toUpperCase();
    }

    update(delta) {
        if (this.started && this.currentStage) {
            this.currentStage.update(delta);
        }
    }
}
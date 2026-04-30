import * as THREE from 'three';
import { GameStage, globalManager } from './GameStage.js';

export const STATE_DRIVING = 'STATE_DRIVING';
export const STATE_ARRIVING = 'STATE_ARRIVING';
export const STATE_EXPLORING = 'STATE_EXPLORING';

export class GameStateManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentStage = null;
        this.started = false;
        this.currentState = STATE_DRIVING;

        // PRELOADER: Hook into the global loading manager from GameStage
        globalManager.onLoad = () => {
            console.log('ALL ASSETS LOADED');
            if (this.currentStage && this.currentStage.onAssetsLoaded) {
                this.currentStage.onAssetsLoaded();
            }
        };

        // Instantiate GameStage — it reads selectedPilot from localStorage internally
        this.currentStage = new GameStage(scene, camera, renderer, this);
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

    setState(newState) {
        this.currentState = newState;
        if (this.currentStage && this.currentStage.onStateChange) {
            this.currentStage.onStateChange(newState);
        }
    }

    update(delta) {
        if (this.started && this.currentStage) {
            this.currentStage.update(delta, this.currentState);
        }
    }
}
import { StationStage } from './StationStage.js';
import { ExteriorStage } from './ExteriorStage.js';
import { LaunchCenterStage } from './LaunchCenterStage.js';
import { RocketInteriorStage } from './RocketInteriorStage.js';

export class GameStateManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentStage = null;
    }

    start() {
        this.transitionTo('STATION');
    }

    transitionTo(stageName, params = {}) {
        // Cleanup current stage
        if (this.currentStage && this.currentStage.cleanup) {
            this.currentStage.cleanup();
        }

        // Switch stages
        if (stageName === 'STATION') {
            this.currentStage = new StationStage(this.scene, this.camera, this.renderer, this);
        } else if (stageName === 'EXTERIOR') {
            this.currentStage = new ExteriorStage(this.scene, this.camera, this.renderer, this);
        } else if (stageName === 'LAUNCH_CENTER') {
            this.currentStage = new LaunchCenterStage(this.scene, this.camera, this.renderer, this);
        } else if (stageName === 'ROCKET_INTERIOR') {
            this.currentStage = new RocketInteriorStage(this.scene, this.camera, this.renderer, this);
        }

        if (this.currentStage) {
            this.currentStage.init(params);
        }
    }

    update(delta) {
        if (this.currentStage) {
            this.currentStage.update(delta);
        }
    }
}

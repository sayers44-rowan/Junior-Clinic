import { StationStage } from './StationStage.js';

export class GameStateManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentStage = null;
    }

    start() {
        this.currentStage = new StationStage(this.scene, this.camera, this.renderer);
        this.currentStage.init();
    }

    update(delta) {
        if (this.currentStage) {
            this.currentStage.update(delta);
        }
    }
}

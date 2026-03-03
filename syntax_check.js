// Extract just the script content to check syntax
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let animations = {};
let currentAction;
let activeModel;
let animationMixer;
let zoneACube;

function updateInteractionPrompt() {
    const distB = 5;
    if (distB < 3.5) {
        const x = 100;
        const y = 100;

        if (x < 1) {
            console.log('block');
        } else {
            console.log('none');
        }
    } else {
        console.log('none2');
    }
}

console.log('Syntax OK');

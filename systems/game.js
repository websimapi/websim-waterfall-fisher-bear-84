import * as THREE from 'three';
import { scene } from '../scene.js';
import { createBear, updateBear, BEAR_Z_MIN, BEAR_Z_MAX } from '../entities/bear.js';
import { updateFish } from '../entities/fish.js';
import { initAudio, wireAudioUnlock } from './audio.js';
import { bindUI, updateUIValues, showHUD } from './ui.js';
import { getPlayerProgress } from '../unlocks.js';
import { updateSpawner, resetSpawner } from './fishSpawner.js';
import * as TWEEN from 'tween';
import { renderer, camera } from '../scene.js';
import { setupStartScreen, startGameWithTurnaround, gameOver } from './gameFlow.js';
import { handleFishInteractions } from './gameplay.js';
import { showcaseFish } from './showcase.js';

// --- GAME OBJECTS ---
export let bear = null;
export let activeFishes = [];

// --- UI & STATE ---
const { startButton } = bindUI();
let playerProgress = getPlayerProgress();
export let gameState = { current: 'IDLE', score: 0, streak: 1, idleAnimTimer: 0 };
const gravity = new THREE.Vector3(0, -0.05, 0);
let isFirstLoad = true;
/* gentle forward drift strength */
const Z_DRIFT_PER_TICK = 0.0008;
/* camera follow config */
const CAM_OFFSET = new THREE.Vector3(0, 12, 9);
const CAM_LERP = 0.08;
/* track previous bear Z for camera/log movement */
let lastBearZ = 0;

export function createGameBear() {
    if (bear) scene.remove(bear);
    bear = createBear(playerProgress.selectedBear);
    scene.add(bear);
    lastBearZ = bear.position.z;

    /* snap camera near follow position on start */
    camera.position.set(0, CAM_OFFSET.y, bear.position.z + CAM_OFFSET.z);
    camera.lookAt(0, 2, bear.position.z);

    bear.position.x = 0;
    updateUIValues({ score: gameState.score, streak: gameState.streak });
    showHUD();
    try { initAudio(); } catch (e) { /* ignore */ }
    
    activeFishes.forEach(f => scene.remove(f));
    activeFishes = [];
    resetSpawner();
}

export function initGame() {
    setupStartScreen(isFirstLoad);
    isFirstLoad = false;
    // start with turnaround sequence before gameplay
    startButton.addEventListener('click', startGameWithTurnaround);
    wireAudioUnlock(() => { initAudio(); import('./audio.js').then(m=>m.startWaterfall?.()); });
}

export function updateGame() {
    if (gameState.current === 'PLAYING') {
        if (!bear) return;
        // Apply gentle forward drift; player must occasionally counter with back swipes
        if (typeof bear.userData.zTarget === 'number') {
            bear.userData.zTarget = Math.min(bear.userData.zTarget + Z_DRIFT_PER_TICK, BEAR_Z_MAX);
        }
        updateBear(bear, 0); // Direction is now handled by controls
        const dz = bear.position.z - lastBearZ; lastBearZ = bear.position.z;
        const log = scene.getObjectByName('log');
        if (log) {
            log.rotation.x += -dz * 0.35; // slower roll
            const targetZ = THREE.MathUtils.clamp(bear.position.z + 0.2, BEAR_Z_MIN + 0.2, BEAR_Z_MAX + 0.2);
            log.position.z = THREE.MathUtils.lerp(log.position.z, targetZ, 0.05); // slower physical drift
        }

        // Smooth camera follow
        const desiredX = 0;
        const desiredY = CAM_OFFSET.y;
        const desiredZ = bear.position.z + CAM_OFFSET.z;
        camera.position.x += (desiredX - camera.position.x) * CAM_LERP;
        camera.position.y += (desiredY - camera.position.y) * CAM_LERP;
        camera.position.z += (desiredZ - camera.position.z) * CAM_LERP;
        camera.lookAt(0, 2, bear.position.z);

        updateSpawner(scene, activeFishes, gameState.score, playerProgress);

        // Handle fish interactions and check for game over
        const shouldGameOver = handleFishInteractions(bear, activeFishes, gameState, updateUIValues);
        if (shouldGameOver) {
            gameOver();
            return;
        }

        // Fail if the bear rolls too far forward or back
        const z = bear.position.z;
        if (z >= BEAR_Z_MAX || z <= BEAR_Z_MIN) {
            gameState.streak = 1;
            updateUIValues({ score: gameState.score, streak: gameState.streak });
            gameOver();
            return;
        }
    } else if (gameState.current === 'GAME_OVER') {
        if (bear && bear.position.y > -10) {
            bear.position.add(gravity);
            bear.rotation.z += 0.05;
        }
    } else { // IDLE
        gameState.idleAnimTimer += 0.05;
        // Update thrown showcase fish physics during start/retry animation
        if (showcaseFish && showcaseFish.userData?.thrown) updateFish(showcaseFish);
        // Update thrown gameplay fish (safety if any remain in array)
        activeFishes.forEach(fish => {
            if (fish && fish.userData?.thrown) updateFish(fish);
        });
    }
}

export function setScoreLive(newScore) {
    gameState.score = Math.max(0, Math.floor(newScore)||0);
    updateUIValues({ score: gameState.score, streak: gameState.streak });
}
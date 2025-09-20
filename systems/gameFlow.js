import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { bear, activeFishes, gameState, createGameBear } from './game.js';
import { BEARS, FISH, getPlayerProgress, savePlayerProgress } from '../unlocks.js';
import { showGameOver, showStart, populateUnlocks, updateUIValues } from './ui.js';
import { playSFX, sounds } from './audio.js';
import { addLocalScore } from './leaderboard.js';
import { startRecording, stopRecording } from './recorder.js';
import { renderer } from '../scene.js';
import { createOrUpdateShowcase, showcaseBear, throwShowcaseFish, walkInShowcaseBear } from './showcase.js';
import * as TWEEN from 'tween';

/* add start guard */
let __startingSequence = false;
/* camera follow config */
const CAM_OFFSET = new THREE.Vector3(0, 12, 9);

export function setupStartScreen(isFirstLoad = false) {
    console.log("[SETUP] Setting up start screen");
    gameState.current = 'IDLE';

    // Hide any active game objects (but not showcase objects)
    scene.children.forEach(child => {
        if ((child.name === 'bear' || child.name === 'fish') && !child.userData?.isShowcase) {
             child.visible = false;
        }
    });

    // Clear fish array, but actual objects are just hidden
    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;

    // Make sure game bear is fully gone
    if (bear) {
        console.log("[SETUP] Removing game bear");
        scene.remove(bear);
    }

    const playerProgress = getPlayerProgress();
    populateUnlocks(playerProgress, (type, id) => {
        if (type === 'bear') playerProgress.selectedBear = id;
        if (type === 'fish') playerProgress.selectedFish = id;
        savePlayerProgress(playerProgress);

        const quickBearName = document.querySelector('#choose-bear span');
        const quickBearImg = document.querySelector('#choose-bear img');
        const quickFishName = document.querySelector('#choose-fish span');
        const quickFishImg = document.querySelector('#choose-fish img');

        const selectedBearInfo = BEARS.find(b => b.id === playerProgress.selectedBear);
        const selectedFishInfo = FISH.find(f => f.id === playerProgress.selectedFish);

        if(quickBearName) quickBearName.textContent = selectedBearInfo.name;
        if(quickBearImg) quickBearImg.src = selectedBearInfo.asset;
        if(quickFishName) quickFishName.textContent = selectedFishInfo.name;
        if(quickFishImg) quickFishImg.src = selectedFishInfo.asset;

        console.log("[SETUP] Recreating showcase after unlock selection");
        createOrUpdateShowcase();
    });

    console.log("[SETUP] Creating main showcase");
    // animate log back first, then waddle bear in
    animateLogReset(() => {
        createOrUpdateShowcase();
        walkInShowcaseBear();
    });
    showStart(isFirstLoad);
    const startButton = document.getElementById('start-button');
    if (startButton) startButton.innerText = 'START';
    console.log("[SETUP] Start screen setup completed");
}

function startGame() {
    gameState.current = 'PLAYING';
    gameState.score = 0;
    gameState.streak = 1;
    TWEEN.removeAll(); // stop showcase tweens when gameplay begins

    // Immediately hide showcase bear to avoid overlapping with gameplay bear
    if (showcaseBear) showcaseBear.visible = false;

    createGameBear();
    try { startRecording(renderer.domElement); } catch {}
}

export function startGameWithTurnaround() {
    if (__startingSequence) return;
    __startingSequence = true;
    const proceed = () => {
        if (showcaseBear && showcaseBear.visible) {
            const baseY = 4.65, dur = 900;
            const easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k);
            const easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
            new TWEEN.Tween(showcaseBear.rotation).to({ y: Math.PI }, dur).easing(easeRot).start();
            const wob = { t: 0 };
            new TWEEN.Tween(wob).to({ t: 1 }, dur).easing(easeWob)
              .onUpdate(()=>{ const phase = wob.t * Math.PI * 4; showcaseBear.rotation.z = Math.sin(phase) * 0.15; showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.10; })
              .onComplete(()=>{ showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; throwShowcaseFish(()=>{ startGame(); __startingSequence = false; }); })
              .start();
        } else { startGame(); __startingSequence = false; }
    };
    proceed();
}

export function gameOver() {
    gameState.current = 'GAME_OVER';
    document.getElementById('final-score').innerText = gameState.score;

    const playerProgress = getPlayerProgress();
    if (gameState.score > playerProgress.highScore) {
        playerProgress.highScore = gameState.score;
    }
    let newUnlock = false;
    BEARS.forEach(b => {
        if (!playerProgress.unlockedBears.includes(b.id) && b.unlockCondition.type === 'score' && playerProgress.highScore >= b.unlockCondition.value) {
            playerProgress.unlockedBears.push(b.id);
            newUnlock = true;
        }
    });
    FISH.forEach(f => {
        if (!playerProgress.unlockedFish.includes(f.id) && f.unlockCondition.type === 'score' && playerProgress.highScore >= f.unlockCondition.value) {
            playerProgress.unlockedFish.push(f.id);
            newUnlock = true;
        }
    });

    savePlayerProgress(playerProgress);

    showGameOver();
    playSFX(sounds.splash);
    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;
    (async () => {
        try {
            await new Promise(r=>setTimeout(r, 1000)); // wait 1s post-fall before stopping recording
            const blob = await stopRecording();
            if (blob && window.websim?.upload) {
                const file = new File([blob], 'replay_' + Date.now() + '.webm', { type: blob.type || 'video/webm' });
                window.__replayUploadPromise = window.websim.upload(file).then((url)=>{ window.__lastReplayUrl = url; return url; });
                const url = await window.__replayUploadPromise;
                addLocalScore(gameState.score, url);
            } else {
                addLocalScore(gameState.score, null);
            }
        } catch (e) { console.warn('Replay upload failed:', e); addLocalScore(gameState.score, null); }
    })();
    // remove auto transition; wait for user choice
    const skipBtn = document.getElementById('skip-submit-btn');
    skipBtn?.addEventListener('click', proceedToStart, { once: true });
    window.addEventListener('leaderboard:closed', proceedToStart, { once: true });
}

function proceedToStart() {
    const goScreen = document.getElementById('game-over-screen');
    if (!goScreen || gameState.current !== 'GAME_OVER') return;
    goScreen.classList.add('fade-out');
    const onFadeOut = () => {
        goScreen.removeEventListener('animationend', onFadeOut);
        setupStartScreen();
        const startButton = document.getElementById('start-button');
        if (startButton) startButton.innerText = 'RETRY';
    };
    goScreen.addEventListener('animationend', onFadeOut);
}

function animateLogReset(done) {
    const log = scene.getObjectByName('log');
    if (!log) { done?.(); return; }
    const camOffsetZ = camera.position.z - log.position.z; // keep current offset to log
    new TWEEN.Tween(log.position).to({ z: 1 }, 900).easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            camera.position.x = 0; camera.position.y = CAM_OFFSET.y;
            camera.position.z = log.position.z + camOffsetZ;
            camera.lookAt(0, 2, log.position.z);
        })
        .start();
    new TWEEN.Tween(log.rotation)
        .to({ x: 0 }, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => { try { done?.(); } catch (e) { console.warn('animateLogReset done() error:', e); } })
        .start();
}
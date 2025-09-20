import * as THREE from 'three';
import { scene } from '../scene.js';
import { createBear, updateBear, getHandAnchor, BEAR_Z_MIN, BEAR_Z_MAX } from '../entities/bear.js';
import { createFish, updateFish } from '../entities/fish.js';
import { initAudio, playSFX, sounds, wireAudioUnlock } from './audio.js';
import { bindUI, updateUIValues, showGameOver, showHUD, showStart, populateUnlocks } from './ui.js';
import { BEARS, FISH, getPlayerProgress, savePlayerProgress } from '../unlocks.js';
import { updateSpawner, resetSpawner } from './fishSpawner.js';
import * as TWEEN from 'tween';
import { addLocalScore } from './leaderboard.js';
import { startRecording, stopRecording } from './recorder.js';
import { renderer } from '../scene.js';
import { camera } from '../scene.js';

// --- GAME OBJECTS ---
export let bear = null;
let showcaseBear = null;
let showcaseFish = null;
let activeFishes = [];

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
/* add start guard */
let __startingSequence = false;
/* track previous bear Z for camera/log movement */
let lastBearZ = 0;

/**
 * [FIX] Technical Note: The 'missing arm' bug on retry was due to improper
 * disposal of THREE.js objects. Simply removing an object from the scene
 * doesn't free up its geometry and material data from GPU memory. This
 * function ensures a deep disposal of an object and all its children.
 * It's called on the old `showcaseBear` before creating a new one to prevent
 * state corruption and rendering glitches.
 */
function disposeObject(obj) {
    if (!obj) return;

    // Dispose of children first
    while (obj.children.length > 0) {
        disposeObject(obj.children[0]);
        obj.remove(obj.children[0]);
    }

    // Dispose of the object itself
    if (obj.isMesh) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        // [FIX] DO NOT dispose materials. They are shared constants across
        // different bear/fish instances. Disposing them globally breaks
        // any future objects that try to use them. Geometries are created
        // uniquely per part, so they are safe to dispose.
        /* if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => material.dispose());
            } else {
                obj.material.dispose();
            }
        } */
    }
}

function createOrUpdateShowcase() {
    console.log("[SHOWCASE] Starting showcase creation/update");
    console.log("[SHOWCASE] Current showcase bear exists:", !!showcaseBear);
    console.log("[SHOWCASE] Selected bear type:", playerProgress.selectedBear);
    console.log("[SHOWCASE] Selected fish type:", playerProgress.selectedFish);

    // [FIX] ALWAYS recreate showcase objects on retry to prevent corruption
    // Instead of trying to reuse potentially corrupted objects, start fresh
    if (showcaseBear) {
        console.log("[SHOWCASE] Removing existing showcase bear");
        // Simple removal without complex disposal that can break hierarchy
        scene.remove(showcaseBear);
        showcaseBear = null;
        showcaseFish = null;
    }

    // Create fresh bear
    console.log("[SHOWCASE] Creating new showcase bear of type:", playerProgress.selectedBear);
    showcaseBear = createBear(playerProgress.selectedBear);
    showcaseBear.name = 'showcase-bear';
    showcaseBear.userData.isShowcase = true;
    showcaseBear.userData.bearType = playerProgress.selectedBear;
    showcaseBear.position.set(0, 4.65, 0.8);
    showcaseBear.rotation.x = 0; // keep facing direction from createBear()
    showcaseBear.rotation.z = 0;
    scene.add(showcaseBear);

    // Rig now has stable hand anchors; attach fish to right-hand anchor
    const rightAnchor = getHandAnchor(showcaseBear, 'right');
    console.log("[SHOWCASE] Right hand anchor present:", !!rightAnchor);

    // Create fresh fish
    console.log("[SHOWCASE] Creating new showcase fish of type:", playerProgress.selectedFish);
    showcaseFish = createFish(scene, 0, playerProgress.selectedFish, {}, false);
    showcaseFish.name = 'showcase-fish';
    showcaseFish.userData.fishType = playerProgress.selectedFish;
    if (showcaseFish.userData?.velocity) showcaseFish.userData.velocity.set(0, 0, 0);
    if (showcaseFish.userData) showcaseFish.userData.swimAmplitude = 0;
    // ensure any previous showcaseFish is detached from old parents
    if (showcaseFish.parent) showcaseFish.parent.remove(showcaseFish);
    
    // Attach fish to bear's hand with error checking
    if (rightAnchor) {
        rightAnchor.add(showcaseFish);
        showcaseFish.position.set(0.12, -0.35, 0.35);
        showcaseFish.rotation.set(-Math.PI/6, Math.PI/2, Math.PI);
        showcaseFish.scale.set(0.5, 0.5, 0.5);
        showcaseFish.visible = true;
        // ensure no culling on attached fish
        showcaseFish.traverse((o) => { if (o.isMesh || o.isGroup) o.frustumCulled = false; });
        console.log("[SHOWCASE] Fish attached to hand anchor");
    }

    // Ensure showcase bear is visible
    if (showcaseBear) {
        showcaseBear.visible = true;
        showcaseBear.updateMatrixWorld(true);
        console.log("[SHOWCASE] Showcase bear set to visible");
    }
    
    setupShowcaseAnimation(); // start new tween-based idle animation
    
    console.log("[SHOWCASE] Showcase creation completed");
}

function setupShowcaseAnimation() {
    if (!showcaseBear) return;
    if (!TWEEN || !TWEEN.Tween) { console.warn("[SHOWCASE] TWEEN not ready; skipping animation"); return; }
    const easingInOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.InOut) || (TWEEN.Easing?.Linear?.None) || ((k)=>k);
    TWEEN.removeAll();
    const arm = showcaseBear.getObjectByName('rightArm');
    if (arm?.rotation) new TWEEN.Tween(arm.rotation).to({ x: -0.35 }, 900).easing(easingInOut).yoyo(true).repeat(Infinity).start();
    if (showcaseFish) {
        // lock fish at hand; animate only tail + body segments for a held wiggle
        const wiggle = { t: 0 };
        new TWEEN.Tween(wiggle)
          .to({ t: Math.PI * 2 }, 1200)
          .easing(easingInOut)
          .onUpdate(() => {
              const ud = showcaseFish.userData || {};
              const phase = wiggle.t;
              const tailSwing = Math.sin(phase) * 0.14; // gentler showcase wiggle, reduced to avoid clipping
              if (ud.tailV) ud.tailV.rotation.y = tailSwing;
              if (ud.tailH) ud.tailH.rotation.y = tailSwing;
               if (ud.segments) {
                   for (const s of ud.segments) {
                       const ramp = Math.min(1, Math.max(0, (s.phase - 0.55) / 0.4)); // tail-biased wiggle
                       const amp = (ud.wiggleRotAmp ? ud.wiggleRotAmp * 0.45 : 0.14) * ramp;
                       s.mesh.rotation.y = (s.baseRotY || 0) + Math.sin(phase + s.phase * Math.PI) * amp;
                   }
               }
          })
          .repeat(Infinity)
          .yoyo(true)
          .start();
    }
}

function setupStartScreen() {
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
    activeFishes = [];

    // Make sure game bear is fully gone
    if (bear) {
        console.log("[SETUP] Removing game bear");
        scene.remove(bear);
        bear = null;
    }

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
        if (showcaseBear) {
            const fromRight = Math.random() < 0.5;
            showcaseBear.position.set(fromRight ? 12 : -12, 4.65, 0.8);
            showcaseBear.visible = true;
            // face toward the log along X while walking in
            showcaseBear.rotation.y = fromRight ? -Math.PI/2 : Math.PI/2;
            const startX = showcaseBear.position.x, endX = 0, baseY = 4.65;
            const duration = 2400;
            new TWEEN.Tween(showcaseBear.position)
                .to({ x: endX }, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    if (!showcaseBear) return;
                    const total = Math.max(0.0001, Math.abs(startX - endX));
                    const progress = 1 - (Math.abs(showcaseBear.position.x - endX) / total);
                    const phase = progress * Math.PI * 6; // ~3 full waddles
                    showcaseBear.rotation.z = Math.sin(phase) * 0.18 * (fromRight ? -1 : 1);
                    showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.12;
                })
                .onComplete(() => { 
                    if (!showcaseBear) return;
                    showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY;
                    const turnDur = 700;
                    new TWEEN.Tween(showcaseBear.rotation).to({ y: 0 }, turnDur).easing(TWEEN.Easing.Cubic.InOut).start();
                    const wob = { t: 0 };
                    new TWEEN.Tween(wob).to({ t: 1 }, turnDur).easing(TWEEN.Easing.Sine.InOut)
                        .onUpdate(()=>{ if(!showcaseBear) return; const ph = wob.t * Math.PI * 3; showcaseBear.rotation.z = Math.sin(ph)*0.12; showcaseBear.position.y = baseY + Math.abs(Math.sin(ph))*0.08; })
                        .onComplete(()=>{ if(!showcaseBear) return; showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; })
                        .start();
                })
                .start();
        }
    });
    showStart(isFirstLoad);
    isFirstLoad = false;
    startButton.innerText = 'START';
    console.log("[SETUP] Start screen setup completed");
}

function startGame() {
    gameState = { current: 'PLAYING', score: 0, streak: 1 };
    TWEEN.removeAll(); // stop showcase tweens when gameplay begins
    
    // Immediately hide showcase bear to avoid overlapping with gameplay bear
    if (showcaseBear) showcaseBear.visible = false;
     
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
    try { startRecording(renderer.domElement); } catch {}
    
    activeFishes.forEach(f => scene.remove(f));
    activeFishes = [];
    resetSpawner();
}

function startGameWithTurnaround() {
    if (__startingSequence) return;
    __startingSequence = true;
    // If we have a showcase bear visible, rotate it from facing camera (y=0) to river (y=PI) with a waddle
    if (showcaseBear && showcaseBear.visible) {
        const baseY = 4.65;
        const dur = 900;
        const easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k);
        const easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
        new TWEEN.Tween(showcaseBear.rotation).to({ y: Math.PI }, dur).easing(easeRot).start();
        const wob = { t: 0 };
        new TWEEN.Tween(wob)
            .to({ t: 1 }, dur)
            .easing(easeWob)
            .onUpdate(()=>{
                if (!showcaseBear) return;
                const phase = wob.t * Math.PI * 4;
                showcaseBear.rotation.z = Math.sin(phase) * 0.15;
                showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.10;
            })
            .onComplete(()=>{
                if (!showcaseBear) { __startingSequence = false; startGame(); return; }
                showcaseBear.rotation.z = 0;
                showcaseBear.position.y = baseY;
                // proceed to gameplay
                startGame();
                __startingSequence = false;
            })
            .start();
    } else {
        startGame();
        __startingSequence = false;
    }
}

function gameOver() {
    gameState.current = 'GAME_OVER';
    document.getElementById('final-score').innerText = gameState.score;
    /* remove: addLocalScore(gameState.score); */

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
    activeFishes = [];
    (async () => {
        try {
            await new Promise(r=>setTimeout(r, 1000)); // wait 1s post-fall before stopping recording
            const blob = await stopRecording();
            if (blob && window.websim?.upload) {
                const file = new File([blob], `replay_${Date.now()}.webm`, { type: blob.type || 'video/webm' });
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
        startButton.innerText = 'RETRY';
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

export function initGame() {
    setupStartScreen();
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

        const catchZ = bear.position.z - 0.9, failZ = bear.position.z - 0.6;
        for (let i = activeFishes.length - 1; i >= 0; i--) {
            const f = activeFishes[i];
            updateFish(f);
            if (f.userData?.thrown) {
                if (f.position.y < -10 || Math.abs(f.position.x) > 30 || f.position.z > 20) { scene.remove(f); activeFishes.splice(i,1); }
                continue;
            }
            // Skip catch/fail checks for fish already caught (attached to hand)
            if (f.userData?.caught) continue;
            if (f.position.z >= catchZ) {
                const half = (bear.userData.netWidth || 1) / 2, buffer = 0.35;
                const dx = Math.abs(f.position.x - bear.position.x);
                const withinX = dx <= half + buffer;
                if (withinX) {
                    playSFX(sounds.catch);
                    gameState.score += computeFishScore(f, gameState.streak);
                    gameState.streak++;
                    updateUIValues({ score: gameState.score, streak: gameState.streak });
                    grabAndThrow(f);
                } else if (f.position.z > failZ && dx > half + buffer + 0.25) {
                    gameState.streak = 1;
                    updateUIValues({ score: gameState.score, streak: gameState.streak });
                    scene.remove(f); activeFishes.splice(i,1);
                    gameOver(); break;
                }
            }
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
        if (showcaseBear) {
            const rightArm = showcaseBear.getObjectByName('rightArm');
            if (rightArm) rightArm.rotation.x = -Math.sin(gameState.idleAnimTimer) * 0.1;
        }
    }
}

function computeFishScore(fish, streak) {
    const ud = fish.userData || {};
    const base = 10;
    const weightBonus = Math.round(ud.weight ? ud.weight * 60 : 0);
    const rareBonusMult = ud.rareTiny ? 3 : 1;
    const raw = (base + weightBonus) * rareBonusMult * Math.max(1, streak);
    return Math.max(1, Math.round(raw / 100));
}

function grabAndThrow(fish) {
    if (!bear || !fish || fish.userData?.thrown) return;
    if (!fish.userData) fish.userData = {};
    // mark as caught so it won't trigger fail checks while attached to the hand
    fish.userData.caught = true;
    if (!fish.userData.velocity || !fish.userData.velocity.set) fish.userData.velocity = new THREE.Vector3(0,0,0);
    const side = fish.position.x >= bear.position.x ? 'right' : 'left';
    let hand = getHandAnchor(bear, side) || getHandAnchor(bear, side === 'right' ? 'left' : 'right');
    if (!hand) return;
    const arm = bear.getObjectByName(side==='right'?'rightArm':'leftArm') || bear.getObjectByName(side==='right'?'leftArm':'rightArm');
    if (!arm || !arm.rotation) return; // guard against missing arm
    const isRight = arm?.name === 'rightArm';
    fish.userData.velocity.set(0,0,0); fish.userData.pattern = 'held';
    if (fish.parent) fish.parent.remove(fish); hand.add(fish);
    fish.position.set(0.08 * (isRight?1:-1), -0.35, 0.30);
    fish.rotation.set(-Math.PI/6, isRight?Math.PI/2:-Math.PI/2, Math.PI);
    const easeInOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.InOut) || ((k)=>k);
    const easeOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.Out) || ((k)=>k);
    const bend1 = new TWEEN.Tween(bear.rotation).to({ x: -0.28 }, 140).easing(easeInOut);
    const prep  = new TWEEN.Tween(arm.rotation).to({ x: -0.6 }, 140).easing(easeInOut);
    const throwTw = new TWEEN.Tween(arm.rotation).to({ x: 1.25 }, 180).easing(easeOut).onStart(()=>{
        if (fish.parent) hand.remove(fish), scene.add(fish);
        fish.userData.thrown = true;
        const dir = isRight?1:-1;
        fish.userData.velocity = new THREE.Vector3(0.22*dir, 0.36, 0.06);
        fish.userData.angularVel = new THREE.Vector3((Math.random()*0.8-0.4), (Math.random()*1.6-0.8)*dir, (Math.random()*1.0-0.5));
        playSFX(sounds.whoosh);
    });
    const recover = new TWEEN.Tween(bear.rotation).to({ x: 0 }, 220).easing(easeOut);
    bend1.start(); prep.start(); bend1.chain(recover); prep.chain(throwTw);
}

export function setScoreLive(newScore) {
    gameState.score = Math.max(0, Math.floor(newScore)||0);
    updateUIValues({ score: gameState.score, streak: gameState.streak });
}
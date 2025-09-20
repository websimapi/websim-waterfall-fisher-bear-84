import * as THREE from 'three';
import { scene } from '../scene.js';
import { getHandAnchor } from '../entities/bear.js';
import { updateFish } from '../entities/fish.js';
import { playSFX, sounds } from './audio.js';
import * as TWEEN from 'tween';

export function handleFishInteractions(bear, activeFishes, gameState, updateUIValues) {
    const catchZ = bear.position.z - 0.9, failZ = bear.position.z - 0.6;
    for (let i = activeFishes.length - 1; i >= 0; i--) {
        const f = activeFishes[i];
        updateFish(f);
        if (f.userData?.thrown) {
            if (f.position.y < -10 || Math.abs(f.position.x) > 30 || f.position.z > 20) { 
                scene.remove(f); 
                activeFishes.splice(i,1); 
            }
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
                grabAndThrow(f, bear);
            } else if (f.position.z > failZ && dx > half + buffer + 0.25) {
                gameState.streak = 1;
                updateUIValues({ score: gameState.score, streak: gameState.streak });
                scene.remove(f); 
                activeFishes.splice(i,1);
                return true; // Signal game over
            }
        }
    }
    return false;
}

function computeFishScore(fish, streak) {
    const ud = fish.userData || {};
    const base = 10;
    const weightBonus = Math.round(ud.weight ? ud.weight * 60 : 0);
    const rareBonusMult = ud.rareTiny ? 3 : 1;
    const raw = (base + weightBonus) * rareBonusMult * Math.max(1, streak);
    return Math.max(1, Math.round(raw / 100));
}

function grabAndThrow(fish, bear) {
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
        // preserve world transform from hand before detaching
        hand.updateMatrixWorld(true);
        fish.updateMatrixWorld(true);
        const wp = new THREE.Vector3(); const wq = new THREE.Quaternion();
        fish.getWorldPosition(wp); fish.getWorldQuaternion(wq);
        if (fish.parent) hand.remove(fish), scene.add(fish);
        fish.position.copy(wp); fish.quaternion.copy(wq);
        fish.userData.thrown = true;
        const dir = isRight?1:-1;
        fish.userData.velocity = new THREE.Vector3(0.22*dir, 0.36, 0.06);
        fish.userData.angularVel = new THREE.Vector3((Math.random()*0.8-0.4), (Math.random()*1.6-0.8)*dir, (Math.random()*1.0-0.5));
        playSFX(sounds.whoosh);
    });
    const recover = new TWEEN.Tween(bear.rotation).to({ x: 0 }, 220).easing(easeOut);
    bend1.start(); prep.start(); bend1.chain(recover); prep.chain(throwTw);
}
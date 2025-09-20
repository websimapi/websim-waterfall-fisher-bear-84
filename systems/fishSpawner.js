import { createFish } from '../entities/fish.js';
import { FISH } from '../unlocks.js';

let spawnTimer = 0;
const maxConcurrent = 3;
let currentPattern = null;
let patternStep = 0;

function nextPattern() {
    const stairs = (dir='right') => {
        const xs = [-3,-2,-1,0,1,2,3];
        return xs.map((v,i)=>({ x: dir==='right'?xs[i]:xs[xs.length-1-i], delay: 18, move: 'zigzag' }));
    };
    const sine = () => {
        const steps = 10, amp = 3;
        return Array.from({length: steps}, (_,i)=>({ x: Math.sin((i/steps)*Math.PI*2)*amp, delay: 12, move: 'sine' }));
    };
    const lanes = () => {
        const seq = [-2,0,2,-2,0,2];
        return seq.map(x=>({ x, delay: 15, move: 'drift' }));
    };
    const choices = [ () => stairs('right'), () => stairs('left'), sine, lanes ];
    currentPattern = { steps: choices[Math.floor(Math.random()*choices.length)]() };
    patternStep = 0; spawnTimer = 0;
}

function getFishToSpawn(score, activeFishes, playerProgress) {
    const classic = FISH.find(f => f.id === 'classic') || FISH[0];
    const vit = FISH.find(f => f.id === 'vitiligo');
    const golden = FISH.find(f => f.id === 'golden');
    const hasActiveVit = activeFishes.some(f => f?.userData?.fishType === 'vitiligo');
    if (score >= 250 && vit && !hasActiveVit && Math.random() < 0.33) return vit;
    if (score >= 800 && golden && Math.random() < 0.20) return golden;
    return classic;
}

export function resetSpawner() {
    spawnTimer = 0;
    currentPattern = null;
    patternStep = 0;
}

export function updateSpawner(scene, activeFishes, score, playerProgress) {
    if (!currentPattern) nextPattern();

    if (spawnTimer-- <= 0 && activeFishes.length < maxConcurrent) {
        const step = currentPattern.steps[patternStep];
        const fishInfo = getFishToSpawn(score, activeFishes, playerProgress);
        const pattern = fishInfo.id === 'vitiligo' ? 'diagonal' : step.move;
        const f = createFish(scene, score, fishInfo.id, { x: step.x, pattern });
        activeFishes.push(f);
        spawnTimer = step.delay;
        patternStep++;
        if (patternStep >= currentPattern.steps.length) {
            currentPattern = null;
            spawnTimer = 45; // gap between sequences
        }
    }
}
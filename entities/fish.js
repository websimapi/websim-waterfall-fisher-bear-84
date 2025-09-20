import * as THREE from 'three';
import { createRiggedFish, updateRiggedFish } from './fishRig.js';

const fishMat = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
const fishTailMat = new THREE.MeshLambertMaterial({ color: 0xff4500 });
const bellyMat = new THREE.MeshLambertMaterial({ color: 0xe6e6e6 });
const finMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const scleraMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

// Vitiligo fish materials
const vitiligoBodyMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const vitiligoPatchMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

function createVoxel(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
}

export function createFish(scene, score = 0, type = 'classic', opts = {}, addToScene = true) {
    const g = createRiggedFish({ scene, score, type, opts, addToScene });
    if (!g.userData) g.userData = {};
    g.userData.fishType = type;
    return g;
}

export function updateFish(fish) {
    updateRiggedFish(fish);
}

export function isFishPastLog(fish) {
    return fish && fish.position.z > 3.5;
}
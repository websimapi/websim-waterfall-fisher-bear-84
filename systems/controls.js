import * as THREE from 'three';
import { BEAR_X_LIMIT, updateBear, nudgeBearZ } from '../entities/bear.js';
import { BEAR_Z_MIN, BEAR_Z_MAX } from '../entities/bear.js';
import { getOrbitControls, initOrbitControls } from '../scene.js';
import { toggleDevTools, resetDevTools } from './dev.js';
import { bear, gameState } from './game.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let keysPressed = {};
let isDragging = false;
// Use a fixed plane at the log depth so dragging continues off the log
// Intersect pointer with the river surface (y = 2) so we can read world Z (up/down river)
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2);
const _dragPoint = new THREE.Vector3();

/* swipe detection state */
let startX = 0, startY = 0, startTime = 0;

function onPointerDown(event) {
    if (gameState.current !== 'PLAYING' || event.target.tagName === 'BUTTON') return;
    isDragging = true;
    const e = event.changedTouches ? event.changedTouches[0] : event;
    startX = e.clientX; startY = e.clientY; startTime = Date.now();
    bear.userData.isMovingWithKeys = false;
    onPointerMove(event);
}

function onPointerMove(event) {
    if (!isDragging || gameState.current !== 'PLAYING' || !bear) return;

    updatePointer(event);
    raycaster.setFromCamera(pointer, window.camera);
    if (raycaster.ray.intersectPlane(dragPlane, _dragPoint)) {
        // Pointer in front (smaller z) rolls log forward/up-river; behind (larger z) rolls back toward waterfall
        bear.userData.targetX = THREE.MathUtils.clamp(_dragPoint.x, -BEAR_X_LIMIT, BEAR_X_LIMIT);
        bear.userData.zTarget = THREE.MathUtils.clamp(_dragPoint.z, BEAR_Z_MIN, BEAR_Z_MAX);
        bear.userData.isMovingWithKeys = false;
    }
}

function onPointerUp(event) {
    isDragging = false;
    if (gameState.current !== 'PLAYING' || !bear) return;
    updatePointer(event);
    raycaster.setFromCamera(pointer, window.camera);
    if (raycaster.ray.intersectPlane(dragPlane, _dragPoint)) {
        const dz = _dragPoint.z - bear.position.z; // positive -> behind (roll back), negative -> in front (roll forward)
        const mag = THREE.MathUtils.clamp(Math.abs(dz) / 2.0, 0, 1);
        const delta = (dz > 0 ? 1 : -1) * (0.06 + 0.12 * mag);
        nudgeBearZ(bear, delta);
    }
}

function updatePointer(event) {
    const eventCoord = event.changedTouches ? event.changedTouches[0] : event;
    pointer.x = (eventCoord.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(eventCoord.clientY / window.innerHeight) * 2 + 1;
}

function handleKeyDown(event) {
    if (gameState.current !== 'PLAYING' || !bear) return;
    keysPressed[event.key] = true;
    if (event.key === 'a' || event.key === 'ArrowLeft' || event.key === 'd' || event.key === 'ArrowRight') {
        bear.userData.isMovingWithKeys = true;
    }
    updateBearMovement();
}

function handleKeyUp(event) {
    keysPressed[event.key] = false;
    updateBearMovement();
}

function updateBearMovement() {
    if (!bear || gameState.current !== 'PLAYING' || !bear.userData.isMovingWithKeys) return;
    let moveDirection = 0;
    if (keysPressed['a'] || keysPressed['ArrowLeft']) moveDirection = -1;
    else if (keysPressed['d'] || keysPressed['ArrowRight']) moveDirection = 1;
    updateBear(bear, moveDirection);
}

function handleGlobalKeyUp(event) {
    if (event.key === '`' || event.key === '~') {
        resetDevTools(getOrbitControls());
    }
}

function handleDevButtonClick() {
    toggleDevTools(initOrbitControls());
}

export function initControls(sceneRef, cameraRef) {
    window.scene = sceneRef; 
    window.camera = cameraRef; 

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keyup', handleGlobalKeyUp, true);

    const devButton = document.getElementById('dev-console-button');
    if (devButton) devButton.addEventListener('click', handleDevButtonClick);
}
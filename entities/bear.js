import * as THREE from 'three';

const brownMat = new THREE.MeshLambertMaterial({ color: 0x8d5524 });
const darkBrownMat = new THREE.MeshLambertMaterial({ color: 0x4a2d1e });

// Grizzly materials
const grizzlyMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2e });
const darkGrizzlyMat = new THREE.MeshLambertMaterial({ color: 0x3b2818 });
const polarMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const darkPolarMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b0 });

export const BEAR_X_LIMIT = 3.5;
const BEAR_MOVE_SPEED = 0.08;
/* add Z roll controls */
export const BEAR_Z_MIN = -9.0, BEAR_Z_MAX = 2.1;
const BEAR_Z_SPEED = 0.012;
const BEAR_WOBBLE_AMOUNT = 0.2;

function createVoxel(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
}

export function createBear(type = 'splashy') {
    const group = new THREE.Group();
    group.name = 'bear'; // Assign name to the group for easier identification

    const bodyMat = type === 'polar' ? polarMat : (type === 'grizzly' ? grizzlyMat : brownMat);
    const accentMat = type === 'polar' ? darkPolarMat : (type === 'grizzly' ? darkGrizzlyMat : darkBrownMat);

    group.add(createVoxel(0, 0, 0, 1.5, 1.5, 1, bodyMat));
    group.add(createVoxel(0, 1.25, 0, 1, 1, 1, bodyMat));
    group.add(createVoxel(-0.4, 1.9, 0, 0.3, 0.3, 0.3, accentMat));
    group.add(createVoxel(0.4, 1.9, 0, 0.3, 0.3, 0.3, accentMat));
    group.add(createVoxel(0, 1.1, 0.5, 0.5, 0.4, 0.3, accentMat));
    group.add(createVoxel(-0.5, -1, 0, 0.5, 0.5, 0.5, bodyMat));
    group.add(createVoxel(0.5, -1, 0, 0.5, 0.5, 0.5, bodyMat));

    const armY = 0.1, armZ = 0.1; // moved arms slightly forward to avoid occlusion
    const armWidth = 0.4, armHeight = 1.0, armDepth = 0.4;
    
    // Left Arm
    const leftArm = new THREE.Group(); leftArm.name = 'leftArm';
    const leftArmMesh = createVoxel(0, 0, 0, armWidth, armHeight, armDepth, bodyMat);
    leftArm.add(leftArmMesh);
    const leftHandAnchor = new THREE.Object3D(); leftHandAnchor.name = 'leftHandAnchor';
    leftHandAnchor.position.set(0, -armHeight/2, 0); leftArm.add(leftHandAnchor);
    leftArm.position.set(-0.95, armY, armZ); leftArm.rotation.z = -Math.PI/20; group.add(leftArm);

    // Right Arm
    const rightArm = new THREE.Group(); rightArm.name = 'rightArm';
    const rightArmMesh = createVoxel(0, 0, 0, armWidth, armHeight, armDepth, bodyMat);
    rightArm.add(rightArmMesh);
    const rightHandAnchor = new THREE.Object3D(); rightHandAnchor.name = 'rightHandAnchor';
    rightHandAnchor.position.set(0, -armHeight/2, 0); rightArm.add(rightHandAnchor);
    rightArm.position.set(0.95, armY, armZ); rightArm.rotation.z = Math.PI/20; group.add(rightArm);
    
    group.position.set(0, 4.65, 0.8); // Adjusted Y to be on top of the log.
    group.rotation.y = Math.PI;
    group.userData.targetX = 0;
    group.userData.wobbleTimer = 0;
    group.userData.zTarget = group.position.z; // init Z roll target
    
    // add simple translucent net in front of the log
    const netWidth = 2.8;
    const netMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    netMaterial.visible = false; // Hide the net visually
    const net = new THREE.Mesh(new THREE.BoxGeometry(netWidth, 0.6, 0.1), netMaterial);
    net.name = 'net';
    net.position.set(0, -1.3, -0.7);
    group.add(net);
    group.userData.net = net; group.userData.netWidth = netWidth;
    // Ensure no parts get culled due to bounding box inaccuracies after parenting/animation
    group.traverse((o) => { if (o.isMesh || o.isGroup) o.frustumCulled = false; });
    return group;
}

export function updateBear(bear, moveDirection) {
    if (moveDirection !== 0 && bear.userData.isMovingWithKeys) {
        bear.userData.targetX = THREE.MathUtils.clamp(bear.position.x + moveDirection, -BEAR_X_LIMIT, BEAR_X_LIMIT);
    }
    const oldX = bear.position.x;
    const distanceToTarget = bear.userData.targetX - bear.position.x;
    const moveThisFrame = Math.sign(distanceToTarget) * Math.min(Math.abs(distanceToTarget), BEAR_MOVE_SPEED);
    if (Math.abs(distanceToTarget) > 0.01) {
        bear.position.x += moveThisFrame;
    }
    // Z roll: move toward zTarget and clamp within safe range
    if (typeof bear.userData.zTarget === 'number') {
        bear.userData.zTarget = THREE.MathUtils.clamp(bear.userData.zTarget, BEAR_Z_MIN, BEAR_Z_MAX);
        const dz = bear.userData.zTarget - bear.position.z;
        const stepZ = Math.sign(dz) * Math.min(Math.abs(dz), BEAR_Z_SPEED);
        if (Math.abs(dz) > 0.001) bear.position.z += stepZ;
    }

    const velocityX = bear.position.x - oldX;
    if (Math.abs(velocityX) > 0.001) {
        bear.userData.wobbleTimer += 0.2;
        bear.rotation.z = Math.sin(bear.userData.wobbleTimer) * BEAR_WOBBLE_AMOUNT;
    } else {
        bear.rotation.z = THREE.MathUtils.lerp(bear.rotation.z, 0, 0.1);
    }
}

export function getHandAnchor(bearGroup, side = 'right') {
    if (!bearGroup) return null;
    return bearGroup.getObjectByName(side === 'right' ? 'rightHandAnchor' : 'leftHandAnchor') || null;
}

/* add helper to nudge Z target by delta */
export function nudgeBearZ(bearGroup, delta) {
    if (!bearGroup) return;
    const next = (bearGroup.userData.zTarget ?? bearGroup.position.z) + delta;
    bearGroup.userData.zTarget = THREE.MathUtils.clamp(next, BEAR_Z_MIN, BEAR_Z_MAX);
}
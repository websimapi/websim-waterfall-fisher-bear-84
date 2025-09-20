import * as THREE from 'three';

const fishMat = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
const fishTailMat = new THREE.MeshLambertMaterial({ color: 0xff4500 });
const bellyMat = new THREE.MeshLambertMaterial({ color: 0xe6e6e6 });
const finMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
const scleraMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

const vitiligoBodyMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const vitiligoPatchMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
const goldenBodyMat = new THREE.MeshLambertMaterial({ color: 0xdaa520 });

function createVoxel(x, y, z, w, h, d, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;
  return mesh;
}

export function createRiggedFish({ scene, score = 0, type = 'classic', opts = {}, addToScene = true }) {
  const group = new THREE.Group();
  group.name = 'fish';
  group.rotation.y = Math.PI;

  const isVitiligo = type === 'vitiligo';
  const isGolden = type === 'golden';
  const bodyMat = isVitiligo ? vitiligoBodyMat : (isGolden ? goldenBodyMat : fishMat);

  // Skeleton chain (bones as Object3D pivots)
  const boneCount = 9;
  const length = 3.2;
  const segLen = length / boneCount;
  const maxW = 0.95, maxH = 1.05;

  const root = new THREE.Object3D(); root.name = 'root';
  group.add(root);

  const bones = [];
  const segments = [];
  let parent = root;

  for (let i = 0; i < boneCount; i++) {
    const t = i / (boneCount - 1);
    const w = THREE.MathUtils.lerp(maxW, 0.28, t);
    const h = THREE.MathUtils.lerp(maxH, 0.32, t);

    const pivot = new THREE.Object3D(); pivot.name = `bone_${i}`;
    pivot.position.z = i === 0 ? -0.4 : segLen; // first bone starts near head
    parent.add(pivot);

    const bodySeg = createVoxel(0, 0, segLen * 0.5, w, h, segLen * 0.98, (isVitiligo && (i === 1 || i === 4)) ? vitiligoPatchMat : bodyMat);
    pivot.add(bodySeg);

    const bellyH = h * 0.25;
    const belly = createVoxel(0, -h * 0.3, segLen * 0.5, w * 0.95, bellyH, segLen * 0.95, bellyMat);
    pivot.add(belly);

    bones.push(pivot);
    segments.push({ mesh: bodySeg, baseRotY: bodySeg.rotation.y, phase: t });

    parent = pivot;
  }

  // Tail at end bone
  const tailBaseZ = segLen * 0.5 + 0.10;
  const tailBase = createVoxel(0, 0.0, tailBaseZ - 0.10, 0.24, 0.60, 0.14, fishTailMat);
  const tailV = createVoxel(0, 0.0, tailBaseZ + 0.02, 0.045, 0.56, 0.30, fishTailMat);
  const tailH = createVoxel(0, -0.05, tailBaseZ - 0.04, 0.32, 0.050, 0.18, fishTailMat);
  bones[bones.length - 1].add(tailBase, tailV, tailH);

  // Fins attached near head/body
  const dorsal = createVoxel(0, 0.55, 0.9, 0.10, 0.30, 1.10, finMat);
  const anal   = createVoxel(0, -0.55, 1.1, 0.10, 0.26, 0.95, finMat);
  const pectoralL = createVoxel(0.46, -0.05, 0.42, 0.08, 0.20, 0.38, finMat);
  const pectoralR = createVoxel(-0.46, -0.05, 0.42, 0.08, 0.20, 0.38, finMat);
  const pelvicL = createVoxel(0.22, -0.45, 1.0, 0.08, 0.16, 0.25, finMat);
  const pelvicR = createVoxel(-0.22, -0.45, 1.0, 0.08, 0.16, 0.25, finMat);
  group.add(dorsal, anal, pectoralL, pectoralR, pelvicL, pelvicR);

  // Head details
  group.add(createVoxel(0, 0.0, 0.25, 0.7, 0.6, 0.15, bellyMat));
  const scleraL = createVoxel(0.30, 0.24, 0.08, 0.24, 0.24, 0.22, scleraMat);
  const scleraR = createVoxel(-0.30, 0.24, 0.08, 0.24, 0.24, 0.22, scleraMat);
  const pupilL  = createVoxel(0.32, 0.24, 0.14, 0.10, 0.10, 0.06, pupilMat);
  const pupilR  = createVoxel(-0.32, 0.24, 0.14, 0.10, 0.10, 0.06, pupilMat);
  const highlightL = createVoxel(0.36, 0.29, 0.16, 0.04, 0.04, 0.03, scleraMat);
  const highlightR = createVoxel(-0.36, 0.29, 0.16, 0.04, 0.04, 0.03, scleraMat);
  group.add(scleraL, scleraR, pupilL, pupilR, highlightL, highlightR);

  // Placement and kinematics
  const riverWidth = 7;
  const edgeX = (riverWidth / 2 - 0.4) * (Math.random() < 0.5 ? -1 : 1);
  const xPos = (typeof opts.x === 'number') 
    ? THREE.MathUtils.clamp(opts.x, -riverWidth / 2, riverWidth / 2) 
    : (isVitiligo ? edgeX : (Math.random() - 0.5) * riverWidth);
  const baseY = 2.1;
  group.position.set(xPos, baseY, -24);

  const speedMultiplier = 1 + (THREE.MathUtils.clamp(score, 0, 5000) / 1600);
  const rareTiny = Math.random() < 0.03;
  const weight = rareTiny ? THREE.MathUtils.randFloat(0.06, 0.14) : THREE.MathUtils.randFloat(0.18, 1.6);
  const sizeScale = THREE.MathUtils.clamp(Math.cbrt(weight) * 0.85, 0.30, 1.20);
  group.scale.set(sizeScale, sizeScale, sizeScale); // apply visual scale to match weight
  const sizeSpeedFactor = 1 + (1.1 - sizeScale) * 0.55;
  const typeSpeed = isVitiligo ? 1.18 : (isGolden ? 1.05 : 1.0);
  const sprinter = Math.random() < 0.20;
  const sprintMult = sprinter ? 1.25 : 1.0;
  let swimSpeed = (0.028 + Math.random() * 0.022) * speedMultiplier * sizeSpeedFactor * typeSpeed * sprintMult;
  const boosted = Math.random() < 0.10;
  if (boosted) swimSpeed *= 2;

  group.userData = {
    velocity: new THREE.Vector3(0, 0, swimSpeed),
    initialX: xPos, baseY,
    swimFrequency: Math.random() * 0.6 + 0.9,
    swimAmplitude: Math.random() * 0.20 + 0.25,
    swimTimer: Math.random() * Math.PI * 2,
    baseRotY: group.rotation.y,
    prevX: xPos,
    dorsal, anal, pectoralL, pectoralR,
    tailV, tailH,
    bones, boneCount, segLen,
    segments, // legacy compatibility for showcase
    wiggleRotAmp: 0.24,
    tailMaxRot: 0.16,
    pattern: opts.pattern || (isVitiligo ? 'diagonal' : (isGolden ? 'jumper' : ['sine','zigzag','drift'][Math.floor(Math.random()*3)])),
    drift: 0,
    sizeScale,
    rareTiny,
    weight,
    sprinter,
    boosted,
    diagDir: isVitiligo ? (xPos < 0 ? 1 : -1) : 1,
    diagSpeed: isVitiligo ? (0.055 + Math.random()*0.045) : 0,
    crossDir: isVitiligo ? (xPos < 0 ? 1 : -1) : 1,
    crossSpeed: isVitiligo ? (0.05 + Math.random()*0.045) : 0,
    crossFlipTimer: 0, crossFlipInterval: isVitiligo ? (1.2 + Math.random()*1.4) : 0,
    isGolden, isVitiligo,
    inAir: false, jumpTimer: 0, jumpCooldown: isGolden ? (1.4 + Math.random()*1.8) : 0
  };

  group.traverse(o => { if (o.isMesh || o.isGroup) o.frustumCulled = false; });
  if (addToScene) scene.add(group);
  return group;
}

export function updateRiggedFish(fish) {
  if (!fish) return;
  const ud = fish.userData;

  // Advance forward
  if (ud.thrown) {
    ud.velocity.y += -0.015; // gravity
    fish.position.add(ud.velocity);
    if (ud.angularVel) {
      fish.rotation.x += ud.angularVel.x;
      fish.rotation.y += ud.angularVel.y;
      fish.rotation.z += ud.angularVel.z;
      ud.angularVel.multiplyScalar(0.992); // slight damping
    }
    return;
  }
  fish.position.add(ud.velocity);

  // Lateral movement
  ud.swimTimer += 0.07;
  if (ud.pattern === 'diagonal') {
    const half = 3.3, margin = 0.2, s = ud.diagSpeed || 0.06;
    fish.position.x += (ud.diagDir || 1) * s;
    if (fish.position.x > half - margin) { fish.position.x = half - margin; ud.diagDir = -1; }
    if (fish.position.x < -half + margin) { fish.position.x = -half + margin; ud.diagDir = 1; }
  } else if (ud.pattern === 'bankCross') {
    const half = 3.3, m = 0.15, s = ud.crossSpeed || 0.05;
    fish.position.x += s * (ud.crossDir || 1);
    if (fish.position.x > half - m) ud.crossDir = -1;
    if (fish.position.x < -half + m) ud.crossDir = 1;
    if (ud.isVitiligo) {
      ud.crossFlipTimer += 0.07;
      if (ud.crossFlipTimer > ud.crossFlipInterval) {
        ud.crossDir = Math.random() < 0.5 ? -1 : 1;
        ud.crossFlipTimer = 0; ud.crossFlipInterval = 1.0 + Math.random()*1.8;
      }
    }
  } else if (ud.pattern === 'jumper') {
    if (!ud.inAir) {
      ud.jumpTimer += 0.07;
      if (ud.jumpTimer > ud.jumpCooldown) {
        ud.inAir = true; ud.jumpTimer = 0; ud.jumpCooldown = 1.1 + Math.random()*2.0;
        ud.velocity.y = 0.22 + Math.random()*0.18;
        ud.velocity.x += (Math.random()<0.5?-1:1) * (0.04 + Math.random()*0.06);
      }
    } else {
      ud.velocity.y += -0.018;
      if (fish.position.y <= ud.baseY && ud.velocity.y <= 0) { fish.position.y = ud.baseY; ud.velocity.y = 0; ud.inAir = false; }
    }
  } else {
    let weave = 0;
    if (ud.pattern === 'sine') weave = Math.sin(ud.swimTimer * ud.swimFrequency) * ud.swimAmplitude;
    else if (ud.pattern === 'zigzag') { const tri = 2 / Math.PI * Math.asin(Math.sin(ud.swimTimer * ud.swimFrequency)); weave = tri * ud.swimAmplitude * 0.8; }
    else { ud.drift += (Math.random() - 0.5) * 0.01; ud.drift = THREE.MathUtils.clamp(ud.drift, -0.4, 0.4); weave = ud.drift; }
    const targetX = ud.initialX + weave;
    fish.position.x = THREE.MathUtils.lerp(fish.position.x, targetX, 0.10);
  }

  // Vertical bob
  const bob = (ud.pattern === 'jumper' && ud.inAir) ? 0 : (Math.sin(ud.swimTimer * 0.8 + 1.3) * 0.04 + Math.sin(ud.swimTimer * 1.7) * 0.03);
  fish.position.y = ud.baseY + bob;

  // Orientation
  const dx = fish.position.x - ud.prevX;
  ud.prevX = fish.position.x;
  fish.rotation.y = ud.baseRotY + Math.sin(ud.swimTimer * ud.swimFrequency) * 0.08;
  if (ud.pattern === 'jumper' && ud.inAir) {
    fish.rotation.x = THREE.MathUtils.lerp(fish.rotation.x, -0.35 * Math.sign(ud.velocity.y), 0.2);
  }
  fish.rotation.z = THREE.MathUtils.clamp(-dx * 0.6, -0.28, 0.28);

  // Bone wave: smooth increasing amplitude towards tail
  const phase = ud.swimTimer * (ud.swimFrequency * 1.0);
  const tailBias = 1.35;
  for (let i = 0; i < ud.bones.length; i++) {
    const t = i / (ud.boneCount - 1);
    const weight = Math.pow(THREE.MathUtils.smoothstep(t, 0.2, 1.0), tailBias);
    const angle = Math.sin(phase + t * Math.PI * 1.6) * (ud.wiggleRotAmp) * weight;
    ud.bones[i].rotation.y = angle;
  }

  // Tail wag synthesized from last bone angle
  const lastAngle = ud.bones[ud.bones.length - 1].rotation.y || 0;
  const tailSwing = THREE.MathUtils.clamp(lastAngle * 1.2, -ud.tailMaxRot, ud.tailMaxRot);
  if (ud.tailV) ud.tailV.rotation.y = tailSwing;
  if (ud.tailH) ud.tailH.rotation.y = tailSwing;

  // Fin flaps
  const finFlap = Math.sin(ud.swimTimer * 2.0) * 0.32;
  if (ud.pectoralL) ud.pectoralL.rotation.z = 0.18 + finFlap;
  if (ud.pectoralR) ud.pectoralR.rotation.z = -0.18 - finFlap;
}
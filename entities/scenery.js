import * as THREE from 'three';

const darkBrownMat = new THREE.MeshLambertMaterial({ color: 0x4a2d1e });
const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
const treeLeavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const grassMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
const bushMat = new THREE.MeshLambertMaterial({ color: 0x3cb371 });
const sandMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c }); // tan/sand color

function createVoxel(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
}

function createTree(x, y, z) {
    const g = new THREE.Group();
    const trunkHeight = 1.5 + Math.random() * 1.5;
    // position trunk voxel so its base is at y=0 of the group
    g.add(createVoxel(0, trunkHeight / 2, 0, 0.5, trunkHeight, 0.5, treeTrunkMat));

    // leaves are a collection of blocks on top of the trunk
    const leavesY = trunkHeight;
    g.add(createVoxel(0, leavesY + 0.75, 0, 1.5, 1.5, 1.5, treeLeavesMat));
    g.add(createVoxel(0.5, leavesY + 0.4, 0.3, 1.2, 1.2, 1.2, treeLeavesMat));
    g.add(createVoxel(-0.4, leavesY + 0.5, -0.5, 1.3, 1.3, 1.3, treeLeavesMat));

    g.position.set(x, y, z);
    return g;
}

function createMountainSide(isLeft) {
    const group = new THREE.Group();
    const sign = isLeft ? -1 : 1;
    const baseWidth = 8, baseDepth = 20, startY = 2, endY = -20;
    const bankEdgeX = 10; // Ground shelves end at x = +/-10
    let currentY = startY, layerCount = 0;
    while (currentY > endY) {
        layerCount++;
        const layerHeight = 3 + Math.random() * 3;
        const widthIncrease = Math.random() * 2;
        const depthIncrease = Math.random() * 2;
        const layerWidth = baseWidth + (layerCount * widthIncrease);
        const layerDepth = baseDepth + (layerCount * depthIncrease);
        const layerX = sign * (bankEdgeX + layerWidth / 2 - 1); // Start just inside the bank edge
        const layerZ = -5 + (Math.random() - 0.5) * 2;
        const layerY = currentY - layerHeight / 2;
        group.add(createVoxel(layerX, layerY, layerZ, layerWidth, layerHeight, layerDepth, rockMat));
        const detailRocks = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < detailRocks; i++) {
            const size = 1 + Math.random() * 2;
            const detailX = layerX + sign * (Math.random() * layerWidth - (layerWidth / 2));
            const detailY = currentY + size / 2;
            const detailZ = layerZ + (Math.random() - 0.5) * layerDepth;
            group.add(createVoxel(detailX, detailY, detailZ, size, size, size, rockMat));
        }
        currentY -= layerHeight;
    }
    return group;
}

/* simple bush: chunky voxel blob */
function createBush(x, y, z) {
    const g = new THREE.Group();
    g.add(createVoxel(0, 0.25, 0, 1.2, 0.6, 1.2, bushMat));
    g.add(createVoxel(0.5, 0.35, -0.2, 0.7, 0.5, 0.7, bushMat));
    g.add(createVoxel(-0.4, 0.3, 0.3, 0.8, 0.5, 0.6, bushMat));
    g.position.set(x, y, z);
    return g;
}

export function createScenery() {
    const group = new THREE.Group();

    // Riverbed - add this first to be under the water and other objects.
    const waterWidth = 8;
    const riverLength = 30;
    const cliffEdgeZ = 2.5;
    const riverBedY = 1.8; // Water is at Y=2.0, banks at Y=2.1. Put this just under water.

    const riverBedGeo = new THREE.PlaneGeometry(waterWidth, riverLength);
    const riverBed = new THREE.Mesh(riverBedGeo, sandMat);
    riverBed.rotation.x = -Math.PI / 2;
    riverBed.position.set(0, riverBedY, cliffEdgeZ - riverLength / 2 - 0.5);
    group.add(riverBed);

    // Add river banks (walls)
    const bankWallHeight = 22; // Make them deep
    const bankWallThickness = 1;
    const bankWallY = riverBedY - (bankWallHeight / 2) + 0.1;
    const bankWallZ = cliffEdgeZ - riverLength / 2 - 0.5;

    const leftBankWall = createVoxel(
        -waterWidth / 2 - bankWallThickness / 2, 
        bankWallY, 
        bankWallZ, 
        bankWallThickness, 
        bankWallHeight, 
        riverLength, 
        rockMat
    );
    group.add(leftBankWall);

    const rightBankWall = createVoxel(
        waterWidth / 2 + bankWallThickness / 2, 
        bankWallY, 
        bankWallZ, 
        bankWallThickness, 
        bankWallHeight, 
        riverLength, 
        rockMat
    );
    group.add(rightBankWall);

    // Add a rock base under the river to connect to the waterfall cliff
    const riverBaseThickness = 1.0;
    const riverBase = createVoxel(0, riverBedY - riverBaseThickness / 2 - 1.0, cliffEdgeZ - riverLength / 2 - 0.5, waterWidth, riverBaseThickness, riverLength, rockMat);
    group.add(riverBase);

    // Ground at the bottom of the waterfall
    const waterfallBottomY = -18.1;
    const bottomGroundGeo = new THREE.PlaneGeometry(12, 15);
    const bottomGround = new THREE.Mesh(bottomGroundGeo, sandMat);
    bottomGround.rotation.x = -Math.PI / 2;
    bottomGround.position.set(0, waterfallBottomY, cliffEdgeZ + 7.5); // Start at cliff edge, extend forward
    group.add(bottomGround);

    // Cliff face behind waterfall
    // Water is at z=2.5, from y=2 to y=-18. This wall sits behind it (z < 2.5).
    group.add(createVoxel(0, -12.5, 1.8, 10, 25, 1.2, rockMat)); // Main back wall (moved behind waterfall and down)
    group.add(createVoxel(3, -10, 1.6, 4, 8, 1, rockMat)); // Ledge/variation (moved down)
    group.add(createVoxel(-4, -6, 1.7, 3, 5, 0.8, rockMat)); // (moved down)
    group.add(createVoxel(-2, -20, 1.5, 5, 7, 1, rockMat)); // (moved down)
    group.add(createVoxel(2, -3.5, 1.8, 6, 3, 1, rockMat)); // top edge (moved down)

    const logGeo = new THREE.CylinderGeometry(0.7, 0.7, 9, 8);
    const log = new THREE.Mesh(logGeo, darkBrownMat);
    log.name = "log";
    log.rotation.z = Math.PI / 2;
    log.position.set(0, 2.7, 1);
    group.add(log);
    const leftMountain = createMountainSide(true);
    const rightMountain = createMountainSide(false);
    group.add(leftMountain);
    group.add(rightMountain);
    // green ground shelves along both sides. Water is at y=2.0. Banks are slightly higher.
    const groundY = 2.1;
    const groundThickness = 0.4;
    const groundL = createVoxel(-7, groundY - groundThickness/2, -8, 6, groundThickness, 24, grassMat);
    const groundR = createVoxel( 7, groundY - groundThickness/2, -8, 6, groundThickness, 24, grassMat);
    group.add(groundL, groundR);

    // Add rock walls underneath the grass shelves to connect them to the mountains
    const groundWallHeight = 22; // Match river bank wall height for consistency
    const groundWallY = (groundY - groundThickness / 2) - (groundWallHeight / 2); // Position it right under the grass
    
    const groundWallL = createVoxel(-7, groundWallY, -8, 6, groundWallHeight, 24, rockMat);
    const groundWallR = createVoxel(7, groundWallY, -8, 6, groundWallHeight, 24, rockMat);
    group.add(groundWallL, groundWallR);

    // Dynamic Tree and Bush Placement
    const bankWidth = 6;
    const bankLength = 24;
    const numTrees = 25;
    for (let i = 0; i < numTrees; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        // Position on the grass banks, avoiding the absolute edges and river.
        // The river is between x=-4 and x=4. Tree leaves are 1.5 wide. Bushes are ~1.2 wide.
        // We want x to be > 4 + (leaf_width/2) = 4.75. Let's start at 5.
        // The bank is from x=4 to x=10.
        const x = side * (5.0 + Math.random() * (bankWidth - 1.5)); // Place between 5 and 9.5 from center
        const z = -8 - (bankLength / 2) + 0.5 + Math.random() * (bankLength - 1);
        group.add(createTree(x, groundY, z));

        // Occasionally add a bush near a tree
        if (Math.random() > 0.65) {
            const bushX = x + (Math.random() - 0.5) * 2;
            const bushZ = z + (Math.random() - 0.5) * 2;
            // Clamp bush X to stay on the bank
            const clampedBushX = side * Math.max(5.0, Math.min(Math.abs(bushX), 10.0 - 0.6));
            group.add(createBush(clampedBushX, groundY, bushZ));
        }
    }

    for (let i=0;i<12;i++){ const z=-26-Math.random()*24, x=(Math.random()<0.5?-12:12)+(Math.random()*4-2), w=4+Math.random()*6, h=1.5+Math.random()*2.5, d=5+Math.random()*8; group.add(createVoxel(x, 1.2-Math.random()*1.5, z, w, h, d, rockMat)); }
    
    // --- Distant Terrain Generation ---
    const distantTerrainGroup = new THREE.Group();
    const terrainColors = [
        grassMat, 
        rockMat,
        new THREE.MeshLambertMaterial({ color: 0x287a4b }), // Darker green
        new THREE.MeshLambertMaterial({ color: 0x707070 })  // Darker rock
    ];

    for (let i = 0; i < 150; i++) {
        const z = -50 - (Math.random() * 150); // Position from z=-50 to z=-200
        const isFar = z < -100;

        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (15 + Math.random() * 60); // Place them wider than the immediate banks

        const w = 8 + Math.random() * (isFar ? 35 : 18);
        const d = 8 + Math.random() * (isFar ? 35 : 18);
        const h = 5 + Math.random() * (isFar ? 50 : 25);

        const y = -15 + h / 2; // Position them lower down to look like mountains rising

        const mat = terrainColors[Math.floor(Math.random() * terrainColors.length)];
        const terrainChunk = createVoxel(x, y, z, w, h, d, mat);
        distantTerrainGroup.add(terrainChunk);

        // Add a secondary smaller chunk sometimes for more natural, lumpy shapes
        if (Math.random() > 0.6) {
             const w2 = w * (0.4 + Math.random() * 0.4);
             const d2 = d * (0.4 + Math.random() * 0.4);
             const h2 = h * (0.4 + Math.random() * 0.4);
             const x2 = x + (Math.random() - 0.5) * w;
             const z2 = z + (Math.random() - 0.5) * d;
             const y2 = y + (Math.random() - 0.5) * h * 0.5;
             const secondaryChunk = createVoxel(x2, y2, z2, w2, h2, d2, mat);
             distantTerrainGroup.add(secondaryChunk);
        }
    }

    // Add higher mountain peaks to fill out the top
    for (let i = 0; i < 60; i++) {
        const z = -100 - (Math.random() * 120); // Focus on the further back area
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (25 + Math.random() * 80); // Place them wide

        const w = 15 + Math.random() * 40;
        const d = 15 + Math.random() * 40;
        const h = 40 + Math.random() * 60; // Taller chunks for peaks

        // Place these chunks higher up to form the top of the mountains
        const y = 10 + h / 2;

        const mat = terrainColors[Math.floor(Math.random() * terrainColors.length)];
        const peakChunk = createVoxel(x, y, z, w, h, d, mat);
        distantTerrainGroup.add(peakChunk);
    }
    
    // Add expansive grassy terrain on top of mountains
    for (let i = 0; i < 120; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const z = -40 - (Math.random() * 100);
        const x = side * (12 + Math.random() * 50);

        const w = 5 + Math.random() * 15;
        const d = 5 + Math.random() * 15;
        const h = 0.5 + Math.random() * 4;
        
        // Find a plausible y position by raycasting down, or just place them higher up
        const y = 15 + Math.random() * 30;

        const mat = terrainColors[Math.floor(Math.random() * 2)]; // grassMat or rockMat
        const grassChunk = createVoxel(x, y, z, w, h, d, mat);
        distantTerrainGroup.add(grassChunk);

        // Add some detail on top of this new terrain
        if (Math.random() > 0.7) {
            const detailX = x + (Math.random() - 0.5) * w;
            const detailZ = z + (Math.random() - 0.5) * d;
            if (Math.random() > 0.4) {
                distantTerrainGroup.add(createTree(detailX, y + h / 2, detailZ));
            } else {
                distantTerrainGroup.add(createBush(detailX, y + h / 2, detailZ));
            }
        }
    }

    group.add(distantTerrainGroup);

    return group;
}
// city.js - Procedural city generation

export class City {
  constructor(scene) {
    this.scene = scene;
    this.busStops = [];
    this.trafficLights = [];
    this.fuelStations = [];
    this.roadSegments = [];
    this.buildings = [];
    this._build();
  }

  _build() {
    this._buildGround();
    this._buildRoadNetwork();
    this._buildBuildings();
    this._buildParks();
    this._buildBusStops();
    this._buildTrafficLights();
    this._buildFuelStation();
    this._buildStreetLights();
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(600, 600, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoadNetwork() {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const lineMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xbbbbaa });

    // Main grid: 6 east-west roads, 6 north-south roads
    const gridSpacing = 60;
    const roadWidth = 14;
    const sidewalkW = 3;

    // North-South roads
    for (let i = -3; i <= 3; i++) {
      const x = i * gridSpacing;
      this._addRoad(roadMat, x, 0, 0, roadWidth, 400, false);
      this._addSidewalk(sidewalkMat, x - roadWidth / 2 - sidewalkW / 2, 0, 0, sidewalkW, 400, false);
      this._addSidewalk(sidewalkMat, x + roadWidth / 2 + sidewalkW / 2, 0, 0, sidewalkW, 400, false);
      // Center line
      for (let z = -195; z < 195; z += 12) {
        this._addCenterLine(lineMat, x, z, 0, false);
      }
      this.roadSegments.push({ x1: x - roadWidth / 2, x2: x + roadWidth / 2, z1: -200, z2: 200, axis: 'ns', cx: x });
    }

    // East-West roads
    for (let i = -3; i <= 3; i++) {
      const z = i * gridSpacing;
      this._addRoad(roadMat, 0, 0, z, roadWidth, 400, true);
      this._addSidewalk(sidewalkMat, 0, 0, z - roadWidth / 2 - sidewalkW / 2, 400, sidewalkW, true);
      this._addSidewalk(sidewalkMat, 0, 0, z + roadWidth / 2 + sidewalkW / 2, 400, sidewalkW, true);
      for (let x = -195; x < 195; x += 12) {
        this._addCenterLine(lineMat, x, z, 0, true);
      }
      this.roadSegments.push({ x1: -200, x2: 200, z1: z - roadWidth / 2, z2: z + roadWidth / 2, axis: 'ew', cz: z });
    }

    // Intersections - slightly lighter asphalt
    const intMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const geo = new THREE.PlaneGeometry(roadWidth + 1, roadWidth + 1);
        const m = new THREE.Mesh(geo, intMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(i * gridSpacing, 0.02, j * gridSpacing);
        this.scene.add(m);
      }
    }
  }

  _addRoad(mat, cx, cy, cz, width, length, isEW) {
    const geo = new THREE.PlaneGeometry(isEW ? length : width, isEW ? width : length);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.01, cz);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  _addSidewalk(mat, cx, cy, cz, w, l, isEW) {
    const geo = new THREE.PlaneGeometry(isEW ? l : w, isEW ? w : l);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.015, cz);
    this.scene.add(mesh);
  }

  _addCenterLine(mat, x, z, y, isEW) {
    const geo = new THREE.PlaneGeometry(isEW ? 6 : 0.2, isEW ? 0.2 : 6);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.025, z);
    this.scene.add(m);
  }

  _buildBuildings() {
    const colors = [0x8899aa, 0xaa9988, 0x889988, 0xccbbaa, 0x7788aa, 0xaa8877, 0x99aacc, 0xddcc99];
    const gridSpacing = 60;
    const roadWidth = 14;
    const sidewalkW = 3;
    const blockPad = roadWidth / 2 + sidewalkW + 1;

    const rng = this._seededRng(42);

    const bData = [];
    const wData = [];

    for (let bx = -3; bx < 3; bx++) {
      for (let bz = -3; bz < 3; bz++) {
        const blockCX = bx * gridSpacing + gridSpacing / 2;
        const blockCZ = bz * gridSpacing + gridSpacing / 2;
        const blockW = gridSpacing - blockPad * 2;

        // Place 2-5 buildings per block
        const count = 2 + Math.floor(rng() * 4);
        for (let b = 0; b < count; b++) {
          const w = 6 + rng() * 14;
          const d = 6 + rng() * 14;
          const h = 4 + rng() * 40;
          const ox = (rng() - 0.5) * (blockW - w - 1);
          const oz = (rng() - 0.5) * (blockW - d - 1);

          const colHex = colors[Math.floor(rng() * colors.length)];
          const posX = blockCX + ox;
          const posY = h / 2;
          const posZ = blockCZ + oz;

          bData.push({ x: posX, y: posY, z: posZ, w, h, d, col: colHex });

          // Windows
          if (h > 8) {
            const winCols = Math.floor(w / 3);
            const winRows = Math.floor(h / 3);
            for (let wi = 0; wi < winCols; wi++) {
              for (let wj = 0; wj < winRows; wj++) {
                if (rng() > 0.35) {
                  wData.push({
                    x: posX + (wi - winCols / 2 + 0.5) * 2.2,
                    y: wj * 2.8 + 2,
                    z: posZ + d / 2 + 0.05
                  });
                }
              }
            }
          }
        }
      }
    }

    // Create Building InstancedMesh
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const bInst = new THREE.InstancedMesh(bGeo, bMat, bData.length);
    bInst.castShadow = true;
    bInst.receiveShadow = true;
    
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    bData.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(d.w, d.h, d.d);
      dummy.updateMatrix();
      bInst.setMatrixAt(i, dummy.matrix);
      color.setHex(d.col);
      bInst.setColorAt(i, color);
      this.buildings.push({ position: new THREE.Vector3(d.x, d.y, d.z) });
    });
    this.scene.add(bInst);

    // Create Window InstancedMesh
    const wGeo = new THREE.BoxGeometry(0.8, 1.0, 0.1);
    const wMat = new THREE.MeshLambertMaterial({ color: 0xffffcc, emissive: 0x111100 });
    const wInst = new THREE.InstancedMesh(wGeo, wMat, wData.length);
    wData.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wInst.setMatrixAt(i, dummy.matrix);
    });
    this.scene.add(wInst);
  }

  _buildParks() {
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });

    const parkPositions = [
      [90, 90], [-90, -90], [90, -90], [-90, 90], [0, 150], [-150, 0]
    ];
    
    const treeData = [];

    parkPositions.forEach(([x, z]) => {
      // Grass
      const pg = new THREE.PlaneGeometry(40, 40);
      const pm = new THREE.Mesh(pg, grassMat);
      pm.rotation.x = -Math.PI / 2;
      pm.position.set(x, 0.02, z);
      this.scene.add(pm);

      // Trees
      for (let i = 0; i < 8; i++) {
        const tx = x + (Math.random() - 0.5) * 34;
        const tz = z + (Math.random() - 0.5) * 34;
        treeData.push({x: tx, z: tz});
      }

      // Bench
      const benchGeo = new THREE.BoxGeometry(1.5, 0.15, 0.4);
      const benchMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
      const bench = new THREE.Mesh(benchGeo, benchMat);
      bench.position.set(x + 10, 0.5, z);
      this.scene.add(bench);
    });
    
    const tGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
    const lGeo = new THREE.SphereGeometry(2.2, 6, 5);
    const tInst = new THREE.InstancedMesh(tGeo, trunkMat, treeData.length);
    const lInst = new THREE.InstancedMesh(lGeo, leavesMat, treeData.length);
    
    const dummy = new THREE.Object3D();
    treeData.forEach((d, i) => {
      dummy.position.set(d.x, 1.5, d.z);
      dummy.updateMatrix();
      tInst.setMatrixAt(i, dummy.matrix);
      
      dummy.position.set(d.x, 4.5, d.z);
      dummy.updateMatrix();
      lInst.setMatrixAt(i, dummy.matrix);
    });
    this.scene.add(tInst);
    this.scene.add(lInst);
  }

  _buildBusStops() {
    // Place bus stops along main roads
    const stopPositions = [
      { pos: new THREE.Vector3(-60, 0, -25), rot: 0, id: 0, name: 'City Center' },
      { pos: new THREE.Vector3(0, 0, -88), rot: Math.PI / 2, id: 1, name: 'Market Square' },
      { pos: new THREE.Vector3(60, 0, -25), rot: Math.PI, id: 2, name: 'North Park' },
      { pos: new THREE.Vector3(60, 0, 35), rot: 0, id: 3, name: 'East Station' },
      { pos: new THREE.Vector3(0, 0, 92), rot: Math.PI / 2, id: 4, name: 'South Mall' },
      { pos: new THREE.Vector3(-60, 0, 35), rot: Math.PI, id: 5, name: 'West Gate' },
      { pos: new THREE.Vector3(-120, 0, -25), rot: 0, id: 6, name: 'Airport Rd' },
      { pos: new THREE.Vector3(120, 0, -25), rot: 0, id: 7, name: 'University' },
    ];

    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const roofGeo = new THREE.BoxGeometry(2.5, 0.15, 1.2);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2266cc });
    const benchGeo = new THREE.BoxGeometry(1.8, 0.12, 0.4);
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const wallGeo = new THREE.BoxGeometry(0.08, 2.0, 1.2);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.5 });

    stopPositions.forEach(stop => {
      const group = new THREE.Group();

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(0, 1.75, 0);
      group.add(pole);

      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0.6, 3.55, 0);
      group.add(roof);

      const wall1 = new THREE.Mesh(wallGeo, wallMat);
      wall1.position.set(1.3, 2.0, 0);
      group.add(wall1);
      const wall2 = new THREE.Mesh(wallGeo, wallMat);
      wall2.position.set(-0.1, 2.0, 0);
      group.add(wall2);

      const bench = new THREE.Mesh(benchGeo, benchMat);
      bench.position.set(0.6, 0.6, 0.3);
      group.add(bench);

      group.position.copy(stop.pos);
      group.rotation.y = stop.rot;
      this.scene.add(group);

      this.busStops.push({
        id: stop.id,
        name: stop.name,
        position: stop.pos.clone(),
        passengers: [],
        waitingCount: Math.floor(Math.random() * 6),
        mesh: group
      });
    });
  }

  _buildTrafficLights() {
    const intersections = [];
    const gridSpacing = 60;
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        intersections.push(new THREE.Vector3(i * gridSpacing, 0, j * gridSpacing));
      }
    }

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const boxGeo = new THREE.BoxGeometry(0.4, 1.2, 0.3);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const lightGeo = new THREE.CircleGeometry(0.12, 8);

    intersections.forEach((pos, idx) => {
      // 4 lights per intersection
      const offsets = [
        [7, 0, 0], [-7, 0, 0], [0, 0, 7], [0, 0, -7]
      ];
      const phase = (idx % 2) * Math.PI; // alternate phases

      offsets.forEach(([ox, oy, oz], li) => {
        const group = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.25;
        group.add(pole);

        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 4.8;
        group.add(box);

        const rMat = new THREE.MeshLambertMaterial({ color: 0x440000, emissive: 0x440000 });
        const yMat = new THREE.MeshLambertMaterial({ color: 0x444400, emissive: 0x444400 });
        const gMat = new THREE.MeshLambertMaterial({ color: 0x004400, emissive: 0x004400 });

        const red = new THREE.Mesh(lightGeo, rMat.clone());
        red.position.set(0, 5.2, 0.16);
        const yellow = new THREE.Mesh(lightGeo, yMat.clone());
        yellow.position.set(0, 4.8, 0.16);
        const green = new THREE.Mesh(lightGeo, gMat.clone());
        green.position.set(0, 4.4, 0.16);

        group.add(red, yellow, green);
        group.position.set(pos.x + ox, pos.y, pos.z + oz);
        if (oz !== 0) group.rotation.y = Math.PI / 2;

        this.scene.add(group);

        const isNS = li < 2;
        this.trafficLights.push({
          group, red, yellow, green,
          rMat: red.material, yMat: yellow.material, gMat: green.material,
          position: new THREE.Vector3(pos.x + ox, 0, pos.z + oz),
          phase, isNS,
          state: 'red', timer: 0
        });
      });
    });
  }

  _buildFuelStation() {
    const pos = new THREE.Vector3(25, 0, 25);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

    // Canopy
    const canopyGeo = new THREE.BoxGeometry(14, 0.3, 10);
    const canopy = new THREE.Mesh(canopyGeo, mat(0xffffff));
    canopy.position.set(pos.x, 5, pos.z);
    this.scene.add(canopy);

    // Canopy support poles
    [[pos.x - 5, 0, pos.z - 3.5], [pos.x + 5, 0, pos.z - 3.5],
     [pos.x - 5, 0, pos.z + 3.5], [pos.x + 5, 0, pos.z + 3.5]].forEach(([x, y, z]) => {
      const pg = new THREE.CylinderGeometry(0.15, 0.15, 5, 6);
      const pm = new THREE.Mesh(pg, mat(0xcccccc));
      pm.position.set(x, 2.5, z);
      this.scene.add(pm);
    });

    // Pumps
    [pos.x - 3, pos.x + 3].forEach(px => {
      const pumpGeo = new THREE.BoxGeometry(0.8, 1.8, 0.5);
      const pump = new THREE.Mesh(pumpGeo, mat(0x228B22));
      pump.position.set(px, 0.9, pos.z);
      this.scene.add(pump);
      // Screen
      const scrGeo = new THREE.BoxGeometry(0.55, 0.4, 0.08);
      const scr = new THREE.Mesh(scrGeo, mat(0x000088));
      scr.position.set(px, 1.3, pos.z + 0.29);
      this.scene.add(scr);
    });

    // Station building
    const buildGeo = new THREE.BoxGeometry(8, 3.5, 5);
    const build = new THREE.Mesh(buildGeo, mat(0xffd700));
    build.position.set(pos.x + 8, 1.75, pos.z);
    this.scene.add(build);

    const signGeo = new THREE.BoxGeometry(3, 1.2, 0.2);
    const sign = new THREE.Mesh(signGeo, mat(0xff6600));
    sign.position.set(pos.x + 8, 4, pos.z);
    this.scene.add(sign);

    // Refuel area marker on ground
    const markerGeo = new THREE.PlaneGeometry(16, 12);
    const markerMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(pos.x, 0.03, pos.z);
    this.scene.add(marker);

    this.fuelStations.push({ position: pos.clone(), radius: 8 });
  }

  _buildStreetLights() {
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 6, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 4);
    const lampGeo = new THREE.SphereGeometry(0.2, 6, 4);
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffffaa, emissive: 0x222200 });

    const gridSpacing = 60;
    const lightData = [];
    
    for (let i = -3; i <= 3; i++) {
      for (let z = -180; z <= 180; z += 20) {
        const x = i * gridSpacing + 8;
        lightData.push({x, z});
      }
    }
    
    const pInst = new THREE.InstancedMesh(poleGeo, poleMat, lightData.length);
    const lInst = new THREE.InstancedMesh(lampGeo, lampMat, lightData.length);
    
    const dummy = new THREE.Object3D();
    lightData.forEach((d, i) => {
      dummy.position.set(d.x, 3, d.z);
      dummy.updateMatrix();
      pInst.setMatrixAt(i, dummy.matrix);
      
      dummy.position.set(d.x + 1, 6.5, d.z);
      dummy.updateMatrix();
      lInst.setMatrixAt(i, dummy.matrix);
    });
    
    this.scene.add(pInst);
    this.scene.add(lInst);
  }

  updateTrafficLights(dt) {
    const cycleDuration = 30; // 30s cycle
    const time = performance.now() / 1000;

    this.trafficLights.forEach(light => {
      const t = (time + light.phase) % cycleDuration;
      let newState;
      if (t < 13) newState = light.isNS ? 'green' : 'red';
      else if (t < 15) newState = 'yellow';
      else if (t < 28) newState = light.isNS ? 'red' : 'green';
      else newState = 'yellow';

      light.state = newState;
      const bright = 2.0;
      const dim = 0.08;

      light.rMat.emissiveIntensity = newState === 'red' ? bright : dim;
      light.rMat.color.setHex(newState === 'red' ? 0xff2200 : 0x220000);
      light.yMat.emissiveIntensity = newState === 'yellow' ? bright : dim;
      light.yMat.color.setHex(newState === 'yellow' ? 0xffcc00 : 0x221100);
      light.gMat.emissiveIntensity = newState === 'green' ? bright : dim;
      light.gMat.color.setHex(newState === 'green' ? 0x00ff44 : 0x002200);
    });
  }

  getNearbyFuelStation(position, radius = 12) {
    for (const fs of this.fuelStations) {
      if (fs.position.distanceTo(position) < radius) return fs;
    }
    return null;
  }

  getNearbyBusStop(position, radius = 8) {
    for (const stop of this.busStops) {
      if (stop.position.distanceTo(position) < radius) return stop;
    }
    return null;
  }

  isOnRoad(position) {
    for (const seg of this.roadSegments) {
      if (seg.axis === 'ns') {
        if (position.x >= seg.x1 && position.x <= seg.x2 &&
            position.z >= seg.z1 && position.z <= seg.z2) return true;
      } else {
        if (position.z >= seg.z1 && position.z <= seg.z2 &&
            position.x >= seg.x1 && position.x <= seg.x2) return true;
      }
    }
    return false;
  }

  _seededRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }
}

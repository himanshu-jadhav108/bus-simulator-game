// bus.js - Bus 3D model, rendering, and integration with physics

import { BusPhysics } from './physics.js';

export class Bus {
  constructor(scene) {
    this.scene = scene;
    this.physics = new BusPhysics();
    this.mesh = null;
    this.wheels = [];
    this.wheelMeshes = [];
    this.headlights = [];
    this.doorsOpen = false;
    this.lightsOn = false;
    this.hornActive = false;
    this._buildMesh();
    this.passengerCount = 0;
    this.maxPassengers = 40;
    
    // Define Seats
    this.seats = [];
    for (let r = 0; r < 10; r++) {
      const z = -2.0 + r * 0.75;
      this.seats.push({ id: r*4+0, pos: new THREE.Vector3(-0.8, 1.2, z), occupied: false });
      this.seats.push({ id: r*4+1, pos: new THREE.Vector3(-0.4, 1.2, z), occupied: false });
      this.seats.push({ id: r*4+2, pos: new THREE.Vector3(0.4, 1.2, z), occupied: false });
      this.seats.push({ id: r*4+3, pos: new THREE.Vector3(0.8, 1.2, z), occupied: false });
    }
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    const mat = (color, rough = 0.6, metal = 0.1) =>
      new THREE.MeshLambertMaterial({ color });

    // ── BODY ──────────────────────────────────────────────────────────────────
    const bodyGeo = new THREE.BoxGeometry(2.55, 2.8, 12.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat(0xf5a623)); // orange city bus
    bodyMesh.position.set(0, 2.0, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);
    this.bodyMesh = bodyMesh;

    // ── ROOF ──────────────────────────────────────────────────────────────────
    const roofGeo = new THREE.BoxGeometry(2.5, 0.15, 11.8);
    const roofMesh = new THREE.Mesh(roofGeo, mat(0xe8941f));
    roofMesh.position.set(0, 3.45, 0);
    this.mesh.add(roofMesh);

    // ── WINDSHIELD FRAME ──────────────────────────────────────────────────────
    const windGeo = new THREE.BoxGeometry(2.45, 1.6, 0.12);
    const windMesh = new THREE.Mesh(windGeo, mat(0x88aacc));
    windMesh.position.set(0, 2.5, -5.94);
    windMesh.material.transparent = true;
    windMesh.material.opacity = 0.55;
    this.mesh.add(windMesh);

    // Rear window
    const rearWin = windMesh.clone();
    rearWin.position.set(0, 2.5, 5.94);
    this.mesh.add(rearWin);

    // Side windows - left
    for (let i = -3; i <= 3; i++) {
      const wg = new THREE.BoxGeometry(0.12, 1.0, 1.4);
      const wm = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.5 }));
      wm.position.set(-1.27, 2.7, i * 1.6);
      this.mesh.add(wm);
    }
    // Side windows - right
    for (let i = -3; i <= 3; i++) {
      const wg = new THREE.BoxGeometry(0.12, 1.0, 1.4);
      const wm = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.5 }));
      wm.position.set(1.27, 2.7, i * 1.6);
      this.mesh.add(wm);
    }

    // ── BUMPERS ───────────────────────────────────────────────────────────────
    const bumperGeo = new THREE.BoxGeometry(2.6, 0.4, 0.25);
    const frontBumper = new THREE.Mesh(bumperGeo, mat(0x333333));
    frontBumper.position.set(0, 0.55, -6.1);
    this.mesh.add(frontBumper);
    const rearBumper = frontBumper.clone();
    rearBumper.position.set(0, 0.55, 6.1);
    this.mesh.add(rearBumper);

    // ── UNDERBODY ─────────────────────────────────────────────────────────────
    const underGeo = new THREE.BoxGeometry(2.5, 0.4, 11.8);
    const underMesh = new THREE.Mesh(underGeo, mat(0x222222));
    underMesh.position.set(0, 0.45, 0);
    this.mesh.add(underMesh);

    // ── HEADLIGHTS ────────────────────────────────────────────────────────────
    const headGeo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffcc });
    [-0.75, 0.75].forEach((x, i) => {
      const h = new THREE.Mesh(headGeo, headMat.clone());
      h.position.set(x, 1.8, -6.05);
      this.mesh.add(h);
      // Spotlight
      const spot = new THREE.SpotLight(0xffffff, 0, 30, 0.4, 0.5, 1.5);
      spot.position.set(x, 1.8, -6.3);
      spot.target.position.set(x * 0.3, -0.5, -14);
      this.mesh.add(spot);
      this.mesh.add(spot.target);
      this.headlights.push({ mesh: h, light: spot });
    });

    // Tail lights
    const tailGeo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2200 });
    [-0.75, 0.75].forEach(x => {
      const t = new THREE.Mesh(tailGeo, tailMat);
      t.position.set(x, 1.8, 6.05);
      this.mesh.add(t);
    });

    // ── DOOR ─────────────────────────────────────────────────────────────────
    const doorGeo = new THREE.BoxGeometry(1.1, 2.2, 0.1);
    this.doorMesh = new THREE.Mesh(doorGeo, mat(0xcc8800));
    this.doorMesh.position.set(-1.27, 1.3, -4.0);
    this.doorMesh.rotation.y = 0;
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-1.27, 1.3, -4.0);
    this.doorMesh.position.set(0.55, 0, 0);
    this.doorPivot.add(this.doorMesh);
    this.mesh.add(this.doorPivot);

    // ── WHEELS ───────────────────────────────────────────────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.28, 16);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

    const wheelPositions = [
      [-1.22, 0.52, -4.2], [1.22, 0.52, -4.2], // front axle
      [-1.22, 0.52,  3.8], [1.22, 0.52,  3.8], // rear axle
    ];

    this.wheelMeshes = wheelPositions.map(([x, y, z]) => {
      const group = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      group.add(tire);
      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.29, 8);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      group.add(rim);
      group.position.set(x, y, z);
      this.mesh.add(group);
      return group;
    });

    // ── DESTINATION BOARD ─────────────────────────────────────────────────────
    const boardGeo = new THREE.BoxGeometry(1.8, 0.45, 0.08);
    const boardMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 3.15, -6.02);
    this.mesh.add(board);

    this.scene.add(this.mesh);
  }

  setPosition(x, y, z) {
    this.physics.position.set(x, y, z);
    this.mesh.position.copy(this.physics.position);
    this.mesh.position.y += 0;
  }

  update(dt, input) {
    this.physics.update(dt, input);

    // Sync mesh with physics
    this.mesh.position.copy(this.physics.position);
    this.mesh.position.y = this.physics.suspensionOffset;
    this.mesh.rotation.y = this.physics.rotation + Math.PI;

    // Body roll
    if (this.physics.bodyRoll !== undefined) {
      this.mesh.rotation.z = -this.physics.bodyRoll * 0.4;
    }

    // Pitch from acceleration/braking
    const speedChange = this.physics.speed;
    this.mesh.rotation.x = 0;

    // Wheel rotation
    const wheelRot = (this.physics.speed / 0.52) * dt;
    this.wheelMeshes.forEach((w, i) => {
      w.children[0].rotation.x += wheelRot;
      w.children[1].rotation.x += wheelRot;
    });

    // Front wheel steering
    this.wheelMeshes[0].rotation.y = this.physics.steerAngle;
    this.wheelMeshes[1].rotation.y = this.physics.steerAngle;

    // Door animation
    const targetRot = this.doorsOpen ? -Math.PI / 2 : 0;
    this.doorPivot.rotation.y += (targetRot - this.doorPivot.rotation.y) * 0.15;

    // Lights
    this.headlights.forEach(({ mesh, light }) => {
      light.intensity = this.lightsOn ? 1.2 : 0;
    });
  }

  toggleDoors() {
    this.doorsOpen = !this.doorsOpen;
  }

  toggleLights() {
    this.lightsOn = !this.lightsOn;
  }

  getPosition() {
    return this.physics.position.clone();
  }

  getRotation() {
    return this.physics.rotation;
  }

  getSpeed() {
    return this.physics.getSpeedKmh();
  }

  isMoving() {
    return Math.abs(this.physics.speed) > 0.5;
  }

  getAvailableSeat() {
    return this.seats.find(s => !s.occupied);
  }

  freeSeat(seatId) {
    const seat = this.seats.find(s => s.id === seatId);
    if (seat) seat.occupied = false;
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

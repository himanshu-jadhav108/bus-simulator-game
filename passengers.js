// passengers.js - Passenger system

import { events, EVENTS } from './events.js';

export class PassengerSystem {
  constructor(scene, city, bus) {
    this.scene = scene;
    this.city = city;
    this.bus = bus;
    this.onboardPassengers = [];
    this.baseFare = 3.00; // base ticket price
    this.totalEarned = 0;
    this.allPassengers = []; // Track all passenger entities
    this.globalSatisfaction = 100;
    
    events.on(EVENTS.BAD_DRIVING, (data) => this._onBadDriving(data));

    this._spawnWaitingPassengers();
  }

  _onBadDriving(data) {
    if (this.getOnboardCount() > 0) {
      if (data.type === 'gforce') this.globalSatisfaction -= data.amount * 15;
      if (data.type === 'collision') this.globalSatisfaction -= 20;
      this.globalSatisfaction = Math.max(0, this.globalSatisfaction);
      events.emit(EVENTS.SATISFACTION_CHANGED, this.globalSatisfaction);
    }
  }

  _spawnWaitingPassengers() {
    this.city.busStops.forEach(stop => {
      stop.waitingPassengers = [];
      const count = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < count; i++) {
        const p = this._createPassengerMesh();
        const angle = (i / count) * Math.PI * 0.6 - 0.3;
        p.position.set(
          stop.position.x + Math.cos(angle) * 1.5,
          0,
          stop.position.z + Math.sin(angle) * 1.5
        );
        this.scene.add(p);
        
        const passEntity = {
          mesh: p,
          state: 'WAITING', // WAITING, BOARDING, SEATED, ALIGHTING
          destination: this._randomStop(stop.id),
          stop: stop,
          seat: null,
          boardDelay: i * 0.5,
          timer: 0
        };
        stop.waitingPassengers.push(passEntity);
        this.allPassengers.push(passEntity);
      }
    });
  }

  _createPassengerMesh() {
    const group = new THREE.Group();
    const colors = [0xff6644, 0x4466ff, 0x44bb44, 0xffaa22, 0xcc44cc, 0x22cccc];
    const bodyColor = colors[Math.floor(Math.random() * colors.length)];

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.9, 6);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.55;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 6, 5);
    const skinColors = [0xffcc99, 0xcc9966, 0x996644, 0xffddaa];
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: skinColors[Math.floor(Math.random() * skinColors.length)] }));
    head.position.y = 1.3;
    group.add(head);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 4);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    [-0.25, 0.25].forEach(x => {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(x, 0.7, 0);
      arm.rotation.z = x > 0 ? -0.4 : 0.4;
      group.add(arm);
    });

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 4);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x334466 });
    [-0.1, 0.1].forEach(x => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.05, 0);
      group.add(leg);
    });

    group.castShadow = false;
    return group;
  }

  _randomStop(excludeId) {
    const stops = this.city.busStops.filter(s => s.id !== excludeId);
    return stops[Math.floor(Math.random() * stops.length)];
  }

  tryBoard(busPosition, busRotation, doorsOpen, maxPassengers, currentCount) {
    // We now handle boarding fully in update(), but we return earned money here to keep main.js simple
    let earned = this._pendingEarnings || 0;
    let boarded = this._pendingBoarded || 0;
    this._pendingEarnings = 0;
    this._pendingBoarded = 0;
    return { boarded, earned };
  }

  tryAlight(busPosition, doorsOpen) {
    let alighted = this._pendingAlighted || 0;
    this._pendingAlighted = 0;
    return { alighted };
  }

  getOnboardCount() {
    return this.onboardPassengers.length;
  }

  update(dt) {
    const t = performance.now() / 1000;
    
    // Check nearest stop if doors open
    const busPos = this.bus.getPosition();
    const doorsOpen = this.bus.doorsOpen && !this.bus.isMoving();
    let currentStop = null;
    
    if (doorsOpen) {
      currentStop = this.city.getNearbyBusStop(busPos, 12);
    }

    this.allPassengers.forEach((p, i) => {
      if (p.state === 'WAITING') {
        // Idle animation
        p.mesh.rotation.y = Math.sin(t * 0.5 + i * 1.3) * 0.3;
        p.mesh.children[0].position.y = 0.55 + Math.sin(t * 1.2 + i) * 0.02;
        
        // Trigger boarding
        if (doorsOpen && currentStop && p.stop === currentStop && this.getOnboardCount() < this.bus.maxPassengers) {
          p.timer += dt;
          if (p.timer > p.boardDelay) {
            p.state = 'BOARDING';
            p.seat = this.bus.getAvailableSeat();
            if (p.seat) p.seat.occupied = true;
          }
        }
      } 
      else if (p.state === 'BOARDING') {
        // Walk to bus door (world space)
        // Bus door world position approx:
        const doorLocal = new THREE.Vector3(-1.5, 0, -4.0);
        const doorWorld = doorLocal.applyMatrix4(this.bus.mesh.matrixWorld);
        
        const toDoor = doorWorld.clone().sub(p.mesh.position);
        const dist = toDoor.length();
        
        if (dist > 0.5) {
          // Walk
          const dir = toDoor.normalize();
          p.mesh.position.addScaledVector(dir, 2.5 * dt);
          p.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          // Walk bounce
          p.mesh.children[0].position.y = 0.55 + Math.abs(Math.sin(t * 8 + i)) * 0.1;
        } else {
          // Reached door, switch to seated
          p.state = 'SEATED';
          this.scene.remove(p.mesh);
          
          if (p.seat) {
            this.bus.mesh.add(p.mesh);
            p.mesh.position.copy(p.seat.pos);
            p.mesh.rotation.y = 0; // face front of bus
            p.mesh.children[0].position.y = 0.55;
          } else {
            p.mesh.visible = false; // Standing (hidden for now)
          }
          
          this.onboardPassengers.push(p);
          // Remove from stop
          const idx = p.stop.waitingPassengers.indexOf(p);
          if (idx >= 0) p.stop.waitingPassengers.splice(idx, 1);
          
          this._pendingBoarded = (this._pendingBoarded || 0) + 1;
        }
      }
      else if (p.state === 'SEATED') {
        // Check if we reached destination
        if (doorsOpen && currentStop && p.destination.id === currentStop.id) {
          p.state = 'ALIGHTING';
          p.timer = 0;
          if (p.seat) this.bus.freeSeat(p.seat.id);
          this.bus.mesh.remove(p.mesh);
          this.scene.add(p.mesh);
          
          // Spawn at door
          const doorLocal = new THREE.Vector3(-1.5, 0, -4.0);
          p.mesh.position.copy(doorLocal.applyMatrix4(this.bus.mesh.matrixWorld));
          p.mesh.visible = true;
          
          // Remove from onboard
          const idx = this.onboardPassengers.indexOf(p);
          if (idx >= 0) this.onboardPassengers.splice(idx, 1);
          
          // Calculate dynamic fare
          const dynamicFare = this.baseFare * (this.globalSatisfaction / 100);
          this._pendingEarnings = (this._pendingEarnings || 0) + dynamicFare;
          this.totalEarned += dynamicFare;

          // Slightly regenerate satisfaction upon successful delivery
          this.globalSatisfaction = Math.min(100, this.globalSatisfaction + 5);
          events.emit(EVENTS.SATISFACTION_CHANGED, this.globalSatisfaction);

          this._pendingAlighted = (this._pendingAlighted || 0) + 1;
        }
      }
      else if (p.state === 'ALIGHTING') {
        p.timer += dt;
        // Walk away from bus
        const walkDir = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.bus.mesh.quaternion).normalize();
        p.mesh.position.addScaledVector(walkDir, 2.5 * dt);
        p.mesh.rotation.y = Math.atan2(walkDir.x, walkDir.z);
        p.mesh.children[0].position.y = 0.55 + Math.abs(Math.sin(t * 8 + i)) * 0.1;
        
        if (p.timer > 3.0) {
          p.state = 'DONE';
          this.scene.remove(p.mesh);
        }
      }
    });

    // Cleanup DONE passengers
    this.allPassengers = this.allPassengers.filter(p => p.state !== 'DONE');

    // Replenish stops slowly
    if (Math.random() < dt * 0.1) { // roughly 1 passenger every 10 seconds globally
      const stop = this.city.busStops[Math.floor(Math.random() * this.city.busStops.length)];
      if (stop.waitingPassengers.length < 8) {
        const pMesh = this._createPassengerMesh();
        pMesh.position.set(
          stop.position.x + (Math.random() - 0.5) * 2,
          0,
          stop.position.z + (Math.random() - 0.5) * 2
        );
        this.scene.add(pMesh);
        const passEntity = {
          mesh: pMesh,
          state: 'WAITING',
          destination: this._randomStop(stop.id),
          stop: stop,
          seat: null,
          boardDelay: Math.random(),
          timer: 0
        };
        stop.waitingPassengers.push(passEntity);
        this.allPassengers.push(passEntity);
      }
    }
  }
}

// traffic.js - Lightweight traffic AI system

export class TrafficSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.vehicles = [];
    this.maxVehicles = 25;
    this.pool = [];
    this._init();
  }

  _init() {
    // Pre-create vehicle pool
    for (let i = 0; i < this.maxVehicles; i++) {
      const v = this._createVehicleMesh();
      v.visible = false;
      this.scene.add(v.mesh);
      this.pool.push(v);
    }
    // Spawn initial vehicles
    for (let i = 0; i < this.maxVehicles; i++) {
      this._spawnVehicle();
    }
  }

  _createVehicleMesh() {
    const types = ['car', 'car', 'car', 'truck', 'motorcycle'];
    const type = types[Math.floor(Math.random() * types.length)];
    const group = new THREE.Group();
    const colors = [0xff4444, 0x4444ff, 0x44ff44, 0xffff44, 0xff8800, 0xffffff, 0x888888, 0xcc44cc];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshLambertMaterial({ color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    if (type === 'car') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.2), mat);
      body.position.y = 0.7;
      group.add(body);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.4), mat);
      top.position.set(0, 1.45, -0.2);
      group.add(top);
      // Wheels
      const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8);
      [[-0.9, 0.32, 1.4], [0.9, 0.32, 1.4], [-0.9, 0.32, -1.4], [0.9, 0.32, -1.4]].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wg, darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, y, z);
        group.add(w);
      });
    } else if (type === 'truck') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.8), mat);
      cab.position.set(0, 1.2, -2.0);
      group.add(cab);
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 5.0), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
      cargo.position.set(0, 1.4, 1.5);
      group.add(cargo);
      const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 8);
      [[-1.1, 0.42, 2.8], [1.1, 0.42, 2.8], [-1.1, 0.42, -0.5],
       [1.1, 0.42, -0.5], [-1.1, 0.42, -3.0], [1.1, 0.42, -3.0]].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wg, darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, y, z);
        group.add(w);
      });
    } else {
      // Motorcycle
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 2.0), mat);
      body.position.y = 0.7;
      group.add(body);
      const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 8);
      [[0, 0.3, 0.8], [0, 0.3, -0.8]].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wg, darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, y, z);
        group.add(w);
      });
    }

    group.castShadow = false;
    return {
      mesh: group, type,
      visible: true,
      speed: 0, targetSpeed: 0,
      steer: 0, rotation: 0,
      position: new THREE.Vector3(),
      route: null, routeIdx: 0,
      waitTimer: 0, active: false
    };
  }

  _getRoutes() {
    const gridSpacing = 60;
    const routes = [];
    // NS routes
    for (let i = -3; i <= 3; i++) {
      const x = i * gridSpacing;
      // Route is center of the right half (width 7) -> offset by 3.5
      routes.push({
        points: [new THREE.Vector3(x - 3.5, 0, -190), new THREE.Vector3(x - 3.5, 0, 190)],
        dir: new THREE.Vector3(0, 0, 1),
        axis: 'z'
      });
      routes.push({
        points: [new THREE.Vector3(x + 3.5, 0, 190), new THREE.Vector3(x + 3.5, 0, -190)],
        dir: new THREE.Vector3(0, 0, -1),
        axis: 'z'
      });
    }
    // EW routes
    for (let i = -3; i <= 3; i++) {
      const z = i * gridSpacing;
      routes.push({
        points: [new THREE.Vector3(-190, 0, z - 3.5), new THREE.Vector3(190, 0, z - 3.5)],
        dir: new THREE.Vector3(1, 0, 0),
        axis: 'x'
      });
      routes.push({
        points: [new THREE.Vector3(190, 0, z + 3.5), new THREE.Vector3(-190, 0, z + 3.5)],
        dir: new THREE.Vector3(-1, 0, 0),
        axis: 'x'
      });
    }
    return routes;
  }

  _spawnVehicle() {
    const v = this.pool.find(p => !p.active);
    if (!v) return;

    const routes = this._getRoutes();
    const route = routes[Math.floor(Math.random() * routes.length)];

    // Start at random point along route
    const t = Math.random();
    const startBase = route.points[0].clone().lerp(route.points[1], t);
    startBase.y = 0;

    v.route = route;
    v.routeIdx = 1;
    v.rotation = Math.atan2(route.dir.x, route.dir.z);
    
    // -1.75 is right lane, +1.75 is left lane (relative to movement direction)
    v.lane = Math.random() > 0.5 ? -1.75 : 1.75; 
    v.currentLaneOffset = v.lane;
    
    const rightVector = new THREE.Vector3(route.dir.z, 0, -route.dir.x); // perpendicular to dir
    v.position.copy(startBase).addScaledVector(rightVector, v.currentLaneOffset);

    v.speed = 0;
    v.targetSpeed = 6 + Math.random() * 8;
    v.active = true;
    v.mesh.visible = true;
    v.mesh.position.copy(v.position);
    v.mesh.rotation.y = v.rotation;
    v.waitTimer = 0;
    v.isOvertaking = false;
  }

  update(dt, busPosition, trafficLights) {
    this.vehicles = this.pool.filter(v => v.active);

    this.vehicles.forEach(v => {
      if (!v.route) return;

      const targetBase = v.route.points[v.routeIdx];
      const rightVector = new THREE.Vector3(v.route.dir.z, 0, -v.route.dir.x);
      const target = targetBase.clone().addScaledVector(rightVector, v.currentLaneOffset);
      const toTarget = target.clone().sub(v.position);
      const dist = toTarget.length();

      // Check for red lights
      let atRedLight = false;
      if (trafficLights) {
        for (const tl of trafficLights) {
          if (tl.state === 'red' || tl.state === 'yellow') {
            const toLightDist = tl.position.distanceTo(v.position);
            if (toLightDist < 12 && toLightDist > 2) {
              const toLight = tl.position.clone().sub(v.position).normalize();
              const heading = new THREE.Vector3(Math.sin(v.rotation), 0, Math.cos(v.rotation));
              if (toLight.dot(heading) > 0.6) {
                atRedLight = true;
                break;
              }
            }
          }
        }
      }

      // Collision avoidance with bus
      const toBus = busPosition.distanceTo(v.position);
      const busAhead = toBus < 18;
      let avoidBus = false;
      if (busAhead) {
        const toBusDir = busPosition.clone().sub(v.position).normalize();
        const heading = new THREE.Vector3(Math.sin(v.rotation), 0, Math.cos(v.rotation));
        if (toBusDir.dot(heading) > 0.5 && toBus < 12) avoidBus = true;
      }

      // Overtaking & Collision avoidance with other traffic
      let vehicleAhead = null;
      let minAheadDist = 20;
      
      this.vehicles.forEach(other => {
        if (other === v || !other.route) return;
        // Only check same route
        if (other.route.axis === v.route.axis && Math.sign(other.route.dir.x) === Math.sign(v.route.dir.x) && Math.sign(other.route.dir.z) === Math.sign(v.route.dir.z)) {
          const toOther = other.position.distanceTo(v.position);
          if (toOther < minAheadDist) {
            const toOtherDir = other.position.clone().sub(v.position).normalize();
            const heading = new THREE.Vector3(v.route.dir.x, 0, v.route.dir.z);
            if (toOtherDir.dot(heading) > 0.8) {
              // They are ahead
              // Check if in same lane
              if (Math.abs(v.currentLaneOffset - other.currentLaneOffset) < 1.0) {
                vehicleAhead = other;
                minAheadDist = toOther;
              }
            }
          }
        }
      });

      if (vehicleAhead) {
        if (minAheadDist < 8 && v.speed > vehicleAhead.speed) {
          v.targetSpeed = vehicleAhead.speed; // Match speed to avoid crash
        }
        
        // Try overtaking
        if (!v.isOvertaking && minAheadDist < 15) {
          const alternateLane = v.lane === 1.75 ? -1.75 : 1.75;
          // Check if alternate lane is clear
          let alternateClear = true;
          this.vehicles.forEach(other => {
            if (other === v || !other.route) return;
            if (other.route.axis === v.route.axis && Math.abs(other.currentLaneOffset - alternateLane) < 1.0) {
              if (other.position.distanceTo(v.position) < 10) alternateClear = false;
            }
          });
          
          if (alternateClear) {
            v.isOvertaking = true;
            v.lane = alternateLane;
          }
        }
      } else {
        v.isOvertaking = false;
      }

      // Smoothly transition lanes
      if (Math.abs(v.currentLaneOffset - v.lane) > 0.05) {
        v.currentLaneOffset += Math.sign(v.lane - v.currentLaneOffset) * dt * 2.0;
      } else {
        v.currentLaneOffset = v.lane;
      }

      // Speed control
      if (atRedLight || avoidBus) {
        v.targetSpeed = 0;
        v.waitTimer += dt;
      } else if (!vehicleAhead || minAheadDist >= 8) {
        v.targetSpeed = 7 + Math.random() * 0.1;
        v.waitTimer = 0;
      }

      // Accelerate / decelerate toward target speed
      const speedDiff = v.targetSpeed - v.speed;
      v.speed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), 4 * dt);
      v.speed = Math.max(0, v.speed);

      // Move toward waypoint
      if (dist > 1.5 && v.speed > 0.01) {
        const dir = toTarget.normalize();
        v.position.addScaledVector(dir, v.speed * dt);
        v.rotation = Math.atan2(dir.x, dir.z);
      } else if (dist < 3) {
        v.routeIdx++;
        if (v.routeIdx >= v.route.points.length) {
          v.active = false;
          v.mesh.visible = false;
          this._spawnVehicle();
          return;
        }
      }

      // Wheel spin
      const wheelRot = v.speed * dt / 0.32;
      v.mesh.children.forEach(child => {
        if (child.rotation.z === Math.PI / 2) {
          child.rotation.x += wheelRot;
        }
      });

      v.mesh.position.copy(v.position);
      v.mesh.rotation.y = v.rotation;

      // Cull if too far from bus
      const farFromBus = busPosition.distanceTo(v.position) > 220;
      if (farFromBus) {
        v.active = false;
        v.mesh.visible = false;
        this._spawnVehicle();
      }
    });
  }
}

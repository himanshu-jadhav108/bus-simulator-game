// main.js - Game orchestrator and main loop

import { Bus } from './bus.js';
import { City } from './city.js';
import { TrafficSystem } from './traffic.js';
import { PassengerSystem } from './passengers.js';
import { WeatherSystem } from './weather.js';
import { AudioSystem } from './audio.js';
import { Controls } from './controls.js';
import { UI } from './ui.js';
import { SaveSystem } from './save.js';
import { CameraSystem } from './camera.js';
import { events, EVENTS } from './events.js';

class Game {
  constructor() {
    this.paused = false;
    this.frameCount = 0;
    this.fps = 60;
    this.lastTime = 0;
    this.fpsTimer = 0;
    this.fpsFrames = 0;

    // Economy state
    this.money = 50;
    this.totalPassengers = 0;
    this.totalDistance = 0;
    this.stopsVisited = [];
    this.sessionTime = 0;

    // Button one-shot tracking
    this._lastDoors = false;
    this._lastLights = false;
    this._lastCamera = false;
    this._lastPause = false;
    this._lastWeather = false;

    // Near-stop tracking
    this._nearStopTimer = 0;
    this._lastNearStop = null;

    this._init();
  }

  _init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: false, // off for mobile perf
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    // Scene
    this.scene = new THREE.Scene();

    // Main Camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 600);
    this.camera.position.set(0, 10, 30);

    // Minimap Setup
    this.minimapTarget = new THREE.WebGLRenderTarget(256, 256, { format: THREE.RGBFormat });
    this.minimapCamera = new THREE.OrthographicCamera(-80, 80, 80, -80, 1, 500);
    this.minimapCamera.position.set(0, 200, 0);
    this.minimapCamera.lookAt(0, 0, 0);
    
    // HUD Scene for Minimap
    this.hudScene = new THREE.Scene();
    this.hudCamera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, -1, 1);
    
    // Circular minimap mesh
    const mmGeo = new THREE.CircleGeometry(70, 32);
    const mmMat = new THREE.MeshBasicMaterial({ 
      map: this.minimapTarget.texture, 
      depthTest: false,
      color: 0xdddddd
    });
    this.minimapMesh = new THREE.Mesh(mmGeo, mmMat);
    this.minimapMesh.position.set(window.innerWidth - 90, window.innerHeight - 90, 0);
    this.hudScene.add(this.minimapMesh);

    // Minimap border
    const borderGeo = new THREE.RingGeometry(70, 74, 32);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xffa500, depthTest: false });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.set(window.innerWidth - 90, window.innerHeight - 90, -0.1);
    this.hudScene.add(borderMesh);

    // Systems
    this.save = new SaveSystem();
    this.money = this.save.get('money') || 50;

    this.city = new City(this.scene);
    this.bus = new Bus(this.scene);
    this.bus.setPosition(0, 0.1, 0);
    this.bus.physics.fuel = this.save.get('fuel') || 100;

    this.engineLevel = this.save.get('engineLevel') || 1;
    this.brakesLevel = this.save.get('brakesLevel') || 1;
    this.bus.physics.applyUpgrades(this.engineLevel, this.brakesLevel);

    this.traffic = new TrafficSystem(this.scene, this.city);
    this.passengers = new PassengerSystem(this.scene, this.city, this.bus);
    this.weather = new WeatherSystem(this.scene, this.renderer);
    this.audio = new AudioSystem();
    this.controls = new Controls();
    this.ui = new UI();

    this.satisfaction = 100;
    events.on(EVENTS.SATISFACTION_CHANGED, val => this.satisfaction = val);

    // Garage UI bindings
    if (this.ui.elements['btn-garage']) {
      this.ui.elements['btn-garage'].addEventListener('click', () => this._openGarage());
    }
    const btnCloseGarage = document.getElementById('btn-close-garage');
    if (btnCloseGarage) btnCloseGarage.addEventListener('click', () => this._closeGarage());
    
    const btnUpgEngine = document.getElementById('btn-upgrade-engine');
    if (btnUpgEngine) {
      btnUpgEngine.addEventListener('click', () => {
        const cost = this.engineLevel * 100;
        if (this.money >= cost) {
          this.money -= cost;
          this.engineLevel++;
          this.bus.physics.applyUpgrades(this.engineLevel, this.brakesLevel);
          this._updateGarageUI();
          this.ui.showNotification('Engine Upgraded!', 'success', 2000);
        } else {
          this.ui.showNotification('Not enough money!', 'danger', 2000);
        }
      });
    }

    const btnUpgBrakes = document.getElementById('btn-upgrade-brakes');
    if (btnUpgBrakes) {
      btnUpgBrakes.addEventListener('click', () => {
        const cost = this.brakesLevel * 80;
        if (this.money >= cost) {
          this.money -= cost;
          this.brakesLevel++;
          this.bus.physics.applyUpgrades(this.engineLevel, this.brakesLevel);
          this._updateGarageUI();
          this.ui.showNotification('Brakes Upgraded!', 'success', 2000);
        } else {
          this.ui.showNotification('Not enough money!', 'danger', 2000);
        }
      });
    }

    this.sessionTime = 0;
    this.camSystem = new CameraSystem(this.camera);

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      
      this.hudCamera.right = window.innerWidth;
      this.hudCamera.top = window.innerHeight;
      this.hudCamera.updateProjectionMatrix();
      
      this.minimapMesh.position.set(window.innerWidth - 90, window.innerHeight - 90, 0);
      borderMesh.position.set(window.innerWidth - 90, window.innerHeight - 90, -0.1);
    });

    // Auto-save every 30s
    setInterval(() => this._save(), 30000);

    // Missions
    this.missionRoute = [];
    this.currentStopIndex = 0;
    
    events.on(EVENTS.DOORS_TOGGLED, (isOpen) => {
      if (isOpen && !this.bus.isMoving()) {
        const targetStop = this.missionRoute[this.currentStopIndex];
        if (targetStop) {
          const dist = this.bus.getPosition().distanceTo(targetStop.position);
          if (dist < 20) {
            this.currentStopIndex++;
            this._updateMissionUI();
            this.ui.showNotification(`Stop complete! Next stop ahead.`, 'success', 2000);
          }
        }
      }
    });

    // Start loop
    this.ui.showNotification('Welcome to City Bus Simulator! 🚌', 'info', 4000);
    this._loop(0);
    
    // Start first mission
    setTimeout(() => this._startMission(), 1000);
  }

  _startMission() {
    if (this.city.busStops.length > 0) {
      // Pick 5 random stops for a route
      this.missionRoute = [...this.city.busStops].sort(() => Math.random() - 0.5).slice(0, 5);
      this.currentStopIndex = 0;
      this._updateMissionUI();
    }
  }

  _updateMissionUI() {
    if (this.currentStopIndex < this.missionRoute.length) {
      const target = this.missionRoute[this.currentStopIndex];
      this.ui.setRouteInfo(`🚌 Route 42 — Next Stop: ${target.name} (${this.currentStopIndex + 1}/${this.missionRoute.length})`);
    } else {
      this.ui.setRouteInfo(`🚌 Route 42 — Shift Complete! Good job.`);
      const bonus = 50 * (this.satisfaction / 100);
      this.money += bonus;
      this.ui.showNotification(`Shift Complete! Bonus: $${bonus.toFixed(2)}`, 'earn', 4000);
      
      setTimeout(() => this._startMission(), 10000);
    }
  }

  _openGarage() {
    this.paused = true;
    if (this.ui.elements['garage-screen']) this.ui.elements['garage-screen'].style.display = 'flex';
    this._updateGarageUI();
  }
  
  _closeGarage() {
    this.paused = false;
    if (this.ui.elements['garage-screen']) this.ui.elements['garage-screen'].style.display = 'none';
  }

  _updateGarageUI() {
    const engineCost = this.engineLevel * 100;
    const brakesCost = this.brakesLevel * 80;
    
    if (this.ui.elements['engine-cost']) this.ui.elements['engine-cost'].textContent = `Lvl ${this.engineLevel} -> $${engineCost}`;
    if (this.ui.elements['brakes-cost']) this.ui.elements['brakes-cost'].textContent = `Lvl ${this.brakesLevel} -> $${brakesCost}`;
  }

  _save() {
    this.save.save({
      money: this.money,
      fuel: this.bus.physics.fuel,
      totalPassengers: this.totalPassengers,
      totalDistance: this.totalDistance,
      stopsVisited: this.stopsVisited,
      sessionTime: this.sessionTime,
      engineLevel: this.engineLevel,
      brakesLevel: this.brakesLevel
    });
  }

  _loop(timestamp) {
    requestAnimationFrame(t => this._loop(t));

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(rawDt, 0.05); // clamp to prevent spiral of death

    // FPS
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsTimer = 0;
      this.fpsFrames = 0;
    }

    // Always update controls to allow unpausing
    this.controls.update(dt);
    if (this.controls.pausePressed && !this._lastPause) {
      this.paused = !this.paused;
      if (!this.paused) this._closeGarage();
    }
    this._lastPause = this.controls.pausePressed;

    if (!this.paused) {
      this._update(dt);
    }

    this._updateUI();
    this._render();
  }

  _update(dt) {
    this.sessionTime += dt;

    const input = this.controls.getInput();

    // One-shot button checks
    if (this.controls.doorsPressed && !this._lastDoors) {
      this.bus.toggleDoors();
      events.emit(EVENTS.DOORS_TOGGLED, this.bus.doorsOpen);
      this.ui.showNotification(this.bus.doorsOpen ? '🚪 Doors Open' : '🚪 Doors Closed', 'info', 1500);
    }
    this._lastDoors = this.controls.doorsPressed;

    if (this.controls.lightsPressed && !this._lastLights) {
      this.bus.toggleLights();
      this.ui.showNotification(this.bus.lightsOn ? '💡 Lights On' : '💡 Lights Off', 'info', 1500);
    }
    this._lastLights = this.controls.lightsPressed;

    if (this.controls.cameraPressed && !this._lastCamera) {
      const modeName = this.camSystem.nextMode();
      this.ui.showNotification('📷 ' + modeName, 'info', 1500);
    }
    this._lastCamera = this.controls.cameraPressed;

    if (this.controls.weatherPressed && !this._lastWeather) {
      const w = this.weather.cycle();
      events.emit(EVENTS.WEATHER_CHANGED, w);
      const wNames = { sunny: '☀️ Sunny', rain: '🌧️ Rain', fog: '🌫️ Foggy', night: '🌙 Night' };
      this.ui.showNotification(wNames[w] || w, 'info', 2000);
      this.audio.setRainVolume(w === 'rain' ? 1 : 0);
    }
    this._lastWeather = this.controls.weatherPressed;

    // Horn
    if (this.controls.hornPressed) {
      this.audio.playHorn();
    }

    // Braking sound trigger
    if (input.brake > 0.3 && this.bus.physics.speed > 5) {
      this.audio.playBrake();
    }

    // Physics input
    const physInput = {
      throttle: input.throttle,
      reverse: input.reverse,
      brake: input.brake,
      steer: input.steer,
      handbrake: input.handbrake,
      grip: this.weather.current === 'rain' ? 0.6 : 1.0
    };

    this.bus.update(dt, physInput);

    // Audio engine update
    this.audio.updateEngine(
      this.bus.physics.rpm,
      this.bus.physics.speed,
      input.throttle
    );

    // Camera
    this.camSystem.update(dt,
      this.bus.getPosition(),
      this.bus.getRotation(),
      this.bus.getSpeed()
    );

    // Traffic
    this.traffic.update(dt, this.bus.getPosition(), this.city.trafficLights);

    // Traffic lights
    this.city.updateTrafficLights(dt);

    // Bad driving detection (Satisfaction)
    const latG = Math.abs(this.bus.physics.bodyRoll || 0);
    if (latG > 0.25 && this.bus.isMoving()) {
      if (!this._gForceCooldown || this._gForceCooldown <= 0) {
        events.emit(EVENTS.BAD_DRIVING, { type: 'gforce', amount: latG });
        this._gForceCooldown = 1.5;
        this.ui.showNotification('😠 Sharp turn!', 'danger', 1000);
      }
    }
    if (this._gForceCooldown > 0) this._gForceCooldown -= dt;

    this.traffic.vehicles.forEach(v => {
      if (v.position.distanceTo(this.bus.getPosition()) < 3.5) {
        if (!this._collisionCooldown || this._collisionCooldown <= 0) {
          events.emit(EVENTS.BAD_DRIVING, { type: 'collision', amount: 10 });
          this._collisionCooldown = 2.0;
          this.ui.showNotification('💥 Collision!', 'danger', 1500);
        }
      }
    });
    if (this._collisionCooldown > 0) this._collisionCooldown -= dt;

    // Passengers
    this.passengers.update(dt);

    // Boarding / alighting
    if (this.bus.doorsOpen && !this.bus.isMoving()) {
      const boardResult = this.passengers.tryBoard(
        this.bus.getPosition(),
        this.bus.getRotation(),
        this.bus.doorsOpen,
        this.bus.maxPassengers,
        this.passengers.getOnboardCount()
      );
      if (boardResult.boarded > 0) {
        this.money += boardResult.earned;
        this.totalPassengers += boardResult.boarded;
        events.emit(EVENTS.PASSENGER_BOARDED, boardResult);
        this.ui.showNotification(`+${boardResult.boarded} passenger${boardResult.boarded > 1 ? 's' : ''} 🧍 +$${boardResult.earned.toFixed(2)}`, 'earn', 2500);
      }

      const alightResult = this.passengers.tryAlight(this.bus.getPosition(), this.bus.doorsOpen);
      if (alightResult.alighted > 0) {
        events.emit(EVENTS.PASSENGER_ALIGHTED, alightResult);
        this.ui.showNotification(`${alightResult.alighted} passenger${alightResult.alighted > 1 ? 's' : ''} exited 👋`, 'success', 2000);
      }
    }

    // Fuel station
    const fs = this.city.getNearbyFuelStation(this.bus.getPosition());
    if (fs && this.bus.physics.fuel < 99.5) {
      const cost = 0.08 * dt * 10; // $0.08/s while refueling
      if (this.money >= cost) {
        this.bus.physics.fuel = Math.min(100, this.bus.physics.fuel + 10 * dt);
        this.money -= cost;
        this.ui.showNotification('⛽ Refueling...', 'info', 500);
      }
    }

    // Low fuel warning
    if (this.bus.physics.fuel < 15 && Math.floor(this.sessionTime * 2) % 10 === 0) {
      events.emit(EVENTS.FUEL_LOW, this.bus.physics.fuel);
      this.ui.showNotification('⚠️ Low Fuel! Head to gas station!', 'danger', 2000);
    }

    // Distance tracking
    this.totalDistance += Math.abs(this.bus.physics.speed) * dt;

    // Nearby stop indicator
    let nearestStop = null, nearestDist = 9999;
    this.city.busStops.forEach(stop => {
      const d = stop.position.distanceTo(this.bus.getPosition());
      if (d < nearestDist) { nearestDist = d; nearestStop = stop; }
    });
    if (nearestStop && nearestDist < 80) {
      if (!this._lastNearStop || this._lastNearStop.id !== nearestStop.id) {
        events.emit(EVENTS.STOP_REACHED, nearestStop);
        this._lastNearStop = nearestStop;
      }
      this.ui.showStopIndicator(nearestStop.name, nearestDist);
    } else {
      this._lastNearStop = null;
      this.ui.showStopIndicator('', 999);
    }

    // Weather update
    this.weather.update(dt, this.bus.getPosition());
  }

  _updateUI() {
    let currentStop = 'En Route';
    if (this._lastNearStop) {
      const dist = this.bus.getPosition().distanceTo(this._lastNearStop.position);
      if (dist < 10) currentStop = this._lastNearStop.name;
    }

    this.ui.update({
      speed: this.bus.getSpeed(),
      fuel: this.bus.physics.fuel,
      money: this.money,
      passengers: this.passengers.getOnboardCount(),
      currentStop: currentStop,
      fps: this.fps,
      gear: this.bus.physics.speed < -1 ? 'R' : (this.bus.physics.speed < 1 ? 'N' : 'D'),
      weather: this.weather.current,
      satisfaction: this.satisfaction,
      paused: this.paused
    });
  }

  _render() {
    // 1. Update Minimap Camera to follow bus
    const busPos = this.bus.getPosition();
    this.minimapCamera.position.set(busPos.x, 200, busPos.z);
    
    // Rotate minimap so bus always faces "up" (optional, for now fixed North is fine, just rotate camera Z to match bus)
    this.minimapCamera.rotation.z = -this.bus.getRotation();

    // 2. Render main scene to minimap target
    const oldClearColor = this.renderer.getClearColor(new THREE.Color());
    this.renderer.setClearColor(0x3a7a3a); // Ground color
    this.renderer.setRenderTarget(this.minimapTarget);
    this.renderer.render(this.scene, this.minimapCamera);
    
    // 3. Render main scene to screen
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(oldClearColor);
    this.renderer.render(this.scene, this.camera);
    
    // 4. Render HUD (Minimap overlay) on top
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.hudScene, this.hudCamera);
    this.renderer.autoClear = true;
  }
}

// Boot after DOM ready
window.addEventListener('DOMContentLoaded', () => {
  // Show loading
  const loading = document.getElementById('loading-screen');
  if (loading) {
    setTimeout(() => {
      loading.style.opacity = '0';
      setTimeout(() => loading.style.display = 'none', 600);
    }, 1800);
  }

  window._game = new Game();
});

// weather.js - Weather and day/night system

export class WeatherSystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.current = 'sunny';
    this.targetWeather = 'sunny';
    this.transitionProgress = 1;
    this.rainParticles = null;
    this.fog = null;
    this.ambientLight = null;
    this.sunLight = null;
    this.rainSound = null;
    this.onWeatherChange = null;

    this.profiles = {
      sunny: {
        ambientColor: new THREE.Color(0xffffff), ambientIntensity: 0.75,
        sunColor: new THREE.Color(0xfff5e0), sunIntensity: 1.0,
        hemiColor: new THREE.Color(0x87CEEB), hemiIntensity: 0.35,
        clearColor: new THREE.Color(0x87CEEB),
        fogColor: new THREE.Color(0x87CEEB), fogDensity: 0.0, fogNear: 150, fogFar: 400,
        rain: false
      },
      rain: {
        ambientColor: new THREE.Color(0x8899aa), ambientIntensity: 0.45,
        sunColor: new THREE.Color(0x8899bb), sunIntensity: 0.3,
        hemiColor: new THREE.Color(0x667788), hemiIntensity: 0.2,
        clearColor: new THREE.Color(0x556677),
        fogColor: new THREE.Color(0x667788), fogDensity: 0.005, fogNear: 40, fogFar: 200,
        rain: true
      },
      fog: {
        ambientColor: new THREE.Color(0xcccccc), ambientIntensity: 0.55,
        sunColor: new THREE.Color(0xcccccc), sunIntensity: 0.2,
        hemiColor: new THREE.Color(0xcccccc), hemiIntensity: 0.1,
        clearColor: new THREE.Color(0xcccccc),
        fogColor: new THREE.Color(0xcccccc), fogDensity: 0.015, fogNear: 10, fogFar: 80,
        rain: false
      },
      night: {
        ambientColor: new THREE.Color(0x223344), ambientIntensity: 0.15,
        sunColor: new THREE.Color(0x223355), sunIntensity: 0.05,
        hemiColor: new THREE.Color(0x001122), hemiIntensity: 0.05,
        clearColor: new THREE.Color(0x050a14),
        fogColor: new THREE.Color(0x050a14), fogDensity: 0.002, fogNear: 30, fogFar: 150,
        rain: false
      }
    };

    this.currentProfile = {
      ambientColor: new THREE.Color(), ambientIntensity: 0,
      sunColor: new THREE.Color(), sunIntensity: 0,
      hemiColor: new THREE.Color(), hemiIntensity: 0,
      clearColor: new THREE.Color(),
      fogColor: new THREE.Color(), fogDensity: 0, fogNear: 0, fogFar: 0
    };

    this._setupLights();
    this._setupRain();
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0); // Use FogExp2 for all and lerp density
    this.setWeather('sunny', true); // instant=true for initial setup
  }

  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.position.set(80, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 400;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.scene.add(this.sunLight);

    // Sky hemisphere
    this.hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3a7a3a, 0.3);
    this.scene.add(this.hemisphereLight);
  }

  _setupRain() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaccff, size: 0.15, transparent: true, opacity: 0.6
    });
    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
    this._rainPositions = positions;
  }

  setWeather(type, instant = false) {
    this.current = type;
    this.targetWeather = type;
    if (this.onWeatherChange) this.onWeatherChange(type);

    const p = this.profiles[type];
    this.rainParticles.visible = p.rain;

    if (instant) {
      this.currentProfile.ambientColor.copy(p.ambientColor);
      this.currentProfile.ambientIntensity = p.ambientIntensity;
      this.currentProfile.sunColor.copy(p.sunColor);
      this.currentProfile.sunIntensity = p.sunIntensity;
      this.currentProfile.hemiColor.copy(p.hemiColor);
      this.currentProfile.hemiIntensity = p.hemiIntensity;
      this.currentProfile.clearColor.copy(p.clearColor);
      this.currentProfile.fogColor.copy(p.fogColor);
      this.currentProfile.fogDensity = p.fogDensity;
      
      this._applyProfile();
    }
  }

  _applyProfile() {
    this.ambientLight.color.copy(this.currentProfile.ambientColor);
    this.ambientLight.intensity = this.currentProfile.ambientIntensity;
    this.sunLight.color.copy(this.currentProfile.sunColor);
    this.sunLight.intensity = this.currentProfile.sunIntensity;
    this.hemisphereLight.color.copy(this.currentProfile.hemiColor);
    this.hemisphereLight.intensity = this.currentProfile.hemiIntensity;
    this.renderer.setClearColor(this.currentProfile.clearColor, 1);
    
    this.scene.fog.color.copy(this.currentProfile.fogColor);
    this.scene.fog.density = this.currentProfile.fogDensity;
  }

  update(dt, busPosition) {
    // Lerp towards target weather
    const target = this.profiles[this.targetWeather];
    const speed = dt * 0.5; // 2 seconds transition

    this.currentProfile.ambientColor.lerp(target.ambientColor, speed);
    this.currentProfile.ambientIntensity += (target.ambientIntensity - this.currentProfile.ambientIntensity) * speed;
    this.currentProfile.sunColor.lerp(target.sunColor, speed);
    this.currentProfile.sunIntensity += (target.sunIntensity - this.currentProfile.sunIntensity) * speed;
    this.currentProfile.hemiColor.lerp(target.hemiColor, speed);
    this.currentProfile.hemiIntensity += (target.hemiIntensity - this.currentProfile.hemiIntensity) * speed;
    this.currentProfile.clearColor.lerp(target.clearColor, speed);
    this.currentProfile.fogColor.lerp(target.fogColor, speed);
    this.currentProfile.fogDensity += (target.fogDensity - this.currentProfile.fogDensity) * speed;

    this._applyProfile();

    // Rain particle animation
    if (this.rainParticles.visible && this._rainPositions) {
      const pos = this._rainPositions;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] -= 18 * dt; // fall speed
        pos[i * 3] += 1.5 * dt;   // wind
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3] = busPosition.x + (Math.random() - 0.5) * 120;
          pos[i * 3 + 1] = 40;
          pos[i * 3 + 2] = busPosition.z + (Math.random() - 0.5) * 120;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
      this.rainParticles.position.set(0, 0, 0);
    }
  }

  cycle() {
    const weathers = ['sunny', 'rain', 'fog', 'night'];
    const idx = weathers.indexOf(this.current);
    this.setWeather(weathers[(idx + 1) % weathers.length]);
    return this.current;
  }
}

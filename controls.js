// controls.js - Mobile touch + keyboard controls

export class Controls {
  constructor() {
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.handbrake = false;
    this.hornPressed = false;
    this.doorsPressed = false;
    this.lightsPressed = false;
    this.cameraPressed = false;
    this.pausePressed = false;
    this.weatherPressed = false;

    // Steer wheel state
    this._steerWheel = {
      active: false, startX: 0, currentX: 0, id: null
    };
    this._throttleActive = false;
    this._brakeActive = false;

    // Keyboard state
    this._keys = {};

    this._setupKeyboard();
    this._setupTouch();
  }

  _setupKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'KeyH') this.hornPressed = true;
      if (e.code === 'KeyO') this.doorsPressed = true;
      if (e.code === 'KeyL') this.lightsPressed = true;
      if (e.code === 'KeyC') this.cameraPressed = true;
      if (e.code === 'Escape') this.pausePressed = true;
      if (e.code === 'KeyW') this.weatherPressed = true;
    });
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
      if (e.code === 'KeyH') this.hornPressed = false;
      if (e.code === 'KeyO') this.doorsPressed = false;
      if (e.code === 'KeyL') this.lightsPressed = false;
      if (e.code === 'KeyC') this.cameraPressed = false;
      if (e.code === 'Escape') this.pausePressed = false;
      if (e.code === 'KeyW') this.weatherPressed = false;
    });
  }

  _setupTouch() {
    // Virtual steering wheel
    const wheel = document.getElementById('steering-wheel');
    const accelBtn = document.getElementById('btn-accel');
    const brakeBtn = document.getElementById('btn-brake');
    const hornBtn = document.getElementById('btn-horn');
    const doorsBtn = document.getElementById('btn-doors');
    const lightsBtn = document.getElementById('btn-lights');
    const cameraBtn = document.getElementById('btn-camera');
    const pauseBtn = document.getElementById('btn-pause');
    const weatherBtn = document.getElementById('btn-weather');

    if (wheel) {
      wheel.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this._steerWheel.active = true;
        this._steerWheel.startX = t.clientX;
        this._steerWheel.currentX = t.clientX;
        this._steerWheel.id = t.identifier;
      }, { passive: false });

      wheel.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let t of e.changedTouches) {
          if (t.identifier === this._steerWheel.id) {
            this._steerWheel.currentX = t.clientX;
          }
        }
      }, { passive: false });

      const endSteer = e => {
        e.preventDefault();
        for (let t of e.changedTouches) {
          if (t.identifier === this._steerWheel.id) {
            this._steerWheel.active = false;
            this._steerWheel.startX = 0;
            this._steerWheel.currentX = 0;
          }
        }
      };
      wheel.addEventListener('touchend', endSteer, { passive: false });
      wheel.addEventListener('touchcancel', endSteer, { passive: false });
    }

    // Accel / Brake
    const addPressBtn = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); onDown(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('touchcancel', e => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
      el.addEventListener('mouseleave', onUp);
    };

    addPressBtn(accelBtn,
      () => { this._throttleActive = true; },
      () => { this._throttleActive = false; }
    );
    addPressBtn(brakeBtn,
      () => { this._brakeActive = true; },
      () => { this._brakeActive = false; }
    );

    // Toggle buttons
    const addToggleBtn = (el, prop) => {
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); this[prop] = true; }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); this[prop] = false; }, { passive: false });
      el.addEventListener('mousedown', () => { this[prop] = true; });
      el.addEventListener('mouseup', () => { this[prop] = false; });
    };

    addToggleBtn(hornBtn, 'hornPressed');

    if (doorsBtn) {
      doorsBtn.addEventListener('touchstart', e => { e.preventDefault(); this.doorsPressed = true; }, { passive: false });
      doorsBtn.addEventListener('touchend', e => { e.preventDefault(); this.doorsPressed = false; }, { passive: false });
      doorsBtn.addEventListener('click', () => { this.doorsPressed = true; setTimeout(() => this.doorsPressed = false, 100); });
    }
    if (lightsBtn) {
      lightsBtn.addEventListener('click', () => { this.lightsPressed = true; setTimeout(() => this.lightsPressed = false, 100); });
    }
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => { this.cameraPressed = true; setTimeout(() => this.cameraPressed = false, 100); });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => { this.pausePressed = true; setTimeout(() => this.pausePressed = false, 100); });
    }
    if (weatherBtn) {
      weatherBtn.addEventListener('click', () => { this.weatherPressed = true; setTimeout(() => this.weatherPressed = false, 100); });
    }
  }

  update(dt) {
    // Steering
    if (this._steerWheel.active) {
      const dx = this._steerWheel.currentX - this._steerWheel.startX;
      const maxDrag = 80; // pixels for full lock
      this.steer = Math.max(-1, Math.min(1, dx / maxDrag));

      // Update visual wheel rotation
      const wheelEl = document.getElementById('steering-wheel');
      if (wheelEl) {
        wheelEl.style.transform = `rotate(${this.steer * 140}deg)`;
      }
    } else {
      // Keyboard steering
      let isSteeringKey = false;
      if (this._keys['ArrowLeft'] || this._keys['KeyA']) {
        this.steer = Math.max(-1, this.steer - 3.5 * dt);
        isSteeringKey = true;
      }
      if (this._keys['ArrowRight'] || this._keys['KeyD']) {
        this.steer = Math.min(1, this.steer + 3.5 * dt);
        isSteeringKey = true;
      }
      
      // Self-center if no steering key is pressed
      if (!isSteeringKey) {
        if (Math.abs(this.steer) > 0.01) {
          this.steer -= Math.sign(this.steer) * Math.min(Math.abs(this.steer), 4.0 * dt);
        } else {
          this.steer = 0;
        }
      }

      const wheelEl = document.getElementById('steering-wheel');
      if (wheelEl) {
        wheelEl.style.transform = `rotate(${this.steer * 140}deg)`;
      }
    }

    // Throttle
    const kbThrottle = this._keys['ArrowUp'] || this._keys['KeyW'];
    const kbReverse = this._keys['ArrowDown'] || this._keys['KeyS'];
    if (this._throttleActive || kbThrottle) {
      this.throttle = Math.min(1, this.throttle + 4 * dt);
    } else if (kbReverse) {
      this.throttle = Math.max(-1, this.throttle - 4 * dt);
    } else {
      if (Math.abs(this.throttle) > 0.01) {
        this.throttle -= Math.sign(this.throttle) * Math.min(Math.abs(this.throttle), 6.0 * dt);
      } else {
        this.throttle = 0;
      }
    }

    // Brake
    if (this._brakeActive || this._keys['Space']) {
      this.brake = Math.min(1, this.brake + 4 * dt);
    } else {
      this.brake = Math.max(0, this.brake - 6 * dt);
    }

    this.handbrake = !!this._keys['ShiftLeft'];
  }

  getInput() {
    return {
      throttle: Math.max(0, this.throttle),
      reverse: this.throttle < 0 ? Math.abs(this.throttle) : 0,
      brake: this.brake,
      steer: this.steer,
      handbrake: this.handbrake,
      throttleRaw: this.throttle
    };
  }
}

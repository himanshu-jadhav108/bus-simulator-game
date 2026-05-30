// camera.js - Three camera modes

export class CameraSystem {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0=third, 1=driver, 2=free
    this.modes = ['Third Person', 'Driver View', 'Free Camera'];

    // Third person state
    this._tpOffset = new THREE.Vector3(0, 8, 18);
    this._tpLookAt = new THREE.Vector3(0, 2, 0);
    this._currentPos = new THREE.Vector3();
    this._currentLook = new THREE.Vector3();

    // Free camera
    this._freePos = new THREE.Vector3(0, 20, 0);
    this._freeYaw = 0;
    this._freePitch = -0.3;
    this._freeDragging = false;
    this._freeDragStart = { x: 0, y: 0 };
    this._freeDragYaw = 0;
    this._freeDragPitch = 0;
    this._setupFreeCam();
  }

  _setupFreeCam() {
    const isUI = (e) => {
      if (!e.target || !e.target.closest) return false;
      return e.target.closest('#hud') !== null || e.target.closest('#pause-screen') !== null;
    };

    window.addEventListener('touchstart', e => {
      if (this.mode !== 2 || isUI(e)) return;
      const t = e.touches[0];
      this._freeDragging = true;
      this._freeDragStart = { x: t.clientX, y: t.clientY };
      this._freeDragYaw = this._freeYaw;
      this._freeDragPitch = this._freePitch;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (this.mode !== 2 || !this._freeDragging) return;
      const t = e.touches[0];
      const dx = (t.clientX - this._freeDragStart.x) * 0.005;
      const dy = (t.clientY - this._freeDragStart.y) * 0.005;
      this._freeYaw = this._freeDragYaw - dx;
      this._freePitch = Math.max(-1.4, Math.min(0.2, this._freeDragPitch - dy));
    }, { passive: true });

    window.addEventListener('touchend', () => { this._freeDragging = false; });

    // Mouse for desktop
    window.addEventListener('mousemove', e => {
      if (this.mode !== 2 || !this._freeDragging) return;
      const dx = (e.clientX - this._freeDragStart.x) * 0.005;
      const dy = (e.clientY - this._freeDragStart.y) * 0.005;
      this._freeYaw = this._freeDragYaw - dx;
      this._freePitch = Math.max(-1.4, Math.min(0.2, this._freeDragPitch - dy));
    });
    window.addEventListener('mousedown', e => {
      if (this.mode !== 2 || isUI(e)) return;
      this._freeDragging = true;
      this._freeDragStart = { x: e.clientX, y: e.clientY };
      this._freeDragYaw = this._freeYaw;
      this._freeDragPitch = this._freePitch;
    });
    window.addEventListener('mouseup', () => { this._freeDragging = false; });
  }

  nextMode() {
    this.mode = (this.mode + 1) % 3;
    return this.modes[this.mode];
  }

  getModeName() {
    return this.modes[this.mode];
  }

  update(dt, busPosition, busRotation, busSpeed) {
    const lerpSpeed = Math.min(dt * 7, 1);

    switch (this.mode) {
      case 0: // Third Person
        this._updateThirdPerson(dt, busPosition, busRotation, lerpSpeed);
        break;
      case 1: // Driver View
        this._updateDriverView(busPosition, busRotation);
        break;
      case 2: // Free Camera
        this._updateFreeCamera(dt, busPosition, busRotation);
        break;
    }
  }

  _updateThirdPerson(dt, busPos, busRot, lerpSpeed) {
    // Camera follows behind and above bus
    const dist = 18;
    const height = 7;
    const lag = 0.85; // rotational lag for cinematic feel

    const targetX = busPos.x - Math.sin(busRot) * dist;
    const targetY = busPos.y + height;
    const targetZ = busPos.z - Math.cos(busRot) * dist;

    if (!this._currentPos.length()) {
      this._currentPos.set(targetX, targetY, targetZ);
    }

    this._currentPos.x += (targetX - this._currentPos.x) * lerpSpeed;
    this._currentPos.y += (targetY - this._currentPos.y) * lerpSpeed * 0.6;
    this._currentPos.z += (targetZ - this._currentPos.z) * lerpSpeed;

    const lookTarget = new THREE.Vector3(
      busPos.x + Math.sin(busRot) * 4,
      busPos.y + 2.5,
      busPos.z + Math.cos(busRot) * 4
    );
    this._currentLook.lerp(lookTarget, lerpSpeed * 0.8);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLook);
  }

  _updateDriverView(busPos, busRot) {
    // Inside cab perspective
    const camHeight = 3.2;
    const camForward = 5.2;
    const camX = busPos.x + Math.sin(busRot) * camForward;
    const camY = busPos.y + camHeight;
    const camZ = busPos.z + Math.cos(busRot) * camForward;

    this.camera.position.set(camX, camY, camZ);

    const lookX = busPos.x + Math.sin(busRot) * 25;
    const lookY = busPos.y + 1.8;
    const lookZ = busPos.z + Math.cos(busRot) * 25;
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  _updateFreeCamera(dt, busPos, busRot) {
    // Orbit freely around the bus
    if (!this._freePosSet) {
      this._freeYaw = (busRot !== undefined ? busRot : 0) + Math.PI;
      this._freePitch = -0.4;
      this._freeDistance = 35;
      this._freePosSet = true;
    }

    const camX = busPos.x + Math.sin(this._freeYaw) * Math.cos(this._freePitch) * this._freeDistance;
    const camY = busPos.y - Math.sin(this._freePitch) * this._freeDistance;
    const camZ = busPos.z + Math.cos(this._freeYaw) * Math.cos(this._freePitch) * this._freeDistance;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(busPos.x, busPos.y + 2, busPos.z);
  }
}

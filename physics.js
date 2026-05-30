// physics.js - Bus physics simulation

export class BusPhysics {
  constructor() {
    // Vehicle specs
    this.mass = 12000; // kg - city bus
    this.wheelbase = 6.0; // meters
    this.trackWidth = 2.4;
    this.centerOfMass = new THREE.Vector3(0, 1.2, 0);

    // State
    this.velocity = new THREE.Vector3();
    this.angularVelocity = 0;
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = 0; // yaw in radians
    this.speed = 0; // m/s
    this.rpm = 800;
    this.gear = 1;
    this.fuel = 100;
    this.isEngineOn = true;
    this.isBraking = false;
    this.isHandbrake = false;
    this.suspensionOffset = 0;
    this.suspensionVelocity = 0;
    this.steerAngle = 0;
    this.targetSteerAngle = 0;

    // Upgrades
    this.engineLevel = 1;
    this.brakesLevel = 1;
    this.topSpeedLimit = 32;

    // Engine
    this.maxRPM = 3200;
    this.idleRPM = 800;
    this.gearRatios = [0, 3.5, 2.1, 1.4, 1.0, 0.75];
    this.finalDrive = 5.1;
    this.engineTorque = 0;
    this.wheelRadius = 0.52;

    // Handling
    this.maxSteerAngle = 0.52; // radians (~30 deg)
    this.steerSpeed = 2.5;
    this.brakeForce = 0.92;
    this.engineBrake = 0.04;
    this.rollingResistance = 0.015;
    this.dragCoefficient = 0.65;
    this.fuelConsumption = 0; // L/s

    // Suspension
    this.suspStiffness = 28000;
    this.suspDamping = 4200;
    this.suspRestLength = 0.45;
    this.suspTravel = 0.18;
  }

  applyUpgrades(engineLevel, brakesLevel) {
    this.engineLevel = engineLevel;
    this.brakesLevel = brakesLevel;
    this.topSpeedLimit = 32 + (engineLevel - 1) * 5; // Increases top speed
    this.brakeForce = 0.92 + (brakesLevel - 1) * 0.25; // Increases braking power
  }

  getTorqueCurve(rpm) {
    // Diesel torque curve - peak around 1400 rpm
    const normalized = rpm / this.maxRPM;
    if (normalized < 0.1) return 0.3;
    if (normalized < 0.45) return 0.6 + normalized * 0.9;
    if (normalized < 0.6)  return 1.0;
    if (normalized < 0.85) return 1.0 - (normalized - 0.6) * 0.8;
    return 0.2;
  }

  update(dt, input) {
    if (!this.isEngineOn) return;

    const { throttle, reverse, brake, steer, handbrake, grip = 1.0 } = input;

    let effThrottle = throttle || 0;
    let effReverse = reverse || 0;
    let effBrake = brake || 0;

    // Arcade style braking
    if (effReverse > 0 && this.speed > 0.5) {
      effBrake = Math.max(effBrake, effReverse);
      effReverse = 0;
    } else if (effThrottle > 0 && this.speed < -0.5) {
      effBrake = Math.max(effBrake, effThrottle);
      effThrottle = 0;
    }
    
    const netThrottle = effThrottle - effReverse;

    // Steering with speed-dependent sensitivity
    const speedFactor = Math.max(0.25, 1.0 - Math.abs(this.speed) / 28);
    this.targetSteerAngle = steer * this.maxSteerAngle * speedFactor;
    const steerDiff = this.targetSteerAngle - this.steerAngle;
    this.steerAngle += Math.sign(steerDiff) * Math.min(Math.abs(steerDiff), this.steerSpeed * dt);

    // Gear shifting
    this._autoShift();

    // Engine torque
    const gearRatio = this.gearRatios[this.gear] * this.finalDrive;
    const maxEngineTorque = 1650; // Nm for diesel bus
    this.rpm = Math.max(this.idleRPM,
      Math.abs(this.speed) / (this.wheelRadius * Math.PI * 2) * 60 * gearRatio
    );
    this.rpm = Math.min(this.rpm, this.maxRPM);

    const torqueMultiplier = this.getTorqueCurve(this.rpm);
    this.engineTorque = netThrottle * maxEngineTorque * torqueMultiplier;
    const driveForce = (this.engineTorque * gearRatio) / this.wheelRadius;

    // Resistance forces
    const speedSq = this.speed * this.speed;
    const drag = this.dragCoefficient * speedSq * Math.sign(this.speed);
    const rolling = this.rollingResistance * this.mass * 9.81 * Math.sign(this.speed);
    const engineBrakeForce = Math.abs(netThrottle) < 0.05 ? this.engineBrake * this.mass * 9.81 * Math.sign(this.speed) : 0;

    // Net force
    let netForce = driveForce - drag - rolling - engineBrakeForce;

    // Braking
    this.isBraking = effBrake > 0.05;
    if (this.isBraking) {
      const brakeTorque = effBrake * this.brakeForce * this.mass * 9.81;
      netForce -= brakeTorque * Math.sign(this.speed);
    }

    // Handbrake
    this.isHandbrake = handbrake;
    if (handbrake) {
      netForce -= 0.95 * this.mass * 9.81 * Math.sign(this.speed);
    }

    // Prevent reversing past zero unless reversing throttle
    if (Math.sign(this.speed) !== Math.sign(this.speed + (netForce / this.mass) * dt) && this.speed !== 0) {
      if (Math.abs(netThrottle) < 0.05 && !this.isBraking) {
        netForce = 0;
        this.speed *= 0.7;
      }
    }

    // Acceleration
    const acceleration = netForce / this.mass;
    this.speed += acceleration * dt;
    this.speed = Math.max(-12, Math.min(this.speed, this.topSpeedLimit)); // limit top speed based on engine

    // Ackermann steering & Slip Angle
    let angVel = 0;
    if (Math.abs(this.steerAngle) > 0.001 && Math.abs(this.speed) > 0.1) {
      // Base turning radius
      let turningRadius = this.wheelbase / Math.tan(this.steerAngle);
      
      // Slip angle simulation (loss of grip at high speeds)
      const slipFactor = Math.min(1.0, (Math.abs(this.speed) / 15) * (1.5 - grip));
      turningRadius *= (1.0 + slipFactor * 1.5);
      
      angVel = this.speed / turningRadius;
      
      // Lateral weight transfer effect
      const lateralG = (this.speed * this.speed) / Math.abs(turningRadius) / 9.81;
      const bodyRoll = Math.min(lateralG * 0.08, 0.12);
      this.bodyRoll = bodyRoll * Math.sign(this.steerAngle);
    } else {
      this.bodyRoll = this.bodyRoll ? this.bodyRoll * 0.85 : 0;
    }

    this.angularVelocity += (angVel - this.angularVelocity) * Math.min(dt * 6, 1);
    this.rotation += this.angularVelocity * dt;

    // Update world position
    const moveDir = new THREE.Vector3(
      Math.sin(this.rotation) * this.speed * dt,
      0,
      Math.cos(this.rotation) * this.speed * dt
    );
    this.position.add(moveDir);

    // Suspension bounce and roll
    const targetSusp = this._calcSuspension();
    
    // Body roll dynamic compression
    const rollCompression = Math.abs(this.bodyRoll || 0) * 0.5;
    
    this.suspensionVelocity += ((targetSusp - rollCompression) - this.suspensionOffset - this.suspensionVelocity * this.suspDamping / this.suspStiffness) * dt * this.suspStiffness / this.mass;
    this.suspensionOffset += this.suspensionVelocity * dt;
    this.suspensionOffset = Math.max(-this.suspTravel, Math.min(this.suspensionOffset, this.suspTravel));

    // Fuel consumption
    const fuelRate = 0.0008 * throttle + 0.0002; // L/s at idle
    this.fuel = Math.max(0, this.fuel - fuelRate * dt);
    if (this.fuel <= 0) this.speed *= 0.98;
  }

  _autoShift() {
    const speedKmh = this.speed * 3.6;
    const shiftUp = [0, 15, 30, 50, 75, 999];
    const shiftDown = [0, 0, 10, 22, 40, 60];

    if (this.speed > 0.5) {
      if (speedKmh > shiftUp[this.gear] && this.gear < 5) this.gear++;
      if (speedKmh < shiftDown[this.gear] && this.gear > 1) this.gear--;
    } else {
      this.gear = 1;
    }
  }

  _calcSuspension() {
    // Simulate road bump effect
    return Math.sin(this.position.x * 0.3 + this.position.z * 0.2) * 0.015
         + Math.sin(this.position.x * 1.1 - this.position.z * 0.7) * 0.008;
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  refuel(amount) {
    this.fuel = Math.min(100, this.fuel + amount);
  }
}

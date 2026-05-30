// audio.js - Web Audio API sound system

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.nodes = {};
    this.enabled = true;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);
      this._createEngine();
      this._createAmbience();
    } catch (e) {
      console.warn('Audio not available', e);
      this.enabled = false;
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _createEngine() {
    if (!this.ctx) return;
    // Diesel engine - layered oscillators
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc3.type = 'triangle';

    osc1.frequency.value = 55;
    osc2.frequency.value = 110;
    osc3.frequency.value = 82;

    const gainEng = this.ctx.createGain();
    gainEng.gain.value = 0.08;

    // Low pass filter for diesel rumble
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    filter.Q.value = 2;

    // Distortion for diesel grittiness
    const distortion = this.ctx.createWaveShaper();
    distortion.curve = this._makeDistortionCurve(50);

    osc1.connect(gainEng);
    osc2.connect(gainEng);
    osc3.connect(gainEng);
    gainEng.connect(filter);
    filter.connect(distortion);
    distortion.connect(this.masterGain);

    osc1.start();
    osc2.start();
    osc3.start();

    this.nodes.engine = { osc1, osc2, osc3, gainEng, filter };
  }

  _createAmbience() {
    if (!this.ctx) return;
    // Ambient traffic noise using buffer noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const ambiFilter = this.ctx.createBiquadFilter();
    ambiFilter.type = 'bandpass';
    ambiFilter.frequency.value = 800;
    ambiFilter.Q.value = 0.5;

    const ambiGain = this.ctx.createGain();
    ambiGain.gain.value = 0.02;

    noise.connect(ambiFilter);
    ambiFilter.connect(ambiGain);
    ambiGain.connect(this.masterGain);
    noise.start();

    this.nodes.ambience = { noise, ambiGain };
  }

  _makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  updateEngine(rpm, speed, throttle) {
    if (!this.ctx || !this.nodes.engine) return;
    this._resume();

    const { osc1, osc2, osc3, gainEng, filter } = this.nodes.engine;
    const t = this.ctx.currentTime;

    // Map RPM to frequency
    const baseFreq = 40 + (rpm / 3200) * 120;
    osc1.frequency.setTargetAtTime(baseFreq, t, 0.1);
    osc2.frequency.setTargetAtTime(baseFreq * 2, t, 0.1);
    osc3.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.1);

    // Volume based on throttle and speed
    const vol = 0.03 + throttle * 0.12 + (Math.abs(speed) / 32) * 0.06;
    gainEng.gain.setTargetAtTime(vol, t, 0.05);

    // Filter cutoff - opens up under load
    const filterFreq = 150 + throttle * 400 + (rpm / 3200) * 200;
    filter.frequency.setTargetAtTime(filterFreq, t, 0.05);
  }

  playHorn() {
    if (!this.ctx) return;
    this._resume();
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc2.type = 'sawtooth';
    osc.frequency.value = 220;
    osc2.frequency.value = 277;
    gain.gain.value = 0.3;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(this.masterGain);

    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 1.0);
    osc2.stop(t + 1.0);
  }

  playBrake() {
    if (!this.ctx) return;
    this._resume();
    const noise = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.value = 1200;
    gain.gain.value = 0.04;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    const t = this.ctx.currentTime;
    noise.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.start(t);
    noise.stop(t + 0.35);
  }

  setRainVolume(vol) {
    if (!this.nodes.ambience) return;
    const t = this.ctx.currentTime;
    this.nodes.ambience.ambiGain.gain.setTargetAtTime(vol * 0.08, t, 0.5);
  }

  setMasterVolume(vol) {
    if (!this.ctx) return;
    this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

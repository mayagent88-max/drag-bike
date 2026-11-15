/* ============================================================================
   DRAG BIKE 3D — js/audio.mjs
   Suara mesin via WebAudio (tanpa file audio). Pitch naik mengikuti RPM.
   ============================================================================ */

export const AudioFX = {
  ctx: null, osc: null, osc2: null, gain: null, started: false,
  init() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.osc = this.ctx.createOscillator(); this.osc.type = 'sawtooth';
      this.osc2 = this.ctx.createOscillator(); this.osc2.type = 'square';
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 900;
      this.osc.connect(filt); this.osc2.connect(filt);
      filt.connect(this.gain); this.gain.connect(this.ctx.destination);
      this.osc.start(); this.osc2.start();
      this.started = true;
    } catch (e) { /* suara opsional */ }
  },
  engine(rpm, gas) {
    if (!this.started || !this.ctx) return;
    const f = 55 + (rpm / 12000) * 260;
    this.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
    this.gain.gain.setTargetAtTime(gas ? 0.05 : 0.015, this.ctx.currentTime, 0.08);
  },
  beep(freq, dur) {
    if (!this.started || !this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },
  stop() { if (this.gain) this.gain.gain.value = 0; }
};

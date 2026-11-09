// All sound is synthesised with the Web Audio API; there are no audio files.
export class Sfx {
  constructor(muted = false) {
    this.ctx = null;
    this.muted = muted;
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  get ready() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.2, delay = 0, attack = 0.005 }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.3, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1, delay = 0 }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  hop() {
    this.tone({ type: 'square', f0: 360 + Math.random() * 40, f1: 640, dur: 0.07, vol: 0.07 });
  }
  bump() {
    this.tone({ type: 'triangle', f0: 180, f1: 120, dur: 0.06, vol: 0.12 });
  }
  coin() {
    this.tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.08 });
    this.tone({ type: 'square', f0: 1319, dur: 0.16, vol: 0.08, delay: 0.07 });
  }
  horn() {
    for (const [f, d] of [[311, 0], [370, 0]]) {
      this.tone({ type: 'sawtooth', f0: f, dur: 0.18, vol: 0.06, delay: d, attack: 0.01 });
      this.tone({ type: 'sawtooth', f0: f, dur: 0.3, vol: 0.06, delay: d + 0.22, attack: 0.01 });
    }
  }
  splash() {
    this.noise({ dur: 0.55, vol: 0.5, type: 'lowpass', f0: 2500, f1: 250 });
    this.tone({ type: 'sine', f0: 500, f1: 90, dur: 0.25, vol: 0.2 });
  }
  squash() {
    this.noise({ dur: 0.2, vol: 0.45, type: 'lowpass', f0: 1200, f1: 100 });
    this.tone({ type: 'square', f0: 200, f1: 50, dur: 0.25, vol: 0.12 });
  }
  bell() {
    for (let i = 0; i < 6; i++) {
      this.tone({ type: 'triangle', f0: 1480, dur: 0.22, vol: 0.12, delay: i * 0.25 });
      this.tone({ type: 'sine', f0: 2960, dur: 0.12, vol: 0.05, delay: i * 0.25 });
    }
  }
  train() {
    this.noise({ dur: 1.2, vol: 0.35, type: 'bandpass', f0: 300, f1: 900, q: 0.7 });
    this.tone({ type: 'sawtooth', f0: 220, f1: 200, dur: 0.6, vol: 0.05 });
    this.tone({ type: 'sawtooth', f0: 277, f1: 250, dur: 0.6, vol: 0.05 });
  }
  eagle() {
    this.tone({ type: 'sawtooth', f0: 2200, f1: 900, dur: 0.45, vol: 0.08 });
    this.noise({ dur: 0.4, vol: 0.15, type: 'highpass', f0: 3000, f1: 1500 });
  }
  gameOver() {
    [523, 415, 349, 262].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.18, vol: 0.08, delay: 0.35 + i * 0.16 }));
  }
  click() {
    this.tone({ type: 'square', f0: 700, f1: 900, dur: 0.04, vol: 0.06 });
  }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.14, vol: 0.08, delay: i * 0.09 }));
  }
}

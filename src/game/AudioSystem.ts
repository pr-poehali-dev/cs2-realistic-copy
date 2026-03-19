// Web Audio API sound generator — no files needed
export class AudioSystem {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // AK-47 gunshot
  playShoot() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // White noise burst
    const bufLen = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    // Low boom
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(110, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    const gainNoise = ctx.createGain();
    gainNoise.gain.setValueAtTime(0.45, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    const gainOsc = ctx.createGain();
    gainOsc.gain.setValueAtTime(0.6, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    const gainOsc2 = ctx.createGain();
    gainOsc2.gain.setValueAtTime(0.35, now);
    gainOsc2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    // Distortion
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
    }
    dist.curve = curve;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.55, now);

    noise.connect(gainNoise);
    osc.connect(gainOsc);
    osc2.connect(gainOsc2);
    gainNoise.connect(dist);
    gainOsc.connect(dist);
    gainOsc2.connect(dist);
    dist.connect(masterGain);
    masterGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.2);
    osc.start(now);
    osc.stop(now + 0.18);
    osc2.start(now);
    osc2.stop(now + 0.12);
  }

  // Shell casing drop
  playShellDrop() {
    const ctx = this.getCtx();
    const now = ctx.currentTime + 0.12;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Reload click
  playReload() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Mag out
    this.playClick(now, 1200, 0.12, 0.06);
    // Mag in
    this.playClick(now + 1.2, 900, 0.18, 0.08);
    // Bolt
    this.playClick(now + 2.0, 600, 0.22, 0.1);
    this.playClick(now + 2.1, 1500, 0.1, 0.05);
  }

  private playClick(at: number, freq: number, vol: number, dur: number) {
    const ctx = this.getCtx();

    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / (bufLen * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, at + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);

    const gainN = ctx.createGain();
    gainN.gain.setValueAtTime(vol * 0.5, at);
    gainN.gain.exponentialRampToValueAtTime(0.001, at + dur * 0.5);

    osc.connect(gain);
    noise.connect(gainN);
    gain.connect(ctx.destination);
    gainN.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur);
    noise.start(at);
    noise.stop(at + dur);
  }

  // Footstep on sand
  playStep() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  // Hit marker — enemy hit
  playHit() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Headshot
  playHeadshot() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4000 - i * 600, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(1000, now + i * 0.03 + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.12);
    }
  }

  // Player damage — low thud
  playDamage() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Enemy distant shot
  playEnemyShot(distance: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const vol = Math.max(0.02, 0.2 - distance * 0.006);

    const bufLen = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.2));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  // Buy menu beep
  playBuy() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const freqs = [660, 880, 1100];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.12);
    });
  }

  // Empty clip
  playEmpty() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    this.playClick(now, 800, 0.08, 0.04);
  }

  destroy() {
    this.ctx?.close();
  }
}

// Web Audio API Procedural Sound Engine for Champs Manager
// Zero external assets required, instantaneous playback and 100% reliable across all browsers

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.8;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setConfig(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Referee Whistle
  public playWhistle(short: boolean = false) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const count = short ? 1 : 2;

    for (let i = 0; i < count; i++) {
      const startTime = now + i * 0.18;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2600, startTime);
      osc.frequency.exponentialRampToValueAtTime(2950, startTime + 0.08);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2850, startTime);
      osc2.frequency.exponentialRampToValueAtTime(3100, startTime + 0.08);

      // Tremolo / flutter
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(45, startTime);
      lfoGain.gain.setValueAtTime(300, startTime);
      lfo.connect(osc.frequency);
      lfo.start(startTime);
      lfo.stop(startTime + 0.14);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25 * this.volume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + 0.15);
      osc2.stop(startTime + 0.15);
    }
  }

  // Triple whistle for full-time
  public playFullTimeWhistle() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const durations = [0.15, 0.15, 0.45];
    const delays = [0, 0.22, 0.44];

    durations.forEach((dur, idx) => {
      const startTime = now + delays[idx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2800, startTime);
      osc.frequency.linearRampToValueAtTime(idx === 2 ? 2600 : 2900, startTime + dur);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.28 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
    });
  }

  // Ball Kick / Shot
  public playKick() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.4 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Heartbeat / tension thud (lub-dub)
  public playHeartbeat() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const beats = [0, 0.22];

    beats.forEach((delay) => {
      const startTime = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, startTime);
      osc.frequency.exponentialRampToValueAtTime(32, startTime + 0.16);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.45 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  // Crossbar / Post hit (metallic clack)
  public playPostHit() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(980, now);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1320, now);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  // Near miss crowd gasp: "Uhhhh!"
  public playCrowdGasp() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.6);
    filter.Q.setValueAtTime(3.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.75);
  }

  // GOOOAL! - Crowd roar and celebration blast
  public playGoal() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.playWhistle(true);

    const now = ctx.currentTime;
    const dur = 2.4;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.9;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Resonant bandpass filter that sweeps up like an explosion of joy
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(450, now + dur);
    filter.Q.setValueAtTime(2.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45 * this.volume, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.35 * this.volume, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + dur + 0.1);

    // Stadium horn fanfare
    [440, 554, 659].forEach((freq) => {
      const osc = ctx.createOscillator();
      const hornGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + 0.1);

      hornGain.gain.setValueAtTime(0, now + 0.1);
      hornGain.gain.linearRampToValueAtTime(0.08 * this.volume, now + 0.25);
      hornGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(hornGain);
      hornGain.connect(ctx.destination);

      osc.start(now + 0.1);
      osc.stop(now + 0.95);
    });
  }

  // Tactical click / button press
  public playClick() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.12 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Cash register / coin chime for financial transactions and stadium expansions
  public playCash() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const startTime = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + 0.12);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2 * this.volume, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  // Intro chime / kickoff chord for splash screen
  public playIntroChime() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const startTime = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.14 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // Fanfare / success confirmation
  public playFanfare() {
    this.playIntroChime();
  }
}

export const sound = new SoundEngine();

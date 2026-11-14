import * as THREE from 'three';

export type SpatialSoundType =
  | 'slash_light'
  | 'slash_heavy'
  | 'parry_perfect'
  | 'block_clang'
  | 'hit_flesh'
  | 'guard_break'
  | 'dash'
  | 'footstep'
  | 'checkpoint'
  | 'telegraph_normal'
  | 'telegraph_unblockable'
  | 'cross_slash'
  | 'iai_counter'
  | 'tempest_whirl'
  | 'eclipse_slam'
  | 'magic_cast'
  | 'meteor_whistle'
  | 'meteor_impact'
  | 'jump'
  | 'land'
  | 'bow_shot'
  | 'bomb_throw'
  | 'bomb_explode'
  | 'time_slow'
  | 'phase_shift';

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

const SFX_SAMPLE_URLS = {
  sword_light_1: '/assets/sfx/sword_light_1.mp3',
  sword_light_2: '/assets/sfx/sword_light_2.mp3',
  sword_light_3: '/assets/sfx/sword_light_3.mp3',
  sword_heavy_1: '/assets/sfx/sword_heavy_1.mp3',
  sword_heavy_2: '/assets/sfx/sword_heavy_2.mp3',
  sword_heavy_3: '/assets/sfx/sword_heavy_3.mp3',
  bomb_explode_1: '/assets/sfx/bomb_explode_1.mp3',
  bomb_explode_2: '/assets/sfx/bomb_explode_2.mp3',
  bomb_explode_3: '/assets/sfx/bomb_explode_3.mp3',
} as const;

type SampleKey = keyof typeof SFX_SAMPLE_URLS;

const SWORD_LIGHT_KEYS: SampleKey[] = ['sword_light_1', 'sword_light_2', 'sword_light_3'];
const SWORD_HEAVY_KEYS: SampleKey[] = ['sword_heavy_1', 'sword_heavy_2', 'sword_heavy_3'];
const BOMB_EXPLODE_KEYS: SampleKey[] = ['bomb_explode_1', 'bomb_explode_2', 'bomb_explode_3'];

export class BinauralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private windGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private rawBuffers = new Map<SampleKey, Promise<ArrayBuffer | null>>();
  private sampleBuffers = new Map<SampleKey, AudioBuffer>();
  private samplesPreloaded = false;
  private lastSamplePick: Record<string, number> = {};
  private volume = 0.85;
  private muted = false;
  private binauralEnabled = true;

  constructor() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      (Object.entries(SFX_SAMPLE_URLS) as [SampleKey, string][]).forEach(([key, url]) => {
        const p = fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .catch(() => null);
        this.rawBuffers.set(key, p);
      });
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxCompressor = this.ctx.createDynamicsCompressor();
      this.sfxCompressor.threshold.value = -10;
      this.sfxCompressor.knee.value = 12;
      this.sfxCompressor.ratio.value = 4;
      this.sfxCompressor.attack.value = 0.003;
      this.sfxCompressor.release.value = 0.14;
      this.sfxCompressor.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.95;
      this.sfxGain.connect(this.sfxCompressor);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 1.5);
      this.startAmbientWind();
      this.preloadSamples();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private preloadSamples(): void {
    if (this.samplesPreloaded || !this.ctx) return;
    this.samplesPreloaded = true;
    const targetCtx = this.ctx;

    (Object.entries(SFX_SAMPLE_URLS) as [SampleKey, string][]).forEach(([key, url]) => {
      const rawPromise =
        this.rawBuffers.get(key) ??
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .catch(() => null);

      void rawPromise
        .then((arr) => {
          if (!arr || !this.ctx || this.ctx !== targetCtx || targetCtx.state === 'closed') {
            return null;
          }
          return targetCtx.decodeAudioData(arr.slice(0));
        })
        .then((decoded) => {
          if (decoded && this.ctx === targetCtx) {
            this.sampleBuffers.set(key, decoded);
          }
        })
        .catch(() => {
          // Graceful fallback to procedural Web Audio synthesis
        });
    });
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setBinauralEnabled(enabled: boolean): void {
    this.binauralEnabled = enabled;
  }

  public getConfig() {
    return {
      volume: this.volume,
      muted: this.muted,
      binauralEnabled: this.binauralEnabled,
    };
  }

  /**
   * Syncs Web Audio AudioListener with the Three.js camera every frame for accurate 3D HRTF binaural localization.
   */
  public updateListener(camera: THREE.Camera): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;

    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(camera.position.x, now);
      listener.positionY.setValueAtTime(camera.position.y, now);
      listener.positionZ.setValueAtTime(camera.position.z, now);
      listener.forwardX.setValueAtTime(_fwd.x, now);
      listener.forwardY.setValueAtTime(_fwd.y, now);
      listener.forwardZ.setValueAtTime(_fwd.z, now);
      listener.upX.setValueAtTime(_up.x, now);
      listener.upY.setValueAtTime(_up.y, now);
      listener.upZ.setValueAtTime(_up.z, now);
    } else if (typeof listener.setPosition === 'function') {
      listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
      listener.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z);
    }
  }

  public playSpatial(type: SpatialSoundType, pos: THREE.Vector3, gainScale = 1): void {
    if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const busTarget: AudioNode = this.sfxGain ?? this.masterGain;

    // Create lightweight spatial panner node tuned for third-person camera distance (~5.5m)
    let outNode: AudioNode = busTarget;
    let panner: PannerNode | null = null;
    if (this.binauralEnabled) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5.5;
      panner.maxDistance = 48;
      panner.rolloffFactor = 0.85;
      panner.positionX.setValueAtTime(pos.x, now);
      panner.positionY.setValueAtTime(pos.y, now);
      panner.positionZ.setValueAtTime(pos.z, now);
      panner.connect(busTarget);
      outNode = panner;
    }

    let maxCleanupMs = 1350;

    switch (type) {
      case 'slash_light':
        if (
          !this.playSampleGroup(
            ctx,
            outNode,
            now,
            'sword_light',
            SWORD_LIGHT_KEYS,
            0.95 * gainScale,
            0.96,
            1.08,
          )
        ) {
          this.synthSlash(ctx, outNode, now, 780, 220, 0.14, 0.34 * gainScale);
        }
        break;
      case 'slash_heavy':
        if (
          !this.playSampleGroup(
            ctx,
            outNode,
            now,
            'sword_heavy',
            SWORD_HEAVY_KEYS,
            1.12 * gainScale,
            0.88,
            0.98,
          )
        ) {
          this.synthSlash(ctx, outNode, now, 520, 130, 0.24, 0.45 * gainScale);
        }
        break;
      case 'parry_perfect':
        this.synthParryPerfect(ctx, outNode, now, gainScale);
        break;
      case 'block_clang':
        this.synthBlockClang(ctx, outNode, now, gainScale);
        break;
      case 'hit_flesh':
        this.synthHitImpact(ctx, outNode, now, gainScale);
        break;
      case 'guard_break':
        this.synthGuardBreak(ctx, outNode, now, gainScale);
        break;
      case 'dash':
        this.synthSlash(ctx, outNode, now, 420, 950, 0.16, 0.18 * gainScale);
        break;
      case 'footstep':
        this.synthFootstep(ctx, outNode, now, 0.08 * gainScale);
        break;
      case 'checkpoint':
        this.synthCheckpointChime(ctx, outNode, now);
        break;
      case 'telegraph_normal':
        this.synthTelegraph(ctx, outNode, now, false);
        break;
      case 'telegraph_unblockable':
        this.synthTelegraph(ctx, outNode, now, true);
        break;
      case 'cross_slash':
        this.synthCrossSlash(ctx, outNode, now, gainScale);
        break;
      case 'iai_counter':
        this.synthIaiCounter(ctx, outNode, now, gainScale);
        break;
      case 'tempest_whirl':
        this.synthTempestWhirl(ctx, outNode, now, gainScale);
        break;
      case 'eclipse_slam':
        this.synthEclipseSlam(ctx, outNode, now, gainScale);
        break;
      case 'magic_cast':
        this.synthMagicCast(ctx, outNode, now, gainScale);
        break;
      case 'meteor_whistle':
        this.synthMeteorWhistle(ctx, outNode, now, gainScale);
        break;
      case 'meteor_impact': {
        const dur = this.playSampleGroup(
          ctx,
          outNode,
          now,
          'bomb_explode',
          BOMB_EXPLODE_KEYS,
          1.08 * gainScale,
          0.8,
          0.9,
        );
        if (!dur) {
          this.synthMeteorImpact(ctx, outNode, now, gainScale);
        } else {
          maxCleanupMs = Math.max(maxCleanupMs, Math.ceil(dur * 1000) + 350);
        }
        break;
      }
      case 'jump':
        this.synthSlash(ctx, outNode, now, 320, 820, 0.14, 0.22 * gainScale);
        break;
      case 'land':
        this.synthFootstep(ctx, outNode, now, 0.24 * gainScale);
        break;
      case 'bow_shot':
        this.synthBowShot(ctx, outNode, now, gainScale);
        break;
      case 'bomb_throw':
        if (
          !this.playSampleGroup(
            ctx,
            outNode,
            now,
            'sword_light',
            SWORD_LIGHT_KEYS,
            0.68 * gainScale,
            1.05,
            1.15,
          )
        ) {
          this.synthSlash(ctx, outNode, now, 620, 290, 0.18, 0.24 * gainScale);
        }
        break;
      case 'bomb_explode': {
        const dur = this.playSampleGroup(
          ctx,
          outNode,
          now,
          'bomb_explode',
          BOMB_EXPLODE_KEYS,
          1.22 * gainScale,
          0.92,
          1.05,
        );
        if (!dur) {
          this.synthMeteorImpact(ctx, outNode, now, 1.15 * gainScale);
        } else {
          maxCleanupMs = Math.max(maxCleanupMs, Math.ceil(dur * 1000) + 350);
        }
        break;
      }
      case 'time_slow':
        this.synthTimeSlow(ctx, outNode, now);
        break;
      case 'phase_shift':
        this.synthPhaseShift(ctx, outNode, now);
        break;
    }

    if (panner) {
      window.setTimeout(() => {
        try {
          panner?.disconnect();
        } catch {
          // Ignore already disconnected
        }
      }, maxCleanupMs);
    }
  }

  private playSampleGroup(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    groupId: string,
    keys: SampleKey[],
    vol: number,
    rateMin: number,
    rateMax: number,
  ): number {
    const prevIdx = this.lastSamplePick[groupId] ?? -1;
    let idx = Math.floor(Math.random() * keys.length);
    if (keys.length > 1 && idx === prevIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (keys.length - 1))) % keys.length;
    }
    this.lastSamplePick[groupId] = idx;

    let buffer = this.sampleBuffers.get(keys[idx]);
    if (!buffer) {
      for (const k of keys) {
        const alt = this.sampleBuffers.get(k);
        if (alt) {
          buffer = alt;
          break;
        }
      }
    }
    if (!buffer) return 0;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = rateMin + Math.random() * (rateMax - rateMin);
    src.playbackRate.setValueAtTime(rate, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.01, vol), t);

    src.connect(g);
    g.connect(out);
    src.start(t);
    return buffer.duration / rate;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startAmbientWind(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.windSource) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.045;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.windSource = src;
    this.windGain = gain;
  }

  private synthSlash(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    fStart: number,
    fEnd: number,
    dur: number,
    vol: number,
  ): void {
    if (!this.noiseBuffer) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(fStart, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(out);
    noise.start(t);
    noise.stop(t + dur + 0.02);
  }

  private synthParryPerfect(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    // High-Q crystalline katana ring with two inharmonic steel partials + bright spark burst
    const freqs = [1480, 2240, 3560];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * (1 + Math.random() * 0.02), t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.52);

      const g = ctx.createGain();
      const peak = (idx === 0 ? 0.28 : 0.16) * scale;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (idx === 0 ? 0.55 : 0.4));

      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.58);
    });

    this.synthSlash(ctx, out, t, 4200, 1200, 0.08, 0.25 * scale);
  }

  private synthBlockClang(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(490, t);
    osc.frequency.exponentialRampToValueAtTime(210, t + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private synthHitImpact(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.15);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.36 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.18);

    this.synthSlash(ctx, out, t, 1800, 380, 0.09, 0.16 * scale);
  }

  private synthGuardBreak(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const freqs = [240, 355, 690];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.45);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18 * scale, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

      osc.connect(filter);
      filter.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  private synthFootstep(ctx: AudioContext, out: AudioNode, t: number, vol: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.07);
  }

  private synthCheckpointChime(ctx: AudioContext, out: AudioNode, t: number): void {
    // Miyako-bushi pentatonic ascending notes: D5, Eb5, G5, A5
    const notes = [587.33, 622.25, 783.99, 880.0];
    notes.forEach((freq, i) => {
      const start = t + i * 0.095;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.72);

      osc.connect(g);
      g.connect(out);
      osc.start(start);
      osc.stop(start + 0.76);
    });
  }

  private synthTelegraph(ctx: AudioContext, out: AudioNode, t: number, unblockable: boolean): void {
    const osc = ctx.createOscillator();
    osc.type = unblockable ? 'sawtooth' : 'sine';
    const baseFreq = unblockable ? 880 : 1240;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(unblockable ? 1320 : 1520, t + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = unblockable ? 1400 : 1600;
    filter.Q.value = 3;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(unblockable ? 0.2 : 0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(filter);
    filter.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private synthCrossSlash(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    // Dual staggered real heavy blade swings + resonant low-mid energy slice
    const s1 = this.playSampleGroup(ctx, out, t, 'sword_heavy', SWORD_HEAVY_KEYS, 0.88 * scale, 0.9, 0.98);
    const s2 = this.playSampleGroup(ctx, out, t + 0.06, 'sword_heavy', SWORD_HEAVY_KEYS, 0.84 * scale, 1.0, 1.08);
    if (!s1 || !s2) {
      this.synthSlash(ctx, out, t, 1400, 260, 0.28, 0.34 * scale);
      this.synthSlash(ctx, out, t + 0.06, 1750, 310, 0.28, 0.32 * scale);
    }

    [190, 570].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.48, t + 0.42);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;

      const g = ctx.createGain();
      g.gain.setValueAtTime((idx === 0 ? 0.2 : 0.14) * scale, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

      osc.connect(filter);
      filter.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  private synthIaiCounter(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    if (!this.playSampleGroup(ctx, out, t, 'sword_light', SWORD_LIGHT_KEYS, 0.86 * scale, 1.08, 1.18)) {
      this.synthSlash(ctx, out, t, 2600, 420, 0.18, 0.28 * scale);
    }
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.26);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private synthTempestWhirl(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const s1 = this.playSampleGroup(ctx, out, t, 'sword_light', SWORD_LIGHT_KEYS, 0.72 * scale, 1.0, 1.1);
    const s2 = this.playSampleGroup(ctx, out, t + 0.08, 'sword_heavy', SWORD_HEAVY_KEYS, 0.82 * scale, 0.96, 1.04);
    const s3 = this.playSampleGroup(ctx, out, t + 0.16, 'sword_light', SWORD_LIGHT_KEYS, 0.76 * scale, 0.92, 1.0);
    if (!s1 || !s2 || !s3) {
      this.synthSlash(ctx, out, t, 1800, 460, 0.16, 0.26 * scale);
      this.synthSlash(ctx, out, t + 0.08, 2200, 380, 0.2, 0.28 * scale);
      this.synthSlash(ctx, out, t + 0.16, 1500, 240, 0.22, 0.25 * scale);
    }
  }

  private synthEclipseSlam(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    this.synthGuardBreak(ctx, out, t, 0.95 * scale);
    if (!this.playSampleGroup(ctx, out, t + 0.03, 'sword_heavy', SWORD_HEAVY_KEYS, 0.92 * scale, 0.82, 0.9)) {
      this.synthSlash(ctx, out, t + 0.04, 620, 95, 0.34, 0.36 * scale);
    }
  }

  private synthMagicCast(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    [440, 660, 990].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.38);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t + idx * 0.04);
      g.gain.linearRampToValueAtTime(0.14 * scale, t + idx * 0.04 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

      osc.connect(g);
      g.connect(out);
      osc.start(t + idx * 0.04);
      osc.stop(t + 0.46);
    });
  }

  private synthMeteorWhistle(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(210, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11 * scale, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 1.28);
  }

  private synthMeteorImpact(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.48);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.48);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

    osc.connect(filter);
    filter.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.55);

    this.synthSlash(ctx, out, t, 540, 80, 0.35, 0.35 * scale);
  }

  private synthBowShot(ctx: AudioContext, out: AudioNode, t: number, scale: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1420, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24 * scale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.2);

    this.synthSlash(ctx, out, t, 2800, 950, 0.1, 0.22 * scale);
  }

  private synthTimeSlow(ctx: AudioContext, out: AudioNode, t: number): void {
    // Deep chrono bass drop + crystalline cyan harmonic sweep
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(220, t);
    bass.frequency.exponentialRampToValueAtTime(48, t + 0.72);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.36, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.76);
    bass.connect(bg);
    bg.connect(out);
    bass.start(t);
    bass.stop(t + 0.78);

    [987.77, 1318.51].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.65);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t + idx * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
      osc.connect(g);
      g.connect(out);
      osc.start(t + idx * 0.05);
      osc.stop(t + 0.7);
    });
  }

  private synthPhaseShift(ctx: AudioContext, out: AudioNode, t: number): void {
    this.synthGuardBreak(ctx, out, t, 1.25);
    [293.66, 440, 587.33].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.55);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(filter);
      filter.connect(g);
      g.connect(out);
      osc.start(t + i * 0.04);
      osc.stop(t + 0.62);
    });
  }

  public dispose(): void {
    try {
      this.windSource?.stop();
      this.windSource?.disconnect();
      this.windGain?.disconnect();
      this.sfxGain?.disconnect();
      this.sfxCompressor?.disconnect();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // Ignore cleanup issues
    }
    this.sampleBuffers.clear();
    this.samplesPreloaded = false;
    this.ctx = null;
    this.windSource = null;
    this.sfxGain = null;
    this.sfxCompressor = null;
  }
}

/**
 * Motor de audio: SFX, música y buffers cargados desde /assets.
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private currentMusicMode: string | null = null;

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  async loadBuffer(name: string, arrayBuffer: ArrayBuffer) {
    this.init();
    try {
      const buffer = await this.ctx!.decodeAudioData(arrayBuffer);
      this.buffers[name] = buffer;
    } catch (e) {
      console.error(`Error decoding audio: ${name}`, e);
    }
  }

  playSFX(type: 'select' | 'hit' | 'start' | 'ko' | 'jump' | 'attack') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'select') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(40, t + 0.2);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    } else if (type === 'attack') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'start') {
      osc.type = 'square';
      [440, 554, 659].forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'square'; o.frequency.value = f;
        o.connect(g); g.connect(this.ctx!.destination);
        g.gain.setValueAtTime(0, t + i * 0.1);
        g.gain.linearRampToValueAtTime(0.1, t + i * 0.1 + 0.05);
        g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.1);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.1);
      });
    }
  }

  playBuffer(name: string) {
    if (!this.ctx) return;
    const buffer = this.buffers[name];
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.start();
  }

  playMusic(mode: 'menu' | 'fight' | 'stop') {
    if (this.currentMusicMode === mode) return;
    this.currentMusicMode = mode;

    if (!this.ctx) this.init();

    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* ignore */ }
      this.musicSource = null;
    }

    if (mode === 'stop') return;

    const buffer = this.buffers[mode];
    if (!buffer) {
      console.warn(`Buffer de música no encontrado para: ${mode}`);
      return;
    }

    this.musicSource = this.ctx!.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;

    this.musicGain = this.ctx!.createGain();
    this.musicGain.gain.value = mode === 'fight' ? 0.25 : 0.4;
    this.musicGain.connect(this.ctx!.destination);

    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }
}

export const sounds = new SoundManager();

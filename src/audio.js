// Web Audio manager. Context is created on the START GAME click (autoplay policy).
// Buses: sfx / crowd / music / voice -> master -> compressor (anti-clipping) -> speakers.
import { CONFIG as C } from './config.js';

const IDS = ['kick', 'net', 'ambience', 'cheer', 'announcer', 'celebration'];

export class AudioManager {
  constructor(assets) {
    this.assets = assets;
    this.ctx = null;
    this.buffers = {};
    this.buses = {};
    this.fired = new Set();   // duplicate-event guard
    this.active = new Set();
  }

  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const master = this.ctx.createGain(); master.gain.value = C.audio.master;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
      master.connect(comp); comp.connect(this.ctx.destination);
      this.master = master;
      for (const [name, v] of Object.entries(C.audio.bus)) {
        const g = this.ctx.createGain(); g.gain.value = v; g.connect(master); this.buses[name] = g;
      }
    }
    try { await this.ctx.resume(); } catch (_) {}
    await this._decodeAll();
  }

  async _decodeAll() {
    await Promise.all(IDS.map(async (id) => {
      if (this.buffers[id]) return;
      const raw = this.assets.get(id);
      if (!raw) return;
      try {
        this.buffers[id] = await new Promise((res, rej) => this.ctx.decodeAudioData(raw.slice(0), res, rej));
      } catch (e) {
        if (C.dev) console.warn('[audio] decode failed for', id, e);
      }
    }));
  }

  play(id, { bus = 'sfx', volume = 1, loop = false, fadeIn = 0, eventKey = null } = {}) {
    if (!this.ctx || !this.buffers[id]) return null;
    if (eventKey) { if (this.fired.has(eventKey)) return null; this.fired.add(eventKey); }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[id]; src.loop = loop;
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    if (fadeIn > 0) { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume, now + fadeIn); }
    else g.gain.value = volume;
    src.connect(g); g.connect(this.buses[bus]);
    const rec = { src, g };
    this.active.add(rec);
    src.onended = () => { this.active.delete(rec); try { g.disconnect(); } catch (_) {} };
    src.start();
    return rec;
  }

  duck(seconds = 3) {
    if (!this.ctx) return;
    const g = this.buses.crowd.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(C.audio.bus.crowd * C.audio.duckTo, t + 0.15);
    g.setValueAtTime(C.audio.bus.crowd * C.audio.duckTo, t + seconds - 0.6);
    g.linearRampToValueAtTime(C.audio.bus.crowd, t + seconds + 0.6);
  }

  startAmbience() { this.play('ambience', { bus: 'crowd', volume: C.audio.vol.ambience, loop: true, fadeIn: 1.5, eventKey: 'ambience' }); }
  kick()          { this.play('kick', { bus: 'sfx', volume: C.audio.vol.kick, eventKey: 'kick' }); }
  net()           { this.play('net', { bus: 'sfx', volume: C.audio.vol.net, eventKey: 'net' }); }
  announcer()     { if (this.play('announcer', { bus: 'voice', volume: C.audio.vol.announcer, eventKey: 'announcer' })) this.duck(3.2); }
  cheer()         { this.play('cheer', { bus: 'crowd', volume: C.audio.vol.cheer, eventKey: 'cheer' }); }
  music()         { this.play('celebration', { bus: 'music', volume: C.audio.vol.music, fadeIn: 0.4, eventKey: 'music' }); }

  stopAll() {
    for (const r of this.active) { try { r.src.stop(); } catch (_) {} }
    this.active.clear();
    this.fired.clear();
    if (this.ctx) {
      const t = this.ctx.currentTime;
      for (const [name, v] of Object.entries(C.audio.bus)) { const g = this.buses[name].gain; g.cancelScheduledValues(t); g.setValueAtTime(v, t); }
    }
  }

  suspend() { if (this.ctx) this.ctx.suspend().catch(() => {}); }
  resume()  { if (this.ctx) this.ctx.resume().catch(() => {}); }
}

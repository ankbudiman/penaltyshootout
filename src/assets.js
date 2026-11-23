// Asset manifest + tolerant loader. A missing/broken asset NEVER crashes the game:
// every consumer has a documented procedural fallback (see README-ASSETS.md).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG as C } from './config.js';

const BASE = import.meta.env.BASE_URL || './';

export const MANIFEST = [
  { id: 'kanason',     type: 'gltf',  path: 'assets/characters/kanason.glb',        fallback: 'procedural low-poly player' },
  { id: 'goalkeeper',  type: 'gltf',  path: 'assets/characters/goalkeeper.glb',     fallback: 'procedural low-poly keeper' },
  { id: 'portrait',    type: 'image', path: 'assets/images/kanason-portrait.png',   fallback: 'silhouette panel' },
  { id: 'brand-sk',    type: 'image', path: 'assets/branding/sk-sri-kelana.png',    fallback: 'text wordmark' },
  { id: 'brand-fc',    type: 'image', path: 'assets/branding/selangor-fc-school.png', fallback: 'text wordmark' },
  { id: 'announcer',   type: 'audio', path: 'assets/audio/announcer-goal.mp3',      fallback: 'silent' },
  { id: 'ambience',    type: 'audio', path: 'assets/audio/stadium-ambience.mp3',    fallback: 'silent' },
  { id: 'cheer',       type: 'audio', path: 'assets/audio/crowd-cheer.mp3',         fallback: 'silent' },
  { id: 'kick',        type: 'audio', path: 'assets/audio/kick.mp3',                fallback: 'silent' },
  { id: 'net',         type: 'audio', path: 'assets/audio/net.mp3',                 fallback: 'silent' },
  { id: 'celebration', type: 'audio', path: 'assets/audio/celebration.mp3',         fallback: 'silent' },
  { id: 'font',        type: 'font',  path: 'assets/fonts/display.woff2',           fallback: 'system condensed font' },
];

const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout loading ${label}`)), ms))]);

export class Assets {
  constructor() {
    this.present = null;     // Set of files that exist (from asset-manifest.json) or null if unknown
    this.items = {};         // id -> { ok, data }
    this.report = [];        // human-readable problems (dev only display)
  }

  url(p) { return BASE + p; }

  async init() {
    try {
      const r = await fetch(this.url('assets/asset-manifest.json'), { cache: 'no-store' });
      if (r.ok) this.present = new Set((await r.json()).files);
    } catch (_) { /* manifest unknown: try everything, tolerate failures */ }
  }

  _exists(path) { return this.present ? this.present.has(path) : true; }

  async loadAll(onProgress = () => {}) {
    let done = 0;
    const total = MANIFEST.length;
    const tick = () => onProgress(++done / total);
    await Promise.all(MANIFEST.map(async (m) => {
      try {
        if (!this._exists(m.path)) {
          this.items[m.id] = { ok: false };
          this.report.push(`MISSING  ${m.path}  -> fallback: ${m.fallback}`);
        } else {
          this.items[m.id] = { ok: true, data: await withTimeout(this._load(m), 20000, m.path) };
        }
      } catch (e) {
        this.items[m.id] = { ok: false };
        this.report.push(`FAILED   ${m.path}  (${e.message}) -> fallback: ${m.fallback}`);
      }
      tick();
    }));
    const f = this.items.font;
    if (f && f.ok) {
      const css = document.createElement('style');
      css.textContent = `@font-face{font-family:"KDisplay";src:url("${this.url(MANIFEST.find(m => m.id === 'font').path)}") format("woff2");font-display:swap}`;
      document.head.appendChild(css);
    }
    if (C.dev && this.report.length) console.warn('[assets]\n' + this.report.join('\n'));
  }

  _load(m) {
    const url = this.url(m.path);
    if (m.type === 'gltf') return new GLTFLoader().loadAsync(url);
    if (m.type === 'image') {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('image decode failed'));
        img.src = url;
      });
    }
    if (m.type === 'audio') return fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
    if (m.type === 'font') return fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
    throw new Error('unknown type');
  }

  has(id) { return !!(this.items[id] && this.items[id].ok); }
  get(id) { return this.has(id) ? this.items[id].data : null; }
}

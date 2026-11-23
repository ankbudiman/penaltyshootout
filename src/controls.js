// Input: Gamepad API + keyboard fallback. Edge-triggered shoot/pause latches (no double inputs).
// Mapping is configurable and persisted (localStorage) via the controller test panel.
import { CONFIG as C } from './config.js';

const STORE = 'kanason-penalty-input-v1';
const DEFAULT_MAP = { axisX: 0, axisY: 1, invertX: false, invertY: false, shoot: 0, pause: 9 };

export class Controls {
  constructor() {
    this.map = { ...DEFAULT_MAP, ...this._load() };
    this.keys = new Set();
    this.mods = { ctrl: false, shift: false, alt: false };
    this.shootLatch = null;
    this.pauseLatch = false;
    this.lastShootAt = 0;
    this.status = { connected: false, name: '' };
    this.aimRaw = { x: 0, y: 0 };
    this.padShootDown = false;
    this.padPauseDown = false;
    this.prevButtons = [];
    this.learn = null;
    this.onMessage = () => {};
    this._dbg = { connected: false, name: '', axes: [], buttons: [], shootPressed: false, aim: { x: 0, y: 0 }, map: this.map };
    this._bind();
  }

  _load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (_) { return {}; } }
  _save() { try { localStorage.setItem(STORE, JSON.stringify(this.map)); } catch (_) {} }
  resetMapping() { this.map = { ...DEFAULT_MAP }; this._save(); this.onMessage('Mapping reset to defaults.'); }

  _bind() {
    this._kd = (e) => {
      this.mods = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey };
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
      if (e.ctrlKey && e.shiftKey && e.altKey && code === 'KeyR') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(code);
      if (!(e.ctrlKey || e.altKey) && (code === 'Space' || code === 'Enter')) this._shoot('keyboard');
      if (code === 'Escape') this.pauseLatch = true;
    };
    this._ku = (e) => { this.mods = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey }; this.keys.delete(e.code); };
    this._blur = () => { this.keys.clear(); this.mods = { ctrl: false, shift: false, alt: false }; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', this._blur);
  }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('blur', this._blur);
  }

  _shoot(src) {
    if (this.learn) return;
    const now = performance.now();
    if (now - this.lastShootAt < C.input.debounceMs) return;
    this.lastShootAt = now;
    this.shootLatch = src;
  }

  consumeShoot() { const s = this.shootLatch; this.shootLatch = null; return s; }
  consumePause() { const p = this.pauseLatch; this.pauseLatch = false; return p; }
  flush() { this.shootLatch = null; this.pauseLatch = false; }
  isResetChord() { return this.keys.has('KeyR') && this.mods.ctrl && this.mods.shift && this.mods.alt; }

  startLearn(kind) {
    this.learn = { kind, stage: 0, base: this.prevButtons.slice() };
    this.onMessage(kind === 'button' ? 'Press the button you want to use for SHOOT...' : 'Push the stick fully RIGHT and hold...');
  }

  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let any = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (p.mapping === 'standard') return p;
      if (!any) any = p;
    }
    return any;
  }

  update() {
    const pad = this._pad();
    this.status.connected = !!pad;
    this.status.name = pad ? String(pad.id).split('(')[0].trim().slice(0, 42) : '';

    let px = 0, py = 0;
    if (pad) {
      const buttons = pad.buttons.map((b) => !!(b && b.pressed));
      // --- learn mode
      if (this.learn) this._learnStep(pad, buttons);
      // --- stick
      const ax = pad.axes[this.map.axisX] || 0, ay = pad.axes[this.map.axisY] || 0;
      px = this.map.invertX ? -ax : ax;
      py = this.map.invertY ? ay : -ay;
      if (pad.mapping === 'standard') {
        if (buttons[14]) px -= 1; if (buttons[15]) px += 1;
        if (buttons[12]) py += 1; if (buttons[13]) py -= 1;
      }
      const mag = Math.hypot(px, py), dz = C.input.deadzone;
      if (mag < dz) { px = 0; py = 0; } else { const k = Math.min(1, (mag - dz) / (1 - dz)) / mag; px *= k; py *= k; }
      // --- buttons (rising edge)
      const sh = !!buttons[this.map.shoot];
      if (sh && !this.padShootDown) this._shoot('pad');
      this.padShootDown = sh;
      const pa = !!buttons[this.map.pause];
      if (pa && !this.padPauseDown && !this.learn) this.pauseLatch = true;
      this.padPauseDown = pa;
      this.prevButtons = buttons;
      this._dbg.axes = Array.from(pad.axes);
      this._dbg.buttons = buttons;
    } else {
      this._dbg.axes = []; this._dbg.buttons = [];
      this.padShootDown = false; this.padPauseDown = false;
    }

    // keyboard vector (used when the stick is idle)
    const k = this.keys;
    const kx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const ky = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    let x = px, y = py;
    if (x === 0 && y === 0) { x = kx; y = ky; }
    const g = C.shot.stickGain;
    this.aimRaw = { x: Math.max(-1, Math.min(1, x * g)), y: Math.max(-1, Math.min(1, y * g)) };

    this._dbg.connected = this.status.connected;
    this._dbg.name = this.status.name;
    this._dbg.aim = this.aimRaw;
    this._dbg.shootPressed = this.padShootDown || k.has('Space') || k.has('Enter');
    this._dbg.map = this.map;
  }

  _learnStep(pad, buttons) {
    const L = this.learn;
    if (L.kind === 'button') {
      const i = buttons.findIndex((b, idx) => b && !L.base[idx]);
      if (i >= 0) {
        this.map.shoot = i; this._save(); this.learn = null;
        this.padShootDown = true; // do not treat the learning press as a shot
        this.onMessage(`SHOOT button set to #${i}.`);
      }
      return;
    }
    // stick learning: stage 0 = right, stage 1 = up
    let best = -1, bv = 0;
    pad.axes.forEach((v, i) => { if (L.stage === 1 && i === this.map.axisX) return; if (Math.abs(v) > Math.abs(bv)) { bv = v; best = i; } });
    if (best >= 0 && Math.abs(bv) > 0.7) {
      if (L.stage === 0) {
        this.map.axisX = best; this.map.invertX = bv < 0; L.stage = 1;
        this.onMessage('Release the stick, then push it fully UP and hold...');
        L.wait = true;
      } else if (!L.wait) {
        this.map.axisY = best; this.map.invertY = bv > 0; this._save(); this.learn = null;
        this.onMessage(`Stick set: X = axis ${this.map.axisX}, Y = axis ${best}.`);
      }
    } else if (L.wait && Math.abs(bv) < 0.3) L.wait = false;
  }

  getAim() { return this.aimRaw; }
  getDebug() { return this._dbg; }
}

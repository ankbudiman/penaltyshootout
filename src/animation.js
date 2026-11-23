// Modular animation layer. Two interchangeable actors expose the same API:
//   play(state, {loop, fade})   update(dt)   setDive(p, side)   has(state)   kickContact
// ProceduralActor drives the fallback rig; ClipActor drives a real GLB using clip-name mapping.
import * as THREE from 'three';
import { smooth, lerp } from './utils.js';
import { CONFIG as C } from './config.js';

const JOINTS = ['hips', 'spine', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'ankL', 'hipR', 'knR', 'ankR'];

function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

export class ProceduralActor {
  constructor(rig) {
    this.rig = rig; this.state = null; this.t = 0; this.blend = 1; this.fade = 0.18; this.snap = null;
    this.diveP = 0; this.diveSide = 1;
    this.kickContact = 0.33;
  }
  has() { return true; }
  _capture() {
    const s = {};
    for (const k of JOINTS) { const r = this.rig[k].rotation; s[k] = [r.x, r.y, r.z]; }
    s.hipsY = this.rig.hips.position.y;
    return s;
  }
  play(state, { fade = 0.18 } = {}) {
    if (this.state === state) return;
    this.snap = this.state ? this._capture() : null;
    this.state = state; this.t = 0; this.fade = fade; this.blend = this.snap && fade > 0 ? 0 : 1;
  }
  setDive(p, side) { this.diveP = p; this.diveSide = side; }

  update(dt) {
    this.t += dt;
    const R = this.rig;
    for (const k of JOINTS) R[k].rotation.set(0, 0, 0);
    R.hips.position.y = 0.95;
    switch (this.state) {
      case 'run': this._run(); break;
      case 'kick': this._kick(); break;
      case 'celebrate': this._celebrate(); break;
      case 'ready': this._ready(); break;
      case 'dive': this._dive(); break;
      default: this._idle();
    }
    if (this.blend < 1 && this.snap) {
      this.blend = Math.min(1, this.blend + dt / Math.max(0.001, this.fade));
      const b = smooth(this.blend);
      for (const k of JOINTS) {
        const r = R[k].rotation, s = this.snap[k];
        r.set(lerp(s[0], r.x, b), lerp(s[1], r.y, b), lerp(s[2], r.z, b));
      }
      R.hips.position.y = lerp(this.snap.hipsY, R.hips.position.y, b);
    }
  }

  _idle() {
    const R = this.rig, t = this.t, br = Math.sin(t * 1.7);
    R.hips.position.y = 0.95 + br * 0.004;
    R.spine.rotation.x = 0.03 + br * 0.012;
    R.head.rotation.set(0.02, Math.sin(t * 0.5) * 0.05, 0);
    R.shL.rotation.z = 0.1; R.shR.rotation.z = -0.1;
    R.elL.rotation.x = -0.25; R.elR.rotation.x = -0.25;
    R.hipL.rotation.set(-0.02, 0, 0.03); R.hipR.rotation.set(0.02, 0, -0.03);
    R.knL.rotation.x = 0.04; R.knR.rotation.x = 0.04;
  }

  _run() {
    const R = this.rig, ph = this.t * Math.PI * 2 * 1.8, s = Math.sin(ph), c = Math.cos(ph);
    R.hips.position.y = 0.93 + Math.abs(c) * 0.035;
    R.spine.rotation.x = 0.2; R.head.rotation.x = -0.1;
    R.hipL.rotation.x = s * 0.75; R.hipR.rotation.x = -s * 0.75;
    R.knL.rotation.x = 0.2 + 0.9 * Math.max(0, -c);
    R.knR.rotation.x = 0.2 + 0.9 * Math.max(0, c);
    R.shL.rotation.x = -s * 0.8; R.shR.rotation.x = s * 0.8;
    R.elL.rotation.x = -1.2; R.elR.rotation.x = -1.2;
    R.shL.rotation.z = 0.12; R.shR.rotation.z = -0.12;
  }

  // Right-footed penalty. Contact at ~0.33 s.
  _kick() {
    const R = this.rig, t = this.t;
    R.hipR.rotation.x = kf(t, [[0, 0.1], [0.20, 1.0], [0.33, -0.95], [0.55, -1.45], [0.85, -0.5], [1.3, 0.02]]);
    R.knR.rotation.x = kf(t, [[0, 0.1], [0.20, 1.7], [0.33, 0.25], [0.55, 0.5], [0.85, 0.5], [1.3, 0.04]]);
    R.ankR.rotation.x = kf(t, [[0, 0], [0.33, -0.5], [0.6, -0.4], [1.3, 0]]);
    R.hipL.rotation.x = kf(t, [[0, -0.1], [0.2, -0.35], [0.6, -0.3], [1.3, -0.02]]);
    R.knL.rotation.x = kf(t, [[0, 0.15], [0.2, 0.38], [0.6, 0.3], [1.3, 0.04]]);
    R.hips.position.y = kf(t, [[0, 0.94], [0.2, 0.915], [0.6, 0.92], [1.3, 0.95]]);
    R.spine.rotation.x = kf(t, [[0, 0.15], [0.2, -0.05], [0.4, 0.25], [0.8, 0.15], [1.3, 0.03]]);
    R.shL.rotation.z = kf(t, [[0, 0.12], [0.2, 0.9], [0.5, 1.0], [1.3, 0.1]]);
    R.shR.rotation.z = -kf(t, [[0, 0.12], [0.2, 0.6], [0.5, 0.8], [1.3, 0.1]]);
    R.shL.rotation.x = kf(t, [[0, 0], [0.2, -0.3], [0.45, 0.3], [1.3, 0]]);
    R.shR.rotation.x = kf(t, [[0, 0], [0.2, 0.5], [0.45, -0.4], [1.3, 0]]);
    R.elL.rotation.x = -0.5; R.elR.rotation.x = -0.5;
    R.head.rotation.x = 0.12;
  }

  _celebrate() {
    const R = this.rig, t = this.t, j = Math.max(0, Math.sin(t * 5.5));
    R.hips.position.y = 0.95 + j * 0.3;
    R.knL.rotation.x = 0.15 + j * 0.9; R.knR.rotation.x = 0.15 + j * 0.9;
    R.hipL.rotation.x = -j * 0.5; R.hipR.rotation.x = -j * 0.2;
    R.spine.rotation.x = -0.12; R.head.rotation.x = -0.18;
    R.shL.rotation.z = 2.5 + Math.sin(t * 9) * 0.25; R.shR.rotation.z = -2.5 - Math.sin(t * 9 + 1) * 0.25;
    R.elL.rotation.x = -0.3; R.elR.rotation.x = -0.3;
  }

  _ready() {
    const R = this.rig, t = this.t, sw = Math.sin(t * 2.4);
    R.hips.position.y = 0.83 + Math.abs(sw) * 0.01;
    R.spine.rotation.x = 0.28; R.head.rotation.x = -0.2;
    R.hipL.rotation.set(-0.55, 0, 0.22); R.hipR.rotation.set(-0.55, 0, -0.22);
    R.knL.rotation.x = 0.95; R.knR.rotation.x = 0.95;
    R.shL.rotation.set(-0.3, 0, 0.95); R.shR.rotation.set(-0.3, 0, -0.95);
    R.elL.rotation.x = -0.7; R.elR.rotation.x = -0.7;
  }

  _dive() {
    const R = this.rig, a = smooth(Math.min(1, this.diveP * 1.4));
    R.hips.position.y = 0.95;
    R.spine.rotation.x = lerp(0.2, 0, a);
    R.shL.rotation.set(-lerp(0.3, 0, a), 0, lerp(0.95, Math.PI - 0.12, a));
    R.shR.rotation.set(-lerp(0.3, 0, a), 0, -lerp(0.95, Math.PI - 0.12, a));
    R.hipL.rotation.set(-lerp(0.55, 0, a), 0, lerp(0.22, 0.15, a));
    R.hipR.rotation.set(-lerp(0.55, 0, a), 0, -lerp(0.22, 0.15, a));
    R.knL.rotation.x = lerp(0.95, 0.3, a); R.knR.rotation.x = lerp(0.95, 0.3, a);
  }
}

// ---------- GLB clip mapping ----------
const PATTERNS = {
  idle: /idle|stand|breath|ready|wait/i,
  run: /run|jog|sprint|walk/i,
  kick: /kick|shoot|strike|penalty|shot/i,
  celebrate: /celebr|victory|win|cheer|dance|dab|jump|happy/i,
  diveL: /(dive|save).*(left)|left.*(dive|save)/i,
  diveR: /(dive|save).*(right)|right.*(dive|save)/i,
  dive: /dive|save|jump/i,
};

export function mapClips(clips) {
  const map = {};
  for (const key of ['diveL', 'diveR', 'kick', 'celebrate', 'run', 'idle', 'dive']) {
    const hit = clips.find((c) => PATTERNS[key].test(c.name) && !Object.values(map).includes(c));
    if (hit) map[key] = hit;
  }
  if (!map.idle && clips.length) map.idle = clips[0];
  return map;
}

export class ClipActor {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clipMap = mapClips(clips);
    this.actions = {};
    for (const [k, clip] of Object.entries(this.clipMap)) this.actions[k] = this.mixer.clipAction(clip);
    this.current = null; this.state = null;
    this.kickContact = C.player.kickContact;
    if (C.dev) console.info('[anim] clips:', clips.map((c) => c.name), '-> mapped:', Object.fromEntries(Object.entries(this.clipMap).map(([k, c]) => [k, c.name])));
  }
  has(state) { return !!this.actions[state]; }
  play(state, { fade = 0.2, loop = true } = {}) {
    if (this.state === state) return;
    let next = this.actions[state];
    if (!next && state === 'ready') next = this.actions.idle;
    if (!next && (state === 'dive')) next = this.actions.dive || null;
    this.state = state;
    if (!next || next === this.current) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.play();
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    this.current = next;
  }
  setDive() {}
  update(dt) { this.mixer.update(dt); }
}

/** Used when a GLB has no animation clips: the model stays static, the game logic still works. */
export class NullActor {
  constructor() { this.state = null; this.kickContact = C.player.kickContact; }
  has() { return false; }
  play(state) { this.state = state; }
  setDive() {}
  update() {}
}

// Timeline (game-clock driven, pausable) + confetti (pooled, constant cost, runs forever without growth).
import * as THREE from 'three';
import { mulberry32 } from './utils.js';

export class Timeline {
  constructor() { this.t = 0; this.items = []; this.running = false; }
  start(items) { this.t = 0; this.items = items.map((i) => ({ ...i, done: false })); this.running = true; }
  stop() { this.running = false; this.items = []; }
  update(dt) {
    if (!this.running) return;
    this.t += dt;
    for (const it of this.items) {
      if (!it.done && this.t >= it.at) { it.done = true; try { it.fn(); } catch (e) { console.error(e); } }
    }
    if (this.items.every((i) => i.done)) this.running = false;
  }
}

const COUNT = 420;
export class Confetti {
  constructor() {
    const geo = new THREE.PlaneGeometry(0.1, 0.065);
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, m, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.rnd = mulberry32(99);
    this.p = Array.from({ length: COUNT }, () => ({ pos: new THREE.Vector3(0, -50, 0), vel: new THREE.Vector3(), rot: new THREE.Euler(), rs: new THREE.Vector3(), ph: 0, state: 0, rest: 0 }));
    const cols = [0xe2231a, 0xffcd00, 0xffffff, 0x111111, 0xffcd00, 0xe2231a];
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) { c.setHex(cols[i % cols.length]); this.mesh.setColorAt(i, c); }
    this.dummy = new THREE.Object3D();
    this.active = false; this.t = 0;
    this.reset();
  }

  reset() {
    this.active = false;
    for (const q of this.p) { q.state = 0; q.pos.set(0, -50, 0); }
    this._write();
  }

  _spawn(q, top) {
    const r = this.rnd;
    q.ph = r() * 6.28; q.rs.set((r() - 0.5) * 12, (r() - 0.5) * 12, (r() - 0.5) * 12); q.rest = 0;
    if (top) {
      q.pos.set((r() - 0.5) * 28, 10 + r() * 6, -16 + r() * 20); q.vel.set((r() - 0.5) * 1.5, -r(), (r() - 0.5) * 1.5);
    } else {
      const side = r() < 0.5 ? -1 : 1;
      q.pos.set(side * (4.5 + r()), 0.3, -4 + r() * 3);
      q.vel.set(-side * (1.5 + r() * 4), 9 + r() * 8, (r() - 0.5) * 4);
    }
    q.state = 1;
  }

  burst() {
    this.active = true;
    this.p.forEach((q, i) => this._spawn(q, i % 3 === 0));
  }

  update(dt, t) {
    if (!this.active) return;
    const g = 9.8;
    for (const q of this.p) {
      if (q.state === 0) continue;
      if (q.state === 2) { q.rest += dt; if (q.rest > 5 + (q.ph % 3)) this._spawn(q, true); continue; }
      q.vel.y -= g * dt;
      const k = q.vel.y > 0 ? 1.0 : 5.0;
      const f = Math.exp(-k * dt);
      q.vel.y *= f; q.vel.x *= Math.exp(-1.6 * dt); q.vel.z *= Math.exp(-1.6 * dt);
      q.pos.x += (q.vel.x + Math.sin(t * 3 + q.ph) * 0.7) * dt;
      q.pos.y += q.vel.y * dt;
      q.pos.z += (q.vel.z + Math.cos(t * 2.6 + q.ph) * 0.7) * dt;
      q.rot.x += q.rs.x * dt; q.rot.y += q.rs.y * dt; q.rot.z += q.rs.z * dt;
      if (q.pos.y <= 0.03) { q.pos.y = 0.03; q.state = 2; q.rot.x = -Math.PI / 2; q.rot.y = 0; }
    }
    this._write();
  }

  _write() {
    const d = this.dummy;
    this.p.forEach((q, i) => {
      d.position.copy(q.pos); d.rotation.copy(q.rot);
      d.scale.setScalar(q.state === 0 ? 0 : 1);
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

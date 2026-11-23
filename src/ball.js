import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { canvasTexture, mulberry32 } from './utils.js';
import { shotPosition, shotVelocity } from './logic.js';

function ballTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, w, h);
    const rnd = mulberry32(5);
    ctx.fillStyle = '#16161a';
    for (let i = 0; i < 22; i++) {
      const x = (i % 11) * (w / 11) + (i < 11 ? 0 : w / 22), y = h * (i < 11 ? 0.3 : 0.7);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + rnd() * 0.15; const r = 20; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e2231a'; ctx.fillRect(0, h * 0.49, w, 4);
  });
}

export class Ball {
  constructor() {
    const r = C.ball.radius;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.mesh.castShadow = true;
    this.position = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.state = 'idle'; this.t = 0; this.shot = null; this.handlers = null;
    this._post = false; this.goalFired = false; this.netFired = false;
    this.vel.set(0, 0, 0);
    this.mesh.position.set(0, C.ball.radius, 0);
    this.mesh.quaternion.identity();
  }

  launch(shot, handlers) { this.shot = shot; this.handlers = handlers; this.state = 'flight'; this.t = 0; this._post = false; }

  update(dt) {
    if (this.state === 'idle' || this.state === 'rest') return;
    const s = this.shot, F = C.field;
    this.t += dt;
    if (!this._post) {
      if (this.t < s.T) {
        const p = shotPosition(s, this.t), v = shotVelocity(s, this.t);
        this.position.set(p.x, p.y, p.z); this.vel.set(v.x, v.y, v.z);
      } else {
        const p = shotPosition(s, s.T), v = shotVelocity(s, s.T);
        this.position.set(p.x, p.y, p.z); this.vel.set(v.x, v.y, v.z);
        this._post = true;
        if (!this.goalFired) { this.goalFired = true; this.handlers && this.handlers.onGoalLine && this.handlers.onGoalLine(this.position.clone()); }
        const rest = this.t - s.T;
        if (rest > 0) this._integrate(rest);
      }
    } else this._integrate(dt);
    this._spin(dt);
  }

  _integrate(dt) {
    const r = C.ball.radius, F = C.field, g = C.shot.gravity;
    const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vel.y -= g * h;
      const drag = this.netFired ? 4.5 : 0.1;
      this.vel.multiplyScalar(Math.max(0, 1 - drag * h));
      this.position.addScaledVector(this.vel, h);
      const p = this.position;
      if (p.z <= F.netBackZ + r && this.vel.z < 0) {
        p.z = F.netBackZ + r;
        if (!this.netFired) { this.netFired = true; this.handlers && this.handlers.onNetHit && this.handlers.onNetHit(p.clone(), Math.abs(this.vel.z)); }
        this.vel.z *= -0.1; this.vel.x *= 0.35; this.vel.y *= 0.35;
      }
      const sx = F.goalHalfWidth - 0.12;
      if (Math.abs(p.x) > sx) { p.x = Math.sign(p.x) * sx; this.vel.x *= -0.25; }
      const top = F.goalHeight - 0.1;
      if (p.y > top) { p.y = top; this.vel.y *= -0.25; }
      // keep it inside the goal (the net holds it)
      if (this.netFired && p.z > F.goalLineZ - 0.25) { p.z = F.goalLineZ - 0.25; this.vel.z = -Math.abs(this.vel.z) * 0.3; }
      if (p.y < r) {
        p.y = r;
        this.vel.y = Math.abs(this.vel.y) > 0.5 ? -this.vel.y * 0.4 : 0;
        const f = Math.max(0, 1 - 3 * h); this.vel.x *= f; this.vel.z *= f;
      }
    }
    if (this.netFired && this.vel.length() < 0.05 && this.position.y <= r + 0.001) { this.state = 'rest'; this.vel.set(0, 0, 0); }
  }

  _spin(dt) {
    const v = this.vel, sp = Math.hypot(v.x, v.y, v.z);
    if (sp < 0.02) return;
    const ax = new THREE.Vector3(v.z, 0, -v.x);
    if (ax.lengthSq() < 1e-8) return;
    this.mesh.rotateOnWorldAxis(ax.normalize(), (sp * dt) / C.ball.radius);
  }
}

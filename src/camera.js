// Camera director: fixed FIFA-style aim camera, short push on the shot, wide cinematic on the goal.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { damp, smooth, clamp } from './utils.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.tp = new THREE.Vector3(); this.tl = new THREE.Vector3();
    this.mode = 'title'; this.lambda = 2; this.shake = 0; this.t = 0;
    this.aimPos = new THREE.Vector3(...C.camera.aimPos);
    this.aimLook = new THREE.Vector3(...C.camera.aimLook);
  }

  setMode(mode, snap = false) {
    this.mode = mode;
    if (mode === 'goalShake') this.shake = 0.12;
    this.compute({ ball: new THREE.Vector3(0, 0.1, 0), player: new THREE.Vector3(0, 0, 1), shotProgress: 0, t: this.t });
    if (snap) { this.pos.copy(this.tp); this.look.copy(this.tl); this.apply(0); }
  }

  compute(ctx) {
    const { ball, player, shotProgress, t } = ctx;
    switch (this.mode) {
      case 'title':
        this.tp.set(-6.5 + 2.2 * Math.sin(t * 0.09), 2.6, 7.5);
        this.tl.set(1.2, 1.4, -11); this.lambda = 2; break;
      case 'aim':
        this.tp.copy(this.aimPos); this.tl.copy(this.aimLook); this.lambda = 1.6; break;
      case 'shot': {
        const s = smooth(shotProgress);
        this.tp.copy(this.aimPos); this.tp.z += C.camera.pushZ * s; this.tp.y += C.camera.pushY * s;
        this.tl.copy(this.aimLook).lerp(ball, 0.35);
        this.tl.y = Math.max(this.tl.y, 0.9); this.tl.z = Math.min(this.tl.z, -4);
        this.lambda = 4; break;
      }
      case 'celebrate':
        this.tp.set(-5.2, 1.9, 7.2);
        this.tl.set(player.x * 0.6, 1.2, player.z - 1.5); this.lambda = 1.3; break;
      case 'final': {
        this.tp.set(-4.6 + Math.sin(t * 0.25) * 0.7, 1.7 + Math.sin(t * 0.17) * 0.12, 6.6);
        // look to the LEFT of Kanason so he lands in the right third; the text sits on the left
        const dx = this.tp.x - player.x, dz = this.tp.z - player.z, l = Math.hypot(dx, dz) || 1;
        this.tl.set(player.x - (dz / l) * 2.6, 1.15, player.z + (dx / l) * 2.6); this.lambda = 1.8; break;
      }
      default: this.tp.copy(this.aimPos); this.tl.copy(this.aimLook);
    }
  }

  apply(dt) {
    this.cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.25);
    }
    this.cam.lookAt(this.look);
  }

  update(dt, ctx) {
    this.t = ctx.t;
    this.compute(ctx);
    const k = this.lambda;
    this.pos.x = damp(this.pos.x, this.tp.x, k, dt); this.pos.y = damp(this.pos.y, this.tp.y, k, dt); this.pos.z = damp(this.pos.z, this.tp.z, k, dt);
    this.look.x = damp(this.look.x, this.tl.x, k, dt); this.look.y = damp(this.look.y, this.tl.y, k, dt); this.look.z = damp(this.look.z, this.tl.z, k, dt);
    this.apply(dt);
  }
}

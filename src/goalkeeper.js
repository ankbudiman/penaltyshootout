import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { buildKeeperRig } from './rig.js';
import { buildActor } from './player.js';
import { ClipActor } from './animation.js';
import { diveProgress } from './logic.js';

export class Goalkeeper {
  constructor(assets) {
    this.group = new THREE.Group();
    const built = buildActor(assets, 'goalkeeper', () => { const rig = buildKeeperRig(); return { root: rig.root, rig, ...rig }; }, 1.85);
    this.actor = built.actor;
    this.group.add(built.holder);
    this.reset();
  }

  reset() {
    this.group.position.set(0, 0, C.keeper.z);
    this.group.rotation.set(0, 0, 0);
    this.plan = null; this.diving = false; this.t = 0; this.clipDive = false;
    this.actor.state = null;
    this.actor.play('ready', { fade: 0, loop: true });
    this.actor.update(0);
  }

  startDive(plan) {
    this.plan = plan; this.t = 0; this.diving = true;
    const clipName = plan.side > 0 ? 'diveL' : 'diveR';   // keeper faces the camera: world +X is HIS left
    this.clipDive = this.actor instanceof ClipActor && this.actor.has(clipName);
    this.clipName = clipName;
  }

  update(dt) {
    this.actor.update(dt);
    if (!this.diving || !this.plan) return;
    this.t += dt;
    const pl = this.plan, p = diveProgress(pl, this.t), g = this.group;
    if (p > 0 && this.actor.state !== 'dive' && this.actor.state !== this.clipName) {
      if (this.clipDive) this.actor.play(this.clipName, { fade: 0.08, loop: false });
      else this.actor.play('dive', { fade: 0.08, loop: false });
    }
    this.actor.setDive(p, pl.side);
    const xc = pl.side * pl.xe * p;
    if (this.clipDive) { g.position.set(xc, 0, C.keeper.z); g.rotation.set(0, 0, 0); return; }
    // procedural roll about the body centre (~0.9 m up)
    const ang = 1.45 * Math.min(1, p * 1.25) * (3 - 2 * Math.min(1, p * 1.25)) * Math.min(1, p * 1.25);
    const phi = -pl.side * ang;
    const yc = (0.9 + (0.32 - 0.9) * p) + 0.55 * Math.sin(Math.PI * p);
    g.rotation.set(0, 0, phi);
    g.position.set(xc + 0.9 * Math.sin(phi), yc - 0.9 * Math.cos(phi), C.keeper.z);
  }
}

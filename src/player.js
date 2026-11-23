// Kanason: uses kanason.glb if present, otherwise a procedural low-poly player.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { clamp, lerp, angleLerp } from './utils.js';
import { buildPlayerRig } from './rig.js';
import { ProceduralActor, ClipActor, NullActor } from './animation.js';

export function fitModel(model, height) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.0001) model.scale.multiplyScalar(height / size.y);
  model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model);
  const c = b2.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b2.min.y;
}

export function buildActor(assets, id, buildRig, height) {
  const holder = new THREE.Group();
  const gltf = assets.get(id);
  if (gltf && gltf.scene) {
    const model = gltf.scene;
    fitModel(model, height);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    holder.add(model);
    const actor = gltf.animations && gltf.animations.length ? new ClipActor(model, gltf.animations) : null;
    if (actor) return { holder, actor, real: true };
    if (C.dev) console.warn(`[${id}] GLB has no animation clips - model will be static (documented fallback).`);
    return { holder, actor: new NullActor(), real: true, staticOnly: true };
  }
  const rig = buildRig();
  holder.add(rig.root);
  return { holder, actor: new ProceduralActor(rig), real: false };
}

export class Player {
  constructor(assets) {
    this.group = new THREE.Group();
    // build with a thin wrapper so we can reuse the procedural rig builder signature
    const built = buildActor(assets, 'kanason', () => { const rig = buildPlayerRig(); return { root: rig.root, rig, ...rig }; }, C.player.height);
    this.holder = built.holder; this.actor = built.actor;
    this.group.add(this.holder);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.reset();
  }

  reset() {
    const S = C.player;
    this.mode = 'idle'; this.t = 0; this.contactFired = false; this.onContact = null;
    this.group.position.set(...S.start);
    this.faceYaw = Math.atan2(S.plant[0] - S.start[0], S.plant[2] - S.start[2]);
    this.group.rotation.set(0, this.faceYaw, 0);
    this.actor.state = null;
    this.actor.play('idle', { fade: 0 });
    this.actor.update(0);
  }

  startRunup(onContact) {
    if (this.mode !== 'idle') return;
    this.mode = 'run'; this.t = 0; this.onContact = onContact; this.contactFired = false;
    this.actor.play('run', { fade: 0.15, loop: true });
  }

  celebrate(lookAt) {
    this.mode = 'celebrate'; this.t = 0; this.lookAt = lookAt || new THREE.Vector3(0, 1, 10);
    this.actor.play('celebrate', { fade: 0.2, loop: true });
  }

  update(dt) {
    const S = C.player;
    this.actor.update(dt);
    this.t += dt;
    const g = this.group;
    if (this.mode === 'run') {
      const u = clamp(this.t / S.runDuration, 0, 1);
      g.position.set(lerp(S.start[0], S.plant[0], u), 0, lerp(S.start[2], S.plant[2], u));
      const yaw = lerp(this.faceYaw, Math.PI, clamp((u - 0.7) / 0.3, 0, 1));
      g.rotation.y = yaw;
      if (u >= 1) {
        this.mode = 'kick'; this.t = 0;
        g.position.set(...S.plant); g.rotation.y = Math.PI;
        this.actor.play('kick', { fade: 0.08, loop: false });
      }
    } else if (this.mode === 'kick') {
      if (!this.contactFired && this.t >= this.actor.kickContact) {
        this.contactFired = true;
        if (this.onContact) this.onContact();
      }
      if (this.t >= S.kickDuration) { this.mode = 'post'; this.actor.play('idle', { fade: 0.4 }); }
    } else if (this.mode === 'celebrate') {
      const target = Math.atan2(this.lookAt.x - g.position.x, this.lookAt.z - g.position.z);
      g.rotation.y = angleLerp(g.rotation.y, target, 1 - Math.exp(-3.5 * dt));
    }
  }
}

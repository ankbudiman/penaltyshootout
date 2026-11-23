// Procedural low-poly humanoid used when kanason.glb / goalkeeper.glb are not available.
// Faces +Z locally (same convention as glTF). Left side of the character = +X.
import * as THREE from 'three';
import { canvasTexture } from './utils.js';

const mat = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

/** Black Selangor-INSPIRED kit with red/yellow accents and a simplified custom crest (NOT an official crest). */
export function makeKitTexture({ base = '#0b0b0d', accent = '#ffcd00', accent2 = '#e2231a', number = '10', crest = true } = {}) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent2; ctx.fillRect(0, 150, w, 22);
    ctx.fillStyle = accent; ctx.fillRect(0, 172, w, 10);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 14);
    if (crest) {
      ctx.save(); ctx.translate(64, 62);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(-22, -24); ctx.lineTo(22, -24); ctx.lineTo(22, 6); ctx.quadraticCurveTo(22, 26, 0, 34); ctx.quadraticCurveTo(-22, 26, -22, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = base; ctx.font = 'bold 30px Impact, Arial'; ctx.textAlign = 'center'; ctx.fillText('K', 0, 10);
      ctx.restore();
    }
    ctx.fillStyle = accent; ctx.font = 'bold 64px Impact, Arial'; ctx.textAlign = 'center'; ctx.fillText(number, 190, 110);
  });
}

export function buildHumanoid({
  shirtMap = null, shirtColor = 0x0b0b0d, sleeveColor = 0x0b0b0d, shortsColor = 0x0b0b0d,
  sockColor = 0xe2231a, bootColor = 0xffcd00, skin = 0xa97452, hair = 0x16110d, glove = null,
} = {}) {
  const root = new THREE.Group();
  const skinM = mat(skin, 0.6), shirtM = shirtMap ? mat(0xffffff, 0.75, { map: shirtMap }) : mat(shirtColor, 0.75);
  const sleeveM = mat(sleeveColor, 0.75), shortsM = mat(shortsColor, 0.8), sockM = mat(sockColor, 0.85), bootM = mat(bootColor, 0.5);
  const gloveM = mat(glove ?? skin, 0.6), hairM = mat(hair, 0.9);

  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const hips = joint(root, 0, 0.95, 0);
  add(hips, new THREE.BoxGeometry(0.34, 0.2, 0.21), shortsM, 0, 0, 0);
  const spine = joint(hips, 0, 0.08, 0);
  add(spine, new THREE.BoxGeometry(0.38, 0.52, 0.22), shirtM, 0, 0.28, 0);
  const head = joint(spine, 0, 0.58, 0);
  add(head, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skinM, 0, 0.02, 0);
  const headMesh = add(head, new THREE.SphereGeometry(0.115, 16, 12), skinM, 0, 0.15, 0); headMesh.scale.set(0.95, 1.1, 1);
  const hairMesh = add(head, new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.165, -0.005); hairMesh.scale.set(0.98, 1.1, 1.02);

  const arm = (sx) => {
    const sh = joint(spine, sx * 0.25, 0.5, 0);
    add(sh, new THREE.CylinderGeometry(0.052, 0.046, 0.3, 8), sleeveM, 0, -0.15, 0);
    const el = joint(sh, 0, -0.3, 0);
    add(el, new THREE.CylinderGeometry(0.042, 0.036, 0.27, 8), skinM, 0, -0.135, 0);
    add(el, new THREE.SphereGeometry(glove ? 0.062 : 0.05, 10, 8), gloveM, 0, -0.29, 0);
    return [sh, el];
  };
  const [shL, elL] = arm(1), [shR, elR] = arm(-1);

  const leg = (sx) => {
    const hip = joint(hips, sx * 0.1, -0.02, 0);
    add(hip, new THREE.CylinderGeometry(0.078, 0.062, 0.45, 8), skinM, 0, -0.225, 0);
    add(hip, new THREE.CylinderGeometry(0.088, 0.088, 0.26, 8), shortsM, 0, -0.13, 0);
    const kn = joint(hip, 0, -0.45, 0);
    add(kn, new THREE.CylinderGeometry(0.058, 0.046, 0.4, 8), sockM, 0, -0.2, 0);
    const ank = joint(kn, 0, -0.4, 0);
    add(ank, new THREE.BoxGeometry(0.1, 0.07, 0.26), bootM, 0, -0.03, 0.07);
    return [hip, kn, ank];
  };
  const [hipL, knL, ankL] = leg(1), [hipR, knR, ankR] = leg(-1);

  return { root, hips, spine, head, shL, elL, shR, elR, hipL, knL, ankL, hipR, knR, ankR };
}

export function buildPlayerRig() {
  return buildHumanoid({
    shirtMap: makeKitTexture({ number: '10' }), sleeveColor: 0x0b0b0d, shortsColor: 0x0b0b0d,
    sockColor: 0xe2231a, bootColor: 0xffcd00, skin: 0xa97452, hair: 0x16110d,
  });
}

export function buildKeeperRig() {
  return buildHumanoid({
    shirtMap: makeKitTexture({ base: '#6cc24a', accent: '#0b0b0d', accent2: '#ffffff', number: '1', crest: false }),
    sleeveColor: 0x6cc24a, shortsColor: 0x0b0b0d, sockColor: 0x6cc24a, bootColor: 0xffffff,
    skin: 0xc58b62, hair: 0x2a1b10, glove: 0xffffff,
  });
}

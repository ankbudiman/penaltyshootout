// Stadium: 3D pitch/goal/net + optimised stands (instanced crowd, instanced trees), ad boards, sky.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { canvasTexture, mulberry32, clamp } from './utils.js';

const F = C.field;

function makeSky() {
  const tex = canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2c7fd1'); g.addColorStop(0.45, '#6fb4ec'); g.addColorStop(0.5, '#a9d6f5'); g.addColorStop(0.62, '#e4f2fb'); g.addColorStop(1, '#e4f2fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  m.renderOrder = -10;
  return m;
}

function makeClouds() {
  const tex = canvasTexture(256, 128, (ctx, w, h) => {
    const rnd = mulberry32(3);
    for (let i = 0; i < 26; i++) {
      const x = 50 + rnd() * 156, y = 40 + rnd() * 48, r = 14 + rnd() * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const grp = new THREE.Group();
  const rnd = mulberry32(8);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9, toneMapped: false }));
    s.scale.set(110 + rnd() * 60, 40 + rnd() * 20, 1);
    s.position.set((rnd() - 0.5) * 420, 75 + rnd() * 70, -150 - rnd() * 140);
    grp.add(s);
  }
  return grp;
}

function grassTexture() {
  return canvasTexture(512, 1024, (ctx, w, h) => {
    const bands = 8;
    for (let i = 0; i < bands; i++) { ctx.fillStyle = i % 2 ? '#3d8836' : '#4a9a41'; ctx.fillRect(0, (i * h) / bands, w, h / bands); }
    const rnd = mulberry32(11);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '20,60,15' : '150,210,95'},${0.04 + rnd() * 0.07})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 2 + rnd() * 6);
    }
  }, { anisotropy: 8 });
}

function adTexture(kind, assets) {
  const imgSk = assets.get('brand-sk'), imgFc = assets.get('brand-fc');
  return canvasTexture(1024, 200, (ctx, w, h) => {
    const paint = (bg, fg, text, img, sub) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcd00'; ctx.fillRect(0, 0, w, 10); ctx.fillStyle = '#e2231a'; ctx.fillRect(0, h - 10, w, 10);
      let x = w / 2, align = 'center';
      if (img) { const s = 150 / img.height; ctx.drawImage(img, 30, 25, img.width * s, 150); x = 30 + img.width * s + 30; align = 'left'; }
      ctx.fillStyle = fg; ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.font = `bold ${sub ? 78 : 92}px Impact, "Arial Narrow", sans-serif`;
      ctx.fillText(text, x, sub ? 78 : 100, w - x - 20);
      if (sub) { ctx.fillStyle = '#ffcd00'; ctx.font = 'bold 40px Impact, "Arial Narrow", sans-serif'; ctx.fillText(sub, x, 150, w - x - 20); }
    };
    if (kind === 0) paint('#0a0a0c', '#ffffff', 'SK SRI KELANA', imgSk, 'HARI ANUGERAH KECEMERLANGAN KOKURIKULUM');
    else if (kind === 1) paint('#e2231a', '#ffffff', 'PENALTY SHOOTOUT!', null, 'FEATURING COACH KANASON');
    else if (kind === 2) paint('#0a0a0c', '#ffcd00', 'SELANGOR FC SOCCER SCHOOL', imgFc, null);
    else paint('#ffcd00', '#0a0a0c', 'SK SRI KELANA', imgSk, 'KOKURIKULUM 2026');
  });
}

function gridLines(a0, a1, b0, b1, na, nb, map) {
  const pos = [];
  for (let i = 0; i <= na; i++) { const a = a0 + ((a1 - a0) * i) / na; pos.push(...map(a, b0), ...map(a, b1)); }
  for (let j = 0; j <= nb; j++) { const b = b0 + ((b1 - b0) * j) / nb; pos.push(...map(a0, b), ...map(a1, b)); }
  return pos;
}

function createGoal() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const W = F.goalHalfWidth, H = F.goalHeight, Z = F.goalLineZ, B = F.netBackZ, pr = F.postRadius;
  const post = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, H, 12), white); m.position.set(x, H / 2, Z); m.castShadow = true; g.add(m); };
  post(-W); post(W);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, W * 2 + pr * 2, 12), white);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, H, Z); bar.castShadow = true; g.add(bar);
  // back frame
  const thin = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 });
  const rod = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), thin);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m);
  };
  for (const s of [-1, 1]) { rod(s * W, H, Z, s * W, H, B); rod(s * W, H, B, s * W, 0, B); rod(s * W, 0, Z, s * W, 0, B); }
  rod(-W, H, B, W, H, B);

  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  // static side + top nets
  const stat = [];
  stat.push(...gridLines(Z, B, 0, H, 9, 12, (z, y) => [-W, y, z]));
  stat.push(...gridLines(Z, B, 0, H, 9, 12, (z, y) => [W, y, z]));
  stat.push(...gridLines(-W, W, Z, B, 30, 9, (x, z) => [x, H, z]));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stat, 3));
  g.add(new THREE.LineSegments(sg, netMat));

  // dynamic back net
  const NX = 30, NY = 15, verts = [], base = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = -W + (2 * W * i) / NX, y = (H * j) / NY; verts.push(x, y, B); base.push(x, y, B); }
  const idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i < NX; i++) idx.push(j * (NX + 1) + i, j * (NX + 1) + i + 1);
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NY; j++) idx.push(j * (NX + 1) + i, (j + 1) * (NX + 1) + i);
  const bg = new THREE.BufferGeometry();
  const posAttr = new THREE.Float32BufferAttribute(verts, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  bg.setAttribute('position', posAttr); bg.setIndex(idx);
  const back = new THREE.LineSegments(bg, netMat); back.frustumCulled = false; g.add(back);

  const net = {
    imp: null,
    hit(x, y, strength) { this.imp = { x, y, amp: clamp(strength * 0.035, 0.18, 0.55), t: 0 }; },
    reset() { this.imp = null; posAttr.array.set(base); posAttr.needsUpdate = true; },
    update(dt) {
      const m = this.imp; if (!m) return;
      m.t += dt;
      const env = Math.exp(-m.t * 2.6) * Math.cos(m.t * 16);
      if (m.t > 3) { this.reset(); return; }
      const a = posAttr.array;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const k = (j * (NX + 1) + i) * 3, dx = base[k] - m.x, dy = base[k + 1] - m.y;
        const w = Math.exp(-(dx * dx + dy * dy) / 0.9) * Math.pow(Math.sin(Math.PI * i / NX), 0.4) * Math.pow(Math.sin(Math.PI * Math.min(1, (j + 0.5) / (NY + 0.5))), 0.3);
        a[k + 2] = base[k + 2] - m.amp * w * env;
      }
      posAttr.needsUpdate = true;
    },
  };
  return { group: g, net };
}

function pitchLines() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const w = 0.12, Z = F.goalLineZ;
  const line = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1) * 1; 
    m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); g.add(m);
  };
  line(-34, Z, 34, Z);
  line(-9.16, Z + 5.5, 9.16, Z + 5.5); line(-9.16, Z, -9.16, Z + 5.5); line(9.16, Z, 9.16, Z + 5.5);
  line(-20.16, Z + 16.5, 20.16, Z + 16.5); line(-20.16, Z, -20.16, Z + 16.5); line(20.16, Z, 20.16, Z + 16.5);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), mat); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.012, 0); g.add(spot);
  const th = Math.acos(5.5 / 9.15);
  const arc = new THREE.Mesh(new THREE.RingGeometry(9.15 - 0.06, 9.15 + 0.06, 64, 1, -Math.PI / 2 - th, th * 2), mat);
  arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.012, 0); g.add(arc);
  return g;
}

function buildStand(def, rnd, people) {
  const { x, z, rotY, width, rows } = def, rowDepth = 1.0, rise = 0.55;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const conc = new THREE.MeshLambertMaterial({ color: 0xb4b8be });
  const trim = new THREE.MeshLambertMaterial({ color: 0x23262b });
  for (let r = 0; r < rows; r++) {
    const h = (r + 1) * rise;
    const m = new THREE.Mesh(new THREE.BoxGeometry(width, h, rowDepth), r % 2 ? conc : new THREE.MeshLambertMaterial({ color: 0xa5aab1 }));
    m.position.set(0, h / 2, -(r + 0.5) * rowDepth); g.add(m);
  }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 0.9, 0.2), trim); wall.position.set(0, 0.45, 0.1); g.add(wall);
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  for (let r = 0; r < rows; r++) {
    const n = Math.floor(width / 0.62), y = (r + 1) * rise;
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.14) continue;
      const lx = -width / 2 + (i + 0.5) * (width / n) + (rnd() - 0.5) * 0.1, lz = -(r + 0.45) * rowDepth;
      people.push({ x: x + lx * cos + lz * sin, y, z: z - lx * sin + lz * cos });
    }
  }
  return g;
}

export function createWorld(assets) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd5e8f5, 110, 300);
  scene.add(makeSky(), makeClouds());

  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x4d7a3a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
  sun.position.set(12, 24, 14); sun.target.position.set(0, 0, -4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 5; sc.far = 70;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ground + pitch
  const outer = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3f7c37'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(2); for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '25,70,20' : '120,180,80'},0.12)`; ctx.fillRect(r() * w, r() * h, 2, 3); }
  });
  outer.wrapS = outer.wrapT = THREE.RepeatWrapping; outer.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ map: outer }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(70, 38), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 3); pitch.receiveShadow = true; scene.add(pitch);
  scene.add(pitchLines());

  const goal = createGoal(); scene.add(goal.group);

  // advertising boards
  const texAds = [0, 1, 2, 3].map((k) => adTexture(k, assets));
  const boardMats = texAds.map((t) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  const boardGeo = new THREE.BoxGeometry(4.4, 0.95, 0.12);
  const addBoard = (x, z, ry, i) => { const m = new THREE.Mesh(boardGeo, boardMats[i % 4]); m.position.set(x, 0.5, z); m.rotation.y = ry; scene.add(m); };
  for (let i = 0; i < 12; i++) addBoard(-24.2 + i * 4.4, -17.4, 0, i);
  for (let i = 0; i < 7; i++) { addBoard(-25.2, -14 + i * 4.4 + 2, Math.PI / 2, i + 1); addBoard(25.2, -14 + i * 4.4 + 2, -Math.PI / 2, i + 2); }

  // stands + instanced crowd
  const rnd = mulberry32(21), people = [];
  scene.add(buildStand({ x: 0, z: -18.6, rotY: 0, width: 52, rows: 11 }, rnd, people));
  scene.add(buildStand({ x: -26.2, z: -4, rotY: Math.PI / 2, width: 30, rows: 8 }, rnd, people));
  scene.add(buildStand({ x: 26.2, z: -4, rotY: -Math.PI / 2, width: 30, rows: 8 }, rnd, people));

  const N = people.length;
  const bodyGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.55, 6), headGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  const shirts = [0xe2231a, 0xe2231a, 0xffcd00, 0xffcd00, 0xffffff, 0xffffff, 0xffffff, 0x111111, 0x2a6fc9, 0x3aa655];
  const skins = [0xf0c8a0, 0xd9a577, 0xb97f55, 0x8d5a3b, 0x6b4128];
  const col = new THREE.Color();
  people.forEach((p, i) => {
    col.setHex(shirts[Math.floor(rnd() * shirts.length)]); bodies.setColorAt(i, col);
    col.setHex(skins[Math.floor(rnd() * skins.length)]); heads.setColorAt(i, col);
    p.ph = rnd() * 6.28; p.sp = 0.8 + rnd() * 0.6;
  });
  bodies.frustumCulled = false; heads.frustumCulled = false;
  scene.add(bodies, heads);
  const dummy = new THREE.Object3D();
  const crowd = {
    excite: 0, target: 0, frame: 0,
    setExcitement(v) { this.target = v; },
    update(dt, t) {
      this.excite += (this.target - this.excite) * Math.min(1, dt * 2);
      if ((this.frame++ & 1) && this.excite < 0.01 && this.frame > 4) return;
      const e = this.excite;
      for (let i = 0; i < N; i++) {
        const p = people[i];
        const bob = (0.012 + 0.03 * e) * Math.sin(t * (1.5 + p.sp) + p.ph) + e * Math.max(0, Math.sin(t * (5 + p.sp * 2) + p.ph)) * 0.28;
        dummy.position.set(p.x, p.y + 0.3 + bob, p.z); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
        dummy.position.y = p.y + 0.76 + bob; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    },
  };
  crowd.update(0, 0);

  // distant trees + buildings
  const TN = 70, trunkG = new THREE.CylinderGeometry(0.25, 0.32, 2.2, 6), leafG = new THREE.ConeGeometry(1.8, 5.5, 7);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5b4030 }), TN);
  const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshLambertMaterial({ color: 0xffffff }), TN);
  const tr = mulberry32(77);
  for (let i = 0; i < TN; i++) {
    const side = i % 3, x = side === 0 ? -150 + tr() * 300 : (side === 1 ? -(55 + tr() * 70) : 55 + tr() * 70);
    const z = side === 0 ? -70 - tr() * 80 : -60 + tr() * 90, s = 0.8 + tr() * 0.9;
    dummy.position.set(x, 1.1 * s, z); dummy.scale.set(s, s, s); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 4.2 * s, z); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.3 + tr() * 0.06, 0.45, 0.22 + tr() * 0.1); leaves.setColorAt(i, col);
  }
  dummy.scale.set(1, 1, 1);
  scene.add(trunks, leaves);
  const bmat = [0xe8dfd0, 0xd9c7a8, 0xc9d6e0].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  [[-70, -90, 40, 14], [20, -110, 55, 18], [90, -80, 36, 12], [-120, -50, 30, 10]].forEach(([x, z, w, h], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), bmat[i % 3]); b.position.set(x, h / 2, z); scene.add(b);
  });

  return {
    scene, sun, net: goal.net, crowd,
    update(dt, t) { crowd.update(dt, t); goal.net.update(dt); },
    reset() { goal.net.reset(); crowd.setExcitement(0); crowd.excite = 0; },
  };
}

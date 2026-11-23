// Game director: state machine TITLE -> PREPARE -> AIM -> SHOOT -> GOAL -> FINAL (permanent).
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { clamp, damp, canvasTexture } from './utils.js';
import { targetFromAim, makeShot, keeperPassTime, planKeeperDive } from './logic.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import { Goalkeeper } from './goalkeeper.js';
import { CameraRig } from './camera.js';
import { Timeline, Confetti } from './celebration.js';

function createAimMarker() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2); ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffcd00'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(0, -94); ctx.stroke(); }
    ctx.fillStyle = '#e2231a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthTest: false, toneMapped: false }));
  m.renderOrder = 20; m.visible = false;
  return m;
}

export class Game {
  constructor({ renderer, camera, world, assets, ui, audio, controls }) {
    Object.assign(this, { renderer, camera, world, assets, ui, audio, controls });
    const scene = world.scene;
    this.player = new Player(assets); scene.add(this.player.group);
    this.keeper = new Goalkeeper(assets); scene.add(this.keeper.group);
    this.ball = new Ball(); scene.add(this.ball.mesh);
    this.confetti = new Confetti(); scene.add(this.confetti.mesh);
    this.marker = createAimMarker(); scene.add(this.marker);
    this.rig = new CameraRig(camera);
    this.timeline = new Timeline();
    this.clock = new THREE.Clock();
    this.time = 0; this.paused = false; this._raf = 0; this.resetHold = 0; this.resetLocked = false;
    this._initState();
    this.rig.setMode('title', true);
    ui.onStart = () => this.startGame();
  }

  _initState() {
    this.phase = 'TITLE'; this.phaseTime = 0; this.starting = false;
    this.shotTaken = false; this.launched = false; this.goalTriggered = false;
    this.shot = null; this.plan = null; this.shotClock = 0;
    this.aim = { x: 0, y: 0 };
  }

  start() {
    if (this._raf) return;                       // never run two loops
    this.clock.getDelta();
    const loop = () => { this._raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    try { this.update(dt); } catch (e) { console.error(e); }
    this.renderer.render(this.world.scene, this.camera);
  }

  setPhase(p) { this.phase = p; this.phaseTime = 0; }

  async startGame() {
    if (this.phase !== 'TITLE' || this.starting) return;
    this.starting = true;
    await this.audio.unlock();
    if (this.phase !== 'TITLE') return;
    this.ui.hideTitle(); this.ui.showHud();
    this.audio.startAmbience();
    this.controls.flush();
    this.rig.setMode('aim');
    this.ui.banner('GET READY');
    this.setPhase('PREPARE');
  }

  enterAim() {
    this.setPhase('AIM');
    this.ui.hideBanner();
    this.ui.hint('AIM: LEFT STICK / ARROWS     SHOOT: A / SPACE');
    this.controls.flush();
    this.marker.visible = true;
  }

  computeTarget() { return targetFromAim(this.aim); }

  shoot() {
    if (this.shotTaken || this.phase !== 'AIM') return;
    this.shotTaken = true;
    this.setPhase('SHOOT');
    const target = this.computeTarget();
    this.shot = makeShot(target);
    this.plan = planKeeperDive(target.x, keeperPassTime(this.shot));
    this.ui.hideHint(); this.marker.visible = false;
    this.rig.setMode('shot');
    this.shotClock = 0;
    this.player.startRunup(() => this.onContact());
  }

  onContact() {
    if (this.launched) return;
    this.launched = true; this.shotClock = 0;
    this.ball.launch(this.shot, {
      onGoalLine: (p) => this.onGoalLine(p),
      onNetHit: (p, speed) => { this.world.net.hit(p.x, p.y, speed); this.audio.net(); },
    });
    this.keeper.startDive(this.plan);
    this.audio.kick();
  }

  onGoalLine() {
    if (this.goalTriggered) return;
    this.goalTriggered = true;
    this.setPhase('GOAL');
    const T = C.timeline;
    this.timeline.start([
      { at: T.goalText, fn: () => this.ui.showGoal() },
      { at: T.announcer, fn: () => this.audio.announcer() },
      { at: T.crowd, fn: () => { this.audio.cheer(); this.confetti.burst(); this.world.crowd.setExcitement(1); this.rig.setMode('celebrate'); this.rig.shake = 0.06; } },
      { at: T.celebrate, fn: () => { this.player.celebrate(this.camera.position.clone()); this.audio.music(); } },
      { at: T.final, fn: () => this.showFinal() },
    ]);
  }

  showFinal() {
    if (this.phase === 'FINAL') return;
    this.setPhase('FINAL');
    this.ui.hideGoal(); this.ui.showFinal();
    this.rig.setMode('final');
  }

  togglePause() {
    this.paused = !this.paused;
    this.controls.flush();
    this.ui.showPause(this.paused);
    this.paused ? this.audio.suspend() : this.audio.resume();
  }

  resetGame() {
    this.timeline.stop(); this.audio.stopAll();
    if (this.paused) { this.paused = false; this.ui.showPause(false); this.audio.resume(); }
    this.player.reset(); this.keeper.reset(); this.ball.reset(); this.confetti.reset(); this.world.reset();
    this.marker.visible = false;
    this.ui.resetToTitle();
    this.controls.flush();
    this._initState();
    this.rig.setMode('title', true);
  }

  _resetHold(dt) {
    if (this.controls.isResetChord()) {
      if (this.resetLocked) return;
      this.resetHold += dt;
      this.ui.resetRing(this.resetHold / C.reset.holdSeconds);
      if (this.resetHold >= C.reset.holdSeconds) { this.resetHold = 0; this.resetLocked = true; this.ui.resetRing(0); this.resetGame(); }
    } else { this.resetHold = 0; this.resetLocked = false; this.ui.resetRing(0); }
  }

  update(dt) {
    const c = this.controls;
    c.update(dt);
    this._resetHold(dt);
    this.ui.setController(c.status.connected, c.status.name);
    if (this.ui.calibOpen) this.ui.updateCalib(c.getDebug());

    if (c.consumePause() && ['PREPARE', 'AIM', 'SHOOT', 'GOAL'].includes(this.phase) && !this.ui.calibOpen) this.togglePause();
    if (this.paused) return;

    this.time += dt; this.phaseTime += dt;
    if (this.launched) this.shotClock += dt;
    const shootSrc = c.consumeShoot();

    switch (this.phase) {
      case 'PREPARE':
        if (this.phaseTime >= C.prepareSeconds) this.enterAim();
        break;
      case 'AIM': {
        const a = c.getAim(), k = 1 - Math.exp(-C.input.aimSmoothing * dt);
        this.aim.x += (a.x - this.aim.x) * k; this.aim.y += (a.y - this.aim.y) * k;
        const S = C.shot, mk = this.marker;
        mk.position.set(this.aim.x * S.aimRangeX, S.aimMidY + this.aim.y * S.aimHalfY, C.field.goalLineZ + 0.45);
        mk.scale.setScalar(1 + Math.sin(this.time * 6) * 0.05);
        if (shootSrc && this.phaseTime >= C.aimMinSeconds) this.shoot();
        break;
      }
      case 'SHOOT':
        if (!this.launched && this.phaseTime > 4) this.onContact();   // watchdog: the kick can never stall
        break;
      case 'GOAL':
        if (this.phaseTime > 9) this.showFinal();                      // watchdog
        break;
      default: break;
    }

    this.player.update(dt); this.keeper.update(dt); this.ball.update(dt);
    this.world.update(dt, this.time); this.confetti.update(dt, this.time); this.timeline.update(dt);

    const prog = this.launched ? clamp(this.shotClock / (C.shot.flightTime + 0.5), 0, 1) : clamp(this.phaseTime / 1.2, 0, 0.4) * 0.5;
    this.rig.update(dt, { ball: this.ball.position, player: this.player.group.position, shotProgress: this.phase === 'SHOOT' || this.phase === 'GOAL' ? prog : 0, t: this.time });
  }
}

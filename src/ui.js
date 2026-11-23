// DOM overlay (designed at 1920x1080 and scaled to the 16:9 stage). No debug text in production.
import { CONFIG as C } from './config.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.stage = $('stage'); this.canvas = $('gl'); this.root = $('ui');
    this.el = Object.fromEntries(['loading', 'loadbar', 'title', 'hud', 'goalfx', 'final', 'pause', 'calib', 'resetring', 'devbox', 'hint', 'banner', 'start-btn'].map((k) => [k, $(k)]));
    this.calibOpen = false;
    this.onResize = () => {};
    this.onStart = () => {};
    this._layout = () => this.layout();
    window.addEventListener('resize', this._layout);
    this.layout();

    this.el['start-btn'].addEventListener('click', () => this.onStart());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (!this.el.title.classList.contains('hidden') && !this.calibOpen && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.onStart(); }
      if (e.code === 'KeyC' && !e.ctrlKey && !e.altKey && !e.metaKey && !this.el.title.classList.contains('hidden')) this.toggleCalib();
      if (e.code === 'Escape' && this.calibOpen) this.toggleCalib(false);
    });
    $('calib-open').addEventListener('click', () => this.toggleCalib(true));
    $('cal-close').addEventListener('click', () => this.toggleCalib(false));
  }

  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    let w = W, h = (W * 9) / 16;
    if (h > H) { h = H; w = (H * 16) / 9; }
    Object.assign(this.stage.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px' });
    this.root.style.transform = `scale(${w / 1920})`;
    this.onResize(Math.round(w), Math.round(h));
  }

  setLoading(p) { this.el.loadbar.style.width = Math.round(p * 100) + '%'; }
  hideLoading() { this.el.loading.classList.add('hidden'); }
  fatal(msg) { this.el.loading.querySelector('.ld-title').textContent = msg; }

  initBranding(assets) {
    document.querySelectorAll('[data-brand]').forEach((box) => {
      const src = assets.get(box.dataset.brand === 'sk' ? 'brand-sk' : 'brand-fc');
      if (!src) return;
      const img = box.querySelector('img'), fb = box.querySelector('.fallback');
      img.src = src.src; img.hidden = false; if (fb) fb.classList.add('hidden');
    });
    const p = assets.get('portrait');
    if (p) { const img = $('portrait-img'); img.src = p.src; img.hidden = false; $('portrait-fallback').classList.add('hidden'); }
    if (C.dev && assets.report.length) { const d = this.el.devbox; d.textContent = 'ASSET WARNINGS (dev only)\n' + assets.report.join('\n'); d.classList.remove('hidden'); }
  }

  showTitle() { this.el.title.classList.remove('hidden'); document.body.classList.remove('playing'); }
  hideTitle() { this.el.title.classList.add('hidden'); this.toggleCalib(false); document.body.classList.add('playing'); }
  showHud() { this.el.hud.classList.remove('hidden'); }

  banner(text) { const b = this.el.banner; b.textContent = text; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  hideBanner() { this.el.banner.classList.add('hidden'); }
  hint(text) { this.el.hint.textContent = text; this.el.hint.classList.remove('hidden'); }
  hideHint() { this.el.hint.classList.add('hidden'); }

  showGoal() { const g = this.el.goalfx; g.classList.remove('hidden'); g.querySelectorAll('.bar,.goal-text').forEach((n) => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }); }
  hideGoal() { this.el.goalfx.classList.add('hidden'); }
  showFinal() { this.el.final.classList.remove('hidden'); this.el.hud.classList.add('hidden'); }
  showPause(b) { this.el.pause.classList.toggle('hidden', !b); }

  setController(connected, name) {
    document.querySelectorAll('.ctrl-ind').forEach((n) => {
      n.classList.toggle('ok', connected);
      n.querySelector('span').textContent = connected ? 'CONTROLLER CONNECTED' : 'WAITING FOR CONTROLLER';
    });
    $('cal-status').textContent = connected ? 'CONTROLLER CONNECTED' : 'WAITING FOR CONTROLLER';
    $('cal-name').textContent = name || '';
  }

  resetRing(p) {
    const r = this.el.resetring;
    if (p <= 0) { r.classList.add('hidden'); return; }
    r.classList.remove('hidden'); r.querySelector('i').style.width = Math.min(100, p * 100) + '%';
  }

  resetToTitle() {
    ['hud', 'goalfx', 'final', 'pause'].forEach((k) => this.el[k].classList.add('hidden'));
    this.hideBanner(); this.hideHint(); this.resetRing(0);
    this.showTitle();
  }

  // ---- controller test panel
  toggleCalib(force) {
    this.calibOpen = force === undefined ? !this.calibOpen : force;
    this.el.calib.classList.toggle('hidden', !this.calibOpen);
  }

  bindCalib(controls) {
    $('cal-learn-btn').addEventListener('click', () => controls.startLearn('button'));
    $('cal-learn-stick').addEventListener('click', () => controls.startLearn('stick'));
    $('cal-reset').addEventListener('click', () => controls.resetMapping());
    controls.onMessage = (m) => { $('cal-msg').textContent = m; };
    const btnBox = $('cal-buttons');
    for (let i = 0; i < 16; i++) { const b = document.createElement('i'); b.textContent = i; btnBox.appendChild(b); }
  }

  updateCalib(d) {
    $('cal-dot').style.left = 50 + d.aim.x * 46 + '%';
    $('cal-dot').style.top = 50 - d.aim.y * 46 + '%';
    $('cal-values').textContent = d.axes.length ? d.axes.map((v, i) => `AXIS ${i}: ${v.toFixed(2)}`).join('\n') : 'NO AXES';
    $('cal-values').style.whiteSpace = 'pre';
    [...$('cal-buttons').children].forEach((n, i) => n.classList.toggle('on', !!d.buttons[i]));
    const s = $('cal-shoot'); s.classList.toggle('on', d.shootPressed); s.textContent = d.shootPressed ? 'SHOOT PRESSED' : 'SHOOT NOT PRESSED';
    $('cal-shootbtn').textContent = '#' + d.map.shoot;
    $('cal-axes').textContent = `${d.map.axisX} / ${d.map.axisY}`;
  }
}

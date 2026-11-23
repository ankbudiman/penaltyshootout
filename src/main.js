import './style.css';
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { UI } from './ui.js';
import { Assets } from './assets.js';
import { AudioManager } from './audio.js';
import { Controls } from './controls.js';
import { createWorld } from './scene.js';
import { Game } from './game.js';

async function boot() {
  const ui = new UI();
  const assets = new Assets();
  await assets.init();
  await assets.loadAll((p) => ui.setLoading(p));

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { ui.fatal('WebGL is not available in this browser'); throw e; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const camera = new THREE.PerspectiveCamera(C.camera.fov, 16 / 9, C.camera.near, C.camera.far);
  ui.onResize = (w, h) => { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  ui.layout();
  ui.initBranding(assets);

  const world = createWorld(assets);
  const audio = new AudioManager(assets);
  const controls = new Controls();
  ui.bindCalib(controls);
  const game = new Game({ renderer, camera, world, assets, ui, audio, controls });
  window.__game = C.dev ? game : undefined;   // dev-only handle for console testing

  ui.showTitle();
  ui.hideLoading();
  game.start();
}

boot().catch((e) => { console.error(e); });

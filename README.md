# PENALTY SHOOTOUT! - Featuring Coach Kanason
3D penalty-shootout web game for the SK Sri Kelana Hari Anugerah Kecemerlangan Kokurikulum.
Three.js + Vite, static site (no backend), Gamepad API + keyboard fallback, built for 1920x1080 projection captured by OBS.

> **STATUS (read first).** All code is written and the shot / goalkeeper logic is unit-tested (`npm run test:logic`).
> The Three.js scene has **NOT yet been run in a browser** (the build environment had no Three.js / internet).
> Do a full rehearsal on the event laptop before the day. See "Test status" below. Camera framing numbers are in `src/config.js`.

## Install / run
```bash
npm install
npm run dev          # http://localhost:5173  (also on your LAN)
npm run test:logic   # guaranteed-goal + keeper-never-saves test (Node only)
npm run build        # output in dist/
npm run preview      # serve dist/ locally to test the production build
```
Requires Node 18+.

## Assets
Everything runs with built-in placeholders. Replace them by dropping files at the exact paths listed in **README-ASSETS.md**
(then restart `npm run dev` or rebuild - a manifest of existing files is generated automatically).

## Deploy to GitHub Pages
1. Create a GitHub repo and push this project to `main` (assets must be in the repo; use a **private** repo + Pages only if your plan allows it, otherwise keep Mixamo files out of a public repo - see README-ASSETS.md).
2. Repo **Settings -> Pages -> Source: GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` tests, builds and publishes. URL: `https://<user>.github.io/<repo>/`.
All paths are relative (`base: './'`), so the sub-path just works. Manual alternative: `npm run build` and upload `dist/` to any static host.

## Controller setup (Android Bluetooth gamepad)
1. Pair the gamepad to the **laptop** via Bluetooth (use the controller's PC / X-input / "standard" mode; avoid keyboard-emulation modes).
2. Open the game in **Chrome or Edge**, press any gamepad button once (browsers hide the pad until a button is pressed).
3. Title screen shows **CONTROLLER CONNECTED**. Click **CONTROLLER TEST (C)** to check stick + shoot button.
4. If the stick or button is wrong: **LEARN SHOOT BUTTON** / **LEARN STICK** and follow the prompts. The mapping is saved on that laptop/browser.
Controls: left stick aims (horizontal + vertical), **A** shoots (one fixed-power shot), **Start** pauses. Keyboard: arrows/WASD aim, Space/Enter shoot, Esc pause.
START GAME must be clicked or triggered with Enter/Space (browsers only unlock audio from mouse/keyboard, not from a gamepad).

## Event-day operation
1. Open the page full-screen (**F11**), 1920x1080, hide the mouse. Wait for the title screen.
2. Connect the controller, run the **Controller Test**, close it.
3. OBS scene 1: Window/Browser capture of the game. Scene 2: your PowerPoint montage. Check audio capture (desktop audio) in OBS.
4. When Coach Kanason is ready: click **START GAME**. After "GET READY", he aims with the left stick and presses A.
5. The shot is always a goal. After the celebration the **final screen stays up indefinitely**. Switch OBS to the PowerPoint scene manually.
6. **Organiser reset (back to title for a rehearsal / next run):** hold **Ctrl + Shift + Alt + R for 2 seconds** (a small red progress bar appears bottom-right). Nothing else resets the game; the page never restarts by itself.
Rehearse once with the real controller, projector and audio, then **reset** before the ceremony.

## Structure
```
src/ main.js game.js scene.js camera.js controls.js player.js goalkeeper.js ball.js
     animation.js rig.js audio.js ui.js celebration.js assets.js logic.js config.js utils.js style.css
public/assets/  characters images branding audio fonts environment
scripts/        make-asset-manifest.mjs  generate_placeholder_audio.py  test-logic.mjs
```
How the guaranteed goal works: the aim cursor range is mapped *inside* the goal mouth, so every shot is on target and the ball follows one smooth ballistic arc (no snapping).
The keeper dives genuinely but his dive timing is planned (`logic.js`) so he is always beaten (by pace, or by guessing the wrong side on central shots).

## Test status
| Test | Status |
|---|---|
| Shot always inside goal, keeper never reaches ball (16,820 randomised cases) | PASSED (Node) |
| JavaScript syntax of every module | PASSED (`node --check`) |
| Title screen, START, stadium, models, animations, goalkeeper dive, ball flight, celebration, final screen, reset, console errors, GitHub Pages build | **PENDING - run `npm install && npm run dev` / `npm run build` and rehearse** |
| Bluetooth controller, real audio devices, projector/OBS | **PENDING (hardware)** |

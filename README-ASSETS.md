# Assets
The game runs with placeholders. Put real files at these exact paths (under `public/assets/`). Missing files never crash the game.

| File | Purpose | Current state | Fallback if missing |
|---|---|---|---|
| characters/kanason.glb | Gameplay model (glTF 2.0, +Z forward, feet at origin) | **missing** | procedural low-poly player in a black/red/yellow custom kit with a simplified custom crest |
| characters/goalkeeper.glb | Goalkeeper model | **missing** | procedural green-kit keeper |
| images/kanason-portrait.png | Title-screen portrait (PNG with transparent background works best) | **missing** | silhouette panel |
| branding/sk-sri-kelana.png | Primary event logo | **missing** | text wordmark (not an official logo) |
| branding/selangor-fc-school.png | Supporting logo | **missing** | text wordmark |
| audio/announcer-goal.mp3 | English announcer "GOALLLLL!" | **PLACEHOLDER (robotic synth)** | silent |
| audio/stadium-ambience.mp3 | Looping crowd ambience | placeholder (synth) | silent |
| audio/crowd-cheer.mp3 | Goal cheer | placeholder (synth) | silent |
| audio/kick.mp3, audio/net.mp3 | Effects | placeholder (synth) | silent |
| audio/celebration.mp3 | Celebration music (played once) | placeholder (original synth fanfare) | silent |
| fonts/display.woff2 | Optional display font (e.g. Bebas Neue / Anton, self-hosted) | optional | Impact / Arial Narrow |

Stadium, pitch, goal, net, ball, crowd, boards, sky and confetti are generated in code (no files needed).

## Character GLBs
- Animation clips are mapped **by name** (regex in `src/animation.js`): idle (`idle|stand|ready`), run (`run|jog`), kick (`kick|shoot|penalty`), celebration (`celebr|victory|win|dance|jump`). Keeper: `dive...left` / `dive...right` ("left" = the keeper's own left). Open the dev console to see the mapping.
- Use **in-place** animations (no root motion): the game moves the character itself.
- Model is auto-scaled to 1.82 m (keeper 1.85 m) and placed on the ground. Avoid Draco compression (not enabled); plain or meshopt-free GLB is fine. Keep each GLB under ~10 MB.
- If a clip is missing the closest clip is used or the model stays static; adjust `kickContact` (seconds from kick start to ball contact, `config.js` -> `player.kickContact`).
- Quick source: **Mixamo** (free, Adobe login): download a character + clips (Idle, Running In Place, Soccer Penalty Kick, Victory / Jump) and the keeper + dive clips. Mixamo gives FBX - convert to GLB (Blender: import FBX, merge actions, export glTF). Mixamo terms forbid re-distributing the raw files, so keep the repo **private** or accept the risk. CC0 alternatives: Quaternius, Kenney (few football animations).
- Do not present the kit as an official Selangor FC kit.

## Audio
- Announcer must be a **local recording** (record someone, or generate once with any TTS and save the mp3). Keep it ~2-3 s, peak-normalised.
- Free sources: Pixabay, Freesound (CC0), YouTube Audio Library. Avoid famous copyrighted songs.
- Regenerate placeholders any time: `npm run gen:audio` (needs python3, numpy, scipy, ffmpeg).

After adding files run `npm run assets` (also runs automatically before `dev`/`build`).

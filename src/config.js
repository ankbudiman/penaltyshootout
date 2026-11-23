// Central configuration. Tune camera / timing / feel here, not in the modules.
const DEV = !!(import.meta.env && import.meta.env.DEV);

export const CONFIG = {
  dev: DEV,

  // World layout (metres). The goal line is at z = -11, penalty spot at (0,0,0), camera looks towards -z.
  field: { goalLineZ: -11, goalHalfWidth: 3.66, goalHeight: 2.44, netBackZ: -12.8, postRadius: 0.06 },
  ball: { radius: 0.11 },

  // Shot: fixed power (fixed flight time). Aim range is INSIDE the goal, so every shot is a goal.
  shot: {
    flightTime: 0.62, gravity: 9.8,
    aimRangeX: 3.1, aimMidY: 1.22, aimHalfY: 0.8,
    maxX: 3.15, minY: 0.42, maxY: 2.05,
    jitterX: 0.12, jitterY: 0.08, curve: 0.12,
    stickGain: 1.25,
  },

  // Goalkeeper makes a real dive attempt but is always beaten (see logic.js planKeeperDive).
  keeper: {
    z: -10.8, diveDuration: 0.85, reaction: 0.14,
    rightWayMaxDelay: 0.38, maxDelay: 0.5,
    bodyHalfReach: 0.65, armExtra: 0.5, minClearance: 0.3,
  },

  player: {
    start: [-1.7, 0, 2.5], plant: [-0.1, 0, 0.72],
    runDuration: 1.15, kickDuration: 1.4, kickContact: 0.34, height: 1.82,
  },

  camera: {
    fov: 36, near: 0.3, far: 900,
    aimPos: [0, 3.1, 9.6], aimLook: [0, 0.9, -11],
    pushZ: -1.4, pushY: -0.2,
  },

  // Seconds after the ball crosses the goal line.
  timeline: { goalText: 0.3, announcer: 0.5, crowd: 1.0, confetti: 1.0, cameraCelebrate: 1.0, celebrate: 2.5, final: 4.0 },

  prepareSeconds: 2.2,
  aimMinSeconds: 0.7,

  audio: {
    master: 0.9,
    bus: { sfx: 1.0, crowd: 0.8, music: 0.55, voice: 1.0 },
    vol: { kick: 0.9, net: 0.8, ambience: 0.5, cheer: 0.85, music: 0.7, announcer: 1.0 },
    duckTo: 0.35,
  },

  input: { deadzone: 0.18, aimSmoothing: 12, debounceMs: 250 },

  // Organiser reset: hold Ctrl + Shift + Alt + R for this long.
  reset: { holdSeconds: 2.0 },

  colors: { red: 0xe2231a, yellow: 0xffcd00, black: 0x0a0a0c, white: 0xffffff },
};

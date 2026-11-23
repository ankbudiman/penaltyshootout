// Pure game maths (no THREE, no DOM) so it can be unit-tested in Node:  npm run test:logic
import { CONFIG as C } from './config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Aim cursor (-1..1, y up) -> point on the goal line. Always inside the goal mouth. */
export function targetFromAim(aim, rand = Math.random) {
  const S = C.shot;
  let x = aim.x * S.aimRangeX + (rand() * 2 - 1) * S.jitterX;
  let y = S.aimMidY + aim.y * S.aimHalfY + (rand() * 2 - 1) * S.jitterY;
  x = clamp(x, -S.maxX, S.maxX);
  y = clamp(y, S.minY, S.maxY);
  return { x, y };
}

/** Ballistic shot with fixed flight time (= fixed power). */
export function makeShot(target, rand = Math.random) {
  const F = C.field, S = C.shot, r = C.ball.radius;
  const T = S.flightTime, g = S.gravity;
  const y0 = r;
  return {
    x0: 0, y0, z0: 0, tx: target.x, ty: target.y, tz: F.goalLineZ,
    T, g, vy0: ((target.y - y0) + 0.5 * g * T * T) / T,
    curve: (rand() * 2 - 1) * S.curve,
  };
}

export function shotPosition(s, t) {
  const u = t / s.T;
  return {
    x: s.x0 + (s.tx - s.x0) * u + s.curve * 4 * u * (1 - u),
    y: s.y0 + s.vy0 * t - 0.5 * s.g * t * t,
    z: s.z0 + (s.tz - s.z0) * u,
  };
}

export function shotVelocity(s, t) {
  const u = t / s.T;
  return {
    x: (s.tx - s.x0) / s.T + (s.curve * 4 * (1 - 2 * u)) / s.T,
    y: s.vy0 - s.g * t,
    z: (s.tz - s.z0) / s.T,
  };
}

/** Time (since launch) at which the ball passes the goalkeeper's plane. */
export function keeperPassTime(s) {
  return s.T * (C.keeper.z - s.z0) / (s.tz - s.z0);
}

export function diveProgress(plan, t) {
  const u = (t - plan.delay) / plan.duration;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * (3 - 2 * u);
}

/**
 * Plans a dive that LOOKS like a genuine attempt but never reaches the ball.
 *  1. Prefer diving the right way with a natural reaction time: the keeper is simply beaten by pace.
 *  2. If the shot is too close to his starting position for that to be safe (central shots),
 *     he commits early to the WRONG side - like a real keeper guessing.
 * Clearance is checked numerically around the instant the ball passes him.
 */
export function planKeeperDive(tx, tPass, rand = Math.random) {
  const K = C.keeper, D = K.diveDuration;
  const probe = [-0.16, -0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12, 0.16];
  const clearance = (side, xe, delay) => {
    let worst = Infinity;
    const plan = { delay, duration: D };
    for (const o of probe) {
      const p = diveProgress(plan, tPass + o);
      worst = Math.min(worst, Math.abs(tx - side * xe * p) - (K.bodyHalfReach + K.armExtra * p));
    }
    return worst;
  };
  const earliest = (side, xe, from, to) => {
    for (let d = from; d <= to + 1e-9; d += 0.02) if (clearance(side, xe, d) >= K.minClearance) return d;
    return null;
  };
  // wrong-way: choose the feasible delay closest to a natural reaction time
  const natural = (side, xe, from, to) => {
    const c = [];
    for (let d = from; d <= to + 1e-9; d += 0.02) c.push(d);
    c.sort((a, b) => Math.abs(a - K.reaction) - Math.abs(b - K.reaction));
    for (const d of c) if (clearance(side, xe, d) >= K.minClearance) return d;
    return null;
  };

  const sgn = Math.abs(tx) < 0.25 ? (rand() < 0.5 ? -1 : 1) : Math.sign(tx);
  let side = sgn, xe = clamp(Math.abs(tx) + 0.2, 1.7, 2.7), mode = 'right';
  let delay = earliest(side, xe, K.reaction, K.rightWayMaxDelay);
  if (delay === null) {
    mode = 'wrong'; side = -sgn; xe = 2.3;
    delay = natural(side, xe, 0, K.maxDelay);
  }
  if (delay === null) { mode = 'wrong'; side = -sgn; xe = 2.6; delay = 0; }
  return { side, xe, delay, duration: D, mode, tx, tPass };
}

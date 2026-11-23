// Unit test of the guaranteed-goal + goalkeeper-never-saves logic. Run: npm run test:logic
import { CONFIG as C } from '../src/config.js';
import { targetFromAim, makeShot, shotPosition, keeperPassTime, planKeeperDive, diveProgress } from '../src/logic.js';

let n = 0, fails = 0, minClear = Infinity;
const modes = { right: 0, wrong: 0 };
const fail = (msg) => { fails++; if (fails < 15) console.error('FAIL:', msg); };

for (let ax = -1.4; ax <= 1.4001; ax += 0.1) {
  for (let ay = -1.4; ay <= 1.4001; ay += 0.1) {
    for (let k = 0; k < 20; k++) {
      n++;
      const aim = { x: Math.max(-1, Math.min(1, ax)), y: Math.max(-1, Math.min(1, ay)) };
      const tg = targetFromAim(aim);
      const s = makeShot(tg);
      const F = C.field, r = C.ball.radius;
      // inside the goal mouth with margin for ball radius and post width
      if (Math.abs(tg.x) > F.goalHalfWidth - r - F.postRadius - 0.2) fail(`x outside goal ${tg.x}`);
      if (tg.y > F.goalHeight - r - F.postRadius - 0.2 || tg.y < r) fail(`y outside goal ${tg.y}`);
      const end = shotPosition(s, s.T);
      if (Math.abs(end.z - F.goalLineZ) > 1e-6 || Math.abs(end.x - tg.x) > 1e-6 || Math.abs(end.y - tg.y) > 1e-6) fail('trajectory does not end at target');
      let ymin = 9, ymax = -9;
      for (let t = 0; t <= s.T; t += 0.005) { const p = shotPosition(s, t); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
      if (ymin < r - 0.02) fail(`ball underground ${ymin}`);
      if (ymax > F.goalHeight + 1.5) fail(`ball absurdly high ${ymax}`);
      // keeper
      const tPass = keeperPassTime(s);
      const plan = planKeeperDive(tg.x, tPass);
      modes[plan.mode]++;
      let worst = Infinity;
      // ball and keeper can only overlap while the ball is within ~0.3 m of the keeper plane (+-0.04 s)
      for (let t = tPass - 0.04; t <= tPass + 0.04; t += 0.002) {
        const p = diveProgress(plan, t), bx = shotPosition(s, Math.min(t, s.T)).x;
        worst = Math.min(worst, Math.abs(bx - plan.side * plan.xe * p) - (C.keeper.bodyHalfReach + C.keeper.armExtra * p));
      }
      minClear = Math.min(minClear, worst);
      if (worst < 0.15) fail(`keeper could reach ball: tx=${tg.x.toFixed(2)} worst=${worst.toFixed(2)} mode=${plan.mode}`);
      if (plan.delay > 0.55) fail(`keeper delay too large ${plan.delay}`);
    }
  }
}
console.log(`cases: ${n}  keeper modes: right=${modes.right} wrong=${modes.wrong}  min keeper clearance=${minClear.toFixed(2)} m`);
if (fails) { console.error(`${fails} FAILURE(S)`); process.exit(1); }
console.log('ALL LOGIC TESTS PASSED (always a goal; keeper never reaches the ball)');

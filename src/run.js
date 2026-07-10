// src/run.js
import { SCORE, SHIP, GEMS } from './config.js';

export function createRun() {
  return {
    score: 0, streak: 0, wave: 1, over: false,
    heartProgress: 0, // 0..1 accumulator toward the next heart (red gems)
    stats: {
      kills: 0, shotsFired: 0, shotsHit: 0, dashes: 0,
      gemsCollected: 0, bossKills: 0, runTime: 0,
    },
  };
}

export function multiplier(run) {
  return Math.min(SCORE.maxMult, 1 + Math.floor(run.streak / SCORE.streakStep));
}

export function addKill(run, enemy) {
  run.score += enemy.score * multiplier(run);
  run.streak += 1;
  run.stats.kills += 1;
  if (enemy.type === 'boss') run.stats.bossKills += 1;
}

export function hitPlayer(run, ship) {
  if (ship.iframes > 0) return 'iframe';
  if (ship.shield.up) {
    ship.shield.up = false;
    ship.iframes = SHIP.iframeTime;
    return 'shield';
  }
  ship.hp -= 1;
  ship.iframes = SHIP.iframeTime;
  run.streak = 0;
  if (ship.hp <= 0) {
    run.over = true;
    return 'dead';
  }
  return 'hit';
}

// Award a collected gem's payout. Kept ship-agnostic beyond the mutations the
// hit/heal paths already make: blue tops up the boost meter (clamped to the
// ship's current unit capacity, overflow lost); red accrues toward the next
// heart and, on completing one, resets the accumulator (subtract 1) and heals
// one hp capped at maxHp (overflow at full HP is consumed but lost). Returns a
// small result {kind, healed?, full?, gained?} the caller turns into floaters.
export function applyGem(run, ship, kind) {
  if (kind === 'blue') {
    ship.boost.meter = Math.min(ship.boost.units, ship.boost.meter + GEMS.boostFill);
    return { kind: 'blue', gained: GEMS.boostFill };
  }
  // red
  run.heartProgress += GEMS.heartFill;
  const res = { kind: 'red' };
  // Epsilon guard: ten 0.10 fills sum to 0.9999999999999999 in float, so an
  // exact `>= 1` check would never complete the heart. Clamp the reset at 0.
  if (run.heartProgress >= 1 - 1e-9) {
    run.heartProgress = Math.max(0, run.heartProgress - 1);
    if (ship.hp < ship.maxHp) {
      ship.hp += 1;
      res.healed = true;
    } else {
      res.full = true; // full HP: progress consumed, heart lost
    }
  }
  return res;
}

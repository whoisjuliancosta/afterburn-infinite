// src/run.js
import { SCORE, SHIP } from './config.js';

export function createRun() {
  return {
    score: 0, streak: 0, wave: 1, over: false,
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

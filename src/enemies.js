// src/enemies.js
import { ENEMIES, WAVE } from './config.js';

export function scaleFor(wave) {
  return 1 + WAVE.scalePerWave * (wave - 1);
}

export function spawnEnemy(type, x, y, wave) {
  const def = ENEMIES[type];
  const s = scaleFor(wave);
  return {
    type, x, y, vx: 0, vy: 0,
    hp: Math.round(def.hp * s), maxHp: Math.round(def.hp * s),
    speed: def.speed * s,
    radius: def.radius, score: def.score,
    wave, state: 'chase', timer: 0, dead: false,
  };
}

export function updateEnemy(e, ship, dt) {
  const dx = ship.x - e.x, dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;

  if (e.type === 'darter') {
    const def = ENEMIES.darter;
    e.timer -= dt;
    if (e.state === 'chase') {
      e.vx = (dx / d) * e.speed;
      e.vy = (dy / d) * e.speed;
      if (d < def.aimRange) {
        e.state = 'aim';
        e.timer = def.aimTime;
        e.vx = 0; e.vy = 0;
      }
    } else if (e.state === 'aim') {
      if (e.timer <= 0) {
        e.state = 'lunge';
        e.timer = def.lungeTime;
        const s = def.lungeSpeed * scaleFor(e.wave);
        e.vx = (dx / d) * s;
        e.vy = (dy / d) * s;
      }
    } else if (e.state === 'lunge' && e.timer <= 0) {
      e.state = 'chase';
    }
  } else {
    e.vx = (dx / d) * e.speed;
    e.vy = (dy / d) * e.speed;
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

export function deathSpawns(e) {
  if (e.type !== 'splitter') return [];
  return [-1, 1].map(side => spawnEnemy('mini', e.x + side * 10, e.y, e.wave));
}

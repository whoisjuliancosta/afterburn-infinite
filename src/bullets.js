// src/bullets.js
import { dist } from './utils.js';

export function updateBullets(bullets, dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    if (b.traveled > b.range) b.dead = true;
  }
  return bullets.filter(b => !b.dead);
}

export function circleHit(a, b) {
  return dist(a.x, a.y, b.x, b.y) < a.radius + b.radius;
}

export function collideBullets(bullets, enemies) {
  const hits = [];
  for (const b of bullets) {
    for (const e of enemies) {
      if (b.dead) break;
      if (e.hp <= 0) continue;
      if (circleHit(b, e)) {
        e.hp -= b.damage;
        hits.push({ enemy: e, damage: b.damage });
        if (b.pierce > 0) b.pierce -= 1;
        else b.dead = true;
      }
    }
  }
  return hits;
}

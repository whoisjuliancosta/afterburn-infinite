// src/bullets.js
import { dist } from './utils.js';

// arena is optional: without it (v1 callers) bullets always fly straight and
// range-cull as before. With an arena, a bullet carrying bounces > 0 reflects
// off any edge it crosses — clamp back inside, flip that velocity component,
// spend one bounce (a single frame that crosses two edges still costs one).
export function updateBullets(bullets, dt, arena) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    if (b.traveled > b.range) b.dead = true;

    if (arena && b.bounces > 0) {
      let bounced = false;
      if (b.x < b.radius)               { b.x = b.radius;            b.vx = Math.abs(b.vx);  bounced = true; }
      else if (b.x > arena.w - b.radius) { b.x = arena.w - b.radius;  b.vx = -Math.abs(b.vx); bounced = true; }
      if (b.y < b.radius)               { b.y = b.radius;            b.vy = Math.abs(b.vy);  bounced = true; }
      else if (b.y > arena.h - b.radius) { b.y = arena.h - b.radius;  b.vy = -Math.abs(b.vy); bounced = true; }
      if (bounced) b.bounces -= 1;
    }
  }
  return bullets.filter(b => !b.dead);
}

export function circleHit(a, b) {
  return dist(a.x, a.y, b.x, b.y) < a.radius + b.radius;
}

export function collideBullets(bullets, enemies, rng, crit) {
  const hits = [];
  for (const b of bullets) {
    for (const e of enemies) {
      if (b.dead) break;
      if (e.hp <= 0) continue;
      if (circleHit(b, e)) {
        const isCrit = !!(rng && crit && rng() < crit.chance);
        const dealt = Math.round(b.damage * (isCrit ? crit.mult : 1));
        e.hp -= dealt;
        hits.push({ enemy: e, damage: b.damage, crit: isCrit, dealt, x: e.x, y: e.y });
        if (b.pierce > 0) b.pierce -= 1;
        else b.dead = true;
      }
    }
  }
  return hits;
}

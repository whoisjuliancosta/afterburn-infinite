// src/rockets.js
// Right-click rockets: a rocket flies straight along the ship's nose and, on
// first contact with a living enemy OR when it reaches its range, detonates —
// dealing splash damage to every living enemy within its AoE radius.
//
// Spec amendment (v5 Task 3): rockets deal FLAT damage, no crit roll. The
// caller (main) handles kills, FX, score and shake off the returned
// detonations; crit-rolling per AoE enemy here would tangle the rng/crit
// plumbing the bullet path owns, so rockets are deliberately flat.
import { ROCKET } from './config.js';
import { dist } from './utils.js';
import { circleHit } from './bullets.js';

export function createRockets() {
  return { list: [], cooldown: 0 };
}

// Spawns a rocket at the ship's nose heading along ship.angle. Returns false
// (and spawns nothing) while the launcher is still cooling down.
//
// Capture point (v5.1): the ship's Big Payload (rocketAoe) and Fast Reload
// (rocketReload) mods are read HERE, at fire time, and baked into the spawned
// rocket's aoeRadius and the launcher cooldown. updateRockets stays mod-agnostic
// (it already reads per-rocket rk.aoeRadius), so mid-flight upgrade changes don't
// retro-alter a rocket already in the air. Reload multiplier is floored at
// ROCKET.reloadFloor seconds so cooldown can't shrink below the design floor.
export function fireRocket(r, ship) {
  if (r.cooldown > 0) return false;
  const cos = Math.cos(ship.angle), sin = Math.sin(ship.angle);
  const mods = ship.mods || {};
  r.list.push({
    x: ship.x + cos * ship.radius,
    y: ship.y + sin * ship.radius,
    vx: cos * ROCKET.speed,
    vy: sin * ROCKET.speed,
    damage: ROCKET.damage,
    aoeRadius: ROCKET.aoeRadius * (mods.rocketAoe ?? 1),
    radius: ROCKET.radius,
    traveled: 0,
    range: ROCKET.range,
    dead: false,
  });
  r.cooldown = Math.max(ROCKET.reloadFloor, ROCKET.cooldown * (mods.rocketReload ?? 1));
  return true;
}

// Moves rockets, ticks the launcher cooldown, and resolves detonations.
// Returns detonations: [{ x, y, hits: [{ enemy, damage }] }] — enemy hp is
// mutated in place (like collideBullets). Detonated rockets are removed.
export function updateRockets(r, enemies, dt) {
  r.cooldown = Math.max(0, r.cooldown - dt);
  const detonations = [];

  for (const rk of r.list) {
    rk.x += rk.vx * dt;
    rk.y += rk.vy * dt;
    rk.traveled += Math.hypot(rk.vx, rk.vy) * dt;

    let detonate = false;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (circleHit(rk, e)) { detonate = true; break; }
    }
    if (!detonate && rk.traveled >= rk.range) detonate = true;
    if (!detonate) continue;

    const hits = [];
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (dist(rk.x, rk.y, e.x, e.y) <= rk.aoeRadius) {
        e.hp -= rk.damage;
        hits.push({ enemy: e, damage: rk.damage });
      }
    }
    detonations.push({ x: rk.x, y: rk.y, hits });
    rk.dead = true;
  }

  r.list = r.list.filter(rk => !rk.dead);
  return detonations;
}

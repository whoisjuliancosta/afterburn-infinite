// src/enemies.js
import { ENEMIES, WAVE } from './config.js';
import { TAU } from './utils.js';

export function scaleFor(wave) {
  return 1 + WAVE.scalePerWave * (wave - 1);
}

export function spawnEnemy(type, x, y, wave) {
  const def = ENEMIES[type];
  const s = scaleFor(wave);
  const e = {
    type, x, y, vx: 0, vy: 0,
    hp: Math.round(def.hp * s), maxHp: Math.round(def.hp * s),
    speed: def.speed * s,
    radius: def.radius, score: def.score,
    wave, state: 'chase', timer: 0, dead: false,
  };
  // Per-type state fields.
  if (type === 'spitter') e.timer = def.fireEvery;      // no instant shot on spawn
  if (type === 'orbiter') e.currentRadius = def.orbitRadius;
  if (type === 'weaver')  e.weaveT = 0;
  return e;
}

export function updateEnemy(e, ship, dt, out) {
  const dx = ship.x - e.x, dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d; // unit vector from enemy toward ship

  if (e.type === 'spitter') {
    const def = ENEMIES.spitter;
    if (d > def.standoff * 1.05) {
      // too far: close in
      e.vx = ux * e.speed;
      e.vy = uy * e.speed;
    } else if (d < def.standoff * 0.75) {
      // much closer than standoff: back off
      e.vx = -ux * e.speed;
      e.vy = -uy * e.speed;
    } else {
      // holding station: slow lateral strafe (perpendicular to the ship line)
      e.vx = -uy * e.speed * 0.5;
      e.vy = ux * e.speed * 0.5;
    }
    // Fire on a per-enemy cadence; timer starts at fireEvery so no shot on spawn.
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer += def.fireEvery;
      if (out) {
        out.push({
          x: e.x, y: e.y,
          vx: ux * def.shotSpeed, vy: uy * def.shotSpeed,
          radius: def.shotRadius, dead: false,
        });
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return;
  }

  if (e.type === 'orbiter') {
    const def = ENEMIES.orbiter;
    // Ring spirals inward over time, clamped to a floor.
    e.currentRadius = Math.max(40, e.currentRadius - def.spiralRate * dt);
    // Outward radial unit vector (from ship to enemy) and its tangent.
    const ox = -ux, oy = -uy;
    const tx = -oy, ty = ox; // 90° rotation → tangential (counter-clockwise)
    // Tangential motion at e.speed plus a proportional radial pull toward the ring.
    const radial = (e.currentRadius - d) * 3; // >0 pushes outward, <0 pulls inward
    e.vx = tx * e.speed + ox * radial;
    e.vy = ty * e.speed + oy * radial;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return;
  }

  if (e.type === 'weaver') {
    const def = ENEMIES.weaver;
    e.weaveT += dt;
    // Drifter-style chase plus a perpendicular sine weave.
    const px = -uy, py = ux; // perpendicular to the chase direction
    const w = def.weaveAmp * def.weaveFreq * Math.cos(e.weaveT * def.weaveFreq * TAU);
    e.vx = ux * e.speed + px * w;
    e.vy = uy * e.speed + py * w;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return;
  }

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

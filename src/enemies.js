// src/enemies.js
import { ENEMIES, WAVE } from './config.js';
import { TAU } from './utils.js';

export function scaleFor(wave) {
  return 1 + WAVE.scalePerWave * (wave - 1);
}

// Boss tuning that the spec fixes in prose rather than in ENEMIES.boss (kept out
// of config so ENEMIES.boss stays exactly the spec's shape).
const BOSS = {
  windupTime: 1.0,     // s of flashing telegraph before a charge (velocity zeroed)
  spiralEvery: 2.2,    // s between P3 spiral rings
  spiralCount: 14,     // shots per P3 spiral ring
  spiralAdvance: 0.9,  // rad the spiral start angle advances each ring
  miniCount: 2,        // minis spawned per spawnEvery in P3
};

// Remaining-HP-fraction phase: P1 >2/3, P2 [1/3, 2/3], P3 <1/3.
function bossPhase(e) {
  const frac = e.hp / e.maxHp;
  return frac > 2 / 3 ? 1 : frac >= 1 / 3 ? 2 : 3;
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
  if (type === 'boss') {
    // Timers start at their full interval so nothing fires/spawns on the spawn frame.
    e.ringTimer = def.ringEvery;
    e.chargeTimer = def.chargeEvery;
    e.spawnTimer = def.spawnEvery;
    e.chargeStateTimer = 0;   // counts down within windup/charge states
    e.spiralAngle = 0;        // P3 spiral start angle, advances per ring
  }
  return e;
}

export function updateEnemy(e, ship, dt, out) {
  const dx = ship.x - e.x, dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d; // unit vector from enemy toward ship

  if (e.type === 'boss') {
    const def = ENEMIES.boss;
    const phase = bossPhase(e);

    // --- Movement / charge state machine (charge unlocks in P2+) ---
    if (e.state === 'windup') {
      e.vx = 0; e.vy = 0;                         // frozen, flashing telegraph
      e.chargeStateTimer -= dt;
      if (e.chargeStateTimer <= 0) {
        e.state = 'charge';
        e.chargeStateTimer = def.chargeTime;
        e.vx = ux * def.chargeSpeed;              // lunge toward the ship, locked in
        e.vy = uy * def.chargeSpeed;
      }
    } else if (e.state === 'charge') {
      e.chargeStateTimer -= dt;                   // keep the locked-in lunge velocity
      if (e.chargeStateTimer <= 0) e.state = 'chase';
    } else {
      e.vx = ux * e.speed;                        // slow chase
      e.vy = uy * e.speed;
      if (phase >= 2) {
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
          e.chargeTimer += def.chargeEvery;
          e.state = 'windup';
          e.chargeStateTimer = BOSS.windupTime;
          e.vx = 0; e.vy = 0;
        }
      }
    }

    // --- Ring (P1/P2) / spiral (P3) shots, independent of movement state ---
    e.ringTimer -= dt;
    if (e.ringTimer <= 0) {
      e.ringTimer += phase >= 3 ? BOSS.spiralEvery : def.ringEvery;
      if (out) {
        if (phase >= 3) {
          for (let i = 0; i < BOSS.spiralCount; i++) {
            const a = e.spiralAngle + (i / BOSS.spiralCount) * TAU;
            out.push({ x: e.x, y: e.y, vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed, radius: def.shotRadius, dead: false });
          }
          e.spiralAngle += BOSS.spiralAdvance;
        } else {
          for (let i = 0; i < def.ringCount; i++) {
            const a = (i / def.ringCount) * TAU;
            out.push({ x: e.x, y: e.y, vx: Math.cos(a) * def.shotSpeed, vy: Math.sin(a) * def.shotSpeed, radius: def.shotRadius, dead: false });
          }
        }
      }
    }

    // --- Mini spawns (P3): push {spawn:'mini'} markers; main must partition out. ---
    if (phase >= 3) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer += def.spawnEvery;
        if (out) for (let i = 0; i < BOSS.miniCount; i++) out.push({ spawn: 'mini', x: e.x, y: e.y });
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return;
  }

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
    const w = def.weaveAmp * def.weaveFreq * TAU * Math.cos(e.weaveT * def.weaveFreq * TAU);
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

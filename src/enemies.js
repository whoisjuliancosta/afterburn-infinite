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
  miniCount: 2,        // minis spawned per spawnEvery in P3 (and P2 when boss number >= 2)
  burstCount: 3,       // shots per P1 aimed burst
  burstSpread: 0.12,   // rad between adjacent burst shots (centered on the ship)
  wallCount: 12,       // shots per P2 bullet wall
  bigRingCount: 14,    // P1/P2 ring count once boss number >= 3
};

// Boss shot aimed along `angle` at the boss's current position.
function bossShot(e, angle, def) {
  return { x: e.x, y: e.y, vx: Math.cos(angle) * def.shotSpeed, vy: Math.sin(angle) * def.shotSpeed, radius: def.shotRadius, dead: false };
}

// Evenly-spaced radial ring of `count` shots, first shot at `startAngle`.
function pushRing(out, e, count, startAngle, def) {
  for (let i = 0; i < count; i++) out.push(bossShot(e, startAngle + (i / count) * TAU, def));
}

// A blink target: a point inside `arena` at least `minDist` from the ship.
// Randomness comes from the injected `rng`; with none, a deterministic fract-sin
// hash of the boss timers/position keeps old (rng-less) call sites valid.
function blinkPoint(ship, minDist, arena, rng, e) {
  const m = 30, w = arena.w, h = arena.h;
  let k = 0;
  const rand = () => {
    if (rng) return rng();
    k++;
    const v = Math.sin(e.blinkTimer * 91.7 + e.x * 0.113 + e.y * 0.071 + k * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < 32; i++) {
    const x = m + rand() * (w - 2 * m);
    const y = m + rand() * (h - 2 * m);
    if (Math.hypot(x - ship.x, y - ship.y) >= minDist) return { x, y };
  }
  // Fallback (ship boxed in): the inset corner farthest from the ship.
  const corners = [[m, m], [w - m, m], [m, h - m], [w - m, h - m]];
  let best = corners[0], bd = -1;
  for (const [cx, cy] of corners) {
    const d = Math.hypot(cx - ship.x, cy - ship.y);
    if (d > bd) { bd = d; best = [cx, cy]; }
  }
  return { x: best[0], y: best[1] };
}

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
    // Boss number B = wave/5 (integer on real boss waves). HP scales additionally
    // with B: hp × (1 + 0.4×(B−1)). Speed/radius/score keep the plain wave scale.
    e.bossNum = wave / 5;
    e.hp = e.maxHp = Math.round(def.hp * s * (1 + 0.4 * (e.bossNum - 1)));
    // Timers start at their full interval so nothing fires/spawns on the spawn frame.
    e.ringTimer = def.ringEvery;
    e.chargeTimer = def.chargeEvery;
    e.spawnTimer = def.spawnEvery;
    e.burstTimer = def.burstEvery;   // P1 aimed 3-shot burst
    e.wallTimer = def.wallEvery;     // P2 bullet wall
    e.blinkTimer = def.blinkEvery;   // P3 blink reposition
    e.wallCount = 0;                 // alternates the wall axis each wall
    e.chargeStateTimer = 0;          // counts down within windup/charge states
    e.blinkStateTimer = 0;           // counts down within the blink telegraph
    e.spiralAngle = 0;               // P3 spiral start angle, advances per ring
  }
  return e;
}

// `arena` (default 800x600) sizes the P2 bullet wall; `rng` (optional) seeds the P3
// blink reposition — both are boss-only and have deterministic fallbacks so plain
// updateEnemy(e, ship, dt, out) call sites stay valid.
export function updateEnemy(e, ship, dt, out, arena = { w: 800, h: 600 }, rng) {
  const dx = ship.x - e.x, dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d; // unit vector from enemy toward ship

  if (e.type === 'boss') {
    const def = ENEMIES.boss;
    const phase = bossPhase(e);
    const ringCount = e.bossNum >= 3 ? BOSS.bigRingCount : def.ringCount; // P1/P2 rings

    // --- Movement / state machine: blink (P3) > charge windup (P2) > chase ---
    if (e.state === 'blinkwind') {
      e.vx = 0; e.vy = 0;                         // frozen, telegraph flash
      e.blinkStateTimer -= dt;
      if (e.blinkStateTimer <= 0) {
        const p = blinkPoint(ship, def.blinkMinDist, arena, rng, e);
        e.x = p.x; e.y = p.y;                     // teleport at least blinkMinDist away
        e.state = 'chase';
        if (out) pushRing(out, e, ringCount, 0, def); // immediate full ring on arrival
      }
    } else if (e.state === 'windup') {
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
      if (phase >= 3) {
        e.blinkTimer -= dt;
        if (e.blinkTimer <= 0) {
          e.blinkTimer += def.blinkEvery;
          e.state = 'blinkwind';
          e.blinkStateTimer = def.blinkTelegraph;
          e.vx = 0; e.vy = 0;
        }
      } else if (phase >= 2) {
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
          pushRing(out, e, BOSS.spiralCount, e.spiralAngle, def);
          e.spiralAngle += BOSS.spiralAdvance;
        } else {
          pushRing(out, e, ringCount, 0, def);
        }
      }
    }

    // --- P1: aimed 3-shot burst at the ship every burstEvery ---
    if (phase === 1) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burstTimer += def.burstEvery;
        if (out) {
          const c = Math.atan2(ship.y - e.y, ship.x - e.x);
          for (let i = 0; i < BOSS.burstCount; i++) {
            out.push(bossShot(e, c + (i - (BOSS.burstCount - 1) / 2) * BOSS.burstSpread, def));
          }
        }
      }
    }

    // --- P2: bullet wall sweeping straight across the arena every wallEvery ---
    if (phase === 2) {
      e.wallTimer -= dt;
      if (e.wallTimer <= 0) {
        e.wallTimer += def.wallEvery;
        const axis = e.wallCount % 2; // 0: left edge → right; 1: top edge → down
        e.wallCount++;
        if (out) {
          for (let i = 0; i < BOSS.wallCount; i++) {
            const f = (i + 0.5) / BOSS.wallCount;
            out.push(axis === 0
              ? { x: 0, y: f * arena.h, vx: def.shotSpeed, vy: 0, radius: def.shotRadius, dead: false }
              : { x: f * arena.w, y: 0, vx: 0, vy: def.shotSpeed, radius: def.shotRadius, dead: false });
          }
        }
      }
    }

    // --- Mini spawns: P3 always, and P2 too once boss number >= 2. Markers
    //     ({spawn:'mini'}) go into out for main to partition. ---
    if (phase >= 3 || (phase === 2 && e.bossNum >= 2)) {
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

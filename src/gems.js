// src/gems.js
// Score gems: dropped by killed enemies (and in rings by bosses). They scatter
// out, damp quickly, get magnetised toward the ship inside GEMS.magnetRadius,
// and are collected on circle overlap. Pure logic — Node-clean, randomness only
// via the injected rng, no clock (ageing is driven by the caller's dt).

import { GEMS } from './config.js';
import { TAU } from './utils.js';

// Tuning that isn't part of the spec's GEMS constant.
const SCATTER_SPEED = 120; // px/s base for the drop scatter (random 0.3..1.0x)
const SCATTER_DAMP = 4;    // exponential velocity damping per second (~4/s)
const RING_RADIUS = 40;    // px: radius of a spawnGemRing placement
const RING_DRIFT = 60;     // px/s outward drift for ring gems

// Blink is a render concern. A gem blinks during the last BLINK_TIME seconds of
// its life; renderers can read gem.age / gem.lifetime directly or call
// gemBlinking(gem). Exported so the render layer and tests share one source.
export const BLINK_TIME = 1.5;

export const gemBlinking = (gem) => gem.age >= gem.lifetime - BLINK_TIME;

export function createGems() {
  return { list: [] };
}

function makeGem(x, y, vx, vy, value, kind) {
  return { x, y, vx, vy, value, kind, age: 0, lifetime: GEMS.lifetime, radius: GEMS.radius };
}

// Drop a single gem at (x, y) with a small random scatter velocity that damps
// quickly. kind is 'blue' (boost) or 'red' (heart), defaulting to blue. Returns
// the gem for inspection.
export function spawnGem(g, x, y, value, rng, kind = 'blue') {
  const a = rng() * TAU;
  const s = SCATTER_SPEED * (0.3 + rng() * 0.7);
  const gem = makeGem(x, y, Math.cos(a) * s, Math.sin(a) * s, value, kind);
  g.list.push(gem);
  return gem;
}

// Place n gems evenly on a ~RING_RADIUS ring around (x, y), each drifting
// outward and carrying kind (default blue). rng picks a random start angle so
// rings aren't axis-locked (and stays deterministic under a seeded rng).
// Returns the created gems.
export function spawnGemRing(g, x, y, value, n, rng, kind = 'blue') {
  const offset = rng() * TAU;
  const gems = [];
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * TAU;
    const cos = Math.cos(a), sin = Math.sin(a);
    const gem = makeGem(x + cos * RING_RADIUS, y + sin * RING_RADIUS,
      cos * RING_DRIFT, sin * RING_DRIFT, value, kind);
    g.list.push(gem);
    gems.push(gem);
  }
  return gems;
}

// Roll a per-kill gem drop. One mutually-exclusive draw partitions [0,1):
// [0, blueChance) → 'blue', the adjacent band → 'red' (doubled for isBig
// splitter/boss-class kills), the rest → null. rng is injected for determinism.
export function rollDrop(rng, isBig = false) {
  const r = rng();
  if (r < GEMS.blueChance) return 'blue';
  const redChance = GEMS.redChance * (isBig ? 2 : 1);
  if (r < GEMS.blueChance + redChance) return 'red';
  return null;
}

// Move / magnetise / age / cull every gem for dt seconds. Returns an array of
// collected gems {x, y, value, kind} (culled expired gems are NOT returned).
// `magnetRadius` is the effective pull radius (default GEMS.magnetRadius); main
// passes GEMS.magnetRadius × the ship's Attractor multiplier so the pull zone
// tracks the rendered force-field ring.
export function updateGems(g, ship, dt, magnetRadius = GEMS.magnetRadius) {
  const collected = [];
  const kept = [];
  for (const gem of g.list) {
    gem.age += dt;
    if (gem.age >= gem.lifetime) continue; // expired: cull, not collected

    const dx = ship.x - gem.x;
    const dy = ship.y - gem.y;
    const d = Math.hypot(dx, dy);

    // Collect on circle overlap (gem radius vs ship radius).
    if (d < ship.radius + gem.radius) {
      collected.push({ x: gem.x, y: gem.y, value: gem.value, kind: gem.kind });
      continue;
    }

    if (d < magnetRadius && d > 1e-6) {
      // Magnet: accelerate toward the ship. Overrides scatter damping.
      gem.vx += (dx / d) * GEMS.magnetAccel * dt;
      gem.vy += (dy / d) * GEMS.magnetAccel * dt;
    } else {
      // Free flight: scatter velocity damps quickly.
      const damp = Math.exp(-SCATTER_DAMP * dt);
      gem.vx *= damp;
      gem.vy *= damp;
    }

    // Cap speed.
    const sp = Math.hypot(gem.vx, gem.vy);
    if (sp > GEMS.maxSpeed) {
      const k = GEMS.maxSpeed / sp;
      gem.vx *= k;
      gem.vy *= k;
    }

    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    kept.push(gem);
  }
  g.list = kept;
  return collected;
}

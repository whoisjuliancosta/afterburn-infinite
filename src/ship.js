// src/ship.js
import { SHIP, GUN, BOOST } from './config.js';
import { TAU } from './utils.js';

export function createShip(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -TAU / 4, // nose up
    radius: SHIP.radius,
    hp: SHIP.maxHp, maxHp: SHIP.maxHp,
    iframes: 0, cooldown: 0,
    boosting: false,
    // Runs start with a full first unit; capacity grows with Boost Tank upgrades.
    // stacks counts Boost Tank picks (offer-excluded at 2).
    boost: { meter: 1, units: BOOST.baseUnits, stacks: 0 },
    mods: {
      fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1,
      critChance: 0, critMult: 0, magnet: 1, bounce: 0,
      // v5.1 upgrades: rocket AoE / reload multipliers, boost-drain multiplier,
      // gem-drop luck multiplier, rear-guard bullet flag, adrenaline flag.
      rocketAoe: 1, rocketReload: 1, boostDrain: 1, luck: 1, rear: 0, adrenaline: 0,
    },
    shield: { owned: false, up: false },
  };
}

// Refill the boost meter (blue-gem pickups), clamped to current capacity.
export function addBoost(ship, amount) {
  ship.boost.meter = Math.min(ship.boost.units, ship.boost.meter + amount);
}

export function updateShip(ship, input, dt, arena) {
  // The nose tracks the cursor instantly.
  if (input.aimX != null) {
    ship.angle = Math.atan2(input.aimY - ship.y, input.aimX - ship.x);
  }

  const cos = Math.cos(ship.angle), sin = Math.sin(ship.angle);
  const a = SHIP.thrust * ship.mods.engine;

  // W / ↑ thrusts toward the nose.
  if (input.thrust) {
    ship.vx += cos * a * dt;
    ship.vy += sin * a * dt;
  }

  // Continuous boost: while Space is held and the meter has charge, drain it,
  // add extra thrust toward the nose (independent of W) and lift the speed cap
  // for this frame. ship.boosting is true only while actually draining.
  ship.boosting = false;
  let capMult = 1;
  if (input.boosting && ship.boost.meter > 0) {
    ship.boost.meter = Math.max(0, ship.boost.meter - BOOST.drainPerSec * (ship.mods.boostDrain ?? 1) * dt);
    ship.vx += cos * a * BOOST.thrustMult * dt;
    ship.vy += sin * a * BOOST.thrustMult * dt;
    capMult = BOOST.speedMult;
    ship.boosting = true;
  }

  const damp = Math.exp(-SHIP.friction * dt);
  ship.vx *= damp;
  ship.vy *= damp;

  // Adrenaline: while below half HP, +10% max speed (dynamic, not CAPS-clamped).
  const adr = adrenalineActive(ship) ? 1.10 : 1;
  const max = SHIP.maxSpeed * ship.mods.engine * capMult * adr;
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  const r = ship.radius;
  if (ship.x < r)            { ship.x = r;            ship.vx = Math.abs(ship.vx) * 0.5; }
  if (ship.x > arena.w - r)  { ship.x = arena.w - r;  ship.vx = -Math.abs(ship.vx) * 0.5; }
  if (ship.y < r)            { ship.y = r;            ship.vy = Math.abs(ship.vy) * 0.5; }
  if (ship.y > arena.h - r)  { ship.y = arena.h - r;  ship.vy = -Math.abs(ship.vy) * 0.5; }

  ship.iframes = Math.max(0, ship.iframes - dt);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
}

// Adrenaline is active while the ship owns the mod and sits strictly below half
// HP. At exactly half (hp/maxHp === 0.5) it stays OFF. Situational, so it's a
// dynamic multiplier applied at read time — never stored in mods, never clamped
// by CAPS.
export function adrenalineActive(ship) {
  return !!ship.mods.adrenaline && ship.hp / ship.maxHp < 0.5;
}

export function updateGun(ship, input, dt, rng) {
  if (ship.cooldown > 0) return [];
  // Adrenaline: while below half HP, +15% fire rate (shorter auto interval).
  const adr = adrenalineActive(ship) ? 1.15 : 1;
  const autoInt = GUN.autoInterval / (ship.mods.fireRate * adr);
  if (input.taps > 0) {
    ship.cooldown = autoInt * GUN.semiFloor;
    return fire(ship, 0, rng, false);
  }
  if (input.held) {
    ship.cooldown = autoInt;
    return fire(ship, GUN.spreadAngle, rng, true);
  }
  return [];
}

function fire(ship, jitter, rng, withSpread) {
  const speed = GUN.bulletSpeed * ship.mods.bulletSpeed;
  const range = GUN.bulletRange * ship.mods.bulletSpeed;
  const damage = GUN.damage + ship.mods.damage;

  const angles = [ship.angle + (rng() - 0.5) * 2 * jitter];
  if (withSpread) {
    for (let i = 1; i <= ship.mods.spread; i++) {
      angles.push(ship.angle + GUN.spreadShotAngle * i, ship.angle - GUN.spreadShotAngle * i);
    }
    // Rear Guard: one extra bullet straight backward, on held auto-fire only.
    if (ship.mods.rear) angles.push(ship.angle + Math.PI);
  }

  ship.vx -= Math.cos(ship.angle) * SHIP.recoil;
  ship.vy -= Math.sin(ship.angle) * SHIP.recoil;

  return angles.map(a => ({
    x: ship.x + Math.cos(a) * ship.radius,
    y: ship.y + Math.sin(a) * ship.radius,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    damage, pierce: ship.mods.pierce, bounces: ship.mods.bounce,
    traveled: 0, range, radius: GUN.bulletRadius, dead: false,
  }));
}

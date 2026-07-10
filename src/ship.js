// src/ship.js
import { SHIP, GUN, DASH } from './config.js';
import { TAU, angleDiff } from './utils.js';

export function createShip(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -TAU / 4, // nose up
    radius: SHIP.radius,
    hp: SHIP.maxHp, maxHp: SHIP.maxHp,
    iframes: 0, cooldown: 0,
    mods: {
      fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1,
      critChance: 0, critMult: 0, dashRate: 1, bounce: 0,
    },
    shield: { owned: false, up: false },
    dash: { charges: DASH.charges, max: DASH.charges, recharge: 0, stacks: 0 },
  };
}

// Consume a dash charge: impulse along the nose, clamp to the dash speed cap,
// grant iframes (never shortening a longer window), start the recharge if idle.
export function tryDash(ship) {
  if (ship.dash.charges <= 0) return false;
  ship.dash.charges -= 1;

  ship.vx += Math.cos(ship.angle) * DASH.impulse;
  ship.vy += Math.sin(ship.angle) * DASH.impulse;
  const cap = SHIP.maxSpeed * ship.mods.engine * DASH.speedCapMult;
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > cap) { ship.vx *= cap / sp; ship.vy *= cap / sp; }

  ship.iframes = Math.max(ship.iframes, DASH.iframes);

  // start a recharge cycle only if one isn't already running
  if (ship.dash.charges < ship.dash.max && ship.dash.recharge <= 0) {
    ship.dash.recharge = DASH.rechargeTime;
  }
  return true;
}

// Every point of dealt damage shaves the active recharge timer (no-op at full).
export function creditDash(ship, damage) {
  if (ship.dash.charges >= ship.dash.max) return;
  ship.dash.recharge = Math.max(0, ship.dash.recharge - DASH.damageCredit * damage);
}

export function updateShip(ship, input, dt, arena) {
  if (input.rotate) {
    ship.angle += input.rotate * SHIP.turnRate * dt; // keyboard override
  } else if (input.aimX != null) {
    // nose chases the cursor at turn rate — aim is a skill, not a snap
    const want = Math.atan2(input.aimY - ship.y, input.aimX - ship.x);
    const diff = angleDiff(ship.angle, want);
    const step = SHIP.turnRate * dt;
    ship.angle += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
  }

  if (input.thrust) {
    const a = SHIP.thrust * ship.mods.engine;
    ship.vx += Math.cos(ship.angle) * a * dt;
    ship.vy += Math.sin(ship.angle) * a * dt;
  }

  const damp = Math.exp(-SHIP.friction * dt);
  ship.vx *= damp;
  ship.vy *= damp;

  const max = SHIP.maxSpeed * ship.mods.engine;
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

  // Recharge ticking: only while below max. tryDash starts the cycle; here we
  // count down (scaled by dashRate) and grant a charge on reaching 0, restarting
  // the timer when there's still a charge left to earn.
  if (ship.dash.charges < ship.dash.max) {
    ship.dash.recharge -= dt * (ship.mods.dashRate || 1);
    if (ship.dash.recharge <= 0) {
      ship.dash.charges += 1;
      ship.dash.recharge = ship.dash.charges < ship.dash.max ? DASH.rechargeTime : 0;
    }
  }
}

export function updateGun(ship, input, dt, rng) {
  if (ship.cooldown > 0) return [];
  const autoInt = GUN.autoInterval / ship.mods.fireRate;
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

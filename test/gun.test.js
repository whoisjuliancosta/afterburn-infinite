// test/gun.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateGun } from '../src/ship.js';
import { GUN } from '../src/config.js';

const rngMid = () => 0.5; // zero jitter: (0.5-0.5)*2*spread = 0

test('holding fires once, then respects auto cooldown', () => {
  const s = createShip(0, 0);
  const held = { rotate: 0, thrust: false, held: true, taps: 0 };
  assert.equal(updateGun(s, held, 1 / 60, rngMid).length, 1);
  assert.ok(Math.abs(s.cooldown - GUN.autoInterval) < 1e-9);
  assert.equal(updateGun(s, held, 1 / 60, rngMid).length, 0); // still cooling
});

test('tap fires with 80% of auto interval as cooldown', () => {
  const s = createShip(0, 0);
  const tap = { rotate: 0, thrust: false, held: false, taps: 1 };
  assert.equal(updateGun(s, tap, 1 / 60, rngMid).length, 1);
  assert.ok(Math.abs(s.cooldown - GUN.autoInterval * GUN.semiFloor) < 1e-9);
});

test('semi cooldown scales with fire rate mod', () => {
  const s = createShip(0, 0);
  s.mods.fireRate = 1.25;
  updateGun(s, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.ok(Math.abs(s.cooldown - (GUN.autoInterval / 1.25) * GUN.semiFloor) < 1e-9);
});

test('tap is perfectly accurate, held shot can jitter', () => {
  const sTap = createShip(0, 0);
  sTap.angle = 0;
  const [b] = updateGun(sTap, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, () => 1);
  assert.ok(Math.abs(Math.atan2(b.vy, b.vx)) < 1e-9); // exactly along nose

  const sHeld = createShip(0, 0);
  sHeld.angle = 0;
  const [h] = updateGun(sHeld, { rotate: 0, thrust: false, held: true, taps: 0 }, 1 / 60, () => 1);
  assert.ok(Math.abs(Math.atan2(h.vy, h.vx) - GUN.spreadAngle) < 1e-6); // rng=1 → +spreadAngle
});

test('spread mod adds side bullets on held fire only', () => {
  const s = createShip(0, 0);
  s.mods.spread = 1;
  const held = updateGun(s, { rotate: 0, thrust: false, held: true, taps: 0 }, 1 / 60, rngMid);
  assert.equal(held.length, 3); // center + 2 sides
  const s2 = createShip(0, 0);
  s2.mods.spread = 1;
  const tapped = updateGun(s2, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(tapped.length, 1);
});

test('damage and bullet speed mods apply; firing recoils the ship', () => {
  const s = createShip(0, 0);
  s.angle = 0;
  s.mods.damage = 1;
  s.mods.bulletSpeed = 1.4;
  const [b] = updateGun(s, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(b.damage, GUN.damage + 1);
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - GUN.bulletSpeed * 1.4) < 1e-6);
  assert.ok(Math.abs(b.range - GUN.bulletRange * 1.4) < 1e-6);
  assert.ok(s.vx < 0); // recoil opposite to nose
});

test('bullets carry bounces from the ricochet mod', () => {
  const s = createShip(0, 0);
  const [b0] = updateGun(s, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(b0.bounces, 0); // default: no ricochet

  const s2 = createShip(0, 0);
  s2.mods.bounce = 2;
  const [b2] = updateGun(s2, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(b2.bounces, 2);
});

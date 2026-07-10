// test/boost.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip, addBoost } from '../src/ship.js';
import { BOOST, SHIP } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { held: false, taps: 0, thrust: false, boosting: false };

test('createShip seeds a full first boost unit at base capacity', () => {
  const s = createShip(400, 300);
  assert.deepEqual(s.boost, { meter: 1, units: BOOST.baseUnits, stacks: 0 });
});

test('holding boost drains the meter linearly over time', () => {
  const s = createShip(400, 300);
  updateShip(s, { ...idle, boosting: true }, 1, arena);
  assert.ok(Math.abs(s.boost.meter - (1 - BOOST.drainPerSec)) < 1e-9);
});

test('boost drain floors at zero and never goes negative', () => {
  const s = createShip(400, 300);
  updateShip(s, { ...idle, boosting: true }, 10, arena); // way more than the meter holds
  assert.equal(s.boost.meter, 0);
});

test('boost thrusts toward the nose even without W', () => {
  const s = createShip(400, 300);
  s.angle = 0; // facing +x
  s.vx = 0; s.vy = 0;
  updateShip(s, { ...idle, thrust: false, boosting: true }, 0.1, arena);
  assert.ok(s.vx > 0);
  assert.ok(Math.abs(s.vy) < 1e-9);
});

test('boost applies more thrust than W alone', () => {
  const w = createShip(400, 300); w.angle = 0;
  const b = createShip(400, 300); b.angle = 0;
  updateShip(w, { ...idle, thrust: true, boosting: false }, 0.05, arena);
  updateShip(b, { ...idle, thrust: false, boosting: true }, 0.05, arena);
  assert.ok(b.vx > w.vx);
});

test('speed cap is raised only while boosting', () => {
  const boosting = createShip(400, 300);
  boosting.angle = 0; boosting.vx = 5000; boosting.vy = 0;
  updateShip(boosting, { ...idle, boosting: true }, 1 / 60, arena);
  const boostCap = SHIP.maxSpeed * boosting.mods.engine * BOOST.speedMult;
  assert.ok(Math.abs(Math.hypot(boosting.vx, boosting.vy) - boostCap) < 1e-6);

  const normal = createShip(400, 300);
  normal.angle = 0; normal.vx = 5000; normal.vy = 0;
  updateShip(normal, { ...idle, boosting: false }, 1 / 60, arena);
  const cap = SHIP.maxSpeed * normal.mods.engine;
  assert.ok(Math.abs(Math.hypot(normal.vx, normal.vy) - cap) < 1e-6);
});

test('an empty meter yields no boost cap even while Space is held', () => {
  const s = createShip(400, 300);
  s.boost.meter = 0;
  s.angle = 0; s.vx = 5000; s.vy = 0;
  updateShip(s, { ...idle, boosting: true }, 1 / 60, arena);
  const cap = SHIP.maxSpeed * s.mods.engine; // normal cap, not the boost cap
  assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - cap) < 1e-6);
});

test('ship.boosting is true only while actually draining', () => {
  const s = createShip(400, 300);
  updateShip(s, { ...idle, boosting: false }, 0.1, arena);
  assert.equal(s.boosting, false); // not holding

  updateShip(s, { ...idle, boosting: true }, 0.1, arena);
  assert.equal(s.boosting, true);  // holding with meter

  s.boost.meter = 0;
  updateShip(s, { ...idle, boosting: true }, 0.1, arena);
  assert.equal(s.boosting, false); // holding but empty → not draining
});

test('addBoost adds to the meter and clamps at units', () => {
  const s = createShip(400, 300);
  s.boost.meter = 0.5;
  addBoost(s, 0.3);
  assert.ok(Math.abs(s.boost.meter - 0.8) < 1e-9);
  addBoost(s, 0.8); // would overflow past units
  assert.equal(s.boost.meter, s.boost.units);
  addBoost(s, 0.05); // already full
  assert.equal(s.boost.meter, s.boost.units);
});

test('addBoost clamps to a raised capacity', () => {
  const s = createShip(400, 300);
  s.boost.units = 3;
  s.boost.meter = 2.9;
  addBoost(s, 0.5);
  assert.equal(s.boost.meter, 3);
});

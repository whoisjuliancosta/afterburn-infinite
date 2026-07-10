// test/ship.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip } from '../src/ship.js';
import { SHIP } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { moveX: 0, moveY: 0, held: false, taps: 0 };

test('createShip has spec defaults', () => {
  const s = createShip(400, 300);
  assert.equal(s.hp, 3);
  assert.equal(s.maxHp, 3);
  assert.deepEqual(s.mods, {
    fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1,
    critChance: 0, critMult: 0, dashRate: 1, bounce: 0,
  });
  assert.deepEqual(s.shield, { owned: false, up: false });
});

test('movement input thrusts in screen directions, independent of aim', () => {
  const s = createShip(400, 300);
  s.angle = 0; // aiming right...
  updateShip(s, { ...idle, moveX: 0, moveY: -1 }, 0.1, arena); // ...moving up
  assert.ok(s.vy < 0);
  assert.ok(Math.abs(s.vx) < 1e-9);
});

test('diagonal movement is normalized (no speed advantage)', () => {
  const a = createShip(400, 300);
  const b = createShip(400, 300);
  updateShip(a, { ...idle, moveX: 1, moveY: 0 }, 0.1, arena);
  updateShip(b, { ...idle, moveX: 1, moveY: 1 }, 0.1, arena);
  assert.ok(Math.abs(Math.hypot(a.vx, a.vy) - Math.hypot(b.vx, b.vy)) < 1e-9);
});

test('friction damps velocity when coasting', () => {
  const s = createShip(400, 300);
  s.vx = 200;
  updateShip(s, idle, 0.5, arena);
  assert.ok(s.vx < 200 && s.vx > 0); // slows but keeps drifting
});

test('speed is capped at maxSpeed * engine mod', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  for (let i = 0; i < 300; i++) updateShip(s, { ...idle, thrust: true }, 1 / 60, arena);
  const sp = Math.hypot(s.vx, s.vy);
  assert.ok(sp <= SHIP.maxSpeed + 1e-6);
});

test('soft-bounces off arena edges', () => {
  const s = createShip(5, 300);
  s.vx = -100;
  updateShip(s, idle, 1 / 60, arena);
  assert.equal(s.x, s.radius);
  assert.ok(s.vx > 0); // reflected inward, halved
});

test('iframes and cooldown tick down', () => {
  const s = createShip(400, 300);
  s.iframes = 1; s.cooldown = 1;
  updateShip(s, idle, 0.25, arena);
  assert.equal(s.iframes, 0.75);
  assert.equal(s.cooldown, 0.75);
});

// --- twin-stick aim: nose snaps to the cursor ---

test('angleDiff gives signed shortest rotation', async () => {
  const { angleDiff } = await import('../src/utils.js');
  assert.ok(Math.abs(angleDiff(0, 1) - 1) < 1e-9);
  assert.ok(Math.abs(angleDiff(1, 0) + 1) < 1e-9);
  // across the wrap: from just below +pi to just above -pi is a small positive turn
  assert.ok(Math.abs(angleDiff(3, -3) - (2 * Math.PI - 6)) < 1e-9);
});

test('nose snaps to the aim point instantly', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  updateShip(s, { ...idle, aimX: 400, aimY: 700 }, 0.016, arena); // cursor straight down
  assert.ok(Math.abs(s.angle - Math.PI / 2) < 1e-9);
});

test('no aim fields means angle is untouched (backward compatible)', () => {
  const s = createShip(400, 300);
  s.angle = 1.23;
  updateShip(s, idle, 0.1, arena);
  assert.equal(s.angle, 1.23);
});

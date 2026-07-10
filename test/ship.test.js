// test/ship.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip } from '../src/ship.js';
import { SHIP } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { rotate: 0, thrust: false, held: false, taps: 0 };

test('createShip has spec defaults', () => {
  const s = createShip(400, 300);
  assert.equal(s.hp, 3);
  assert.equal(s.maxHp, 3);
  assert.deepEqual(s.mods, { fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1 });
  assert.deepEqual(s.shield, { owned: false, up: false });
});

test('rotation input turns the ship', () => {
  const s = createShip(400, 300);
  const a0 = s.angle;
  updateShip(s, { ...idle, rotate: 1 }, 0.5, arena);
  assert.ok(Math.abs(s.angle - a0 - SHIP.turnRate * 0.5) < 1e-9);
});

test('thrust accelerates in facing direction', () => {
  const s = createShip(400, 300);
  s.angle = 0; // facing +x
  updateShip(s, { ...idle, thrust: true }, 0.1, arena);
  assert.ok(s.vx > 0);
  assert.ok(Math.abs(s.vy) < 1e-9);
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

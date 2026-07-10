// test/enemies.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleFor, spawnEnemy, updateEnemy, deathSpawns } from '../src/enemies.js';
import { ENEMIES } from '../src/config.js';

const ship = { x: 400, y: 300 };

test('scaleFor grows 4% per wave', () => {
  assert.equal(scaleFor(1), 1);
  assert.ok(Math.abs(scaleFor(6) - 1.2) < 1e-9);
});

test('spawnEnemy applies wave scaling to hp and speed', () => {
  const e = spawnEnemy('drifter', 0, 0, 6);
  assert.equal(e.hp, Math.round(ENEMIES.drifter.hp * 1.2));
  assert.ok(Math.abs(e.speed - ENEMIES.drifter.speed * 1.2) < 1e-9);
  assert.equal(e.score, ENEMIES.drifter.score);
});

test('drifter chases the ship', () => {
  const e = spawnEnemy('drifter', 0, 300, 1);
  updateEnemy(e, ship, 0.1);
  assert.ok(e.x > 0);
  assert.ok(Math.abs(e.vy) < 1e-9); // straight toward ship on same row
});

test('darter aims then lunges fast', () => {
  const e = spawnEnemy('darter', 200, 300, 1); // within aimRange (260) of ship
  updateEnemy(e, ship, 1 / 60);
  assert.equal(e.state, 'aim');
  // wait out aimTime
  for (let t = 0; t < ENEMIES.darter.aimTime + 0.05; t += 1 / 60) updateEnemy(e, ship, 1 / 60);
  assert.equal(e.state, 'lunge');
  assert.ok(Math.hypot(e.vx, e.vy) > ENEMIES.darter.speed * 2);
});

test('splitter spawns two minis on death, minis do not split', () => {
  const e = spawnEnemy('splitter', 100, 100, 3);
  const kids = deathSpawns(e);
  assert.equal(kids.length, 2);
  assert.ok(kids.every(k => k.type === 'mini' && k.wave === 3));
  assert.equal(deathSpawns(kids[0]).length, 0);
});

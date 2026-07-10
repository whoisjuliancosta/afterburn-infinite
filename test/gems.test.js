// test/gems.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMS } from '../src/config.js';
import { makeRng } from '../src/utils.js';
import {
  createGems, spawnGem, spawnGemRing, updateGems, gemBlinking, BLINK_TIME,
} from '../src/gems.js';

test('createGems starts empty', () => {
  const g = createGems();
  assert.deepEqual(g.list, []);
});

test('spawnGem populates position, value, age, lifetime, radius and a scatter velocity', () => {
  const g = createGems();
  const rng = makeRng(1);
  const gem = spawnGem(g, 40, 50, 130, rng);
  assert.equal(g.list.length, 1);
  assert.equal(gem.x, 40);
  assert.equal(gem.y, 50);
  assert.equal(gem.value, 130);
  assert.equal(gem.age, 0);
  assert.equal(gem.lifetime, GEMS.lifetime);
  assert.equal(gem.radius, GEMS.radius);
  // scatter velocity is non-zero
  assert.ok(Math.hypot(gem.vx, gem.vy) > 0);
});

test('spawnGem is deterministic under a seeded rng', () => {
  const a = createGems();
  const b = createGems();
  const g1 = spawnGem(a, 0, 0, 10, makeRng(42));
  const g2 = spawnGem(b, 0, 0, 10, makeRng(42));
  assert.equal(g1.vx, g2.vx);
  assert.equal(g1.vy, g2.vy);
});

test('magnet pulls a gem inside magnetRadius toward the ship', () => {
  const g = createGems();
  const gem = spawnGem(g, 100, 0, 10, makeRng(1));
  gem.vx = 0; gem.vy = 0; // isolate the magnet from scatter
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  // dist 100 < 130: accelerated toward origin, so x decreased
  assert.ok(g.list[0].x < 100);
  assert.ok(g.list[0].vx < 0);
});

test('magnet does NOT pull a gem outside magnetRadius', () => {
  const g = createGems();
  const gem = spawnGem(g, 200, 0, 10, makeRng(1));
  gem.vx = 0; gem.vy = 0;
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  // dist 200 > 130: no acceleration, velocity stays zero, position unchanged
  assert.equal(g.list[0].vx, 0);
  assert.equal(g.list[0].x, 200);
});

test('gem speed is capped at GEMS.maxSpeed', () => {
  const g = createGems();
  const gem = spawnGem(g, 50, 0, 10, makeRng(1));
  gem.vx = 100000; gem.vy = 0; // absurd velocity
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.016);
  assert.ok(Math.hypot(g.list[0].vx, g.list[0].vy) <= GEMS.maxSpeed + 1e-6);
});

test('collecting a gem returns its value+position and removes it from the list', () => {
  const g = createGems();
  spawnGem(g, 5, 0, 250, makeRng(1)); // within ship radius + gem radius
  const ship = { x: 0, y: 0, radius: 18 };
  const collected = updateGems(g, ship, 0.016);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].value, 250);
  assert.equal(typeof collected[0].x, 'number');
  assert.equal(typeof collected[0].y, 'number');
  assert.equal(g.list.length, 0);
});

test('an expired gem is culled without being collected', () => {
  const g = createGems();
  const gem = spawnGem(g, 500, 500, 10, makeRng(1));
  gem.age = GEMS.lifetime - 0.05;
  const ship = { x: 100000, y: 0, radius: 18 }; // far away
  const collected = updateGems(g, ship, 0.1); // pushes age past lifetime
  assert.equal(collected.length, 0);
  assert.equal(g.list.length, 0);
});

test('a gem within its lifetime survives an update', () => {
  const g = createGems();
  spawnGem(g, 500, 500, 10, makeRng(1));
  const ship = { x: 100000, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  assert.equal(g.list.length, 1);
  assert.ok(Math.abs(g.list[0].age - 0.1) < 1e-9);
});

test('spawnGemRing places n gems evenly on a ~40px ring around the centre', () => {
  const g = createGems();
  const gems = spawnGemRing(g, 100, 100, 42, 6, makeRng(7));
  assert.equal(g.list.length, 6);
  assert.equal(gems.length, 6);
  // each gem ~40px from the centre
  for (const gem of gems) {
    assert.ok(Math.abs(Math.hypot(gem.x - 100, gem.y - 100) - 40) < 1e-6);
    assert.equal(gem.value, 42);
  }
  // evenly spaced: adjacent angular gaps equal (~TAU/6)
  const angs = gems.map(gem => Math.atan2(gem.y - 100, gem.x - 100)).sort((a, b) => a - b);
  for (let i = 1; i < angs.length; i++) {
    assert.ok(Math.abs((angs[i] - angs[i - 1]) - (Math.PI * 2 / 6)) < 1e-6);
  }
});

test('ring gems drift outward from the centre', () => {
  const g = createGems();
  const gems = spawnGemRing(g, 0, 0, 10, 4, makeRng(3));
  for (const gem of gems) {
    // outward drift: velocity points the same way as the offset from centre
    const dot = gem.x * gem.vx + gem.y * gem.vy;
    assert.ok(dot > 0);
  }
});

test('spawnGemRing is deterministic under a seeded rng', () => {
  const a = createGems();
  const b = createGems();
  spawnGemRing(a, 0, 0, 10, 6, makeRng(99));
  spawnGemRing(b, 0, 0, 10, 6, makeRng(99));
  assert.deepEqual(a.list, b.list);
});

test('gemBlinking is true only during the last BLINK_TIME seconds of life', () => {
  const g = createGems();
  const gem = spawnGem(g, 0, 0, 10, makeRng(1));
  gem.age = GEMS.lifetime - BLINK_TIME - 0.1;
  assert.equal(gemBlinking(gem), false);
  gem.age = GEMS.lifetime - BLINK_TIME + 0.1;
  assert.equal(gemBlinking(gem), true);
});

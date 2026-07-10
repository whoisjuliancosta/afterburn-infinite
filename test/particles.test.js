// test/particles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFx, burst, addShake, addPause, updateFx, MAX_PARTICLES } from '../src/particles.js';
import { makeRng } from '../src/utils.js';

test('burst adds n particles at the origin point', () => {
  const fx = createFx();
  burst(fx, 10, 20, '#fff', 12, makeRng(1));
  assert.equal(fx.particles.length, 12);
  assert.ok(fx.particles.every(p => p.x === 10 && p.y === 20));
});

test('particles move and expire', () => {
  const fx = createFx();
  burst(fx, 0, 0, '#fff', 5, makeRng(1));
  updateFx(fx, 0.1);
  assert.ok(fx.particles.length === 5);
  assert.ok(fx.particles.some(p => p.x !== 0 || p.y !== 0));
  updateFx(fx, 2); // way past max life (0.7s)
  assert.equal(fx.particles.length, 0);
});

test('MAX_PARTICLES cap is 320', () => {
  assert.equal(MAX_PARTICLES, 320);
});

test('burst never exceeds the cap, dropping oldest particles', () => {
  const fx = createFx();
  // Fill just below the cap, tagging each with an ordinal so we can prove which
  // survive: oldest inserted must be the ones evicted.
  burst(fx, 0, 0, '#fff', 310, makeRng(1));
  fx.particles.forEach((p, i) => { p.id = i; });
  assert.equal(fx.particles.length, 310);
  // 30 more overflows the 320 cap by 20 → the 20 oldest (ids 0..19) drop.
  burst(fx, 5, 5, '#f00', 30, makeRng(2));
  assert.equal(fx.particles.length, MAX_PARTICLES);
  // Survivors keep insertion order; the first survivor is old id 20.
  assert.equal(fx.particles[0].id, 20);
  // The freshly-added particles are all present at the tail.
  assert.ok(fx.particles.slice(-30).every(p => p.color === '#f00'));
});

test('a single oversized burst is clamped to the cap', () => {
  const fx = createFx();
  burst(fx, 0, 0, '#fff', 500, makeRng(1));
  assert.equal(fx.particles.length, MAX_PARTICLES);
});

test('shake takes the max and decays to zero', () => {
  const fx = createFx();
  addShake(fx, 8);
  addShake(fx, 3); // weaker shake never reduces current
  assert.equal(fx.shake, 8);
  updateFx(fx, 1);
  assert.equal(fx.shake, 0);
});

test('pause counts down', () => {
  const fx = createFx();
  addPause(fx, 0.05);
  updateFx(fx, 0.02);
  assert.ok(Math.abs(fx.pause - 0.03) < 1e-9);
});

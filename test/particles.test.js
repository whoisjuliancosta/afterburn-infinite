// test/particles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFx, burst, addShake, addPause, updateFx } from '../src/particles.js';
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

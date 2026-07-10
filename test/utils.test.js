// test/utils.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAU, clamp, dist, makeRng, pick, loadBest, saveBest } from '../src/utils.js';

test('clamp bounds values', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('dist is euclidean', () => {
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('makeRng is deterministic and in [0,1)', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('pick selects from array', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 20; i++) assert.ok([1, 2, 3].includes(pick(rng, [1, 2, 3])));
});

test('best-score storage is safe without localStorage', () => {
  assert.equal(loadBest(), 0);
  assert.doesNotThrow(() => saveBest(123));
});

test('TAU is a full circle', () => {
  assert.equal(TAU, Math.PI * 2);
});

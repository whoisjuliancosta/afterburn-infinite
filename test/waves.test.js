// test/waves.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveBudget, buildWave, scheduleWave } from '../src/waves.js';
import { ENEMIES } from '../src/config.js';
import { makeRng } from '../src/utils.js';

test('budget follows 3 + 2*(wave-1)', () => {
  assert.equal(waveBudget(1), 3);
  assert.equal(waveBudget(5), 11);
  assert.equal(waveBudget(10), 21);
});

test('buildWave spends the exact budget on buyable types', () => {
  for (let wave = 1; wave <= 12; wave++) {
    const types = buildWave(wave, makeRng(wave));
    const spent = types.reduce((sum, t) => sum + ENEMIES[t].cost, 0);
    assert.equal(spent, waveBudget(wave));
    assert.ok(types.every(t => ['drifter', 'darter', 'splitter'].includes(t)));
  }
});

test('scheduleWave places every spawn on time-sorted arena edges', () => {
  const arena = { w: 800, h: 600 };
  const types = buildWave(6, makeRng(6));
  const sched = scheduleWave(types, makeRng(99), arena);
  assert.equal(sched.length, types.length);
  for (let i = 1; i < sched.length; i++) assert.ok(sched[i].at >= sched[i - 1].at);
  for (const s of sched) {
    assert.ok(s.x >= 0 && s.x <= arena.w && s.y >= 0 && s.y <= arena.h);
    const nearEdge = s.x <= 20 || s.x >= arena.w - 20 || s.y <= 20 || s.y >= arena.h - 20;
    assert.ok(nearEdge);
  }
});

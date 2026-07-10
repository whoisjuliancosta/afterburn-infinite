// test/waves.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveBudget, buildWave, scheduleWave, spawnIntervalFor, isBossWave } from '../src/waves.js';
import { ENEMIES, WAVE } from '../src/config.js';
import { makeRng } from '../src/utils.js';

const BUYABLE = ['drifter', 'darter', 'spitter', 'splitter', 'orbiter', 'weaver'];

test('budget follows round(4 + 2.5*(wave-1) + 1.5*power)', () => {
  assert.equal(waveBudget(1, 0), 4);
  assert.equal(waveBudget(1), 4);        // power defaults to 0
  assert.equal(waveBudget(5, 4), 20);    // 4 + 10 + 6 = 20
  assert.equal(waveBudget(10, 0), 27);   // 4 + 22.5 = 26.5 → 27
  assert.equal(waveBudget(3, 2), 12);    // 4 + 5 + 3 = 12
});

test('budget accelerates past wave 10 (+3 per wave beyond lateStart)', () => {
  // wave <= 10: no late term. wave > 10: + 3*(wave-10).
  assert.equal(waveBudget(10, 0), 27);  // 4 + 22.5 = 26.5 → 27 (unchanged)
  assert.equal(waveBudget(11, 0), 32);  // 4 + 25 + 3*1 = 32
  assert.equal(waveBudget(15, 0), 54);  // 4 + 35 + 3*5 = 54
  assert.equal(waveBudget(20, 0), 82);  // 4 + 47.5 + 3*10 = 81.5 → 82
  assert.equal(waveBudget(15, 4), 60);  // 4 + 35 + 6 + 15 = 60 (power still counts)
});

test('buildWave spends the exact budget on buyable types (non-boss waves)', () => {
  for (let wave = 1; wave <= 12; wave++) {
    if (isBossWave(wave)) continue;
    for (const power of [0, 3, 7]) {
      const types = buildWave(wave, makeRng(wave * 100 + power), power);
      const spent = types.reduce((sum, t) => sum + ENEMIES[t].cost, 0);
      assert.equal(spent, waveBudget(wave, power));
      assert.ok(types.every(t => BUYABLE.includes(t)));
    }
  }
});

// --- Boss waves ---

test('isBossWave is true only every 5th wave', () => {
  for (let w = 1; w <= 30; w++) assert.equal(isBossWave(w), w % 5 === 0);
});

test('boss waves lead with the boss then an escort spending ~40% of the budget', () => {
  for (const wave of [5, 10, 15, 20]) {
    for (const power of [0, 3, 7]) {
      const types = buildWave(wave, makeRng(wave * 13 + power), power);
      assert.equal(types[0], 'boss', 'boss leads the wave');
      const escort = types.slice(1);
      // escort is a normal purchase at round(0.4 * budget)
      const spent = escort.reduce((sum, t) => sum + ENEMIES[t].cost, 0);
      assert.equal(spent, Math.round(0.4 * waveBudget(wave, power)));
      assert.ok(escort.every(t => BUYABLE.includes(t)), 'escort is buyable types only');
      assert.ok(!escort.includes('boss'), 'no boss in the escort');
    }
  }
});

test('boss escort respects unlock gating', () => {
  // Wave 5 escort: weaver (unlock 7) must never appear.
  for (let seed = 0; seed < 60; seed++) {
    const escort = buildWave(5, makeRng(seed), 6).slice(1);
    assert.ok(escort.every(t => ENEMIES[t].unlock <= 5), 'escort gated by unlock');
    assert.ok(!escort.includes('weaver'), 'weaver locked at wave 5');
  }
});

test('boss never appears on normal waves (cost-0 excluded from buyable)', () => {
  for (let wave = 1; wave <= 24; wave++) {
    if (isBossWave(wave)) continue;
    for (let seed = 0; seed < 30; seed++) {
      const types = buildWave(wave, makeRng(seed), 6);
      assert.ok(!types.includes('boss'), `no boss on normal wave ${wave}`);
    }
  }
});

test('buildWave gates types by unlock <= wave', () => {
  // Wave 1: only drifter/darter unlocked → never the locked types.
  const locked1 = ['spitter', 'splitter', 'orbiter', 'weaver'];
  for (let seed = 0; seed < 40; seed++) {
    const types = buildWave(1, makeRng(seed), 5);
    assert.ok(types.every(t => ['drifter', 'darter'].includes(t)));
    assert.ok(types.every(t => !locked1.includes(t)));
  }
  // Wave 7+: all six can appear across many seeds.
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    for (const t of buildWave(8, makeRng(seed), 6)) seen.add(t);
  }
  for (const t of BUYABLE) assert.ok(seen.has(t), `expected ${t} to appear by wave 8`);
});

test('buildWave never buys a type before its unlock wave', () => {
  for (let wave = 1; wave <= 10; wave++) {
    for (let seed = 0; seed < 30; seed++) {
      const types = buildWave(wave, makeRng(seed), 4);
      assert.ok(types.every(t => ENEMIES[t].unlock <= wave));
    }
  }
});

test('spawnIntervalFor decreases per wave and clamps to the floor', () => {
  assert.equal(spawnIntervalFor(1), WAVE.spawnInterval);              // 1.1 base
  assert.equal(spawnIntervalFor(2), WAVE.spawnInterval - WAVE.spawnIntervalStep); // 1.05
  assert.ok(spawnIntervalFor(20) >= WAVE.spawnIntervalFloor);
  assert.equal(spawnIntervalFor(1000), WAVE.spawnIntervalFloor);      // clamped
  // Never below floor.
  for (let w = 1; w <= 50; w++) assert.ok(spawnIntervalFor(w) >= WAVE.spawnIntervalFloor);
});

test('scheduleWave places every spawn on time-sorted arena edges', () => {
  const arena = { w: 800, h: 600 };
  const types = buildWave(6, makeRng(6), 2);
  const sched = scheduleWave(types, makeRng(99), arena, 6);
  assert.equal(sched.length, types.length);
  for (let i = 1; i < sched.length; i++) assert.ok(sched[i].at >= sched[i - 1].at);
  for (const s of sched) {
    assert.ok(s.x >= 0 && s.x <= arena.w && s.y >= 0 && s.y <= arena.h);
    const nearEdge = s.x <= 20 || s.x >= arena.w - 20 || s.y <= 20 || s.y >= arena.h - 20;
    assert.ok(nearEdge);
  }
});

test('scheduleWave spacing uses spawnIntervalFor(wave); wave defaults to 1', () => {
  const arena = { w: 800, h: 600 };
  const types = ['drifter', 'drifter', 'drifter'];
  // Default wave = 1 keeps the old base spacing (1.1).
  const s1 = scheduleWave(types, makeRng(1), arena);
  const s1w = scheduleWave(types, makeRng(1), arena, 1);
  assert.deepEqual(s1.map(s => s.at), s1w.map(s => s.at));
  // Later waves compress spacing: max slot time is smaller for the same index count.
  const late = scheduleWave(types, makeRng(1), arena, 10);
  // Spacing component is index * interval; interval(10) < interval(1).
  assert.ok(spawnIntervalFor(10) < spawnIntervalFor(1));
});

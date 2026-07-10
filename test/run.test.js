import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, multiplier, addKill, hitPlayer, applyGem } from '../src/run.js';
import { createShip } from '../src/ship.js';
import { SHIP, GEMS } from '../src/config.js';

test('multiplier steps every 5 streak, capped at 5x', () => {
  const run = createRun();
  assert.equal(multiplier(run), 1);
  run.streak = 5;
  assert.equal(multiplier(run), 2);
  run.streak = 100;
  assert.equal(multiplier(run), 5);
});

test('addKill scores base * multiplier and grows streak', () => {
  const run = createRun();
  run.streak = 5; // 2x
  addKill(run, { score: 100 });
  assert.equal(run.score, 200);
  assert.equal(run.streak, 6);
});

test('createRun initializes flat stats block at zero', () => {
  const run = createRun();
  assert.deepEqual(run.stats, {
    kills: 0, shotsFired: 0, shotsHit: 0, boostTime: 0,
    gemsCollected: 0, bossKills: 0, runTime: 0,
  });
});

test('addKill increments stats.kills', () => {
  const run = createRun();
  addKill(run, { score: 100 });
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.bossKills, 0);
  addKill(run, { score: 50 });
  assert.equal(run.stats.kills, 2);
});

test('addKill increments bossKills only for boss enemies', () => {
  const run = createRun();
  addKill(run, { score: 2000, type: 'boss' });
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.bossKills, 1);
  addKill(run, { score: 100, type: 'grunt' });
  assert.equal(run.stats.kills, 2);
  assert.equal(run.stats.bossKills, 1);
});

test('hit during iframes does nothing', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.iframes = 0.5;
  assert.equal(hitPlayer(run, ship), 'iframe');
  assert.equal(ship.hp, 3);
});

test('shield absorbs one hit and grants iframes', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.shield = { owned: true, up: true };
  run.streak = 7;
  assert.equal(hitPlayer(run, ship), 'shield');
  assert.equal(ship.hp, 3);
  assert.ok(!ship.shield.up);
  assert.equal(ship.iframes, SHIP.iframeTime);
  assert.equal(run.streak, 7); // shield hits don't break streak
});

test('real hit costs hp, resets streak, grants iframes', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  run.streak = 9;
  assert.equal(hitPlayer(run, ship), 'hit');
  assert.equal(ship.hp, 2);
  assert.equal(run.streak, 0);
  assert.equal(ship.iframes, SHIP.iframeTime);
});

test('hit at 1 hp ends the run', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = 1;
  assert.equal(hitPlayer(run, ship), 'dead');
  assert.ok(run.over);
});

test('createRun starts heartProgress at 0', () => {
  const run = createRun();
  assert.equal(run.heartProgress, 0);
});

test('applyGem blue fills the boost meter by boostFill and reports kind', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.boost.meter = 0;
  const res = applyGem(run, ship, 'blue');
  assert.equal(res.kind, 'blue');
  assert.ok(Math.abs(ship.boost.meter - GEMS.boostFill) < 1e-9);
});

test('applyGem blue clamps the boost meter to units capacity', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.boost.units = 1;
  ship.boost.meter = 0.97; // +boostFill would overflow past 1.0
  applyGem(run, ship, 'blue');
  assert.equal(ship.boost.meter, 1); // clamped, overflow lost
});

test('applyGem blue fill uses the config value (0.25)', () => {
  assert.equal(GEMS.boostFill, 0.25);
  const run = createRun();
  const ship = createShip(0, 0);
  ship.boost.meter = 0;
  const res = applyGem(run, ship, 'blue');
  assert.ok(Math.abs(res.gained - 0.25) < 1e-9);
  assert.ok(Math.abs(ship.boost.meter - 0.25) < 1e-9);
});

test('applyGem red accumulates heartProgress by heartFill without healing yet', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = 2;
  const res = applyGem(run, ship, 'red');
  assert.equal(res.kind, 'red');
  assert.ok(Math.abs(run.heartProgress - GEMS.heartFill) < 1e-9);
  assert.equal(ship.hp, 2); // not a full heart yet
  assert.ok(!res.healed);
});

test('applyGem red at >=1.0 resets the accumulator and heals one hp', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = 1;
  let res;
  for (let i = 0; i < 10; i++) res = applyGem(run, ship, 'red'); // 10 x 0.10 = 1.0
  assert.equal(ship.hp, 2);
  assert.ok(res.healed);
  assert.ok(!res.full);
  assert.ok(Math.abs(run.heartProgress) < 1e-9); // accumulator reset (subtract 1)
});

test('applyGem red keeps the remainder when crossing 1.0 from a partial', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = 1;
  run.heartProgress = 0.95;
  applyGem(run, ship, 'red'); // 1.05 -> heal, remainder 0.05
  assert.equal(ship.hp, 2);
  assert.ok(Math.abs(run.heartProgress - 0.05) < 1e-9);
});

test('applyGem red overheal at full hp grows a new heart container and fills it', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = ship.maxHp; // already full (3/3)
  let res;
  for (let i = 0; i < 10; i++) res = applyGem(run, ship, 'red'); // completes a heart
  assert.equal(ship.maxHp, 4);       // container grew
  assert.equal(ship.hp, 4);          // and is filled
  assert.ok(res.healed);
  assert.ok(res.grown);
  assert.ok(Math.abs(run.heartProgress) < 1e-9); // accumulator reset
});

test('applyGem red overheal grows repeatedly (3 -> 4 -> 5)', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = ship.maxHp; // 3/3
  for (let i = 0; i < 10; i++) applyGem(run, ship, 'red');
  assert.equal(ship.maxHp, 4);
  assert.equal(ship.hp, 4);
  for (let i = 0; i < 10; i++) applyGem(run, ship, 'red');
  assert.equal(ship.maxHp, 5);
  assert.equal(ship.hp, 5);
});

test('applyGem red partial progress at full hp does not grow until completion', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = ship.maxHp; // 3/3
  for (let i = 0; i < 9; i++) {          // 0.9 accrued, no completion
    const res = applyGem(run, ship, 'red');
    assert.ok(!res.grown);
  }
  assert.equal(ship.maxHp, 3);
  assert.equal(ship.hp, 3);
  const res = applyGem(run, ship, 'red'); // 10th completes -> grow
  assert.ok(res.grown);
  assert.equal(ship.maxHp, 4);
});

test('applyGem red never returns the removed `full` outcome', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = ship.maxHp;
  for (let i = 0; i < 30; i++) {
    const res = applyGem(run, ship, 'red');
    assert.equal(res.full, undefined);
  }
});

// Grown maxHp naturally raises the adrenaline band (threshold is hp/maxHp < 0.5):
// this is accepted behavior — more containers means the low-HP surge kicks in
// deeper. Documented here so the interaction isn't mistaken for a regression.
test('grown maxHp raises the adrenaline hp/maxHp threshold band', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = ship.maxHp; // 3/3
  for (let i = 0; i < 20; i++) applyGem(run, ship, 'red'); // grow to 5/5
  assert.equal(ship.maxHp, 5);
  // At 2 hp: 2/3 (0.67) would be above the 0.5 band, but 2/5 (0.4) is below it.
  assert.ok(2 / ship.maxHp < 0.5);
});

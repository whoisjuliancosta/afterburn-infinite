import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, multiplier, addKill, hitPlayer } from '../src/run.js';
import { createShip } from '../src/ship.js';
import { SHIP } from '../src/config.js';

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
    kills: 0, shotsFired: 0, shotsHit: 0, dashes: 0,
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

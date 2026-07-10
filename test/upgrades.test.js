// test/upgrades.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, rollOffers, applyUpgrade } from '../src/upgrades.js';
import { createShip } from '../src/ship.js';
import { makeRng } from '../src/utils.js';

test('pool has the 15 spec upgrades', () => {
  const ids = UPGRADES.map(u => u.id).sort();
  assert.deepEqual(ids, [
    'aegis', 'deadeye', 'engine', 'executioner', 'extradash', 'heavy', 'hull',
    'overclock', 'pierce', 'rapid', 'recovery', 'ricochet', 'secondwind', 'spread', 'velocity',
  ]);
});

test('upgrades stack multiplicatively/additively per spec', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'rapid');
  applyUpgrade(s, 'rapid');
  assert.ok(Math.abs(s.mods.fireRate - 1.5625) < 1e-9); // 1.25^2
  applyUpgrade(s, 'heavy');
  assert.equal(s.mods.damage, 1);
  applyUpgrade(s, 'pierce');
  applyUpgrade(s, 'pierce');
  assert.equal(s.mods.pierce, 2);
});

test('hull plating raises max hp and heals 1, capped', () => {
  const s = createShip(0, 0); // 3/3
  applyUpgrade(s, 'hull');
  assert.equal(s.maxHp, 4);
  assert.equal(s.hp, 4); // healed into new cap
  s.hp = 1;
  applyUpgrade(s, 'hull');
  assert.equal(s.maxHp, 5);
  assert.equal(s.hp, 2);
});

test('aegis grants an up shield', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'aegis');
  assert.deepEqual(s.shield, { owned: true, up: true });
});

test('offers are 3 unique upgrades', () => {
  const s = createShip(0, 0);
  const offers = rollOffers(s, makeRng(3));
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(o => o.id)).size, 3);
});

test('aegis never re-offered once owned', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'aegis');
  for (let seed = 0; seed < 50; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== 'aegis'));
  }
});

// --- new v2 upgrades ---

test('deadeye adds crit chance additively', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'deadeye');
  assert.ok(Math.abs(s.mods.critChance - 0.08) < 1e-9);
  applyUpgrade(s, 'deadeye');
  assert.ok(Math.abs(s.mods.critChance - 0.16) < 1e-9);
});

test('executioner adds crit multiplier additively', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'executioner');
  assert.ok(Math.abs(s.mods.critMult - 0.5) < 1e-9);
  applyUpgrade(s, 'executioner');
  assert.ok(Math.abs(s.mods.critMult - 1.0) < 1e-9);
});

test('extradash raises dash max, grants a charge, and counts a stack', () => {
  const s = createShip(0, 0); // charges = max = 2, stacks 0
  applyUpgrade(s, 'extradash');
  assert.equal(s.dash.max, 3);
  assert.equal(s.dash.charges, 3);
  assert.equal(s.dash.stacks, 1);
  applyUpgrade(s, 'extradash');
  assert.equal(s.dash.max, 4);
  assert.equal(s.dash.charges, 4);
  assert.equal(s.dash.stacks, 2);
});

test('recovery speeds dash recharge multiplicatively', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'recovery');
  assert.ok(Math.abs(s.mods.dashRate - 1.25) < 1e-9);
  applyUpgrade(s, 'recovery');
  assert.ok(Math.abs(s.mods.dashRate - 1.5625) < 1e-9); // 1.25^2
});

test('ricochet adds a bounce per stack', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'ricochet');
  assert.equal(s.mods.bounce, 1);
  applyUpgrade(s, 'ricochet');
  assert.equal(s.mods.bounce, 2);
});

test('overclock boosts fire rate and bullet speed together', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'overclock');
  assert.ok(Math.abs(s.mods.fireRate - 1.1) < 1e-9);
  assert.ok(Math.abs(s.mods.bulletSpeed - 1.1) < 1e-9);
});

test('secondwind heals 2 capped at maxHp', () => {
  const s = createShip(0, 0); // 3/3
  s.hp = 1;
  applyUpgrade(s, 'secondwind');
  assert.equal(s.hp, 3); // 1 + 2
  s.maxHp = 6; s.hp = 5;
  applyUpgrade(s, 'secondwind');
  assert.equal(s.hp, 6); // capped, not 7
});

test('extradash excluded once at 2 stacks (re-rolls like aegis)', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'extradash');
  applyUpgrade(s, 'extradash'); // stacks now 2
  assert.equal(s.dash.stacks, 2);
  for (let seed = 0; seed < 50; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== 'extradash'));
  }
});

test('extradash still offerable below 2 stacks', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'extradash'); // stacks 1
  let seen = false;
  for (let seed = 0; seed < 50 && !seen; seed++) {
    if (rollOffers(s, makeRng(seed)).some(o => o.id === 'extradash')) seen = true;
  }
  assert.ok(seen);
});

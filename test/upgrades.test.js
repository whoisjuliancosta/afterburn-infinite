// test/upgrades.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, rollOffers, applyUpgrade } from '../src/upgrades.js';
import { createShip } from '../src/ship.js';
import { makeRng } from '../src/utils.js';

test('pool has the 8 spec upgrades', () => {
  const ids = UPGRADES.map(u => u.id).sort();
  assert.deepEqual(ids, ['aegis', 'engine', 'heavy', 'hull', 'pierce', 'rapid', 'spread', 'velocity']);
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

// test/upgrades.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, rollOffers, applyUpgrade } from '../src/upgrades.js';
import { createShip } from '../src/ship.js';
import { makeRng } from '../src/utils.js';
import { CAPS, BOOST } from '../src/config.js';

test('pool has the 21 spec upgrades (v5.1 adds six)', () => {
  const ids = UPGRADES.map(u => u.id).sort();
  assert.deepEqual(ids, [
    'adrenaline', 'aegis', 'attractor', 'bigpayload', 'boosttank', 'burners', 'deadeye',
    'engine', 'executioner', 'fastreload', 'heavy', 'hull', 'lucky', 'overclock', 'pierce',
    'rapid', 'rearguard', 'ricochet', 'secondwind', 'spread', 'velocity',
  ]);
  assert.equal(new Set(ids).size, 21);
});

test('legacy ids extradash/recovery are gone from the pool', () => {
  const ids = UPGRADES.map(u => u.id);
  assert.ok(!ids.includes('extradash'));
  assert.ok(!ids.includes('recovery'));
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

// --- crit upgrades ---

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

// --- reworked pair: Boost Tank + Attractor ---

test('boosttank adds a boost unit and counts a stack', () => {
  const s = createShip(0, 0); // units = baseUnits, stacks 0
  applyUpgrade(s, 'boosttank');
  assert.equal(s.boost.units, BOOST.baseUnits + 1);
  assert.equal(s.boost.stacks, 1);
  applyUpgrade(s, 'boosttank');
  assert.equal(s.boost.units, BOOST.baseUnits + 2);
  assert.equal(s.boost.stacks, 2);
});

test('boosttank units never exceed BOOST.maxUnits', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 8; i++) applyUpgrade(s, 'boosttank');
  assert.equal(s.boost.units, BOOST.maxUnits);
});

test('boosttank excluded once at 6 stacks (re-rolls like aegis)', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 6; i++) applyUpgrade(s, 'boosttank');
  assert.equal(s.boost.stacks, 6);
  for (let seed = 0; seed < 50; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== 'boosttank'));
  }
});

test('boosttank still offerable below 6 stacks', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 5; i++) applyUpgrade(s, 'boosttank'); // stacks 5
  let seen = false;
  for (let seed = 0; seed < 50 && !seen; seed++) {
    if (rollOffers(s, makeRng(seed)).some(o => o.id === 'boosttank')) seen = true;
  }
  assert.ok(seen);
});

test('attractor multiplies gem magnet radius by 1.45 per stack', () => {
  const s = createShip(0, 0);
  assert.equal(s.mods.magnet, 1);
  applyUpgrade(s, 'attractor');
  assert.ok(Math.abs(s.mods.magnet - 1.45) < 1e-9);
  applyUpgrade(s, 'attractor');
  assert.ok(Math.abs(s.mods.magnet - 1.45 * 1.45) < 1e-9);
});

test('attractor excluded once at 6 stacks (magnet at 1.45^6)', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 6; i++) applyUpgrade(s, 'attractor');
  for (let seed = 0; seed < 50; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== 'attractor'));
  }
});

test('attractor still offerable below 6 stacks', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 5; i++) applyUpgrade(s, 'attractor'); // 5 stacks
  let seen = false;
  for (let seed = 0; seed < 50 && !seen; seed++) {
    if (rollOffers(s, makeRng(seed)).some(o => o.id === 'attractor')) seen = true;
  }
  assert.ok(seen);
});

// --- spec E: stat caps ---

test('every mod holds at its cap under repeated application', () => {
  const s = createShip(0, 0);
  for (let i = 0; i < 40; i++) {
    applyUpgrade(s, 'rapid');
    applyUpgrade(s, 'engine');
    applyUpgrade(s, 'velocity');
    applyUpgrade(s, 'pierce');
    applyUpgrade(s, 'spread');
    applyUpgrade(s, 'ricochet');
    applyUpgrade(s, 'overclock');
  }
  assert.equal(s.mods.fireRate, CAPS.fireRate);
  assert.equal(s.mods.engine, CAPS.engine);
  assert.equal(s.mods.bulletSpeed, CAPS.bulletSpeed);
  assert.equal(s.mods.pierce, CAPS.pierce);
  assert.equal(s.mods.spread, CAPS.spread);
  assert.equal(s.mods.bounce, CAPS.bounce);
});

test('each capped upgrade disappears from offers once its stat is maxed', () => {
  const cases = [
    ['rapid', 'fireRate'],
    ['engine', 'engine'],
    ['velocity', 'bulletSpeed'],
    ['pierce', 'pierce'],
    ['spread', 'spread'],
    ['ricochet', 'bounce'],
  ];
  for (const [id] of cases) {
    const s = createShip(0, 0);
    for (let i = 0; i < 40; i++) applyUpgrade(s, id);
    for (let seed = 0; seed < 40; seed++) {
      assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== id),
        `${id} should be excluded at cap (seed ${seed})`);
    }
  }
});

test('overclock only excluded when BOTH fireRate and bulletSpeed are capped', () => {
  // fireRate capped alone (via rapid) — overclock still offerable since bulletSpeed can grow.
  const s = createShip(0, 0);
  for (let i = 0; i < 40; i++) applyUpgrade(s, 'rapid');
  assert.equal(s.mods.fireRate, CAPS.fireRate);
  assert.ok(s.mods.bulletSpeed < CAPS.bulletSpeed);
  let seen = false;
  for (let seed = 0; seed < 60 && !seen; seed++) {
    if (rollOffers(s, makeRng(seed)).some(o => o.id === 'overclock')) seen = true;
  }
  assert.ok(seen, 'overclock offerable while bulletSpeed below cap');

  // Cap bulletSpeed too — now overclock vanishes.
  for (let i = 0; i < 40; i++) applyUpgrade(s, 'velocity');
  assert.equal(s.mods.bulletSpeed, CAPS.bulletSpeed);
  for (let seed = 0; seed < 40; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== 'overclock'));
  }
});

test('rapid can never push fireRate past cap via applyUpgrade clamp', () => {
  const s = createShip(0, 0);
  s.mods.fireRate = CAPS.fireRate - 0.01;
  applyUpgrade(s, 'rapid'); // 1.25x would overshoot
  assert.equal(s.mods.fireRate, CAPS.fireRate);
});

// --- v5.1: six new upgrades ---

test('createShip seeds neutral v5.1 mod defaults', () => {
  const s = createShip(0, 0);
  assert.equal(s.mods.rocketAoe, 1);
  assert.equal(s.mods.rocketReload, 1);
  assert.equal(s.mods.boostDrain, 1);
  assert.equal(s.mods.luck, 1);
  assert.equal(s.mods.rear, 0);
  assert.equal(s.mods.adrenaline, 0);
});

test('bigpayload multiplies rocket AoE ×1.4 per stack', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'bigpayload');
  assert.ok(Math.abs(s.mods.rocketAoe - 1.4) < 1e-9);
  applyUpgrade(s, 'bigpayload');
  assert.ok(Math.abs(s.mods.rocketAoe - 1.4 * 1.4) < 1e-9);
});

test('fastreload multiplies rocket reload ×0.75 per stack', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'fastreload');
  assert.ok(Math.abs(s.mods.rocketReload - 0.75) < 1e-9);
  applyUpgrade(s, 'fastreload');
  assert.ok(Math.abs(s.mods.rocketReload - 0.75 * 0.75) < 1e-9);
});

test('burners multiplies boost drain ×0.75 per stack', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'burners');
  assert.ok(Math.abs(s.mods.boostDrain - 0.75) < 1e-9);
  applyUpgrade(s, 'burners');
  assert.ok(Math.abs(s.mods.boostDrain - 0.75 * 0.75) < 1e-9);
});

test('lucky multiplies gem-drop luck ×1.3 per stack', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'lucky');
  assert.ok(Math.abs(s.mods.luck - 1.3) < 1e-9);
  applyUpgrade(s, 'lucky');
  assert.ok(Math.abs(s.mods.luck - 1.3 * 1.3) < 1e-9);
});

test('rearguard stacks to 3 backward bullets', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'rearguard');
  assert.equal(s.mods.rear, 1);
  applyUpgrade(s, 'rearguard');
  applyUpgrade(s, 'rearguard');
  assert.equal(s.mods.rear, 3);
});

test('adrenaline sets the adrenaline flag (single stack, idempotent)', () => {
  const s = createShip(0, 0);
  applyUpgrade(s, 'adrenaline');
  assert.equal(s.mods.adrenaline, 1);
  applyUpgrade(s, 'adrenaline');
  assert.equal(s.mods.adrenaline, 1);
});

// --- v5.1: offer exclusions at stack limits ---

const excludedAfter = (id, applyN) => {
  const s = createShip(0, 0);
  for (let i = 0; i < applyN; i++) applyUpgrade(s, id);
  for (let seed = 0; seed < 50; seed++) {
    assert.ok(rollOffers(s, makeRng(seed)).every(o => o.id !== id),
      `${id} should be excluded after ${applyN} picks (seed ${seed})`);
  }
};
const offerableAfter = (id, applyN) => {
  const s = createShip(0, 0);
  for (let i = 0; i < applyN; i++) applyUpgrade(s, id);
  let seen = false;
  for (let seed = 0; seed < 80 && !seen; seed++) {
    if (rollOffers(s, makeRng(seed)).some(o => o.id === id)) seen = true;
  }
  assert.ok(seen, `${id} should still be offerable after ${applyN} picks`);
};

test('bigpayload/fastreload/burners/lucky excluded at 6 stacks, offerable below', () => {
  for (const id of ['bigpayload', 'fastreload', 'burners', 'lucky']) {
    offerableAfter(id, 0);
    offerableAfter(id, 5);
    excludedAfter(id, 6);
  }
});

test('adrenaline excluded after one pick; rearguard after three', () => {
  offerableAfter('adrenaline', 0);
  excludedAfter('adrenaline', 1);
  offerableAfter('rearguard', 2);
  excludedAfter('rearguard', 3);
});

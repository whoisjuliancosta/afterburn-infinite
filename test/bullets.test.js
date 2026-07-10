// test/bullets.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateBullets, circleHit, collideBullets } from '../src/bullets.js';

const bullet = (over = {}) => ({
  x: 0, y: 0, vx: 100, vy: 0, damage: 1, pierce: 0,
  traveled: 0, range: 50, radius: 3, dead: false, ...over,
});
const enemy = (over = {}) => ({ x: 0, y: 0, radius: 10, hp: 2, ...over });

test('bullets move and are culled past range', () => {
  let bs = [bullet()];
  bs = updateBullets(bs, 0.25); // travels 25px
  assert.equal(bs.length, 1);
  assert.equal(bs[0].x, 25);
  bs = updateBullets(bs, 0.3); // total 55px > 50 range
  assert.equal(bs.length, 0);
});

test('circleHit detects overlap', () => {
  assert.ok(circleHit({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 5 }));
  assert.ok(!circleHit({ x: 0, y: 0, radius: 5 }, { x: 11, y: 0, radius: 5 }));
});

test('bullet without pierce dies on first hit', () => {
  const b = bullet();
  const e1 = enemy({ x: 5 }), e2 = enemy({ x: 6 });
  const hits = collideBullets([b], [e1, e2]);
  assert.equal(hits.length, 1);
  assert.equal(e1.hp, 1);
  assert.ok(b.dead);
});

test('pierce lets a bullet hit one extra enemy', () => {
  const b = bullet({ pierce: 1 });
  const e1 = enemy({ x: 5 }), e2 = enemy({ x: 6 }), e3 = enemy({ x: 7 });
  const hits = collideBullets([b], [e1, e2, e3]);
  assert.equal(hits.length, 2);
  assert.ok(b.dead);
});

test('dead enemies are not hit again', () => {
  const b = bullet({ damage: 5 });
  const e = enemy({ x: 5, hp: 2 });
  collideBullets([b], [e]);
  const b2 = bullet({ x: 4 });
  assert.equal(collideBullets([b2], [e]).length, 0); // hp already <= 0
});

test('backward-compat: without rng/crit, dealt equals damage and crit false', () => {
  const b = bullet({ damage: 3 });
  const e = enemy({ x: 5, y: 7, hp: 10 });
  const hits = collideBullets([b], [e]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 3);
  assert.equal(hits[0].dealt, 3);
  assert.equal(hits[0].crit, false);
  assert.equal(hits[0].x, 5);
  assert.equal(hits[0].y, 7);
  assert.equal(e.hp, 7); // reduced by dealt (== damage)
});

test('crit roll: rng below chance crits and applies mult', () => {
  const b = bullet({ damage: 3 });
  const e = enemy({ x: 5, y: 7, hp: 20 });
  const rng = () => 0.05; // < 0.10 chance -> crit
  const hits = collideBullets([b], [e], rng, { chance: 0.10, mult: 2 });
  assert.equal(hits[0].crit, true);
  assert.equal(hits[0].dealt, 6); // 3 * 2
  assert.equal(e.hp, 14); // 20 - 6
});

test('crit roll: rng at/above chance does not crit', () => {
  const b = bullet({ damage: 3 });
  const e = enemy({ x: 0, y: 0, hp: 20 });
  const rng = () => 0.5; // >= 0.10 -> no crit
  const hits = collideBullets([b], [e], rng, { chance: 0.10, mult: 2 });
  assert.equal(hits[0].crit, false);
  assert.equal(hits[0].dealt, 3);
  assert.equal(e.hp, 17);
});

test('crit dealt is rounded', () => {
  const b = bullet({ damage: 5 });
  const e = enemy({ x: 0, y: 0, hp: 30 });
  const rng = () => 0; // crit
  const hits = collideBullets([b], [e], rng, { chance: 1, mult: 1.5 });
  assert.equal(hits[0].dealt, 8); // round(5 * 1.5 = 7.5) = 8
  assert.equal(e.hp, 22);
});

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

test('without arena, bullets fly straight through edges (backward-compat)', () => {
  // v1 signature: no arena, no bounces field — a bullet with negative x keeps going
  let bs = [bullet({ x: 5, vx: -100, bounces: 0, range: 500 })];
  bs = updateBullets(bs, 0.25); // x -> 5 - 25 = -20, no arena so no reflection
  assert.equal(bs.length, 1);
  assert.equal(bs[0].x, -20);
  assert.equal(bs[0].vx, -100); // velocity untouched
});

test('a bounces>0 bullet reflects off an arena edge, clamps inside, decrements', () => {
  const arena = { w: 800, h: 600 };
  // heading left toward x=0, starts at x=10 moving -100/frame*0.25 = -25 -> would land at -15
  let bs = [bullet({ x: 10, y: 300, vx: -100, vy: 0, bounces: 2, range: 1000 })];
  bs = updateBullets(bs, 0.25, arena);
  assert.equal(bs.length, 1);
  const b = bs[0];
  assert.ok(b.x >= 0); // clamped back inside
  assert.equal(b.x, 0); // clamped to the edge
  assert.equal(b.vx, 100); // x-velocity flipped
  assert.equal(b.vy, 0); // y untouched
  assert.equal(b.bounces, 1); // one bounce spent
});

test('reflection off the right and bottom edges flips the correct component', () => {
  const arena = { w: 100, h: 100 };
  let bs = [bullet({ x: 95, y: 95, vx: 100, vy: 100, bounces: 1, range: 1000, radius: 4 })];
  bs = updateBullets(bs, 0.2, arena); // would go to (115,115)
  const b = bs[0];
  assert.equal(b.x, 100); // clamped to right edge
  assert.equal(b.y, 100); // clamped to bottom edge
  assert.equal(b.vx, -100);
  assert.equal(b.vy, -100);
  assert.equal(b.bounces, 0); // decremented once even though two edges crossed
});

test('a bounces=0 bullet with an arena flies on through the edge (no reflect)', () => {
  const arena = { w: 800, h: 600 };
  let bs = [bullet({ x: 5, y: 300, vx: -100, vy: 0, bounces: 0, range: 1000 })];
  bs = updateBullets(bs, 0.25, arena);
  assert.equal(bs[0].x, -20); // passed through, no bounce
  assert.equal(bs[0].vx, -100);
});

test('range culling still applies with bounces', () => {
  const arena = { w: 800, h: 600 };
  let bs = [bullet({ x: 400, y: 300, vx: 100, vy: 0, bounces: 3, range: 20 })];
  bs = updateBullets(bs, 0.3, arena); // travels 30 > 20 range
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

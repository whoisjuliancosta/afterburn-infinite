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

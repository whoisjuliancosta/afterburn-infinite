// test/rockets.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRockets, fireRocket, updateRockets } from '../src/rockets.js';
import { ROCKET } from '../src/config.js';

const ship = (over = {}) => ({ x: 0, y: 0, angle: 0, radius: 18, ...over });
const enemy = (over = {}) => ({ x: 0, y: 0, radius: 10, hp: 100, ...over });

test('createRockets returns an empty list and zero cooldown', () => {
  const r = createRockets();
  assert.deepEqual(r.list, []);
  assert.equal(r.cooldown, 0);
});

test('fireRocket spawns a rocket at the nose with ship-angle velocity and sets cooldown', () => {
  const r = createRockets();
  const ok = fireRocket(r, ship({ x: 100, y: 50, angle: 0 }));
  assert.equal(ok, true);
  assert.equal(r.list.length, 1);
  const rk = r.list[0];
  // nose = ship pos + angle unit * ship.radius; angle 0 -> +x
  assert.equal(rk.x, 100 + 18);
  assert.equal(rk.y, 50);
  assert.equal(rk.vx, ROCKET.speed);
  assert.ok(Math.abs(rk.vy) < 1e-9);
  assert.equal(r.cooldown, ROCKET.cooldown);
});

test('fireRocket respects the angle direction', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: Math.PI / 2 })); // straight down (+y)
  const rk = r.list[0];
  assert.ok(Math.abs(rk.x) < 1e-9);
  assert.ok(Math.abs(rk.y - 18) < 1e-9);
  assert.ok(Math.abs(rk.vx) < 1e-9);
  assert.ok(Math.abs(rk.vy - ROCKET.speed) < 1e-9);
});

test('fireRocket returns false while cooling down and does not spawn', () => {
  const r = createRockets();
  assert.equal(fireRocket(r, ship()), true);
  assert.equal(fireRocket(r, ship()), false); // cooldown > 0
  assert.equal(r.list.length, 1);
});

test('cooldown ticks down in updateRockets and re-enables firing', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 5000, y: 5000 })); // far from any enemy, no detonation
  assert.equal(r.cooldown, ROCKET.cooldown);
  updateRockets(r, [], ROCKET.cooldown); // fully drains the cooldown
  assert.equal(r.cooldown, 0);
  assert.equal(fireRocket(r, ship({ x: 5000, y: 5000 })), true);
});

test('cooldown never goes negative', () => {
  const r = createRockets();
  r.cooldown = 1;
  updateRockets(r, [], 10);
  assert.equal(r.cooldown, 0);
});

test('a rocket flies straight along its velocity', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 })); // nose at x=18, vx=speed
  updateRockets(r, [], 0.1);
  const rk = r.list[0];
  assert.ok(Math.abs(rk.x - (18 + ROCKET.speed * 0.1)) < 1e-9);
  assert.ok(Math.abs(rk.y) < 1e-9);
});

test('contact detonation hits every living enemy in aoeRadius and none outside', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  const rk = r.list[0];
  rk.x = 500; rk.y = 0; rk.vx = 0; rk.vy = 0; // park it, then detonate on contact

  const contact = enemy({ x: 500, y: 0, radius: 12, hp: 100 }); // overlaps rocket -> trigger
  const near = enemy({ x: 500 + ROCKET.aoeRadius - 5, y: 0, hp: 100 }); // inside AoE
  const far = enemy({ x: 500 + ROCKET.aoeRadius + 50, y: 0, hp: 100 }); // outside AoE

  const dets = updateRockets(r, [contact, near, far], 0.001);
  assert.equal(dets.length, 1);
  const det = dets[0];
  assert.equal(det.x, 500);
  assert.equal(det.y, 0);
  // contact + near hit, far untouched
  assert.equal(det.hits.length, 2);
  assert.equal(contact.hp, 100 - ROCKET.damage);
  assert.equal(near.hp, 100 - ROCKET.damage);
  assert.equal(far.hp, 100); // outside radius, untouched
  // each hit records the enemy and flat damage (no crit)
  for (const h of det.hits) assert.equal(h.damage, ROCKET.damage);
  assert.equal(r.list.length, 0); // rocket removed after detonation
});

test('dead enemies neither trigger nor take AoE damage', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  const rk = r.list[0];
  rk.x = 500; rk.y = 0; rk.vx = 0; rk.vy = 0;

  const deadContact = enemy({ x: 500, y: 0, hp: 0 }); // overlapping but dead -> no trigger
  const dets = updateRockets(r, [deadContact], 0.001);
  assert.equal(dets.length, 0); // no living enemy contacted, no range end yet
  assert.equal(r.list.length, 1); // rocket still alive
});

test('range-end detonation fires with no enemy contact', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  const rk = r.list[0];
  // push it just past range in one step
  const dt = (ROCKET.range + 100) / ROCKET.speed;
  const blastX = rk.x + ROCKET.speed * dt;
  // near AoE but 50px off the flight line -> inside aoeRadius, no contact overlap
  const near = enemy({ x: blastX, y: 50, hp: 50 });
  const dets = updateRockets(r, [near], dt);
  assert.equal(dets.length, 1);
  assert.equal(near.hp, 50 - ROCKET.damage);
  assert.equal(r.list.length, 0);
});

test('hp is mutated on the passed enemy objects', () => {
  const r = createRockets();
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  const rk = r.list[0];
  rk.x = 200; rk.y = 200; rk.vx = 0; rk.vy = 0;
  const e = enemy({ x: 200, y: 200, hp: 30 });
  updateRockets(r, [e], 0.001);
  assert.equal(e.hp, 30 - ROCKET.damage);
});

test('multiple rockets detonate independently', () => {
  const r = createRockets();
  // spawn two rockets manually (bypass cooldown gate) at different spots
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  r.cooldown = 0;
  fireRocket(r, ship({ x: 0, y: 0, angle: 0 }));
  assert.equal(r.list.length, 2);

  const a = r.list[0], b = r.list[1];
  a.x = 100; a.y = 0; a.vx = 0; a.vy = 0;
  b.x = 900; b.y = 0; b.vx = 0; b.vy = 0;

  const ea = enemy({ x: 100, y: 0, hp: 40 });
  const eb = enemy({ x: 900, y: 0, hp: 40 });
  const far = enemy({ x: 500, y: 0, hp: 40 }); // between them, out of both AoEs

  const dets = updateRockets(r, [ea, eb, far], 0.001);
  assert.equal(dets.length, 2);
  assert.equal(ea.hp, 40 - ROCKET.damage);
  assert.equal(eb.hp, 40 - ROCKET.damage);
  assert.equal(far.hp, 40);
  assert.equal(r.list.length, 0);
});

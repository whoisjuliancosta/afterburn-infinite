// test/ship.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip } from '../src/ship.js';
import { SHIP, BOOST } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { held: false, taps: 0, thrust: false, boosting: false };

test('createShip has spec defaults', () => {
  const s = createShip(400, 300);
  assert.equal(s.hp, 3);
  assert.equal(s.maxHp, 3);
  assert.deepEqual(s.mods, {
    fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1,
    critChance: 0, critMult: 0, magnet: 1, bounce: 0,
    rocketAoe: 1, rocketReload: 1, boostDrain: 1, luck: 1, rear: 0, adrenaline: 0,
  });
  assert.deepEqual(s.shield, { owned: false, up: false });
  assert.deepEqual(s.boost, { meter: 1, units: BOOST.baseUnits, stacks: 0 });
});

test('W thrusts toward the facing (forward), not screen-up', () => {
  const s = createShip(400, 300);
  s.angle = 0; // facing right
  updateShip(s, { ...idle, thrust: true }, 0.1, arena);
  assert.ok(s.vx > 0);
  assert.ok(Math.abs(s.vy) < 1e-9);
});

test('W thrusts along an arbitrary facing', () => {
  const s = createShip(400, 300);
  s.angle = Math.PI / 2; // facing screen-down
  updateShip(s, { ...idle, thrust: true }, 0.1, arena);
  assert.ok(s.vy > 0);
  assert.ok(Math.abs(s.vx) < 1e-9);
});

test('no thrust means only friction acts (coasting)', () => {
  const s = createShip(400, 300);
  s.vx = 200;
  updateShip(s, idle, 0.5, arena);
  assert.ok(s.vx < 200 && s.vx > 0); // slows but keeps drifting
});

test('friction damps velocity when coasting', () => {
  const s = createShip(400, 300);
  s.vx = 200;
  updateShip(s, idle, 0.5, arena);
  assert.ok(s.vx < 200 && s.vx > 0);
});

test('speed is capped at maxSpeed * engine mod', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  for (let i = 0; i < 300; i++) updateShip(s, { ...idle, thrust: true }, 1 / 60, arena);
  const sp = Math.hypot(s.vx, s.vy);
  assert.ok(sp <= SHIP.maxSpeed + 1e-6);
});

test('soft-bounces off arena edges', () => {
  const s = createShip(5, 300);
  s.vx = -100;
  updateShip(s, idle, 1 / 60, arena);
  assert.equal(s.x, s.radius);
  assert.ok(s.vx > 0); // reflected inward, halved
});

test('iframes and cooldown tick down', () => {
  const s = createShip(400, 300);
  s.iframes = 1; s.cooldown = 1;
  updateShip(s, idle, 0.25, arena);
  assert.equal(s.iframes, 0.75);
  assert.equal(s.cooldown, 0.75);
});

// --- twin-stick aim: nose snaps to the cursor ---

test('angleDiff gives signed shortest rotation', async () => {
  const { angleDiff } = await import('../src/utils.js');
  assert.ok(Math.abs(angleDiff(0, 1) - 1) < 1e-9);
  assert.ok(Math.abs(angleDiff(1, 0) + 1) < 1e-9);
  // across the wrap: from just below +pi to just above -pi is a small positive turn
  assert.ok(Math.abs(angleDiff(3, -3) - (2 * Math.PI - 6)) < 1e-9);
});

test('nose snaps to the aim point instantly', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  updateShip(s, { ...idle, aimX: 400, aimY: 700 }, 0.016, arena); // cursor straight down
  assert.ok(Math.abs(s.angle - Math.PI / 2) < 1e-9);
});

test('no aim fields means angle is untouched (backward compatible)', () => {
  const s = createShip(400, 300);
  s.angle = 1.23;
  updateShip(s, idle, 0.1, arena);
  assert.equal(s.angle, 1.23);
});

// --- reverse thrust: S / ↓ backs off opposite the nose at SHIP.reverseMult ---

test('reverse accelerates opposite the nose, scaled by reverseMult', () => {
  const fwd = createShip(400, 300); fwd.angle = 0;
  const rev = createShip(400, 300); rev.angle = 0;
  updateShip(fwd, { ...idle, thrust: true }, 0.05, arena);
  updateShip(rev, { ...idle, reverse: true }, 0.05, arena);
  assert.ok(rev.vx < 0);                          // moves backward
  assert.ok(Math.abs(rev.vy) < 1e-9);
  // single frame, identical damping → reverse is exactly reverseMult of forward
  assert.ok(Math.abs(rev.vx + fwd.vx * SHIP.reverseMult) < 1e-9);
});

test('reverse flag off is a no-op (only friction acts)', () => {
  const s = createShip(400, 300); s.angle = 0; s.vx = 100;
  updateShip(s, { ...idle, reverse: false }, 0.1, arena);
  assert.ok(s.vx < 100 && s.vx > 0); // pure coast, no backward accel
});

test('engine mod scales reverse acceleration', () => {
  const a = createShip(400, 300); a.angle = 0;
  const b = createShip(400, 300); b.angle = 0; b.mods.engine = 2;
  updateShip(a, { ...idle, reverse: true }, 0.02, arena);
  updateShip(b, { ...idle, reverse: true }, 0.02, arena);
  assert.ok(Math.abs(b.vx - 2 * a.vx) < 1e-9); // twice the engine → twice the reverse accel
});

test('thrust + reverse held together nets (1 - reverseMult) forward', () => {
  const fwd = createShip(400, 300); fwd.angle = 0;
  const both = createShip(400, 300); both.angle = 0;
  updateShip(fwd, { ...idle, thrust: true }, 0.05, arena);
  updateShip(both, { ...idle, thrust: true, reverse: true }, 0.05, arena);
  assert.ok(both.vx > 0); // still nets forward at reverseMult < 1
  assert.ok(Math.abs(both.vx - fwd.vx * (1 - SHIP.reverseMult)) < 1e-9);
});

// --- lateral strafe: A / D accelerate perpendicular to the nose at SHIP.strafeMult ---

test('strafe accelerates perpendicular to the nose (dot with nose ≈ 0)', () => {
  const s = createShip(400, 300); s.angle = 0; // nose +x
  updateShip(s, { ...idle, strafeRight: true }, 0.05, arena);
  assert.ok(Math.abs(s.vx) < 1e-9); // no along-nose component
  assert.ok(Math.abs(s.vy) > 0);    // pure lateral
});

test('strafe is perpendicular at an arbitrary nose angle', () => {
  const s = createShip(400, 300); s.angle = 0.7;
  updateShip(s, { ...idle, strafeRight: true }, 0.02, arena);
  const nx = Math.cos(0.7), ny = Math.sin(0.7);
  assert.ok(Math.abs(s.vx * nx + s.vy * ny) < 1e-9); // velocity ⟂ nose
});

test('strafe left and right push opposite perpendiculars', () => {
  const l = createShip(400, 300); l.angle = 0;
  const r = createShip(400, 300); r.angle = 0;
  updateShip(l, { ...idle, strafeLeft: true }, 0.05, arena);
  updateShip(r, { ...idle, strafeRight: true }, 0.05, arena);
  assert.ok(Math.abs(l.vy + r.vy) < 1e-9); // exact opposites
  assert.ok(l.vy < 0 && r.vy > 0);
});

test('strafe accel is thrust * strafeMult, and boost does NOT scale it', () => {
  const base = createShip(400, 300); base.angle = 0;
  const boosted = createShip(400, 300); boosted.angle = 0;
  updateShip(base, { ...idle, strafeRight: true }, 0.02, arena);
  updateShip(boosted, { ...idle, strafeRight: true, boosting: true }, 0.02, arena);
  assert.ok(Math.abs(base.vy - boosted.vy) < 1e-9); // boost leaves the strafe untouched
  // magnitude equals forward thrust scaled by strafeMult
  const fwd = createShip(400, 300); fwd.angle = 0;
  updateShip(fwd, { ...idle, thrust: true }, 0.02, arena);
  assert.ok(Math.abs(base.vy - fwd.vx * SHIP.strafeMult) < 1e-9);
});

test('engine mod scales strafe acceleration', () => {
  const a = createShip(400, 300); a.angle = 0;
  const b = createShip(400, 300); b.angle = 0; b.mods.engine = 2;
  updateShip(a, { ...idle, strafeRight: true }, 0.02, arena);
  updateShip(b, { ...idle, strafeRight: true }, 0.02, arena);
  assert.ok(Math.abs(b.vy - 2 * a.vy) < 1e-9);
});

test('no strafe flags is a no-op (only friction acts)', () => {
  const s = createShip(400, 300); s.angle = 0; s.vy = 100;
  updateShip(s, idle, 0.1, arena);
  assert.ok(s.vy < 100 && s.vy > 0); // pure coast, no lateral accel
});

test('strafe left + right held together cancel (no lateral accel)', () => {
  const s = createShip(400, 300); s.angle = 0;
  updateShip(s, { ...idle, strafeLeft: true, strafeRight: true }, 0.05, arena);
  assert.ok(Math.abs(s.vx) < 1e-9);
  assert.ok(Math.abs(s.vy) < 1e-9);
});

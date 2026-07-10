// test/dash.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip, tryDash, creditDash } from '../src/ship.js';
import { DASH, SHIP } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { moveX: 0, moveY: 0, held: false, taps: 0 };

test('createShip seeds dash at full charges', () => {
  const s = createShip(400, 300);
  assert.deepEqual(s.dash, { charges: DASH.charges, max: DASH.charges, recharge: 0, stacks: 0 });
});

test('tryDash consumes a charge and refuses at zero', () => {
  const s = createShip(400, 300);
  assert.equal(tryDash(s), true);
  assert.equal(s.dash.charges, DASH.charges - 1);
  assert.equal(tryDash(s), true);
  assert.equal(s.dash.charges, 0);
  assert.equal(tryDash(s), false); // out of charges
  assert.equal(s.dash.charges, 0);
});

test('dash impulse is added along the nose direction', () => {
  const s = createShip(400, 300);
  s.angle = 0; // facing +x
  s.vx = 0; s.vy = 0;
  s.mods.engine = 3; // raise the cap so the raw impulse isn't clamped
  tryDash(s);
  assert.ok(Math.abs(s.vx - DASH.impulse) < 1e-9);
  assert.ok(Math.abs(s.vy) < 1e-9);
});

test('dash adds to current velocity (does not replace it)', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  s.vx = 40; s.vy = 0;
  s.mods.engine = 3; // keep the sum under the cap
  tryDash(s);
  assert.ok(Math.abs(s.vx - (40 + DASH.impulse)) < 1e-9);
});

test('dash speed is clamped to maxSpeed * engine * speedCapMult', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  tryDash(s); // impulse 560 exceeds the dash cap
  const cap = SHIP.maxSpeed * s.mods.engine * DASH.speedCapMult;
  const sp = Math.hypot(s.vx, s.vy);
  assert.ok(sp <= cap + 1e-6);
  assert.ok(Math.abs(sp - cap) < 1e-6); // clamped exactly to the cap
});

test('dash cap scales with the engine mod', () => {
  const s = createShip(400, 300);
  s.angle = 0;
  s.vx = 5000; s.vy = 0; // way over any cap, so the clamp always bites
  s.mods.engine = 1.5;
  tryDash(s);
  const cap = SHIP.maxSpeed * 1.5 * DASH.speedCapMult;
  assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - cap) < 1e-6);
});

test('dash grants iframes but never shortens a longer existing window', () => {
  const s = createShip(400, 300);
  s.iframes = 0;
  tryDash(s);
  assert.ok(Math.abs(s.iframes - DASH.iframes) < 1e-9);

  const s2 = createShip(400, 300);
  s2.iframes = 1.0; // longer than DASH.iframes
  tryDash(s2);
  assert.equal(s2.iframes, 1.0); // untouched, not reduced
});

test('tryDash starts an idle recharge timer', () => {
  const s = createShip(400, 300);
  assert.equal(s.dash.recharge, 0); // idle at full charges
  tryDash(s);
  assert.equal(s.dash.recharge, DASH.rechargeTime);
});

test('a second dash does not reset an already-running timer', () => {
  const s = createShip(400, 300);
  tryDash(s);                 // charges 2 -> 1, recharge = 6
  s.dash.recharge = 3;        // pretend it ticked down
  tryDash(s);                 // charges 1 -> 0, timer already running
  assert.equal(s.dash.recharge, 3); // not reset
});

test('recharge ticks down and grants a charge over time', () => {
  const s = createShip(400, 300);
  tryDash(s); // charges -> 1, recharge = 6
  // tick just short of full
  updateShip(s, idle, DASH.rechargeTime - 0.5, arena);
  assert.equal(s.dash.charges, 1);
  assert.ok(s.dash.recharge > 0);
  // finish the cycle
  updateShip(s, idle, 0.6, arena);
  assert.equal(s.dash.charges, 2);
});

test('recharge restarts the timer when still below max after a grant', () => {
  const s = createShip(400, 300);
  tryDash(s); tryDash(s); // both charges spent, recharge = 6
  updateShip(s, idle, DASH.rechargeTime + 0.01, arena);
  assert.equal(s.dash.charges, 1);      // one granted
  assert.ok(s.dash.recharge > 0);       // timer restarted for the next
});

test('dashRate mod speeds recharge ticking', () => {
  const s = createShip(400, 300);
  s.mods.dashRate = 2; // twice as fast
  tryDash(s); // recharge = 6
  updateShip(s, idle, DASH.rechargeTime / 2 + 0.01, arena);
  assert.equal(s.dash.charges, 2); // finished in half the time
});

test('creditDash shaves the active recharge timer and floors at zero', () => {
  const s = createShip(400, 300);
  tryDash(s); // recharge = 6
  creditDash(s, 4); // 4 damage * 0.35 = 1.4
  assert.ok(Math.abs(s.dash.recharge - (DASH.rechargeTime - DASH.damageCredit * 4)) < 1e-9);
  creditDash(s, 1000); // overshoot floors at 0
  assert.equal(s.dash.recharge, 0);
});

test('creditDash accelerates the eventual charge grant', () => {
  const s = createShip(400, 300);
  tryDash(s); // recharge = 6
  creditDash(s, 10); // 10 * 0.35 = 3.5 shaved -> recharge = 2.5
  updateShip(s, idle, 2.5 + 0.01, arena);
  assert.equal(s.dash.charges, 2); // completed sooner than rechargeTime
});

test('creditDash does nothing at full charges', () => {
  const s = createShip(400, 300);
  creditDash(s, 100);
  assert.equal(s.dash.recharge, 0);
  assert.equal(s.dash.charges, DASH.charges);
});

test('no recharge activity while at full charges', () => {
  const s = createShip(400, 300);
  updateShip(s, idle, 10, arena);
  assert.equal(s.dash.charges, DASH.charges);
  assert.equal(s.dash.recharge, 0);
});

test('dash follows movement input over the nose', async () => {
  const { createShip, tryDash } = await import('../src/ship.js');
  const s = createShip(400, 300);
  s.angle = 0; // aiming right
  tryDash(s, 0, -1); // moving up
  const assert = (await import('node:assert/strict')).default;
  assert.ok(s.vy < 0 && Math.abs(s.vx) < 1e-9);
});

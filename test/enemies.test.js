// test/enemies.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleFor, spawnEnemy, updateEnemy, deathSpawns } from '../src/enemies.js';
import { ENEMIES } from '../src/config.js';
import { TAU } from '../src/utils.js';

const ship = { x: 400, y: 300 };

test('scaleFor grows 6% per wave', () => {
  assert.equal(scaleFor(1), 1);
  assert.ok(Math.abs(scaleFor(6) - 1.3) < 1e-9);
});

test('spawnEnemy applies wave scaling to hp and speed', () => {
  const e = spawnEnemy('drifter', 0, 0, 6);
  assert.equal(e.hp, Math.round(ENEMIES.drifter.hp * 1.3));
  assert.ok(Math.abs(e.speed - ENEMIES.drifter.speed * 1.3) < 1e-9);
  assert.equal(e.score, ENEMIES.drifter.score);
});

test('drifter chases the ship', () => {
  const e = spawnEnemy('drifter', 0, 300, 1);
  updateEnemy(e, ship, 0.1);
  assert.ok(e.x > 0);
  assert.ok(Math.abs(e.vy) < 1e-9); // straight toward ship on same row
});

test('darter aims then lunges fast', () => {
  const e = spawnEnemy('darter', 200, 300, 1); // within aimRange (260) of ship
  updateEnemy(e, ship, 1 / 60);
  assert.equal(e.state, 'aim');
  // wait out aimTime
  for (let t = 0; t < ENEMIES.darter.aimTime + 0.05; t += 1 / 60) updateEnemy(e, ship, 1 / 60);
  assert.equal(e.state, 'lunge');
  assert.ok(Math.hypot(e.vx, e.vy) > ENEMIES.darter.speed * 2);
});

test('splitter spawns two minis on death, minis do not split', () => {
  const e = spawnEnemy('splitter', 100, 100, 3);
  const kids = deathSpawns(e);
  assert.equal(kids.length, 2);
  assert.ok(kids.every(k => k.type === 'mini' && k.wave === 3));
  assert.equal(deathSpawns(kids[0]).length, 0);
});

// --- Spitter ---

test('spitter approaches the ship when farther than standoff', () => {
  const def = ENEMIES.spitter;
  // place well beyond standoff, on the same row to the left of the ship
  const e = spawnEnemy('spitter', ship.x - (def.standoff + 200), ship.y, 1);
  const before = Math.hypot(ship.x - e.x, ship.y - e.y);
  updateEnemy(e, ship, 0.1);
  const after = Math.hypot(ship.x - e.x, ship.y - e.y);
  assert.ok(after < before, 'should close distance when far');
  assert.ok(e.vx > 0, 'moves toward the ship (rightward)');
});

test('spitter retreats when much closer than standoff', () => {
  const def = ENEMIES.spitter;
  const e = spawnEnemy('spitter', ship.x - def.standoff * 0.5, ship.y, 1);
  const before = Math.hypot(ship.x - e.x, ship.y - e.y);
  updateEnemy(e, ship, 0.1);
  const after = Math.hypot(ship.x - e.x, ship.y - e.y);
  assert.ok(after > before, 'should back off when too close');
  assert.ok(e.vx < 0, 'moves away from the ship (leftward)');
});

test('spitter strafes (perpendicular) while holding standoff', () => {
  const def = ENEMIES.spitter;
  const e = spawnEnemy('spitter', ship.x - def.standoff, ship.y, 1);
  const before = Math.hypot(ship.x - e.x, ship.y - e.y);
  updateEnemy(e, ship, 0.1);
  const after = Math.hypot(ship.x - e.x, ship.y - e.y);
  // radial distance roughly held; motion is mostly lateral (vy)
  assert.ok(Math.abs(after - before) < def.standoff * 0.15, 'holds distance');
  assert.ok(Math.abs(e.vy) > Math.abs(e.vx), 'motion is mostly lateral');
});

test('spitter timer starts at fireEvery — no shot on spawn frame', () => {
  const def = ENEMIES.spitter;
  const e = spawnEnemy('spitter', ship.x - def.standoff, ship.y, 1);
  assert.ok(Math.abs(e.timer - def.fireEvery) < 1e-9);
  const out = [];
  updateEnemy(e, ship, 1 / 60, out);
  assert.equal(out.length, 0, 'no instant shot');
});

test('spitter fires an aimed shot into out on cadence', () => {
  const def = ENEMIES.spitter;
  const e = spawnEnemy('spitter', ship.x - def.standoff, ship.y, 1);
  const out = [];
  // advance just under fireEvery: still no shot
  let t = 0;
  const step = 1 / 60;
  while (t < def.fireEvery - 2 * step) { updateEnemy(e, ship, step, out); t += step; }
  assert.equal(out.length, 0, 'no shot before cadence');
  // cross the threshold
  while (t < def.fireEvery + step) { updateEnemy(e, ship, step, out); t += step; }
  assert.equal(out.length, 1, 'exactly one shot fired');
  const shot = out[0];
  assert.equal(shot.radius, def.shotRadius);
  assert.equal(shot.dead, false);
  // aimed at the ship: velocity points from enemy toward ship, magnitude shotSpeed
  assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - def.shotSpeed) < 1e-6);
  const toShip = Math.atan2(ship.y - shot.y, ship.x - shot.x);
  const vel = Math.atan2(shot.vy, shot.vx);
  assert.ok(Math.abs(Math.atan2(Math.sin(toShip - vel), Math.cos(toShip - vel))) < 1e-6);
});

test('spitter without out array does not throw', () => {
  const e = spawnEnemy('spitter', 100, 300, 1);
  for (let i = 0; i < 200; i++) updateEnemy(e, ship, 1 / 60);
});

// --- Orbiter ---

test('orbiter initializes currentRadius at orbitRadius', () => {
  const def = ENEMIES.orbiter;
  const e = spawnEnemy('orbiter', ship.x + def.orbitRadius, ship.y, 1);
  assert.equal(e.currentRadius, def.orbitRadius);
});

test('orbiter settles onto the (shrinking) ring within tolerance', () => {
  const def = ENEMIES.orbiter;
  // start off the ring to prove radial correction pulls it in
  const e = spawnEnemy('orbiter', ship.x + def.orbitRadius + 120, ship.y, 1);
  const step = 1 / 60;
  for (let i = 0; i < 240; i++) updateEnemy(e, ship, step, []); // ~4s to settle
  const d = Math.hypot(ship.x - e.x, ship.y - e.y);
  assert.ok(Math.abs(d - e.currentRadius) < 20, `on ring: d=${d} r=${e.currentRadius}`);
});

test('orbiter ring shrinks over time, clamped to a floor of 40', () => {
  const def = ENEMIES.orbiter;
  const e = spawnEnemy('orbiter', ship.x + def.orbitRadius, ship.y, 1);
  updateEnemy(e, ship, 1.0, []);
  assert.ok(Math.abs(e.currentRadius - (def.orbitRadius - def.spiralRate)) < 1e-6);
  // run long enough that it would go below 40 without the clamp
  for (let i = 0; i < 60; i++) updateEnemy(e, ship, 1.0, []);
  assert.ok(e.currentRadius >= 40 - 1e-9);
  assert.ok(e.currentRadius <= 40 + 1e-6);
});

// --- Weaver ---

test('weaver initializes weaveT at 0', () => {
  const e = spawnEnemy('weaver', 0, 300, 1);
  assert.equal(e.weaveT, 0);
});

test('weaver net-approaches the ship despite the weave', () => {
  const e = spawnEnemy('weaver', 0, 300, 1);
  const before = Math.hypot(ship.x - e.x, ship.y - e.y);
  for (let i = 0; i < 120; i++) updateEnemy(e, ship, 1 / 60, []);
  const after = Math.hypot(ship.x - e.x, ship.y - e.y);
  assert.ok(after < before, 'closes on the ship overall');
});

test('weaver deviates perpendicular from the straight chase line', () => {
  // ship directly to the right; a pure chaser stays on y=300. The TAU-corrected
  // weave gives a real positional amplitude ~= weaveAmp (~70px), so within one
  // weave period the enemy should swing well clear of the chase line.
  const def = ENEMIES.weaver;
  const e = spawnEnemy('weaver', 0, 300, 1);
  const step = 1 / 60;
  const period = 1 / def.weaveFreq; // seconds for one full weave
  let maxDev = 0;
  for (let t = 0; t < period; t += step) {
    updateEnemy(e, ship, step, []);
    maxDev = Math.max(maxDev, Math.abs(e.y - 300));
  }
  assert.ok(maxDev > 35, `weave should push >35px off the chase line, got ${maxDev}`);
});

test('weaver velocity carries the TAU-corrected perpendicular sine term', () => {
  const def = ENEMIES.weaver;
  const e = spawnEnemy('weaver', 0, 300, 1); // ship to the right → chase is +x, perp is y
  updateEnemy(e, ship, 1 / 60, []);
  // perpendicular weave velocity = weaveAmp * weaveFreq * TAU * cos(t*freq*TAU)
  const expected = def.weaveAmp * def.weaveFreq * TAU * Math.cos(e.weaveT * def.weaveFreq * TAU);
  assert.ok(Math.abs(e.vy - expected) < 1e-6, `vy=${e.vy} expected~${expected}`);
});

// --- Boss ---

const shots   = out => out.filter(o => o.vx !== undefined);
const spawns  = out => out.filter(o => o.spawn !== undefined);
// Run the boss for `secs` seconds at 1/60 step, collecting everything pushed to out.
function runBoss(e, secs, ship) {
  const out = [];
  const step = 1 / 60;
  for (let t = 0; t + 1e-9 < secs; t += step) updateEnemy(e, ship, step, out);
  return out;
}

test('boss wave-scales hp/speed like others; radius/score unscaled', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 0, 0, 6);
  assert.equal(e.hp, Math.round(def.hp * 1.3));
  assert.equal(e.maxHp, Math.round(def.hp * 1.3));
  assert.ok(Math.abs(e.speed - def.speed * 1.3) < 1e-9);
  assert.equal(e.radius, def.radius);
  assert.equal(e.score, def.score);
});

test('boss inits timers so nothing fires or spawns on the spawn frame', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 100, 300, 1);
  assert.equal(e.state, 'chase');
  const out = [];
  updateEnemy(e, ship, 1 / 60, out);
  assert.equal(out.length, 0, 'no shots or spawns on the first frame');
});

test('boss slow-chases the ship in every phase', () => {
  for (const hp of [60, 30, 10]) {
    const e = spawnEnemy('boss', 0, 300, 1);
    e.hp = hp;
    const before = Math.hypot(ship.x - e.x, ship.y - e.y);
    updateEnemy(e, ship, 0.1, []);
    const after = Math.hypot(ship.x - e.x, ship.y - e.y);
    assert.ok(after < before, `closes distance at hp=${hp}`);
  }
});

test('P1 (>2/3 hp) fires a radial ring of ringCount shots on ringEvery cadence', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 41; // 41/60 > 2/3 → P1
  // just under one ringEvery: no ring yet
  let out = runBoss(e, def.ringEvery - 2 / 60, ship);
  assert.equal(shots(out).length, 0, 'no ring before cadence');
  // cross the threshold: exactly one ring of ringCount
  out = runBoss(e, def.ringEvery + 2 / 60, ship);
  const s = shots(out);
  assert.equal(s.length, def.ringCount, 'one full ring of ringCount shots');
  // evenly spaced radial ring at shotSpeed
  for (const shot of s) {
    assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - def.shotSpeed) < 1e-6);
    assert.equal(shot.radius, def.shotRadius);
    assert.equal(shot.dead, false);
  }
});

test('P1 never charges and never spawns minis', () => {
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 60; // full → P1
  const out = runBoss(e, 20, ship);
  assert.equal(spawns(out).length, 0, 'no minis in P1');
  assert.notEqual(e.state, 'windup');
  assert.notEqual(e.state, 'charge');
});

test('P2 (2/3–1/3 hp) telegraphs a charge: windup zeroes velocity, then lunges at chargeSpeed', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 30; // 0.5 → P2
  const step = 1 / 60;
  // advance until the charge windup begins (chargeEvery)
  let t = 0;
  while (e.state !== 'windup' && t < 10) { updateEnemy(e, ship, step, []); t += step; }
  assert.equal(e.state, 'windup', 'entered windup');
  assert.ok(Math.abs(t - def.chargeEvery) < 0.05, `windup starts ~chargeEvery (t=${t})`);
  assert.equal(e.vx, 0);
  assert.equal(e.vy, 0);
  // hold through windup (~1s): stays zeroed, then lunges
  let sawZeroMidWindup = false;
  while (e.state === 'windup' && t < 12) {
    updateEnemy(e, ship, step, []);
    if (e.state === 'windup') { sawZeroMidWindup = true; assert.equal(e.vx, 0); assert.equal(e.vy, 0); }
    t += step;
  }
  assert.ok(sawZeroMidWindup, 'velocity stays zero across the windup');
  assert.equal(e.state, 'charge', 'windup → charge');
  assert.ok(Math.abs(Math.hypot(e.vx, e.vy) - def.chargeSpeed) < 1e-6, 'lunges at chargeSpeed');
});

test('P2 charge lasts chargeTime then resumes chasing', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 30;
  const step = 1 / 60;
  let t = 0;
  while (e.state !== 'charge' && t < 12) { updateEnemy(e, ship, step, []); t += step; }
  assert.equal(e.state, 'charge');
  let ct = 0;
  while (e.state === 'charge' && ct < 5) { updateEnemy(e, ship, step, []); ct += step; }
  assert.ok(Math.abs(ct - def.chargeTime) < 0.05, `charge lasts ~chargeTime (${ct})`);
  assert.equal(e.state, 'chase');
});

test('P2 still fires 10-shot rings and never spawns minis', () => {
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 30;
  const out = runBoss(e, ENEMIES.boss.ringEvery + 2 / 60, ship);
  assert.equal(shots(out).length, ENEMIES.boss.ringCount);
  const long = runBoss(spawnBossAt30(), 20, ship);
  assert.equal(spawns(long).length, 0);
});
function spawnBossAt30() { const e = spawnEnemy('boss', 100, 300, 1); e.hp = 30; return e; }

test('P3 (<1/3 hp) rings become 14-shot spirals with start angle advancing 0.9 rad per ring', () => {
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 19; // 19/60 < 1/3 → P3
  const step = 1 / 60;
  const firsts = [];
  let ring = 0;
  let t = 0;
  while (firsts.length < 3 && t < 20) {
    const out = [];
    updateEnemy(e, ship, step, out);
    const s = shots(out);
    if (s.length) {
      assert.equal(s.length, 14, 'spiral fires 14 shots');
      firsts.push(Math.atan2(s[0].vy, s[0].vx));
      ring++;
    }
    t += step;
  }
  assert.equal(firsts.length, 3, 'saw three spiral rings');
  const d1 = Math.atan2(Math.sin(firsts[1] - firsts[0]), Math.cos(firsts[1] - firsts[0]));
  const d2 = Math.atan2(Math.sin(firsts[2] - firsts[1]), Math.cos(firsts[2] - firsts[1]));
  assert.ok(Math.abs(d1 - 0.9) < 1e-6, `advance 0.9 rad (got ${d1})`);
  assert.ok(Math.abs(d2 - 0.9) < 1e-6, `advance 0.9 rad (got ${d2})`);
});

test('P3 spirals fire on a 2.2s cadence', () => {
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 19;
  const step = 1 / 60;
  const times = [];
  let t = 0;
  while (times.length < 2 && t < 20) {
    const out = [];
    updateEnemy(e, ship, step, out);
    if (shots(out).length) times.push(t);
    t += step;
  }
  assert.ok(Math.abs((times[1] - times[0]) - 2.2) < 0.05, `2.2s spiral cadence (${times[1] - times[0]})`);
});

test('P3 spawns 2 mini markers every spawnEvery via the out array', () => {
  const def = ENEMIES.boss;
  const e = spawnEnemy('boss', 100, 300, 1);
  e.hp = 10; // P3
  // just under spawnEvery: no spawns
  let out = runBoss(e, def.spawnEvery - 2 / 60, ship);
  assert.equal(spawns(out).length, 0, 'no spawns before spawnEvery');
  // cross threshold: exactly two mini markers
  out = runBoss(e, def.spawnEvery + 2 / 60, ship);
  const sp = spawns(out);
  assert.equal(sp.length, 2, 'two minis spawned');
  for (const m of sp) {
    assert.equal(m.spawn, 'mini');
    assert.equal(typeof m.x, 'number');
    assert.equal(typeof m.y, 'number');
  }
});

test('boss updateEnemy without an out array does not throw in any phase', () => {
  for (const hp of [60, 30, 10]) {
    const e = spawnEnemy('boss', 100, 300, 1);
    e.hp = hp;
    for (let i = 0; i < 900; i++) updateEnemy(e, ship, 1 / 60);
  }
});

test('boss is not a splitter: deathSpawns returns nothing', () => {
  const e = spawnEnemy('boss', 100, 300, 1);
  assert.equal(deathSpawns(e).length, 0);
});

// --- Wave scaling applies to all new types ---

test('new enemy types respect wave scaling on hp and speed', () => {
  for (const type of ['spitter', 'orbiter', 'weaver']) {
    const e = spawnEnemy(type, 0, 0, 6);
    const def = ENEMIES[type];
    assert.equal(e.hp, Math.round(def.hp * 1.3), `${type} hp`);
    assert.ok(Math.abs(e.speed - def.speed * 1.3) < 1e-9, `${type} speed`);
    assert.equal(e.score, def.score, `${type} score`);
  }
});

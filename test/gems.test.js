// test/gems.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMS } from '../src/config.js';
import { makeRng } from '../src/utils.js';
import {
  createGems, spawnGem, spawnGemRing, updateGems, gemBlinking, BLINK_TIME, rollDrop,
} from '../src/gems.js';

test('createGems starts empty', () => {
  const g = createGems();
  assert.deepEqual(g.list, []);
});

test('spawnGem populates position, value, age, lifetime, radius and a scatter velocity', () => {
  const g = createGems();
  const rng = makeRng(1);
  const gem = spawnGem(g, 40, 50, 130, rng);
  assert.equal(g.list.length, 1);
  assert.equal(gem.x, 40);
  assert.equal(gem.y, 50);
  assert.equal(gem.value, 130);
  assert.equal(gem.age, 0);
  assert.equal(gem.lifetime, GEMS.lifetime);
  assert.equal(gem.radius, GEMS.radius);
  // scatter velocity is non-zero
  assert.ok(Math.hypot(gem.vx, gem.vy) > 0);
});

test('spawnGem is deterministic under a seeded rng', () => {
  const a = createGems();
  const b = createGems();
  const g1 = spawnGem(a, 0, 0, 10, makeRng(42));
  const g2 = spawnGem(b, 0, 0, 10, makeRng(42));
  assert.equal(g1.vx, g2.vx);
  assert.equal(g1.vy, g2.vy);
});

test('magnet pulls a gem inside magnetRadius toward the ship', () => {
  const g = createGems();
  const gem = spawnGem(g, 100, 0, 10, makeRng(1));
  gem.vx = 0; gem.vy = 0; // isolate the magnet from scatter
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  // dist 100 < 130: accelerated toward origin, so x decreased
  assert.ok(g.list[0].x < 100);
  assert.ok(g.list[0].vx < 0);
});

test('magnet does NOT pull a gem outside magnetRadius', () => {
  const g = createGems();
  const gem = spawnGem(g, 200, 0, 10, makeRng(1));
  gem.vx = 0; gem.vy = 0;
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  // dist 200 > 130: no acceleration, velocity stays zero, position unchanged
  assert.equal(g.list[0].vx, 0);
  assert.equal(g.list[0].x, 200);
});

test('updateGems honors an explicit (smaller) magnetRadius — no pull outside it', () => {
  const g = createGems();
  const gem = spawnGem(g, 150, 0, 10, makeRng(1));
  gem.vx = 0; gem.vy = 0;
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1, 100); // 150 > 100 shrunk radius → no acceleration
  assert.equal(g.list[0].vx, 0);
  assert.equal(g.list[0].x, 150);
});

test('updateGems honors an explicit (larger) magnetRadius — pulls a gem the default ignores', () => {
  const g = createGems();
  const gem = spawnGem(g, 260, 0, 10, makeRng(1)); // 260 > default 200, would be ignored
  gem.vx = 0; gem.vy = 0;
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.1, 300); // 260 < 300 → pulled toward origin
  assert.ok(g.list[0].vx < 0);
  assert.ok(g.list[0].x < 260);
});

test('gem speed is capped at GEMS.maxSpeed', () => {
  const g = createGems();
  const gem = spawnGem(g, 50, 0, 10, makeRng(1));
  gem.vx = 100000; gem.vy = 0; // absurd velocity
  const ship = { x: 0, y: 0, radius: 18 };
  updateGems(g, ship, 0.016);
  assert.ok(Math.hypot(g.list[0].vx, g.list[0].vy) <= GEMS.maxSpeed + 1e-6);
});

test('collecting a gem returns its value+position and removes it from the list', () => {
  const g = createGems();
  spawnGem(g, 5, 0, 250, makeRng(1)); // within ship radius + gem radius
  const ship = { x: 0, y: 0, radius: 18 };
  const collected = updateGems(g, ship, 0.016);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].value, 250);
  assert.equal(typeof collected[0].x, 'number');
  assert.equal(typeof collected[0].y, 'number');
  assert.equal(g.list.length, 0);
});

test('an expired gem is culled without being collected', () => {
  const g = createGems();
  const gem = spawnGem(g, 500, 500, 10, makeRng(1));
  gem.age = GEMS.lifetime - 0.05;
  const ship = { x: 100000, y: 0, radius: 18 }; // far away
  const collected = updateGems(g, ship, 0.1); // pushes age past lifetime
  assert.equal(collected.length, 0);
  assert.equal(g.list.length, 0);
});

test('a gem within its lifetime survives an update', () => {
  const g = createGems();
  spawnGem(g, 500, 500, 10, makeRng(1));
  const ship = { x: 100000, y: 0, radius: 18 };
  updateGems(g, ship, 0.1);
  assert.equal(g.list.length, 1);
  assert.ok(Math.abs(g.list[0].age - 0.1) < 1e-9);
});

test('updateGems does NOT auto-collect a distant gem (vacuum is main\'s job)', () => {
  // Guards the boundary: updateGems only collects on circle overlap. Sweeping up
  // far-off field gems on wave clear is main.js's explicit vacuum, not this
  // module's — so a gem the ship never touches must never appear in collected[].
  const g = createGems();
  spawnGem(g, 500, 500, 99, makeRng(1));
  const ship = { x: 0, y: 0, radius: 18 };
  const collected = updateGems(g, ship, 0.016);
  assert.equal(collected.length, 0);
  assert.equal(g.list.length, 1); // still on the field, uncollected
});

test('spawnGemRing places n gems evenly on a ~40px ring around the centre', () => {
  const g = createGems();
  const gems = spawnGemRing(g, 100, 100, 42, 6, makeRng(7));
  assert.equal(g.list.length, 6);
  assert.equal(gems.length, 6);
  // each gem ~40px from the centre
  for (const gem of gems) {
    assert.ok(Math.abs(Math.hypot(gem.x - 100, gem.y - 100) - 40) < 1e-6);
    assert.equal(gem.value, 42);
  }
  // evenly spaced: adjacent angular gaps equal (~TAU/6)
  const angs = gems.map(gem => Math.atan2(gem.y - 100, gem.x - 100)).sort((a, b) => a - b);
  for (let i = 1; i < angs.length; i++) {
    assert.ok(Math.abs((angs[i] - angs[i - 1]) - (Math.PI * 2 / 6)) < 1e-6);
  }
});

test('ring gems drift outward from the centre', () => {
  const g = createGems();
  const gems = spawnGemRing(g, 0, 0, 10, 4, makeRng(3));
  for (const gem of gems) {
    // outward drift: velocity points the same way as the offset from centre
    const dot = gem.x * gem.vx + gem.y * gem.vy;
    assert.ok(dot > 0);
  }
});

test('spawnGemRing is deterministic under a seeded rng', () => {
  const a = createGems();
  const b = createGems();
  spawnGemRing(a, 0, 0, 10, 6, makeRng(99));
  spawnGemRing(b, 0, 0, 10, 6, makeRng(99));
  assert.deepEqual(a.list, b.list);
});

test('spawnGem defaults kind to blue and carries an explicit kind', () => {
  const g = createGems();
  const blue = spawnGem(g, 0, 0, 10, makeRng(1));
  assert.equal(blue.kind, 'blue');
  const red = spawnGem(g, 0, 0, 10, makeRng(1), 'red');
  assert.equal(red.kind, 'red');
});

test('spawnGemRing propagates kind (default blue) to every gem', () => {
  const g = createGems();
  const reds = spawnGemRing(g, 0, 0, 10, 4, makeRng(1), 'red');
  for (const gem of reds) assert.equal(gem.kind, 'red');
  const g2 = createGems();
  const blues = spawnGemRing(g2, 0, 0, 10, 3, makeRng(1));
  for (const gem of blues) assert.equal(gem.kind, 'blue');
});

test('collected gems report their kind', () => {
  const g = createGems();
  spawnGem(g, 5, 0, 10, makeRng(1), 'red'); // within ship+gem radius
  const ship = { x: 0, y: 0, radius: 18 };
  const collected = updateGems(g, ship, 0.016);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].kind, 'red');
});

test('rollDrop: blue when the roll lands under blueChance', () => {
  assert.equal(rollDrop(() => 0.0, false), 'blue');
  assert.equal(rollDrop(() => GEMS.blueChance - 1e-9, false), 'blue');
});

test('rollDrop: red in the band above blueChance, null beyond', () => {
  // small enemy: red band is [0.35, 0.43)
  assert.equal(rollDrop(() => GEMS.blueChance, false), 'red');
  assert.equal(rollDrop(() => GEMS.blueChance + GEMS.redChance - 1e-9, false), 'red');
  assert.equal(rollDrop(() => GEMS.blueChance + GEMS.redChance, false), null);
  assert.equal(rollDrop(() => 0.99, false), null);
});

test('rollDrop: isBig doubles the red band (splitter/boss-class)', () => {
  // a roll of 0.50 is null for a small enemy but red for a big one
  const roll = GEMS.blueChance + GEMS.redChance + 1e-3; // 0.35 + 0.08 + eps = ~0.431
  assert.equal(rollDrop(() => roll, false), null);
  assert.equal(rollDrop(() => roll, true), 'red');
  // upper edge of the doubled band [0.35, 0.51)
  assert.equal(rollDrop(() => GEMS.blueChance + GEMS.redChance * 2 - 1e-9, true), 'red');
  assert.equal(rollDrop(() => GEMS.blueChance + GEMS.redChance * 2, true), null);
});

test('rollDrop: seeded-rng distribution is mutually exclusive and roughly on target', () => {
  const rng = makeRng(12345);
  const N = 20000;
  let blue = 0, red = 0, none = 0;
  for (let i = 0; i < N; i++) {
    const k = rollDrop(rng, false);
    if (k === 'blue') blue++;
    else if (k === 'red') red++;
    else none++;
  }
  assert.equal(blue + red + none, N); // partitioned, mutually exclusive
  assert.ok(Math.abs(blue / N - GEMS.blueChance) < 0.02, `blue rate ${blue / N}`);
  assert.ok(Math.abs(red / N - GEMS.redChance) < 0.02, `red rate ${red / N}`);
});

test('rollDrop: luck scales blue and red bands ×luck', () => {
  const luck = 1.3;
  // blue band widens to blueChance*luck
  assert.equal(rollDrop(() => GEMS.blueChance * luck - 1e-9, false, luck), 'blue');
  assert.equal(rollDrop(() => GEMS.blueChance * luck, false, luck), 'red');
  // red band widens too
  const redEnd = GEMS.blueChance * luck + GEMS.redChance * luck;
  assert.equal(rollDrop(() => redEnd - 1e-9, false, luck), 'red');
  assert.equal(rollDrop(() => redEnd, false, luck), null);
});

test('rollDrop: luck defaults to 1 (unchanged from base behaviour)', () => {
  assert.equal(rollDrop(() => GEMS.blueChance - 1e-9), 'blue');
  assert.equal(rollDrop(() => GEMS.blueChance), 'red');
});

test('rollDrop: blue chance clamps at 0.6 under extreme luck', () => {
  const luck = 10; // blueChance*10 = 3.5, clamped to 0.6
  assert.equal(rollDrop(() => 0.6 - 1e-9, false, luck), 'blue');
  assert.equal(rollDrop(() => 0.6, false, luck), 'red'); // just past the clamped blue band
});

test('rollDrop: red chance clamps at 0.2 (including isBig doubling)', () => {
  const luck = 10;
  // blue clamps to 0.6, red clamps to 0.2 → red band is [0.6, 0.8)
  assert.equal(rollDrop(() => 0.8 - 1e-9, true, luck), 'red');
  assert.equal(rollDrop(() => 0.8, true, luck), null);
  // even isBig can't push red past 0.2
  assert.equal(rollDrop(() => 0.6, false, luck), 'red');
  assert.equal(rollDrop(() => 0.8 - 1e-9, false, luck), 'red');
  assert.equal(rollDrop(() => 0.8, false, luck), null);
});

test('gemBlinking is true only during the last BLINK_TIME seconds of life', () => {
  const g = createGems();
  const gem = spawnGem(g, 0, 0, 10, makeRng(1));
  gem.age = GEMS.lifetime - BLINK_TIME - 0.1;
  assert.equal(gemBlinking(gem), false);
  gem.age = GEMS.lifetime - BLINK_TIME + 0.1;
  assert.equal(gemBlinking(gem), true);
});

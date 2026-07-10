# Arena Space Shooter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 arena space shooter from `docs/superpowers/specs/2026-07-09-arena-space-shooter-design.md`: 360° waves, nose-aimed ship with damped drift, tap/hold trigger, roguelite upgrades, pixel art, all in vanilla JS.

**Architecture:** Native ES modules, no build step. Game logic (physics, waves, upgrades, scoring, collision) lives in pure modules with no DOM access, unit-tested with Node's built-in test runner. Browser-only modules (sprites, audio, hud, main loop) read/write plain state objects. `main.js` owns the state machine: MENU → PLAYING → UPGRADE_CHOICE → GAME_OVER.

**Tech Stack:** Vanilla JavaScript (ES2022), Canvas 2D, WebAudio, Node ≥20 for `node --test`. Zero dependencies.

## Global Constraints

- Zero npm dependencies; `package.json` exists only for `"type": "module"` and scripts.
- No build step. Game must run by serving the folder statically (`python3 -m http.server 8000`).
- All pixel art generated in code (palette-indexed string rows → offscreen canvas, nearest-neighbor). No image or audio asset files.
- Pure-logic modules (`utils`, `config`, `ship`, `bullets`, `enemies`, `waves`, `run`, `upgrades`, `particles`) must import cleanly in Node — no `window`/`document`/`canvas` references.
- Randomness in logic modules comes in as an injected `rng` function (testability). Only `main.js` seeds it.
- Spec values verbatim: 3 HP base; semi-auto cooldown = 80% of full-auto interval (both scale with fire-rate mods); wave budget = 3 + 2×(wave−1); enemy speed/HP +4%/wave; telegraph ≈ 1s; damped drift with max-speed cap; delta-time clamped to 50ms; `localStorage` wrapped in try/catch; WebAudio created on first user gesture.
- Commit after every task (working tree green: `npm test` passes).

## File Map

```
package.json        type:module + test/serve scripts        (Task 1)
index.html          canvas shell                            (Task 1)
src/utils.js        TAU, clamp, dist, makeRng, pick, best-score storage (Task 1)
src/config.js       all tuning constants                    (Task 1)
src/ship.js         createShip, updateShip, updateGun       (Tasks 2–3)
src/bullets.js      updateBullets, circleHit, collideBullets(Task 3)
src/enemies.js      spawnEnemy, updateEnemy, deathSpawns, scaleFor (Task 4)
src/waves.js        waveBudget, buildWave, scheduleWave     (Task 5)
src/run.js          createRun, multiplier, addKill, hitPlayer (Task 6)
src/upgrades.js     UPGRADES, rollOffers, applyUpgrade      (Task 7)
src/sprites.js      makeSprite, initSprites, SPRITES        (Task 8)
src/particles.js    createFx, burst, addShake, addPause, updateFx (Task 9)
src/audio.js        initAudio, sfxShot/Explosion/Hit/Chime/Wave (Task 10)
src/hud.js          drawHud, drawMenu, drawGameOver, drawOffers, offerRects (Task 11)
src/input.js        createInput → per-frame snapshot        (Task 12)
src/main.js         loop, state machine, world render       (Tasks 1 stub, 8 gallery, 12 final)
test/*.test.js      one per logic module
```

---

### Task 1: Scaffold, utils, config

**Files:**
- Create: `package.json`, `index.html`, `src/main.js` (stub), `src/utils.js`, `src/config.js`
- Test: `test/utils.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `TAU`, `clamp(v,lo,hi)`, `dist(ax,ay,bx,by)`, `makeRng(seed)→()=>float`, `pick(rng,arr)`, `loadBest()→number`, `saveBest(n)`; every constant object in `config.js` exactly as written below — later tasks import these names verbatim.

- [ ] **Step 1: Write the failing test**

```js
// test/utils.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAU, clamp, dist, makeRng, pick, loadBest, saveBest } from '../src/utils.js';

test('clamp bounds values', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('dist is euclidean', () => {
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('makeRng is deterministic and in [0,1)', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('pick selects from array', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 20; i++) assert.ok([1, 2, 3].includes(pick(rng, [1, 2, 3])));
});

test('best-score storage is safe without localStorage', () => {
  assert.equal(loadBest(), 0);
  assert.doesNotThrow(() => saveBest(123));
});

test('TAU is a full circle', () => {
  assert.equal(TAU, Math.PI * 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/juliancosta/Game - NP" && node --test test/`
Expected: FAIL — `Cannot find module '../src/utils.js'` (also fails until package.json exists because of ESM).

- [ ] **Step 3: Write scaffold + implementation**

```json
// package.json
{
  "name": "arena-space-shooter",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "serve": "python3 -m http.server 8000"
  }
}
```

```js
// src/utils.js
export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Deterministic LCG so game logic is testable with a fixed seed.
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const BEST_KEY = 'np-shooter-best';

export function loadBest() {
  try { return Number(globalThis.localStorage?.getItem(BEST_KEY)) || 0; }
  catch { return 0; }
}

export function saveBest(score) {
  try { globalThis.localStorage?.setItem(BEST_KEY, String(score)); }
  catch { /* private mode: session-only best */ }
}
```

```js
// src/config.js
export const SHIP = {
  radius: 12,
  turnRate: 3.6,     // rad/s
  thrust: 320,       // px/s^2
  maxSpeed: 260,     // px/s
  friction: 1.2,     // exponential damping coefficient per second
  recoil: 18,        // px/s pushback per shot
  maxHp: 3,
  iframeTime: 1.2,   // s of invulnerability after a hit
};

export const GUN = {
  autoInterval: 0.22,    // s between full-auto shots at fireRate 1
  semiFloor: 0.8,        // semi-auto cooldown = semiFloor * auto interval
  bulletSpeed: 420,
  bulletRange: 480,
  bulletRadius: 3,
  damage: 1,
  spreadAngle: 0.14,     // rad of random jitter on full-auto shots
  spreadShotAngle: 0.28, // rad offset per Spread Shot side bullet
};

export const ENEMIES = {
  drifter:  { cost: 1, hp: 2, speed: 60,  radius: 12, score: 100 },
  darter:   { cost: 2, hp: 1, speed: 90,  radius: 9,  score: 150,
              aimRange: 260, aimTime: 0.7, lungeSpeed: 330, lungeTime: 0.45 },
  splitter: { cost: 3, hp: 5, speed: 40,  radius: 18, score: 200 },
  mini:     { cost: 0, hp: 1, speed: 110, radius: 8,  score: 75 },
};

export const WAVE = {
  baseBudget: 3,
  budgetPerWave: 2,      // budget = 3 + 2*(wave-1)
  scalePerWave: 0.04,    // +4% enemy hp/speed per wave
  spawnInterval: 1.1,    // s between trickled spawns
  telegraphTime: 1.0,    // s of spawn warning marker
};

export const SCORE = { streakStep: 5, maxMult: 5 }; // mult = 1 + floor(streak/5), capped
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Untitled Space Shooter</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0b12; overflow: hidden; cursor: crosshair; }
  canvas { display: block; image-rendering: pixelated; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script type="module" src="src/main.js"></script>
</body>
</html>
```

```js
// src/main.js — stub, replaced in Task 12
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  g.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

function frame() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#e8e6d8';
  g.font = '16px monospace';
  g.fillText('scaffold ok', 20, 30);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/juliancosta/Game - NP" && npm test`
Expected: PASS — 6 tests.

- [ ] **Step 5: Verify serving works**

Run: `npm run serve` (background) then open `http://localhost:8000`.
Expected: dark page with "scaffold ok".

- [ ] **Step 6: Commit**

```bash
git add package.json index.html src test
git commit -m "feat: scaffold project with utils, config, and canvas shell"
```

---

### Task 2: Ship physics

**Files:**
- Create: `src/ship.js`
- Test: `test/ship.test.js`

**Interfaces:**
- Consumes: `SHIP` from `config.js`; `TAU` from `utils.js`.
- Produces: `createShip(x, y) → ship`, `updateShip(ship, input, dt, arena)`. Ship shape (relied on by every later task): `{ x, y, vx, vy, angle, radius, hp, maxHp, iframes, cooldown, mods: { fireRate, damage, engine, pierce, spread, bulletSpeed }, shield: { owned, up } }`. `input` snapshot: `{ rotate: -1|0|1, thrust: bool, held: bool, taps: int }`. `arena = { w, h }`.

- [ ] **Step 1: Write the failing test**

```js
// test/ship.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateShip } from '../src/ship.js';
import { SHIP } from '../src/config.js';

const arena = { w: 800, h: 600 };
const idle = { rotate: 0, thrust: false, held: false, taps: 0 };

test('createShip has spec defaults', () => {
  const s = createShip(400, 300);
  assert.equal(s.hp, 3);
  assert.equal(s.maxHp, 3);
  assert.deepEqual(s.mods, { fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1 });
  assert.deepEqual(s.shield, { owned: false, up: false });
});

test('rotation input turns the ship', () => {
  const s = createShip(400, 300);
  const a0 = s.angle;
  updateShip(s, { ...idle, rotate: 1 }, 0.5, arena);
  assert.ok(Math.abs(s.angle - a0 - SHIP.turnRate * 0.5) < 1e-9);
});

test('thrust accelerates in facing direction', () => {
  const s = createShip(400, 300);
  s.angle = 0; // facing +x
  updateShip(s, { ...idle, thrust: true }, 0.1, arena);
  assert.ok(s.vx > 0);
  assert.ok(Math.abs(s.vy) < 1e-9);
});

test('friction damps velocity when coasting', () => {
  const s = createShip(400, 300);
  s.vx = 200;
  updateShip(s, idle, 0.5, arena);
  assert.ok(s.vx < 200 && s.vx > 0); // slows but keeps drifting
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/ship.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/ship.js
import { SHIP } from './config.js';
import { TAU } from './utils.js';

export function createShip(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -TAU / 4, // nose up
    radius: SHIP.radius,
    hp: SHIP.maxHp, maxHp: SHIP.maxHp,
    iframes: 0, cooldown: 0,
    mods: { fireRate: 1, damage: 0, engine: 1, pierce: 0, spread: 0, bulletSpeed: 1 },
    shield: { owned: false, up: false },
  };
}

export function updateShip(ship, input, dt, arena) {
  ship.angle += input.rotate * SHIP.turnRate * dt;

  if (input.thrust) {
    const a = SHIP.thrust * ship.mods.engine;
    ship.vx += Math.cos(ship.angle) * a * dt;
    ship.vy += Math.sin(ship.angle) * a * dt;
  }

  const damp = Math.exp(-SHIP.friction * dt);
  ship.vx *= damp;
  ship.vy *= damp;

  const max = SHIP.maxSpeed * ship.mods.engine;
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  const r = ship.radius;
  if (ship.x < r)            { ship.x = r;            ship.vx = Math.abs(ship.vx) * 0.5; }
  if (ship.x > arena.w - r)  { ship.x = arena.w - r;  ship.vx = -Math.abs(ship.vx) * 0.5; }
  if (ship.y < r)            { ship.y = r;            ship.vy = Math.abs(ship.vy) * 0.5; }
  if (ship.y > arena.h - r)  { ship.y = arena.h - r;  ship.vy = -Math.abs(ship.vy) * 0.5; }

  ship.iframes = Math.max(0, ship.iframes - dt);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all ship + utils tests.

- [ ] **Step 5: Commit**

```bash
git add src/ship.js test/ship.test.js
git commit -m "feat: ship physics with damped drift and soft edge bounce"
```

---

### Task 3: Gun and bullets

**Files:**
- Modify: `src/ship.js` (append `updateGun` + private `fire`)
- Create: `src/bullets.js`
- Test: `test/gun.test.js`, `test/bullets.test.js`

**Interfaces:**
- Consumes: ship shape and `input` snapshot from Task 2; `GUN`, `SHIP` from config.
- Produces: `updateGun(ship, input, dt, rng) → bullet[]` (new bullets this frame; mutates `ship.cooldown` and applies recoil). Bullet shape: `{ x, y, vx, vy, damage, pierce, traveled, range, radius, dead }`. From `bullets.js`: `updateBullets(bullets, dt) → bullet[]` (moved + culled), `circleHit(a, b) → bool` (any two `{x,y,radius}`), `collideBullets(bullets, enemies) → hits[]` where each hit is `{ enemy, damage }` (mutates `enemy.hp` and bullet `pierce`/`dead`).

- [ ] **Step 1: Write the failing tests**

```js
// test/gun.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShip, updateGun } from '../src/ship.js';
import { GUN } from '../src/config.js';

const rngMid = () => 0.5; // zero jitter: (0.5-0.5)*2*spread = 0

test('holding fires once, then respects auto cooldown', () => {
  const s = createShip(0, 0);
  const held = { rotate: 0, thrust: false, held: true, taps: 0 };
  assert.equal(updateGun(s, held, 1 / 60, rngMid).length, 1);
  assert.ok(Math.abs(s.cooldown - GUN.autoInterval) < 1e-9);
  assert.equal(updateGun(s, held, 1 / 60, rngMid).length, 0); // still cooling
});

test('tap fires with 80% of auto interval as cooldown', () => {
  const s = createShip(0, 0);
  const tap = { rotate: 0, thrust: false, held: false, taps: 1 };
  assert.equal(updateGun(s, tap, 1 / 60, rngMid).length, 1);
  assert.ok(Math.abs(s.cooldown - GUN.autoInterval * GUN.semiFloor) < 1e-9);
});

test('semi cooldown scales with fire rate mod', () => {
  const s = createShip(0, 0);
  s.mods.fireRate = 1.25;
  updateGun(s, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.ok(Math.abs(s.cooldown - (GUN.autoInterval / 1.25) * GUN.semiFloor) < 1e-9);
});

test('tap is perfectly accurate, held shot can jitter', () => {
  const sTap = createShip(0, 0);
  sTap.angle = 0;
  const [b] = updateGun(sTap, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, () => 1);
  assert.ok(Math.abs(Math.atan2(b.vy, b.vx)) < 1e-9); // exactly along nose

  const sHeld = createShip(0, 0);
  sHeld.angle = 0;
  const [h] = updateGun(sHeld, { rotate: 0, thrust: false, held: true, taps: 0 }, 1 / 60, () => 1);
  assert.ok(Math.abs(Math.atan2(h.vy, h.vx) - GUN.spreadAngle) < 1e-6); // rng=1 → +spreadAngle
});

test('spread mod adds side bullets on held fire only', () => {
  const s = createShip(0, 0);
  s.mods.spread = 1;
  const held = updateGun(s, { rotate: 0, thrust: false, held: true, taps: 0 }, 1 / 60, rngMid);
  assert.equal(held.length, 3); // center + 2 sides
  const s2 = createShip(0, 0);
  s2.mods.spread = 1;
  const tapped = updateGun(s2, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(tapped.length, 1);
});

test('damage and bullet speed mods apply; firing recoils the ship', () => {
  const s = createShip(0, 0);
  s.angle = 0;
  s.mods.damage = 1;
  s.mods.bulletSpeed = 1.4;
  const [b] = updateGun(s, { rotate: 0, thrust: false, held: false, taps: 1 }, 1 / 60, rngMid);
  assert.equal(b.damage, GUN.damage + 1);
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - GUN.bulletSpeed * 1.4) < 1e-6);
  assert.ok(Math.abs(b.range - GUN.bulletRange * 1.4) < 1e-6);
  assert.ok(s.vx < 0); // recoil opposite to nose
});
```

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `updateGun` not exported; `../src/bullets.js` missing.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ship.js` (add `GUN` to the config import):

```js
// src/ship.js — append; change first import line to:
// import { SHIP, GUN } from './config.js';

export function updateGun(ship, input, dt, rng) {
  if (ship.cooldown > 0) return [];
  const autoInt = GUN.autoInterval / ship.mods.fireRate;
  if (input.taps > 0) {
    ship.cooldown = autoInt * GUN.semiFloor;
    return fire(ship, 0, rng, false);
  }
  if (input.held) {
    ship.cooldown = autoInt;
    return fire(ship, GUN.spreadAngle, rng, true);
  }
  return [];
}

function fire(ship, jitter, rng, withSpread) {
  const speed = GUN.bulletSpeed * ship.mods.bulletSpeed;
  const range = GUN.bulletRange * ship.mods.bulletSpeed;
  const damage = GUN.damage + ship.mods.damage;

  const angles = [ship.angle + (rng() - 0.5) * 2 * jitter];
  if (withSpread) {
    for (let i = 1; i <= ship.mods.spread; i++) {
      angles.push(ship.angle + GUN.spreadShotAngle * i, ship.angle - GUN.spreadShotAngle * i);
    }
  }

  ship.vx -= Math.cos(ship.angle) * SHIP.recoil;
  ship.vy -= Math.sin(ship.angle) * SHIP.recoil;

  return angles.map(a => ({
    x: ship.x + Math.cos(a) * ship.radius,
    y: ship.y + Math.sin(a) * ship.radius,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    damage, pierce: ship.mods.pierce,
    traveled: 0, range, radius: GUN.bulletRadius, dead: false,
  }));
}
```

```js
// src/bullets.js
import { dist } from './utils.js';

export function updateBullets(bullets, dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    if (b.traveled > b.range) b.dead = true;
  }
  return bullets.filter(b => !b.dead);
}

export function circleHit(a, b) {
  return dist(a.x, a.y, b.x, b.y) < a.radius + b.radius;
}

export function collideBullets(bullets, enemies) {
  const hits = [];
  for (const b of bullets) {
    for (const e of enemies) {
      if (b.dead) break;
      if (e.hp <= 0) continue;
      if (circleHit(b, e)) {
        e.hp -= b.damage;
        hits.push({ enemy: e, damage: b.damage });
        if (b.pierce > 0) b.pierce -= 1;
        else b.dead = true;
      }
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests so far.

- [ ] **Step 5: Commit**

```bash
git add src/ship.js src/bullets.js test/gun.test.js test/bullets.test.js
git commit -m "feat: tap/hold gun logic and bullet collision with pierce"
```

---

### Task 4: Enemies

**Files:**
- Create: `src/enemies.js`
- Test: `test/enemies.test.js`

**Interfaces:**
- Consumes: `ENEMIES`, `WAVE` from config; ship `{x, y}` for seeking.
- Produces: `scaleFor(wave) → number`, `spawnEnemy(type, x, y, wave) → enemy`, `updateEnemy(enemy, ship, dt)`, `deathSpawns(enemy) → enemy[]`. Enemy shape: `{ type, x, y, vx, vy, hp, maxHp, speed, radius, score, wave, state, timer, dead }`. Darter `state` cycles `'chase' → 'aim' → 'lunge'` (render uses `state === 'aim'` to flash).

- [ ] **Step 1: Write the failing test**

```js
// test/enemies.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleFor, spawnEnemy, updateEnemy, deathSpawns } from '../src/enemies.js';
import { ENEMIES } from '../src/config.js';

const ship = { x: 400, y: 300 };

test('scaleFor grows 4% per wave', () => {
  assert.equal(scaleFor(1), 1);
  assert.ok(Math.abs(scaleFor(6) - 1.2) < 1e-9);
});

test('spawnEnemy applies wave scaling to hp and speed', () => {
  const e = spawnEnemy('drifter', 0, 0, 6);
  assert.equal(e.hp, Math.round(ENEMIES.drifter.hp * 1.2));
  assert.ok(Math.abs(e.speed - ENEMIES.drifter.speed * 1.2) < 1e-9);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/enemies.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/enemies.js
import { ENEMIES, WAVE } from './config.js';

export function scaleFor(wave) {
  return 1 + WAVE.scalePerWave * (wave - 1);
}

export function spawnEnemy(type, x, y, wave) {
  const def = ENEMIES[type];
  const s = scaleFor(wave);
  return {
    type, x, y, vx: 0, vy: 0,
    hp: Math.round(def.hp * s), maxHp: Math.round(def.hp * s),
    speed: def.speed * s,
    radius: def.radius, score: def.score,
    wave, state: 'chase', timer: 0, dead: false,
  };
}

export function updateEnemy(e, ship, dt) {
  const dx = ship.x - e.x, dy = ship.y - e.y;
  const d = Math.hypot(dx, dy) || 1;

  if (e.type === 'darter') {
    const def = ENEMIES.darter;
    e.timer -= dt;
    if (e.state === 'chase') {
      e.vx = (dx / d) * e.speed;
      e.vy = (dy / d) * e.speed;
      if (d < def.aimRange) {
        e.state = 'aim';
        e.timer = def.aimTime;
        e.vx = 0; e.vy = 0;
      }
    } else if (e.state === 'aim') {
      if (e.timer <= 0) {
        e.state = 'lunge';
        e.timer = def.lungeTime;
        const s = def.lungeSpeed * scaleFor(e.wave);
        e.vx = (dx / d) * s;
        e.vy = (dy / d) * s;
      }
    } else if (e.state === 'lunge' && e.timer <= 0) {
      e.state = 'chase';
    }
  } else {
    e.vx = (dx / d) * e.speed;
    e.vy = (dy / d) * e.speed;
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

export function deathSpawns(e) {
  if (e.type !== 'splitter') return [];
  return [-1, 1].map(side => spawnEnemy('mini', e.x + side * 10, e.y, e.wave));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enemies.js test/enemies.test.js
git commit -m "feat: drifter, darter, splitter behaviors with wave scaling"
```

---

### Task 5: Waves and spawn scheduling

**Files:**
- Create: `src/waves.js`
- Test: `test/waves.test.js`

**Interfaces:**
- Consumes: `ENEMIES`, `WAVE` from config; injected `rng`.
- Produces: `waveBudget(wave) → int`, `buildWave(wave, rng) → type[]`, `scheduleWave(types, rng, arena) → [{ at, type, x, y }]` sorted ascending by `at` (seconds from wave start). Main loop turns each due entry into a telegraph, then an enemy after `WAVE.telegraphTime`.

- [ ] **Step 1: Write the failing test**

```js
// test/waves.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveBudget, buildWave, scheduleWave } from '../src/waves.js';
import { ENEMIES } from '../src/config.js';
import { makeRng } from '../src/utils.js';

test('budget follows 3 + 2*(wave-1)', () => {
  assert.equal(waveBudget(1), 3);
  assert.equal(waveBudget(5), 11);
  assert.equal(waveBudget(10), 21);
});

test('buildWave spends the exact budget on buyable types', () => {
  for (let wave = 1; wave <= 12; wave++) {
    const types = buildWave(wave, makeRng(wave));
    const spent = types.reduce((sum, t) => sum + ENEMIES[t].cost, 0);
    assert.equal(spent, waveBudget(wave));
    assert.ok(types.every(t => ['drifter', 'darter', 'splitter'].includes(t)));
  }
});

test('scheduleWave places every spawn on time-sorted arena edges', () => {
  const arena = { w: 800, h: 600 };
  const types = buildWave(6, makeRng(6));
  const sched = scheduleWave(types, makeRng(99), arena);
  assert.equal(sched.length, types.length);
  for (let i = 1; i < sched.length; i++) assert.ok(sched[i].at >= sched[i - 1].at);
  for (const s of sched) {
    assert.ok(s.x >= 0 && s.x <= arena.w && s.y >= 0 && s.y <= arena.h);
    const nearEdge = s.x <= 20 || s.x >= arena.w - 20 || s.y <= 20 || s.y >= arena.h - 20;
    assert.ok(nearEdge);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/waves.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/waves.js
import { ENEMIES, WAVE } from './config.js';

const BUYABLE = ['drifter', 'darter', 'splitter'];

export function waveBudget(wave) {
  return WAVE.baseBudget + WAVE.budgetPerWave * (wave - 1);
}

export function buildWave(wave, rng) {
  let budget = waveBudget(wave);
  const types = [];
  while (budget > 0) {
    const affordable = BUYABLE.filter(t => ENEMIES[t].cost <= budget);
    const type = affordable[Math.floor(rng() * affordable.length)];
    types.push(type);
    budget -= ENEMIES[type].cost;
  }
  return types;
}

export function scheduleWave(types, rng, arena) {
  return types
    .map((type, i) => {
      const { x, y } = edgePoint(Math.floor(rng() * 4), rng(), arena);
      return { at: i * WAVE.spawnInterval + rng() * 0.4, type, x, y };
    })
    .sort((a, b) => a.at - b.at);
}

function edgePoint(edge, t, arena) {
  const m = 20; // inset so telegraphs are fully visible
  if (edge === 0) return { x: t * arena.w, y: m };
  if (edge === 1) return { x: arena.w - m, y: t * arena.h };
  if (edge === 2) return { x: t * arena.w, y: arena.h - m };
  return { x: m, y: t * arena.h };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/waves.js test/waves.test.js
git commit -m "feat: wave budgets and edge spawn scheduling"
```

---

### Task 6: Run state — scoring, streak, damage

**Files:**
- Create: `src/run.js`
- Test: `test/run.test.js`

**Interfaces:**
- Consumes: `SCORE`, `SHIP` from config; ship shape from Task 2; enemy `score` field from Task 4.
- Produces: `createRun() → { score, streak, wave, over }`, `multiplier(run) → int`, `addKill(run, enemy)`, `hitPlayer(run, ship) → 'iframe' | 'shield' | 'hit' | 'dead'` (mutates ship hp/iframes/shield and run streak/over).

- [ ] **Step 1: Write the failing test**

```js
// test/run.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, multiplier, addKill, hitPlayer } from '../src/run.js';
import { createShip } from '../src/ship.js';
import { SHIP } from '../src/config.js';

test('multiplier steps every 5 streak, capped at 5x', () => {
  const run = createRun();
  assert.equal(multiplier(run), 1);
  run.streak = 5;
  assert.equal(multiplier(run), 2);
  run.streak = 100;
  assert.equal(multiplier(run), 5);
});

test('addKill scores base * multiplier and grows streak', () => {
  const run = createRun();
  run.streak = 5; // 2x
  addKill(run, { score: 100 });
  assert.equal(run.score, 200);
  assert.equal(run.streak, 6);
});

test('hit during iframes does nothing', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.iframes = 0.5;
  assert.equal(hitPlayer(run, ship), 'iframe');
  assert.equal(ship.hp, 3);
});

test('shield absorbs one hit and grants iframes', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.shield = { owned: true, up: true };
  run.streak = 7;
  assert.equal(hitPlayer(run, ship), 'shield');
  assert.equal(ship.hp, 3);
  assert.ok(!ship.shield.up);
  assert.equal(ship.iframes, SHIP.iframeTime);
  assert.equal(run.streak, 7); // shield hits don't break streak
});

test('real hit costs hp, resets streak, grants iframes', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  run.streak = 9;
  assert.equal(hitPlayer(run, ship), 'hit');
  assert.equal(ship.hp, 2);
  assert.equal(run.streak, 0);
  assert.equal(ship.iframes, SHIP.iframeTime);
});

test('hit at 1 hp ends the run', () => {
  const run = createRun();
  const ship = createShip(0, 0);
  ship.hp = 1;
  assert.equal(hitPlayer(run, ship), 'dead');
  assert.ok(run.over);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/run.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/run.js
import { SCORE, SHIP } from './config.js';

export function createRun() {
  return { score: 0, streak: 0, wave: 1, over: false };
}

export function multiplier(run) {
  return Math.min(SCORE.maxMult, 1 + Math.floor(run.streak / SCORE.streakStep));
}

export function addKill(run, enemy) {
  run.score += enemy.score * multiplier(run);
  run.streak += 1;
}

export function hitPlayer(run, ship) {
  if (ship.iframes > 0) return 'iframe';
  if (ship.shield.up) {
    ship.shield.up = false;
    ship.iframes = SHIP.iframeTime;
    return 'shield';
  }
  ship.hp -= 1;
  ship.iframes = SHIP.iframeTime;
  run.streak = 0;
  if (ship.hp <= 0) {
    run.over = true;
    return 'dead';
  }
  return 'hit';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/run.js test/run.test.js
git commit -m "feat: scoring with streak multiplier, damage and shield handling"
```

---

### Task 7: Upgrades

**Files:**
- Create: `src/upgrades.js`
- Test: `test/upgrades.test.js`

**Interfaces:**
- Consumes: ship shape (mutates `mods`, `maxHp`, `hp`, `shield`).
- Produces: `UPGRADES` — array of `{ id, name, desc, apply(ship) }`; `rollOffers(ship, rng) → upgrade[3]` (unique; excludes `aegis` when `ship.shield.owned`); `applyUpgrade(ship, id)`. HUD renders `name` and `desc` verbatim.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/upgrades.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/upgrades.js
export const UPGRADES = [
  { id: 'rapid',    name: 'Rapid Fire',      desc: '+25% fire rate',           apply: s => { s.mods.fireRate *= 1.25; } },
  { id: 'heavy',    name: 'Heavy Rounds',    desc: '+1 bullet damage',         apply: s => { s.mods.damage += 1; } },
  { id: 'engine',   name: 'Engine Tune',     desc: '+20% thrust & max speed',  apply: s => { s.mods.engine *= 1.2; } },
  { id: 'hull',     name: 'Hull Plating',    desc: '+1 max HP, heal 1',        apply: s => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'pierce',   name: 'Piercing Shots',  desc: 'Bullets pierce +1 enemy',  apply: s => { s.mods.pierce += 1; } },
  { id: 'spread',   name: 'Spread Shot',     desc: '+2 side bullets on auto',  apply: s => { s.mods.spread += 1; } },
  { id: 'velocity', name: 'Velocity Rounds', desc: '+40% bullet speed/range',  apply: s => { s.mods.bulletSpeed *= 1.4; } },
  { id: 'aegis',    name: 'Aegis Shield',    desc: 'Blocks 1 hit, recharges',  apply: s => { s.shield.owned = true; s.shield.up = true; } },
];

export function rollOffers(ship, rng) {
  const avail = UPGRADES.filter(u => !(u.id === 'aegis' && ship.shield.owned));
  const offers = [];
  while (offers.length < 3 && avail.length > 0) {
    offers.push(avail.splice(Math.floor(rng() * avail.length), 1)[0]);
  }
  return offers;
}

export function applyUpgrade(ship, id) {
  UPGRADES.find(u => u.id === id).apply(ship);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/upgrades.js test/upgrades.test.js
git commit -m "feat: upgrade pool with stacking and offer rolls"
```

---

### Task 8: Pixel-art sprites

**Files:**
- Create: `src/sprites.js`
- Modify: `src/main.js` (temporary sprite gallery — main.js is fully rewritten in Task 12, so this is throwaway by design)

**Interfaces:**
- Consumes: `document` (browser-only module — never imported by logic tests).
- Produces: `makeSprite(rows, palette, scale=3) → HTMLCanvasElement`; `initSprites()` (call once at boot); `SPRITES` object with keys `ship, drifter, darter, splitter, mini, shield`. All sprites author-facing **pointing right** (+x) so `ctx.rotate(entity.angle)` works directly.

- [ ] **Step 1: Write the implementation**

```js
// src/sprites.js
export const SPRITES = {};

export function makeSprite(rows, palette, scale = 3) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale;
  c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = palette[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return c;
}

// All art faces +x (right). '.' = transparent.
const SHIP_ROWS = [
  '..GG.......',
  '..WWWG.....',
  'RRWWWWWG...',
  'RRWWWWWWWWY',
  'RRWWWWWG...',
  '..WWWG.....',
  '..GG.......',
];
const SHIP_PAL = { W: '#e8e6d8', G: '#7a8a99', R: '#e6743e', Y: '#ffd75e' };

const DRIFTER_ROWS = [
  '..PPP..',
  '.PDDDP.',
  'PDDEDDP',
  'PDEEEDP',
  'PDDEDDP',
  '.PDDDP.',
  '..PPP..',
];
const DRIFTER_PAL = { P: '#8e4ec6', D: '#5c2e8a', E: '#ff5edb' };

const DARTER_ROWS = [
  '....C.',
  'CCCEC.',
  '.CCCCE',
  'CCCEC.',
  '....C.',
];
const DARTER_PAL = { C: '#3ecfe6', E: '#e8fdff' };

const SPLITTER_ROWS = [
  '..OOOOO..',
  '.OYYYYYO.',
  'OYYOOOYYO',
  'OYOYYYOYO',
  'OYYOOOYYO',
  '.OYYYYYO.',
  '..OOOOO..',
];
const SPLITTER_PAL = { O: '#c2452e', Y: '#ff9e3e' };

const MINI_ROWS = [
  '.OO.',
  'OYYO',
  'OYYO',
  '.OO.',
];

const SHIELD_ROWS = [
  '..BBB..',
  '.B...B.',
  'B.....B',
  'B.....B',
  'B.....B',
  '.B...B.',
  '..BBB..',
];
const SHIELD_PAL = { B: '#5ea8ff' };

export function initSprites() {
  SPRITES.ship = makeSprite(SHIP_ROWS, SHIP_PAL);
  SPRITES.drifter = makeSprite(DRIFTER_ROWS, DRIFTER_PAL);
  SPRITES.darter = makeSprite(DARTER_ROWS, DARTER_PAL);
  SPRITES.splitter = makeSprite(SPLITTER_ROWS, SPLITTER_PAL);
  SPRITES.mini = makeSprite(MINI_ROWS, SPLITTER_PAL);
  SPRITES.shield = makeSprite(SHIELD_ROWS, SHIELD_PAL, 4);
}
```

- [ ] **Step 2: Temporary gallery to verify by eye**

Replace the `frame` function body in `src/main.js` with:

```js
// src/main.js — TEMPORARY gallery (Task 12 rewrites this file entirely)
import { initSprites, SPRITES } from './sprites.js';
initSprites();

function frame() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  let x = 40;
  for (const [name, spr] of Object.entries(SPRITES)) {
    g.drawImage(spr, x, 60);
    g.fillStyle = '#e8e6d8';
    g.font = '12px monospace';
    g.fillText(name, x, 50);
    x += spr.width + 40;
  }
  requestAnimationFrame(frame);
}
```

(Keep the existing canvas/resize code; move the two `import` lines to the top of the file.)

- [ ] **Step 3: Verify in browser**

Run: `npm run serve`, open `http://localhost:8000`.
Expected: six labeled pixel sprites on dark background — ship reads as pointing right, splitter visibly bigger than mini. Tweak rows/palettes until they read well; that iteration is expected here.

- [ ] **Step 4: Run tests still pass, commit**

Run: `npm test` — Expected: PASS (sprites.js is not imported by any test).

```bash
git add src/sprites.js src/main.js
git commit -m "feat: code-generated pixel sprites for ship and enemies"
```

---

### Task 9: Particles, screen shake, hit-pause

**Files:**
- Create: `src/particles.js`
- Test: `test/particles.test.js`

**Interfaces:**
- Consumes: `TAU` from utils; injected `rng`.
- Produces: `createFx() → { particles, shake, pause }`, `burst(fx, x, y, color, n, rng, speed?)`, `addShake(fx, mag)`, `addPause(fx, seconds)`, `updateFx(fx, dt)`. Main loop: while `fx.pause > 0` the world does not update (hit-pause); render offsets the camera by `fx.shake`-scaled jitter. Particle shape: `{ x, y, vx, vy, life, t, color }`.

- [ ] **Step 1: Write the failing test**

```js
// test/particles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFx, burst, addShake, addPause, updateFx } from '../src/particles.js';
import { makeRng } from '../src/utils.js';

test('burst adds n particles at the origin point', () => {
  const fx = createFx();
  burst(fx, 10, 20, '#fff', 12, makeRng(1));
  assert.equal(fx.particles.length, 12);
  assert.ok(fx.particles.every(p => p.x === 10 && p.y === 20));
});

test('particles move and expire', () => {
  const fx = createFx();
  burst(fx, 0, 0, '#fff', 5, makeRng(1));
  updateFx(fx, 0.1);
  assert.ok(fx.particles.length === 5);
  assert.ok(fx.particles.some(p => p.x !== 0 || p.y !== 0));
  updateFx(fx, 2); // way past max life (0.7s)
  assert.equal(fx.particles.length, 0);
});

test('shake takes the max and decays to zero', () => {
  const fx = createFx();
  addShake(fx, 8);
  addShake(fx, 3); // weaker shake never reduces current
  assert.equal(fx.shake, 8);
  updateFx(fx, 1);
  assert.equal(fx.shake, 0);
});

test('pause counts down', () => {
  const fx = createFx();
  addPause(fx, 0.05);
  updateFx(fx, 0.02);
  assert.ok(Math.abs(fx.pause - 0.03) < 1e-9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/particles.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/particles.js
import { TAU } from './utils.js';

export function createFx() {
  return { particles: [], shake: 0, pause: 0 };
}

export function burst(fx, x, y, color, n, rng, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const s = speed * (0.3 + rng() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.3 + rng() * 0.4, t: 0, color,
    });
  }
}

export function addShake(fx, mag) {
  fx.shake = Math.max(fx.shake, mag);
}

export function addPause(fx, seconds) {
  fx.pause = Math.max(fx.pause, seconds);
}

export function updateFx(fx, dt) {
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.pause = Math.max(0, fx.pause - dt);
  for (const p of fx.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  fx.particles = fx.particles.filter(p => p.t < p.life);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/particles.js test/particles.test.js
git commit -m "feat: particle bursts, screen shake, and hit-pause timers"
```

---

### Task 10: WebAudio SFX

**Files:**
- Create: `src/audio.js`

**Interfaces:**
- Consumes: `window.AudioContext` (browser-only module).
- Produces: `initAudio()` (idempotent; call on first user gesture), `sfxShot()`, `sfxExplosion()`, `sfxHit()`, `sfxChime()`, `sfxWave()`. All are safe no-ops before `initAudio()` runs.

- [ ] **Step 1: Write the implementation**

```js
// src/audio.js
let ctx = null;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
}

function blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur, vol = 0.2) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(gain).connect(ctx.destination);
  src.start(t);
}

export function sfxShot()      { blip(880, 0.07, 'square', 0.05, 220); }
export function sfxExplosion() { noise(0.25, 0.25); blip(140, 0.2, 'sawtooth', 0.1, 40); }
export function sfxHit()       { noise(0.35, 0.3); blip(90, 0.35, 'sawtooth', 0.18, 30); }
export function sfxChime()     { blip(523, 0.12, 'triangle', 0.15); setTimeout(() => blip(784, 0.2, 'triangle', 0.15), 90); }
export function sfxWave()      { blip(330, 0.1, 'triangle', 0.12); setTimeout(() => blip(440, 0.15, 'triangle', 0.12), 100); }
```

- [ ] **Step 2: Verify in browser**

With `npm run serve` running, open `http://localhost:8000`, click the page once, then in the devtools console:

```js
const a = await import('./src/audio.js');
a.initAudio();
a.sfxShot(); a.sfxExplosion(); a.sfxHit(); a.sfxChime(); a.sfxWave();
```

Expected: five distinct retro noises — pew, crunch, low crunch, rising two-note chime, two-note fanfare. No console errors. Also confirm `a.sfxShot()` before `initAudio()` would not throw (reload, call `sfxShot()` first).

- [ ] **Step 3: Commit**

```bash
git add src/audio.js
git commit -m "feat: synthesized retro SFX via WebAudio"
```

---

### Task 11: HUD and screens

**Files:**
- Create: `src/hud.js`

**Interfaces:**
- Consumes: `run` (Task 6), `ship` (Task 2), `offers` (Task 7 upgrade objects), canvas 2D context.
- Produces (all take the context `g` first):
  - `drawHud(g, w, run, ship)` — top bar: score+multiplier left, wave center, HP pips + shield right.
  - `drawMenu(g, w, h, best)` — title, controls, "click to start".
  - `drawGameOver(g, w, h, run, best)` — score, best, "click or press R to restart".
  - `drawOffers(g, w, h, offers)` — three centered cards labeled 1/2/3.
  - `offerRects(w, h) → [{x, y, w, h}]` — card hitboxes; main.js uses these for click detection, so drawing and hit-testing can never drift apart.

- [ ] **Step 1: Write the implementation**

```js
// src/hud.js
import { multiplier } from './run.js';

const FONT = 'monospace';
const INK = '#e8e6d8';
const DIM = '#8a879a';
const ACCENT = '#ffd75e';

export function drawHud(g, w, run, ship) {
  g.textBaseline = 'top';
  g.font = `16px ${FONT}`;
  g.fillStyle = INK;
  g.textAlign = 'left';
  g.fillText(`SCORE ${run.score}`, 16, 14);
  const mult = multiplier(run);
  if (mult > 1) {
    g.fillStyle = ACCENT;
    g.fillText(`x${mult}`, 16 + g.measureText(`SCORE ${run.score} `).width, 14);
  }
  g.fillStyle = DIM;
  g.textAlign = 'center';
  g.fillText(`WAVE ${run.wave}`, w / 2, 14);
  // HP pips right-aligned
  for (let i = 0; i < ship.maxHp; i++) {
    g.fillStyle = i < ship.hp ? '#e6743e' : '#3a3745';
    g.fillRect(w - 16 - (ship.maxHp - i) * 18, 14, 12, 12);
  }
  if (ship.shield.owned) {
    g.fillStyle = ship.shield.up ? '#5ea8ff' : '#3a3745';
    g.fillRect(w - 16 - (ship.maxHp + 1) * 18 - 6, 14, 12, 12);
  }
  g.textAlign = 'left';
}

export function drawMenu(g, w, h, best) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold 42px ${FONT}`;
  g.fillText('UNTITLED SPACE SHOOTER', w / 2, h * 0.32);
  g.font = `16px ${FONT}`;
  g.fillStyle = DIM;
  g.fillText('A/D or ←/→ rotate · W or ↑ thrust', w / 2, h * 0.48);
  g.fillText('hold mouse: auto-fire (spray) · tap mouse: precise shots', w / 2, h * 0.53);
  if (best > 0) {
    g.fillStyle = ACCENT;
    g.fillText(`BEST ${best}`, w / 2, h * 0.62);
  }
  g.fillStyle = INK;
  g.fillText('— click to start —', w / 2, h * 0.72);
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

export function drawGameOver(g, w, h, run, best) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e6743e';
  g.font = `bold 36px ${FONT}`;
  g.fillText('SHIP DESTROYED', w / 2, h * 0.34);
  g.fillStyle = INK;
  g.font = `20px ${FONT}`;
  g.fillText(`score ${run.score}   ·   wave ${run.wave}`, w / 2, h * 0.46);
  g.fillStyle = run.score >= best ? ACCENT : DIM;
  g.fillText(run.score >= best ? 'NEW BEST!' : `best ${best}`, w / 2, h * 0.53);
  g.fillStyle = DIM;
  g.font = `16px ${FONT}`;
  g.fillText('click or press R to fly again', w / 2, h * 0.66);
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

export function offerRects(w, h) {
  const cw = 220, ch = 150, gap = 30;
  const total = cw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y = (h - ch) / 2;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}

export function drawOffers(g, w, h, offers) {
  g.fillStyle = 'rgba(11, 11, 18, 0.75)';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold 24px ${FONT}`;
  g.fillText('WAVE CLEAR — CHOOSE AN UPGRADE', w / 2, h / 2 - 130);
  const rects = offerRects(w, h);
  offers.forEach((u, i) => {
    const r = rects[i];
    g.fillStyle = '#16141f';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = ACCENT;
    g.lineWidth = 2;
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.fillStyle = DIM;
    g.font = `14px ${FONT}`;
    g.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 26);
    g.fillStyle = INK;
    g.font = `bold 18px ${FONT}`;
    g.fillText(u.name, r.x + r.w / 2, r.y + 62);
    g.fillStyle = DIM;
    g.font = `14px ${FONT}`;
    g.fillText(u.desc, r.x + r.w / 2, r.y + 96);
  });
  g.textAlign = 'left';
  g.textBaseline = 'top';
}
```

- [ ] **Step 2: Verify tests still pass** (hud imports run.js which is pure — but hud itself is only imported by main)

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hud.js
git commit -m "feat: HUD, menu, game-over, and upgrade-choice screens"
```

---

### Task 12: Input and main loop integration

**Files:**
- Create: `src/input.js`
- Modify: `src/main.js` (full rewrite — replaces the Task 8 gallery)

**Interfaces:**
- Consumes: every module built so far, by the exact names in each task's Produces block.
- Produces: the playable game.

- [ ] **Step 1: Write input module**

```js
// src/input.js
export function createInput(canvas) {
  const down = new Set();
  let taps = 0, held = false, clicked = false, clickX = 0, clickY = 0;

  window.addEventListener('keydown', e => {
    down.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    taps += 1;
    held = true;
    clicked = true;
    clickX = e.offsetX;
    clickY = e.offsetY;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) held = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  return {
    poll() {
      const snap = {
        rotate: (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
              - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0),
        thrust: down.has('KeyW') || down.has('ArrowUp'),
        held, taps, clicked, clickX, clickY,
        key1: down.has('Digit1'), key2: down.has('Digit2'), key3: down.has('Digit3'),
        keyR: down.has('KeyR'),
      };
      taps = 0;
      clicked = false;
      return snap;
    },
  };
}
```

- [ ] **Step 2: Rewrite main.js as the full game**

```js
// src/main.js
import { WAVE } from './config.js';
import { makeRng, loadBest, saveBest, clamp } from './utils.js';
import { createShip, updateShip, updateGun } from './ship.js';
import { updateBullets, circleHit, collideBullets } from './bullets.js';
import { spawnEnemy, updateEnemy, deathSpawns } from './enemies.js';
import { buildWave, scheduleWave } from './waves.js';
import { createRun, addKill, hitPlayer } from './run.js';
import { rollOffers, applyUpgrade } from './upgrades.js';
import { initSprites, SPRITES } from './sprites.js';
import { createFx, burst, addShake, addPause, updateFx } from './particles.js';
import { initAudio, sfxShot, sfxExplosion, sfxHit, sfxChime, sfxWave } from './audio.js';
import { drawHud, drawMenu, drawGameOver, drawOffers, offerRects } from './hud.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const arena = { w: 0, h: 0 };

function resize() {
  canvas.width = arena.w = window.innerWidth;
  canvas.height = arena.h = window.innerHeight;
  g.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();
initSprites();

const input = createInput(canvas);
const rng = makeRng(Date.now());

let mode = 'menu'; // 'menu' | 'playing' | 'upgrade' | 'gameover'
let best = loadBest();
let run, ship, bullets, enemies, telegraphs, pending, waveT, fx, offers;

function startRun() {
  run = createRun();
  ship = createShip(arena.w / 2, arena.h / 2);
  bullets = [];
  enemies = [];
  telegraphs = [];
  fx = createFx();
  offers = [];
  startWave(1);
  mode = 'playing';
}

function startWave(n) {
  run.wave = n;
  pending = scheduleWave(buildWave(n, rng), rng, arena);
  waveT = 0;
  sfxWave();
}

function killEnemy(e) {
  e.dead = true;
  addKill(run, e);
  enemies.push(...deathSpawns(e));
  burst(fx, e.x, e.y, '#ff9e3e', 14, rng);
  addShake(fx, 5);
  addPause(fx, 0.03);
  sfxExplosion();
}

function damagePlayer() {
  const result = hitPlayer(run, ship);
  if (result === 'iframe') return;
  burst(fx, ship.x, ship.y, result === 'shield' ? '#5ea8ff' : '#e6743e', 20, rng);
  addShake(fx, result === 'shield' ? 6 : 12);
  sfxHit();
  if (result === 'dead') {
    if (run.score > best) { best = run.score; saveBest(best); }
    mode = 'gameover';
  }
}

function tickPlaying(snap, dt) {
  updateFx(fx, dt);
  if (fx.pause > 0) return; // hit-pause freezes the world, not the fx

  updateShip(ship, snap, dt, arena);

  const shots = updateGun(ship, snap, dt, rng);
  if (shots.length > 0) sfxShot();
  bullets.push(...shots);
  bullets = updateBullets(bullets, dt);

  // spawn pipeline: schedule → telegraph → enemy
  waveT += dt;
  while (pending.length > 0 && pending[0].at <= waveT) {
    const s = pending.shift();
    telegraphs.push({ ...s, t: WAVE.telegraphTime });
  }
  for (const tg of telegraphs) {
    tg.t -= dt;
    if (tg.t <= 0) enemies.push(spawnEnemy(tg.type, tg.x, tg.y, run.wave));
  }
  telegraphs = telegraphs.filter(tg => tg.t > 0);

  for (const e of enemies) updateEnemy(e, ship, dt);

  collideBullets(bullets, enemies);
  bullets = bullets.filter(b => !b.dead);
  for (const e of enemies) {
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }

  for (const e of enemies) {
    if (!e.dead && circleHit(e, ship)) {
      e.dead = true; // enemy explodes on impact, no score
      burst(fx, e.x, e.y, '#8a879a', 8, rng);
      damagePlayer();
      if (mode !== 'playing') break;
    }
  }
  enemies = enemies.filter(e => !e.dead);

  if (mode === 'playing' && pending.length === 0 && telegraphs.length === 0 && enemies.length === 0) {
    if (ship.shield.owned) ship.shield.up = true; // recharge between waves
    offers = rollOffers(ship, rng);
    mode = 'upgrade';
  }
}

function tickUpgrade(snap) {
  let choice = -1;
  if (snap.key1) choice = 0;
  if (snap.key2) choice = 1;
  if (snap.key3) choice = 2;
  if (snap.clicked) {
    offerRects(arena.w, arena.h).forEach((r, i) => {
      if (snap.clickX >= r.x && snap.clickX <= r.x + r.w &&
          snap.clickY >= r.y && snap.clickY <= r.y + r.h) choice = i;
    });
  }
  if (choice >= 0 && offers[choice]) {
    applyUpgrade(ship, offers[choice].id);
    sfxChime();
    startWave(run.wave + 1);
    mode = 'playing';
  }
}

function drawSprite(spr, x, y, angle = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.drawImage(spr, -spr.width / 2, -spr.height / 2);
  g.restore();
}

function render() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);

  if (mode === 'menu') { drawMenu(g, arena.w, arena.h, best); return; }

  g.save();
  if (fx.shake > 0) g.translate((rng() - 0.5) * fx.shake, (rng() - 0.5) * fx.shake);

  for (const tg of telegraphs) {
    const blink = Math.sin(tg.t * 25) > 0;
    g.strokeStyle = blink ? '#e6743e' : '#8a4a2e';
    g.lineWidth = 2;
    g.strokeRect(tg.x - 10, tg.y - 10, 20, 20);
  }

  for (const b of bullets) {
    g.fillStyle = '#ffd75e';
    g.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  for (const e of enemies) {
    const spr = SPRITES[e.type];
    const flash = e.type === 'darter' && e.state === 'aim' && Math.sin(e.timer * 30) > 0;
    if (flash) {
      g.save();
      g.globalAlpha = 0.5;
      drawSprite(spr, e.x, e.y, Math.atan2(e.vy, e.vx));
      g.restore();
    } else {
      drawSprite(spr, e.x, e.y, e.type === 'darter' ? Math.atan2(e.vy, e.vx) : 0);
    }
  }

  const blinking = ship.iframes > 0 && Math.sin(ship.iframes * 30) > 0;
  if (!blinking) drawSprite(SPRITES.ship, ship.x, ship.y, ship.angle);
  if (ship.shield.up) drawSprite(SPRITES.shield, ship.x, ship.y);

  for (const p of fx.particles) {
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.globalAlpha = 1;
  g.restore();

  drawHud(g, arena.w, run, ship);
  if (mode === 'upgrade') drawOffers(g, arena.w, arena.h, offers);
  if (mode === 'gameover') drawGameOver(g, arena.w, arena.h, run, best);
}

let last = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); // clamp: tab-switch can't teleport entities
  last = t;
  const snap = input.poll();

  if (mode === 'menu' && snap.clicked) { initAudio(); startRun(); }
  else if (mode === 'playing') tickPlaying(snap, dt);
  else if (mode === 'upgrade') tickUpgrade(snap);
  else if (mode === 'gameover' && (snap.clicked || snap.keyR)) startRun();

  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Add the missing import at the top: `import { createInput } from './input.js';`

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS — every suite.

- [ ] **Step 4: Playtest checklist (manual, in browser)**

With `npm run serve`, open `http://localhost:8000` and verify each:

- Menu shows title/controls; click starts a run and audio works from the first shot.
- Ship rotates (A/D and arrows), thrusts (W/↑), drifts and slows when coasting, bounces softly off edges.
- Hold mouse: continuous spray with visible jitter. Tap rapidly: noticeably crisper, straight shots.
- Orange squares blink at edges ~1s before each enemy appears.
- Drifters chase; darters freeze-flash then lunge; splitters burst into two fast minis.
- Kills: particles, brief freeze, shake, crunch sound, score climbs; multiplier appears after a 5-streak and vanishes when hit.
- Getting rammed: HP pip lost, big shake, ship blinks and is invulnerable briefly; enemy dies without score.
- Clearing the wave shows 3 distinct upgrade cards; both click and 1/2/3 keys choose; effect is felt next wave.
- Aegis: blue ring appears, absorbs one hit, recharges after the next wave clear; never offered twice.
- Death screen shows score/best; R or click restarts instantly; best survives a page reload.

- [ ] **Step 5: Commit**

```bash
git add src/input.js src/main.js
git commit -m "feat: wire full game loop with state machine and world render"
```

---

### Task 13: Verification and devlog

**Files:**
- No new source files. Screenshot for the devlog.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS, 0 failures.

- [ ] **Step 2: Headless smoke test + screenshots**

Drive the served game in a headless browser (Playwright if available on the machine, else manual): load page, assert no console errors, click to start, hold fire for ~5s, screenshot mid-combat. Capture menu + combat screenshots for the devlog.

- [ ] **Step 3: Balance pass**

Play at least 3 full runs. Tune `config.js` values (only that file) if: wave 1–2 kills the player (too hard) or wave 5 feels sleepy (too easy); full-auto feels strictly better than tapping (semiFloor too high) or vice versa.

- [ ] **Step 4: Update devlog artifact with screenshots, commit any tuning**

```bash
git add src/config.js
git commit -m "tune: balance pass after playtesting"
```

---

## Self-Review Notes

- **Spec coverage:** controls/tap-hold (T3), damped drift + bounce (T2), 3 HP/iframes/streak (T6), 3 enemy types + scaling (T4), budget/trickle/telegraph (T5, T12), 8 upgrades w/ stacking + aegis re-roll (T7), pixel art (T8), feel package (T9, T12), synth SFX (T10), HUD/menus/localStorage try-catch (T1, T11), dt clamp + gesture-gated audio (T12), out-of-scope list untouched. No gaps found.
- **Additions vs spec file list:** `config.js`, `utils.js`, `run.js` added for testability; `waves.js` keeps scheduling pure by returning a schedule that main.js executes.
- **Type consistency:** bullet/enemy/ship/input shapes defined once (T2–T4) and used verbatim in T12; `offerRects` shared between drawing and hit-testing.

# V3 "Bosses & Gems" — Design Spec (amendment to v1 + v2 specs)

**Date:** 2026-07-10 (overnight, free-rein round authorized by Julian)
**Rationale:** genre-standard depth features — boss fights (answer to "too easy"), score gems (Geometry Wars-style movement incentive), pause, and run stats/leaderboard (score-chasing teeth). Additive only; the approved core feel is untouched.

Global constraints unchanged (vanilla JS, zero deps, ESM, Node-clean pure logic with injected rng, npm test green per commit, backward-compatible optional params until integration).

## A. Score gems

- Killed enemies drop a gem with probability `GEMS.dropChance` (0.65), worth `Math.max(10, Math.round(enemy.score / 8))` score (multiplier applies on collect), at the enemy's position with a small random scatter velocity that damps quickly.
- Gems live `GEMS.lifetime` (6s); blink during the last 1.5s; despawn uncollected.
- **Magnet:** within `GEMS.magnetRadius` (130px) of the ship, gems accelerate toward it (`GEMS.magnetAccel` 900 px/s²; cap 480 px/s). Collect on circle overlap (gem radius 7).
- Collecting also shaves `GEMS.dashCredit` (0.12s) off the active dash recharge — flying into the fight pays defensively too.
- Bosses always drop 6 gems in a ring.
- **New pure module `src/gems.js`:** `createGems() → {list:[]}`, `spawnGem(g, x, y, value, rng)`, `spawnGemRing(g, x, y, value, n, rng)`, `updateGems(g, ship, dt) → collected[]` (moves/magnetizes/ages/culls; returns collected gems `{x, y, value}`).
- Config: `GEMS = { dropChance: 0.65, lifetime: 6, magnetRadius: 130, magnetAccel: 900, maxSpeed: 480, radius: 7, dashCredit: 0.12 }`.

## B. Boss waves

- Every 5th wave (`wave % 5 === 0`) is a boss wave: `buildWave` returns `['boss', ...escort]` where escort is a normal budget purchase at **40%** of the wave's budget (types still unlock-gated). Export `isBossWave(wave)`.
- **Boss enemy** (`ENEMIES.boss`): `{ cost: 0, hp: 60, speed: 32, radius: 42, score: 2000, unlock: 5, ringEvery: 3.0, ringCount: 10, chargeEvery: 7.0, chargeSpeed: 380, chargeTime: 0.6, spawnEvery: 8.0, shotSpeed: 170, shotRadius: 6 }`. HP/speed wave-scaled like others (`scaleFor`).
- **Three phases by remaining HP fraction (behavior in enemies.js, deterministic timers, shots via the `out` array):**
  - **P1 (>2/3):** slow chase + radial ring of `ringCount` shots every `ringEvery`s.
  - **P2 (2/3–1/3):** adds a telegraphed charge every `chargeEvery`s (1s flashing windup, then a `chargeSpeed` lunge for `chargeTime`s; render reads `state === 'windup'` to flash).
  - **P3 (<1/3):** rings become 14-shot spirals (each ring's start angle advances 0.9 rad) every 2.2s, and spawns 2 minis every `spawnEvery`s (pushed via a new optional 5th param `spawns` array on `updateEnemy` — or reuse `out` with a `{spawn: type}` marker; pick one, document it, test it).
- **Boss kill reward:** score via normal kill path (2000 × multiplier), guaranteed 6-gem ring, heal 1 heart, instant full dash recharge, big glow explosion + shake.
- Boss renders with a **HP bar** (top-center, under the wave label, only while a boss is alive; width ~34% of screen, red fill over dark track, thin border).
- Minis spawned by the boss (and splitters) still count toward wave-clear.

## C. Pause

- `Esc` or `P` toggles pause during PLAYING only (input snapshot gains `pausePressed`, edge-triggered like dash). Paused: world & floaters & gems frozen (starfield may keep drifting — it's ambience), dim overlay + "PAUSED — Esc/P to resume" centered, HUD still visible. Audio: nothing special (SFX are one-shots).
- Pause must not break the dt clock (on resume, no teleport — dt already clamps, but exclude paused time from run stats' `runTime`).

## D. Run stats & local leaderboard

- Track per run (plain object on `run`): `kills`, `shotsFired`, `shotsHit` (bullet hits, not kills), `dashes`, `gemsCollected`, `bossKills`, `runTime` (unpaused seconds). Pure helpers in `run.js`: extend `createRun()`; accuracy derived at display time (`shotsHit/shotsFired`, guard 0).
- **Game-over screen v3:** score + best as now, plus a stats block (kills, accuracy %, waves, gems, dashes, boss kills, time m:ss).
- **Local leaderboard:** top 5 runs in localStorage key `np-shooter-board` — entries `{score, wave, date}` (date = ISO day string passed in by main — logic module stays clock-free). Pure helpers in `src/board.js`: `loadBoard()`, `recordRun(board, entry) → newBoard` (sorted desc by score, max 5), `saveBoard(board)` (try/catch like best-score). Game-over shows the board with the just-finished run highlighted if it placed; menu shows top 3.

## E. Sprites/HUD additions (browser layer)

- Boss sprite: large (≈28px source, scale 4 → ~112px), 2 frames, menacing silhouette (crown/core look), distinct from splitter; windup state renders flashing (alpha pulse) like the darter aim.
- Gem sprite: small cyan/teal diamond, 2 frames (sparkle); collected → tiny glow burst + soft chime (`sfxGem` in audio.js: short high blip; also `sfxBossDown`: descending 3-note).
- Boss HP bar in hud.js: `drawBossBar(g, w, boss)` — only while boss alive.
- Pause overlay: `drawPause(g, w, h)`.
- Game-over stats + leaderboard rendering; menu top-3 board (small, under best score).

## F. Out of scope still

Music loops, online leaderboards, meta-progression, gamepad/touch, graze system (candidate for a later round).

## Testing

Pure logic TDD: gem drop/magnet/collect/expiry/dash-credit math; isBossWave + boss-wave composition (boss + 40% escort, unlock gating intact); boss phase transitions at HP fractions, ring/spiral/charge/spawn timings and shot counts via out array; stats accumulation helpers; board record/sort/cap/tie behavior + storage safety. Browser modules `node --check` + end screenshot pass (add `?screen=boss` dev seed: wave 5, boss at 55% HP mid-ring, HP bar visible).

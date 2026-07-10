# Arena Space Shooter — Design Spec

**Date:** 2026-07-09
**Status:** Approved pending user review
**Working title:** Untitled Space Shooter

## Vision

A browser-based 360° arena space shooter that rewards pilot skill. Enemies swarm from all sides; the player flies an Asteroids-style ship (nose-aimed fire, damped drift), survives escalating waves, and builds power through roguelite upgrade choices between waves. Retro pixel art, arcade game-feel, instant restarts.

## Core Loop

1. Run starts: ship spawns at arena center with base stats, 3 HP, score 0.
2. A wave of enemies spawns from the arena edges (each spawn telegraphed ~1s in advance).
3. Player clears the wave.
4. Player picks 1 of 3 randomly offered upgrades.
5. Next wave begins, harder. Repeat until death.
6. Death: show score, best score (localStorage), and instant-restart prompt.

## Controls

| Input | Action |
|---|---|
| Mouse position | Aim: the nose chases the cursor at the ship's turn rate (change post-v1, 2026-07-10) |
| `A` / `←`, `D` / `→` | Optional keyboard turn override (wins over mouse aim while held) |
| `W` / `↑` | Thrust in facing direction |
| Mouse button (hold) | Full-auto fire at base fire rate, slight bullet spread |
| Mouse button (tap) | Semi-auto: fires instantly per click, perfect accuracy; fast tapping can slightly exceed full-auto rate |

- Fire direction is always the ship's nose. The mouse both aims (nose chases cursor, rate-limited) and triggers.
- The tap-vs-hold split is a core skill mechanic: spray (hold) when swarmed, precision-tap when it counts.
- Semi-auto has a minimum cooldown of ~80% of the full-auto interval, and that cooldown scales down with fire-rate upgrades — tapping always retains its slight edge but can never trivialize Rapid Fire.

## Movement

Damped drift: thrust adds velocity in the facing direction; friction bleeds velocity gradually (roughly 0.98/frame at 60fps); max speed capped. The ship can drift one way while facing/shooting another. Slight recoil pushback when firing.

## Arena

Single fixed screen sized to the browser window (no scrolling, no camera). Soft-bounce at edges. All enemies and telegraphs are always visible.

## Survival & Scoring

- 3 HP base. On hit: lose 1 HP, brief invulnerability (i-frames) with sprite flashing.
- Score per kill × kill-streak multiplier. Multiplier grows with consecutive kills and resets to 1 when the player is hit.
- Best score persists in `localStorage`.

## Enemies (v1: three types)

| Enemy | Cost | Behavior | Tests |
|---|---|---|---|
| Drifter | 1 | Slow, steady chaser; 1–2 HP; dangerous in crowds | Positioning |
| Darter | 2 | Fast; pauses, aims, lunges in a straight burst | Reaction, dodging |
| Splitter | 3 | Big, tanky; splits into two fast mini-splitters on death | Target prioritization |

## Waves & Difficulty

- Each wave has a difficulty budget spent on enemy costs (see table above).
- Starting values (tunable during playtesting): budget = 3 + 2×(wave − 1); enemy speed and HP each scale ~+4%/wave.
- Spawns trickle in across the wave duration rather than all at once.
- Wave 1–2 near-tutorial; ~wave 10 is chaos. No fixed end — runs last as long as skill allows.

## Upgrades (pick 1 of 3 after each wave; pool of 8)

| Upgrade | Effect | Stacks? |
|---|---|---|
| Rapid Fire | +25% full-auto fire rate | Yes |
| Heavy Rounds | +1 bullet damage | Yes |
| Engine Tune | +20% thrust & max speed | Yes |
| Hull Plating | +1 max HP and heal 1 | Yes |
| Piercing Shots | Bullets pass through one extra enemy | Yes (+1 each) |
| Spread Shot | +2 angled side bullets (full-auto only) | Yes |
| Velocity Rounds | +40% bullet speed & range | Yes |
| Aegis Shield | Blocks one hit; recharges between waves | No (once owned, re-rolls) |

The 3 offered upgrades are drawn randomly without duplicates within one offer.

## Game Feel (required, not polish-later)

- Screen shake on explosions and player hits.
- Short hit-pause (~2 frames) on kills.
- Pixel particle bursts for explosions; muzzle flash on fire.
- WebAudio-synthesized SFX: fire, explosion, player hit, upgrade chime, wave start. No audio asset files.

## Art

Retro pixel art, generated in code: each sprite is a small palette-indexed 2D array rendered to an offscreen canvas and scaled with nearest-neighbor (`imageSmoothingEnabled = false`). No external image assets.

## Tech & Architecture

Vanilla JavaScript, Canvas 2D, native ES modules, no build step, no dependencies. Served by any static file server for local play.

```
index.html          shell + canvas
src/main.js         game loop (rAF, clamped delta-time); state machine:
                    MENU → PLAYING → UPGRADE_CHOICE → GAME_OVER
src/input.js        keyboard + mouse snapshot, tap-vs-hold detection
src/ship.js         player physics and firing logic
src/enemies.js      enemy behaviors + spawn telegraphs
src/bullets.js      projectiles, circle-circle collision
src/waves.js        wave budgets, difficulty scaling, spawn scheduling
src/upgrades.js     upgrade pool, effects, offer generation
src/particles.js    explosions, muzzle flash, screen shake
src/sprites.js      pixel-art sprite generation
src/audio.js        WebAudio synth SFX
src/hud.js          score, HP, wave counter, menus
```

Boundaries:
- Game logic (waves, upgrades, collision, scoring) is pure functions over plain state — testable without a browser.
- Rendering reads state, never mutates it.
- Input is polled into a per-frame snapshot; game logic never touches DOM events.

## Error Handling

- `localStorage` access wrapped in try/catch (private-mode browsers) — falls back to session-only best score.
- WebAudio context created on first user gesture (browser autoplay policy).
- Delta-time clamped (e.g., max 50ms) so tab-switch pauses don't teleport entities.

## Testing

- Unit tests via Node's built-in test runner for pure logic: wave budget math, upgrade stacking, collision, streak multiplier, offer generation.
- Manual playtesting for feel (drift, fire cadence, difficulty curve).
- Headless-browser smoke runs to catch runtime errors and capture devlog screenshots.

## Out of Scope for v1

Bosses, meta-progression/unlocks between runs, multiple weapons, gamepad support, mobile/touch, music, pause menu beyond basics, online leaderboards.

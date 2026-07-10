# V2 "Glow-Up" — Design Spec (amendment to 2026-07-09 spec)

**Date:** 2026-07-10
**Status:** Approved by Julian (verbal, pre-sleep); executing autonomously overnight.
**Decisions locked by Julian:** dash burst on Space; full graphics glow-up (pixel art stays); base crit from start; everything bigger; hearts for lives; ship paint picker; more enemies/upgrades; difficulty must scale with wave AND player power.

All v1 rules stay unless amended here. Global constraints unchanged: vanilla JS, Canvas 2D, zero deps, no build step, ESM; pure-logic modules Node-clean with injected rng; `npm test` green before every commit.

## A. Dash boost

- **Input:** Space, edge-triggered (`dashPressed` in the input snapshot, true only on the frame the key goes down).
- **Effect:** instant velocity impulse `DASH.impulse` along the nose direction (added to current velocity, then clamped to `maxSpeed * engine * DASH.speedCapMult` so a dash can briefly exceed normal max), `DASH.iframes` seconds of invulnerability, dash particles + SFX.
- **Charges:** `ship.dash = { charges, max, recharge }`. Start `charges = max = DASH.charges`. When below max, `recharge` counts down from `DASH.rechargeTime`; hitting 0 grants one charge and restarts if still below max.
- **Damage-fed recharge:** every point of damage the player deals shaves `DASH.damageCredit` seconds off the active recharge timer (no effect at full charges).
- **Config:** `DASH = { impulse: 560, charges: 2, rechargeTime: 6, damageCredit: 0.35, iframes: 0.25, speedCapMult: 1.8 }`.
- **Interfaces:** `tryDash(ship) → bool` (consumes a charge, applies impulse+iframes) and `creditDash(ship, damage)` exported from `ship.js`; recharge ticking inside `updateShip`.
- HUD shows dash pips (see G).

## B. Crits, damage numbers, combo text

- **Crit roll per bullet hit:** `CRIT = { chance: 0.10, mult: 2 }` base; modified by `ship.mods.critChance` (additive) and `ship.mods.critMult` (additive). `collideBullets(bullets, enemies, rng, crit)` — new trailing params; each hit in the result gains `{ crit: bool, dealt: number, x, y }` (dealt = damage after crit mult, rounded).
- **Floating text — new pure module `src/floaters.js`:** `createFloaters()`, `addFloater(f, x, y, text, kind)`, `updateFloaters(f, dt)`. Kinds: `'dmg'` (small white), `'crit'` (bigger yellow), `'combo'` (streak milestones), `'info'` (wave banners). Floaters drift up ~30px/s, fade over 0.7s (`'combo'`/`'info'`: 1.2s). Cap 40 live floaters — oldest dropped. Never spawn on the ship itself (readability).
- **Combo popups:** on kill streaks at multiples of 5 (multiplier steps), spawn `'combo'` floater `xN` at the kill location; at streak 10/20/30 add flavor text (`RAMPAGE`, `UNSTOPPABLE`, `GODLIKE`).

## C. New enemies (3) — total roster 6 + mini

| Enemy | Cost | Unlocks | Behavior | Stats (base hp/speed/radius/score) |
|---|---|---|---|---|
| Spitter | 2 | wave 3 | Keeps `standoff` ~320px from ship, strafes slowly, fires an aimed projectile every `fireEvery` 2.2s | 2 / 55 / 16 / 175 |
| Orbiter | 3 | wave 5 | Circles the ship at ~240px (tangential + radial correction), spirals in 12px/s | 3 / 120 / 14 / 200 |
| Weaver | 3 | wave 7 | Chases like drifter but overlays a perpendicular sine weave (positional amp ~70px, freq 0.9Hz, per-enemy phase) — hard to hit. Lateral velocity term is TAU-corrected: `weaveAmp * weaveFreq * TAU * cos(t * weaveFreq * TAU)` (peak lateral ~396 px/s) | 2 / 95 / 13 / 225 |

- **Enemy projectiles:** `updateEnemy(e, ship, dt)` gains an optional 4th param `out` (array); spitter pushes `{ x, y, vx, vy, radius: 5, dead: false }` aimed at the ship, speed 200. Main keeps `enemyShots[]`, moves them (cull off-arena), collides vs ship with `circleHit` → `hitPlayer` path. Enemy shots are wiped on wave clear and on player death.
- Existing enemies keep behavior; all enemy base stats get the size bump (E).

## D. Difficulty that actually scales

- **Power level:** `powerLevel` = number of upgrades the player has taken this run (main increments on each pick).
- **Budget:** `waveBudget(wave, power) = round(4 + 2.5*(wave-1) + 1.5*power)` — signature change, tests updated.
- **Type unlocks:** buildWave only buys types whose `unlock` ≤ wave (drifter/darter 1, spitter 3, splitter 4, orbiter 5, weaver 7). `buildWave(wave, rng, power)`.
- **Scaling:** `WAVE.scalePerWave: 0.06` (was 0.04). Spawn trickle accelerates: `spawnInterval(wave) = max(0.35, 1.1 - 0.05*(wave-1))` — exported helper, scheduleWave uses it.
- Telegraph time unchanged (1.0s).

## E. Everything bigger (readability)

- `src/sprites.js` default scale 3 → **4**; sprite pixel-art gets a higher-detail redraw (roughly 13–17 px wide source art vs the old 7–11).
- Config size bumps: `SHIP.radius 12→18`; drifter radius 12→17, darter 9→13, splitter 18→26, mini 8→11. Bullet radius 3→4, enemy shot radius 5. `GUN.bulletSpeed 420→460`, `bulletRange 480→560` (bigger arena distances need reach).
- Speeds otherwise unchanged (v1 feel preserved).

## F. Upgrades — pool grows 8 → 15

New (all stack unless noted):
| id | Name | Effect |
|---|---|---|
| deadeye | Deadeye | `mods.critChance += 0.08` |
| executioner | Executioner | `mods.critMult += 0.5` |
| extradash | Extra Dash | `dash.max += 1` and grant 1 charge (max 2 stacks, then re-rolls like aegis) |
| recovery | Quick Recovery | dash recharge 25% faster: `mods.dashRate *= 1.25` (recharge timer ticks at dashRate) |
| ricochet | Ricochet | bullets bounce off arena walls, +1 bounce per stack (`mods.bounce += 1`) |
| overclock | Overclock | `mods.fireRate *= 1.1` AND `mods.bulletSpeed *= 1.1` |
| secondwind | Second Wind | heal 2 (capped at maxHp); always offerable |

- `createShip` mods gains: `critChance: 0, critMult: 0, dashRate: 1, bounce: 0`.
- **Ricochet mechanics:** `updateBullets(bullets, dt, arena)` — new arena param; a bullet with `bounces > 0` reflects off arena edges (flip the velocity component, decrement `bounces`); bullets spawn with `bounces = mods.bounce`. Range still culls.
- **rollOffers:** exclude `aegis` when owned (as v1) and `extradash` at 2 stacks (track `ship.dash.stacks`). 3 unique per offer.
- **Upgrade cards get icons + mini-previews (see G).**

## G. Graphics glow-up + HUD v2 (browser layer)

- **Starfield:** new browser module `src/starfield.js` — 3 parallax layers of code-generated stars (~90/50/25 stars), slow drift (4/9/16 px/s downward-left), dim blues/whites, twinkle via sine alpha. `createStarfield(w, h)`, `updateStarfield(sf, dt)`, `drawStarfield(g, sf)`. Regenerate on resize.
- **Glow:** bullets, enemy shots, engine flame, and explosion particles render with `ctx.shadowBlur` (8–16) + `shadowColor` matching fill; explosion particles composite with `globalCompositeOperation: 'lighter'`. Reset state after each pass (save/restore).
- **Sprite redraw (higher detail, still pixel art):** ship ~17px-wide source with cockpit, twin engine nozzles and hull shading; per-enemy distinctive silhouettes and 2-frame idle animation (sprites module returns frame arrays; render picks frame by `Math.floor(t*6)%2`). Engine flame: 2-frame animation drawn behind ship while thrusting. Dash leaves a brief afterimage trail (render last 3 positions at falling alpha).
- **Ship paint picker:** 6 hull colors — white `#e8e6d8`, red `#e0524a`, blue `#5ea8ff`, green `#63d471`, yellow `#ffd75e`, purple `#b07fe8`. `initSprites(paint)` builds the ship (and its flame) with the hull color swapped; menu shows clickable swatches (selected one outlined); choice persists in localStorage key `np-shooter-paint`; picker also usable between runs (game-over screen shows it too).
- **Hearts:** pixel heart sprite (full red / hollow dark) replaces HP squares. Shield renders as a blue outlined heart beside them.
- **HUD scale:** all HUD font sizes derive from `const u = Math.max(12, Math.round(w / 90))` (score `2u`, wave `1.5u`, etc.). Score top-left with multiplier badge, wave top-center, hearts + dash pips top-right. Dash pips: small cyan diamonds, hollow while recharging with a radial-ish fill indicating progress.
- **Upgrade cards v2:** larger cards (`min(30% of width, 380px)` each), pixel icon per upgrade (16px source art in sprites.js `SPRITES.icons[id]`), name, desc, and a **mini-preview vignette**: a 100%-width strip inside the card where `drawUpgradePreview(g, id, rect, t)` (hud.js) draws an animated micro-demo per upgrade (e.g. spread: fanning bullet dots; ricochet: a dot bouncing between two walls; deadeye: rolling numbers with a yellow crit pop; hull/secondwind: heart filling; extradash: ship dot double-blinking across). Simple shapes + existing sprites, animated via the `t` clock. Cards keyboard-selectable (1/2/3) and clickable as before.
- **Menu:** title, controls line (now includes SPACE dash), color picker, best score.
- **Dev screenshot hook:** `?screen=upgrade` / `?screen=gameover` query param jumps straight to that state with representative fake data (guarded, no effect otherwise) — exists solely so headless screenshots can cover those screens.

## H. Out of scope (unchanged)

Bosses, meta-progression, gamepad/touch, music, leaderboards, pause menu.

## Testing

Pure-logic additions all unit-tested with injected rng: dash charge/recharge/credit math, crit roll + damage calc, floaters lifecycle/cap, each new enemy behavior (standoff, orbit radius correction, weave offset, spitter fire cadence), budget/unlock/interval formulas, new upgrade effects + offer exclusions, ricochet reflection. Browser modules verified headlessly (`node --check`, not imported by tests) + screenshot pass at the end (menu with picker, combat with damage numbers, upgrade cards, game over).

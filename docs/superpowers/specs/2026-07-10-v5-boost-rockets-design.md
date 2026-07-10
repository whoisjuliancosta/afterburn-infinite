# V5 "Boost & Rockets" — Design Spec (amendment; Julian's playtest round 2)

**Date:** 2026-07-10. All items from Julian's feedback after reaching wave 40.

Global constraints unchanged (vanilla JS, zero deps, ESM, Node-clean pure logic w/ injected rng, npm test green per commit, optional-param backward compat until integration).

## A. Movement: W + mouse only

- The nose faces the cursor instantly (unchanged). `W`/`↑` thrusts toward the nose. **No other movement keys** — S/A/D/strafe removed from input and ship logic (arrows: only `↑`).
- `moveDir` helper removed; thrust uses the nose vector directly. Thruster plume points opposite the nose while W held.
- Menu copy: `W thrust · aim with mouse · hold SPACE boost · right-click rocket`.

## B. Boost (replaces the dash system entirely)

- **Hold Space = continuous boost** while the meter lasts: thrust toward the nose at `BOOST.thrustMult`× normal thrust (applies even without W) and max speed raised to `BOOST.speedMult`× while boosting. Linear meter drain `BOOST.drainPerSec`. No i-frames.
- **Meter:** `ship.boost = { meter, units }` — `meter` in [0, units], `units` = capacity (base 1; each "Boost Tank" upgrade +1, max 3). One unit = 100%. Runs start with a full first unit (`meter = 1`).
- **Filling:** blue gems only — each +`GEMS.boostFill` (0.10) units, capped at `units`. No passive regen, no damage credit (creditDash and the recharge cycle are deleted).
- `startBoost/updateBoost` logic lives in ship.js: exported `updateShip(ship, input, dt, arena)` reads `input.boosting` (held Space); expose `ship.boosting` bool for render/audio. Dash SFX → replaced by a low continuous-ish thruster blip on boost start only (`sfxBoost` = renamed/replacing sfxDash is fine).
- Boost trail: keep the afterimage trail while boosting; plume scales up.
- Upgrade rework: `extradash` → **`boosttank` "Boost Tank" (+1 boost unit, max 2 stacks)**; `recovery` → **`attractor` "Attractor" (+45% gem magnet radius, max 2 stacks)**. Stats: replace `dashes` with `boostTime` (seconds spent boosting).
- Config: `BOOST = { drainPerSec: 0.40, thrustMult: 2.4, speedMult: 1.9, baseUnits: 1, maxUnits: 3 }` (one unit ≈ 2.5s of continuous boost). Delete `DASH`.

## C. Gems v2: blue = boost, red = hearts

- Gem entities gain `kind: 'blue' | 'red'`. Draw smaller (`GEMS.radius` 7 → 5; sprite drawn ~30% smaller).
- **Drops (RNG per kill, mutually exclusive roll):** blue at `GEMS.blueChance` 0.35; else red at `GEMS.redChance` 0.08 (splitter/boss-class kills roll red at 2×). Boss death ring: 6 blue + 2 red.
- **Payouts on collect:** blue → +0.10 boost units (overflow lost), small cyan floater `+10%`. Red → +`GEMS.heartFill` (0.10) toward the next heart; at ≥1.0 the accumulator resets and `hp += 1` (capped at maxHp — overflow at full HP is lost, floater says `FULL`); red floater `+10% ♥`. Gems no longer grant score; score comes from kills. Wave-clear vacuum still auto-collects everything (same payouts).
- **Magnet/force field:** `GEMS.magnetRadius` 130 → 200 (+45%/stack from Attractor). Render a faint force-field ring at the current magnet radius around the ship (thin cyan circle, ~0.08 alpha, slight pulse) so the pull zone is visible.
- `run.heartProgress` (0..1) tracked on the run object (pure logic + tests).

## D. Rockets on right-click

- Right mouse button (edge-triggered `rocketPressed`; context menu already suppressed) launches a rocket along the nose: `ROCKET = { cooldown: 5, speed: 360, turn: 0, damage: 8, aoeRadius: 110, radius: 6, range: 900 }`.
- Rocket flies straight; on first enemy contact OR range end, it detonates: every living enemy within `aoeRadius` takes `damage` (full crit roll applies per enemy), with a big glow explosion + shake + `sfxRocket` (deep whoosh-boom). Bosses take rocket damage normally.
- Pure logic in `src/rockets.js`: `createRockets()`, `fireRocket(r, ship)` (returns false while cooling), `updateRockets(r, enemies, dt) → detonations[{x, y, hits:[{enemy, damage}]}]` (mutates enemy hp like collideBullets; caller handles kills/FX/score). Cooldown on the rockets store, ticked in update.
- HUD: small rocket icon + radial/linear cooldown indicator near the boost bar. Render: missile sprite from the pack (`missile-1/2.png`, animated 2-frame), pre-rotated, with a small particle trail.

## E. Stat caps (fire speed & co — Julian asked; there were none)

- `CAPS = { fireRate: 3, engine: 2, bulletSpeed: 2.5, pierce: 5, spread: 3, bounce: 3 }` in config.
- `applyUpgrade` clamps each mod at its cap. `rollOffers` excludes any upgrade whose target mod is already at cap (aegis/boosttank/attractor keep their existing stack-exclusion rules; hull/secondwind/heavy stay uncapped).
- Tests: each capped mod stops growing at its cap; capped upgrades vanish from offers.

## F. Difficulty v3: bigger waves, meaner bosses

- **Budget:** `waveBudget(wave, power) = round(4 + 2.5*(wave-1) + 1.5*power + (wave > 10 ? 3*(wave-10) : 0))` — accelerates past wave 10.
- **Trickle:** `spawnIntervalFloor` 0.35 → 0.22; interval step 0.05 → 0.06. More enemies on screen sooner ("a lot more enemies, like in waves").
- **Enemy stat scale:** `scalePerWave` 0.06 → 0.07.
- **Bosses (boss number B = wave/5), all patterns still deterministic, shots via out array:**
  - HP scales additionally with boss number: `hp × (1 + 0.4×(B−1))`.
  - **P1:** rings (as now) **plus** an aimed 3-shot burst at the player every 4s.
  - **P2:** adds the telegraphed charge (as now) **plus** a horizontal/vertical bullet wall every 9s: 12 shots in a line sweeping from one arena edge (spawned as a spaced row of enemy shots aimed straight across; alternate axis per wall).
  - **P3:** spirals + minis (as now) **plus** a blink-reposition every 7s: boss telegraphs (0.6s flash), vanishes, reappears at a random point ≥260px from the player (rng injected — spawnEnemy already receives none; thread an rng param through updateEnemy's optional args for the boss only, defaulting to a deterministic fallback so old call sites stay valid), then immediately fires a full ring.
  - From B≥2, minis spawn in P2 as well; from B≥3, ring count 10 → 14 in P1/P2.
- Tests: budget acceleration, floor/step, boss-number HP scale, each new pattern's cadence/counts/telegraph, reposition min-distance with seeded rng.

## G. Starfield & readability

- Stars: counts 90/50/25 → 150/90/50; base alpha up ~40%; a handful (~12) larger "bright" stars with a soft glow. Keep drift/twinkle.
- Gems drawn smaller (C); force-field ring (C).

## H. Out of scope

Music, meta-progression, online boards, gamepad/touch, graze.

## Testing

TDD on all pure logic: boost meter drain/fill/caps/units, gem kinds + payout math + heart accumulator, rocket cooldown/flight/AoE (incl. crit-per-enemy), mod caps + offer exclusion, new wave budget/trickle numbers, boss pattern cadences + reposition. Browser layer: node --check; end screenshots (combat with boost bar + force-field ring + rocket, boss wall pattern via ?screen=boss, menu) at 0 console errors.

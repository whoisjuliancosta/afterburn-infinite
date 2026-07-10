# V4 "Real Ships" — Design Spec (amendment; asset-pack integration)

**Date:** 2026-07-10 (morning; Julian bought "Pixel Spaceships for SHMUP" by dylestorm and asked to install it; approved committing assets to the public repo)

Supersedes the "no external assets" constraint for SHIPS, PROJECTILES, THRUSTERS and EXPLOSIONS only. Everything else (gems, hearts, dash pips, upgrade icons, shield heart, starfield) stays code-generated. Zero npm deps and no build step still hold: PNGs load at runtime via `Image` from the statically-served `assets/` dir.

## Assets (already copied)

- `assets/ships/` — 48×48 small ships: families blue/red/purple/orange/darkgrey/greyblue/metalic ×6 variants (`blue_01.png`…), 128×128 large ships (`large_blue_01/02`, `large_red_01`, `large_grey_01/02`, `large-seagreen-01..05`), tank pieces (unused v4).
- `assets/fx/` — `vertical-thrust-01..04.png` (+`-sheet`), `explosion-01..09.png` (+`-sheet`), `projectile01..0N-x.png` frame sets, `missile-1/2.png`.
- `assets/CREDITS.txt` — attribution (dylestorm, livingtheindie.com). Keep committed.
- Original pack folder is gitignored; `assets/` is the canonical copy.

## A. Asset loader — new browser module `src/assets.js`

- `loadAssets() → Promise` — loads every needed PNG via `Image`; resolves when all settle. Per-image failure is non-fatal: record the miss; consumers fall back to the v3 code-generated sprite for that slot (game must remain fully playable if every asset 404s).
- Pack ships face UP; the engine faces +x. Pre-rotate 90° clockwise at load onto offscreen canvases (nearest-neighbor) so all existing rotate-by-angle draw code works unchanged.
- Exposes `ASSETS.ready` (bool) and the processed canvases. `main.js` shows a minimal "LOADING…" frame until ready (boot state before MENU; menu click before ready is ignored).

## B. Sprite mapping (SPRITES keys keep their existing shapes: frame arrays)

- **Player ship:** paint choice now selects a pack family: white→`metalic`, red→`red`, blue→`blue`, purple→`purple`, yellow→`orange`, grey→`greyblue` (green is dropped — the pack has no small green family; picker swatch hues update to match the actual hulls). Variant `_01` of the family, both SPRITES.ship frames = the same pre-rotated canvas (pack has no idle frames) — animation frame flip simply repeats; acceptable. Persisted paint value becomes the family key (`'metalic'|'red'|'blue'|'purple'|'orange'|'greyblue'`); stored legacy hex values map: `#e8e6d8`→metalic, `#e0524a`→red, `#5ea8ff`→blue, `#b07fe8`→purple, `#ffd75e`→orange, `#63d471`→greyblue, unknown→metalic.
- **Menu picker:** swatches recolored to family hues; draw the currently-selected ship sprite (large, ~3×) above the swatch row as a preview.
- **Enemies** (small ships, chosen for silhouette distinctness, avoiding the 6 player families where possible — darkgrey + remaining variants are the enemy palette; implementer picks exact variants by eye and reports the mapping):
  - drifter, darter, spitter, orbiter, weaver, mini → six visually distinct small ships (mini may reuse a variant drawn at ~60% size).
  - splitter → a bulkier variant drawn larger (or a large ship at 0.5 downscale).
- **Boss:** large ships, cycled by boss number (wave/5): 1st `large_red_01`, 2nd `large_blue_01`, 3rd `large_grey_01`, 4th+ rotate through `large-seagreen-01..`. Windup flash behavior unchanged.
- **Projectiles:** player bullets → `projectile01-*` frames (animated); enemy shots → `projectile03-*`; boss shots may use `projectile04-*` if it reads better. Glow pass stays.
- **Thruster:** `vertical-thrust-01..04` pre-rotated, drawn behind the ship while thrusting (replaces code-gen flame; scale to ship size; dash afterimages unchanged).
- **Explosions:** on kill, spawn a one-shot 9-frame `explosion-0x` animation entity at the death point (~0.45s, sized ~2.2× enemy radius; boss ~2× that). Particle burst count halves (sprites carry the visual now). Player-hit keeps the particle-only treatment.

## C. Sizing

Draw diameter ≈ entity radius × 2.5, nearest-neighbor, integer-ish scale preferred. Ship (r18)→~45px (near-native 48), boss (r42)→~105px (128 at ~0.82 — acceptable), splitter (r26)→~65px.

## D. Out of scope

Tank pieces, missiles as weapons, pack-based UI art, sound changes.

## Testing

Pure logic untouched → suite must stay green unchanged. Browser verification: node --check; headless screenshots (menu w/ ship preview + picker, combat, boss wave via ?screen=boss) at 0 console errors, including one run with assets renamed/missing to prove the code-gen fallback path works. Visual judgment reported honestly: silhouettes distinct, rotation correct (nose = travel direction), no smoothing blur.

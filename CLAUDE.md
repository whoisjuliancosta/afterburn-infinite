# AFTERBURN INFINITE — project guide

Browser 360° arena space shooter. Vanilla JS + Canvas 2D, native ES modules, **zero npm dependencies, no build step**. Play: https://whoisjuliancosta.github.io/afterburn-infinite/ (GitHub Pages redeploys automatically on every push to `main`).

## Commands

- `npm test` — full suite, Node ≥20 built-in runner (glob `test/**/*.test.js`)
- `npm run serve` — static server on :8000 (ES modules don't load over `file://`)
- Node syntax check: `node --check src/<file>.js` (browser modules can't run under Node but must parse)

## Architecture rules (binding)

- **Pure-logic modules** (`config, utils, ship, bullets, enemies, waves, run, upgrades, particles, floaters, gems, board, rockets`) are Node-clean: no `window`/`document`/`canvas`/`Date`; randomness only via an injected `rng(seed)` param (`makeRng` in utils). These are the only unit-tested modules.
- **Browser modules** (`assets, sprites, starfield, audio, hud, input, main`) are never imported by tests. `main.js` is the composition root (owns the clock, `Date`, localStorage keys `np-shooter-best` / `np-shooter-board` / `np-shooter-paint`).
- All tuning constants live in `src/config.js`. Balance changes should touch only that file.
- Rendering is perf-sensitive: glow is **pre-baked into sprite canvases at init** — never add per-frame `ctx.shadowBlur` in the render loop (that caused a 28.7ms→3.8ms p95 regression fix; see the v5.1 spec).
- Purchased art pack (dylestorm) lives in `assets/` (credited in `assets/CREDITS.txt`); every asset slot has a code-generated fallback in `sprites.js` — the game must stay playable with `assets/` missing.

## Dev hooks

Append to the URL: `?screen=upgrade | gameover | boss | stress` — seeds that screen/scene directly (stress = worst-case perf scene). Used for headless screenshots and perf measurement.

## Process conventions (established with Julian)

- Specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/` — one dated spec per feature round (v1…v5.1 so far); specs are the binding requirements docs.
- Build ledger: `.superpowers/sdd/progress.md` (gitignored) — one line per completed round; read it before resuming interrupted work.
- Subagents run on **Opus** (`model: 'opus'`), orchestration via dynamic Workflow scripts: sequential implementer → reviewer → fix-loop per task, final whole-branch review before merge, headless screenshot verification (Playwright + cached chromium headless-shell; driver scripts are session-scratch, rebuild from the pattern: serve on :8123, capture `?screen=*` pages, require 0 console errors).
- Feature work on `feat/*` branches, merged `--no-ff` to `main`, pushed immediately (Pages = production).
- The devlog artifact is updated with a timestamped entry + screenshots at every milestone (URL in Claude's project memory).

## Current state (2026-07-10, end of v5.1)

226/226 tests. Shipped: W+mouse movement, continuous Shift-boost fed by blue gems, red heart-gems, right-click rockets, crits/damage numbers/combos, 7 enemy types + 3-phase bosses every 5th wave (bursts/walls/blink-teleports, scaling per boss), 21 upgrades with icon+preview cards, stat caps (tripled 2026-07-10 at Julian's request: fireRate 9× etc.), difficulty scaling by wave + build power, gem magnet force-field, local leaderboard + run stats, pre-baked-glow renderer (~7.5× faster), dylestorm ship art with 6-hull hangar.

Open threads: Julian's ongoing playtest feedback drives each round; balance levers live in `config.js`; graze system and music remain explicitly out of scope until requested.

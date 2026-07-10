# AFTERBURN INFINITE 🚀

**AFTERBURN INFINITE** is a 360° arena space shooter — pilot skill, roguelite upgrades, pixel art. Built with vanilla JavaScript and Canvas 2D. Zero dependencies, no build step.

## ▶️ Play it now

**<a href="https://whoisjuliancosta.github.io/arena-space-shooter/">whoisjuliancosta.github.io/arena-space-shooter</a>**

Desktop browser + keyboard & mouse required.

## Controls

| Input | Action |
|---|---|
| Mouse | Aim (your nose follows the cursor) |
| `W` / `↑` | Thrust toward your cursor |
| Hold left click | Full-auto fire (slight spray) |
| Tap left click | Precise semi-auto shots |
| Right click | Fire a rocket (area damage, cooldown) |
| Hold `Space` | Boost — drains a meter refilled by blue gems |
| `Esc` / `P` | Pause |

## Features

- Roguelite runs: clear waves, pick 1-of-3 upgrades from a 21-strong pool, die, chase the leaderboard
- A boss every 5th wave — shot rings, aimed bursts, bullet walls, blink-teleports, escalating with every boss
- Gem economy: blue gems fuel your boost, rare red gems rebuild your hearts
- Crits, Diablo-style damage numbers, combo streaks, kill-streak score multiplier
- 7 enemy types with distinct behaviors, difficulty that scales with your wave *and* your build
- Ship hangar: 6 hulls to fly, choice remembered between sessions
- Local top-5 leaderboard and full run stats

## Running locally

```bash
git clone https://github.com/whoisjuliancosta/arena-space-shooter.git
cd arena-space-shooter
python3 -m http.server 8000   # or: npx serve -l 8000
# open http://localhost:8000
```

(A static server is required — ES modules don't load over `file://`.)

Tests: `npm test` (Node ≥20, zero dependencies — uses the built-in test runner).

## Credits

- Ship, projectile, thruster and explosion pixel art: [dylestorm — Pixel Spaceships for SHMUP](https://www.livingtheindie.com) (purchased pack; see `assets/CREDITS.txt`)
- All other art, SFX (WebAudio synth) and code generated in-project
- Built by Julian Costa with [Claude Code](https://claude.com/claude-code)

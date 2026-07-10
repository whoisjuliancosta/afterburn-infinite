// src/main.js
import { WAVE, CRIT } from './config.js';
import { makeRng, loadBest, saveBest, clamp } from './utils.js';
import { createShip, updateShip, updateGun } from './ship.js';
import { updateBullets, circleHit, collideBullets } from './bullets.js';
import { spawnEnemy, updateEnemy, deathSpawns } from './enemies.js';
import { buildWave, scheduleWave } from './waves.js';
import { createRun, addKill, hitPlayer, multiplier } from './run.js';
import { createGems, spawnGem, spawnGemRing, updateGems, gemBlinking, rollDrop } from './gems.js';
import { loadBoard, recordRun, saveBoard, placed } from './board.js';
import { rollOffers, applyUpgrade } from './upgrades.js';
import { createFloaters, addFloater, updateFloaters } from './floaters.js';
import { initSprites, SPRITES } from './sprites.js';
import { ASSETS, loadAssets, bossSprite } from './assets.js';
import { createFx, burst, addShake, addPause, updateFx } from './particles.js';
import { createStarfield, updateStarfield, drawStarfield } from './starfield.js';
import { initAudio, sfxShot, sfxDash, sfxExplosion, sfxHit, sfxChime, sfxWave, sfxGem, sfxBossDown } from './audio.js';
import { drawHud, drawMenu, drawGameOver, drawOffers, offerRects, paintRects, drawBossBar, drawPause } from './hud.js';
import { createInput } from './input.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const arena = { w: 0, h: 0 };

let starfield;
function resize() {
  canvas.width = arena.w = window.innerWidth;
  canvas.height = arena.h = window.innerHeight;
  g.imageSmoothingEnabled = false;
  starfield = createStarfield(arena.w, arena.h); // regenerate for the new size
}
window.addEventListener('resize', resize);
resize();

// Ship paint: persisted choice is now a pack FAMILY key (default metalic). Guard
// localStorage (private mode). Legacy v3 hex values migrate to their family.
const DEFAULT_PAINT = 'metalic';
const FAMILY_KEYS = ['metalic', 'red', 'blue', 'greyblue', 'orange', 'purple'];
const LEGACY_PAINT = {
  '#e8e6d8': 'metalic', '#e0524a': 'red', '#5ea8ff': 'blue',
  '#b07fe8': 'purple', '#ffd75e': 'orange', '#63d471': 'greyblue',
};
function loadPaint() {
  try {
    const stored = localStorage.getItem('np-shooter-paint');
    if (FAMILY_KEYS.includes(stored)) return stored;
    if (LEGACY_PAINT[stored]) return LEGACY_PAINT[stored];
    return DEFAULT_PAINT;
  }
  catch { return DEFAULT_PAINT; }
}
let paint = loadPaint();
initSprites(paint); // code-gen fallback now; rebound to pack art once assets load

const input = createInput(canvas);
const rng = makeRng(Date.now());

let mode = 'loading'; // 'loading' | 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameover'
// Input lockout after a screen transition, so click-spam from combat can't
// select an upgrade (or restart a run) the instant the screen appears.
let uiLockout = 0;
const UPGRADE_LOCKOUT = 0.5;
const GAMEOVER_LOCKOUT = 0.6;
let best = loadBest();
let board = loadBoard();  // local leaderboard, top 5
let placedIdx = -1;       // where the just-finished run placed on the board (-1 = didn't)
let clock = 0; // global animation clock (sprite frames, previews, floaters)
let run, ship, bullets, enemies, enemyShots, telegraphs, pending, waveT, fx, floaters, gems, offers;
let explosions = []; // one-shot 9-frame explosion FX entities at kill points
let powerLevel;         // upgrades taken this run (feeds wave budget)
let thrusting = false;  // last-frame movement state, for the engine flame
let moveAngle = 0;      // direction of travel input — the plume points opposite this
let shipTrail = [];     // recent {x, y, angle} for the dash afterimage
let dashTrailT = 0;     // afterimage lifetime countdown

const HOSTILE = '#ff5b8a'; // enemy-shot color

function startRun() {
  run = createRun();
  ship = createShip(arena.w / 2, arena.h / 2);
  bullets = [];
  enemies = [];
  enemyShots = [];
  telegraphs = [];
  fx = createFx();
  floaters = createFloaters();
  gems = createGems();
  offers = [];
  explosions = [];
  placedIdx = -1;
  powerLevel = 0;
  thrusting = false;
  shipTrail = [];
  dashTrailT = 0;
  startWave(1);
  mode = 'playing';
}

function startWave(n) {
  run.wave = n;
  pending = scheduleWave(buildWave(n, rng, powerLevel), rng, arena, n);
  enemyShots = []; // wave transitions wipe hostile fire
  waveT = 0;
  sfxWave();
  addFloater(floaters, arena.w / 2, arena.h * 0.22, `WAVE ${n}`, 'info');
}

// One-shot explosion FX entity at a death point. ~0.45s over the 9-frame sheet,
// sized ~2.2× the entity radius (bosses get ~2× that). Falls back silently to
// nothing when the sheet is missing (the halved particle burst still fires).
function spawnExplosion(x, y, radius, boss = false) {
  const diameter = radius * 2.2 * (boss ? 2 : 1) * 2; // 2.2×r radius → ×2 for diameter
  explosions.push({ x, y, size: diameter, t: 0, life: 0.45 });
}

function killEnemy(e) {
  e.dead = true;
  addKill(run, e);
  enemies.push(...deathSpawns(e));

  // Gem value: spec formula, floor 10. Bosses always drop a 6-gem ring; other
  // enemies roll a single scattered gem via rollDrop (blue/red/none).
  const gemValue = Math.max(10, Math.round(e.score / 8));
  if (e.type === 'boss') {
    spawnGemRing(gems, e.x, e.y, gemValue, 6, rng);
    ship.hp = Math.min(ship.maxHp, ship.hp + 1);       // heal 1 heart (capped)
    ship.dash.charges = ship.dash.max;                 // instant full dash recharge
    ship.dash.recharge = 0;                            // recharge idle
    spawnExplosion(e.x, e.y, e.radius, true);
    burst(fx, e.x, e.y, '#ff9e3e', 21, rng, 260, true); // halved: sprite carries it
    addShake(fx, 16);
    addPause(fx, 0.05);
    sfxBossDown();
  } else {
    // Gems v2: one mutually-exclusive roll → blue (boost) / red (heart) / none.
    // Full collect-payout wiring lands in T7; this keeps drops flowing meanwhile.
    const kind = rollDrop(rng, e.type === 'splitter');
    if (kind) spawnGem(gems, e.x, e.y, gemValue, rng, kind);
    spawnExplosion(e.x, e.y, e.radius);
    burst(fx, e.x, e.y, '#ff9e3e', 7, rng, 160, true); // halved: sprite carries it
    addShake(fx, 5);
    addPause(fx, 0.03);
    sfxExplosion();
  }

  // Combo popups at every 5th kill; flavor words at 10/20/30.
  if (run.streak > 0 && run.streak % 5 === 0) {
    addFloater(floaters, e.x, e.y, `x${multiplier(run)}`, 'combo');
    const flavor = { 10: 'RAMPAGE', 20: 'UNSTOPPABLE', 30: 'GODLIKE' }[run.streak];
    if (flavor) addFloater(floaters, e.x, e.y - 26, flavor, 'combo');
  }
}

function damagePlayer() {
  const result = hitPlayer(run, ship);
  if (result === 'iframe') return;
  burst(fx, ship.x, ship.y, result === 'shield' ? '#5ea8ff' : '#e6743e', 20, rng, 160, true); // player-hit glows
  addShake(fx, result === 'shield' ? 6 : 12);
  sfxHit();
  if (result === 'dead') {
    enemyShots = []; // clear hostile fire on death
    if (run.score > best) { best = run.score; saveBest(best); }
    // Record on the local leaderboard (main is the composition root → owns the clock).
    const entry = { score: run.score, wave: run.wave, date: new Date().toISOString().slice(0, 10) };
    board = recordRun(board, entry);
    saveBoard(board);
    placedIdx = placed(board, entry);
    uiLockout = GAMEOVER_LOCKOUT;
    mode = 'gameover';
  }
}

// Award a single gem's payout: score (×multiplier) and the gemsCollected stat.
// Shared by the collect path and the wave-clear vacuum so both stay in lockstep.
// Visual/audio FX are the caller's.
function collectGem(gem) {
  run.score += gem.value * multiplier(run);
  run.stats.gemsCollected += 1;
  // Boost/heart payouts (applyGem) are wired in T7; the old dash-credit shave is
  // gone with the dash system.
}

function tickPlaying(snap, dt) {
  run.stats.runTime += dt; // unpaused seconds (paused ticks never reach here)
  updateFloaters(floaters, dt);
  updateFx(fx, dt);
  for (const ex of explosions) ex.t += dt;
  explosions = explosions.filter(ex => ex.t < ex.life);
  if (fx.pause > 0) return; // hit-pause freezes the world, not the fx

  // Movement: W thrust toward the nose + continuous Space boost (full boost
  // FX/trail wiring lands in T7). Plume points opposite the nose while thrusting.
  updateShip(ship, snap, dt, arena);
  thrusting = snap.thrust || ship.boosting;
  if (thrusting) moveAngle = ship.angle;

  const shots = updateGun(ship, snap, dt, rng);
  if (shots.length > 0) {
    run.stats.shotsFired += shots.length;
    sfxShot();
    burst(fx, ship.x + Math.cos(ship.angle) * ship.radius, ship.y + Math.sin(ship.angle) * ship.radius, '#ffd75e', 3, rng, 90);
  }
  bullets.push(...shots);
  bullets = updateBullets(bullets, dt, arena);

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

  // updateEnemy pushes to a shared `out`: hostile shots (have vx) plus boss mini
  // markers ({spawn:'mini'}). Partition them — shots join the field, markers spawn
  // minis at the marker position with the current wave (they count toward clear).
  const out = [];
  for (const e of enemies) updateEnemy(e, ship, dt, out);
  for (const o of out) {
    if (o.spawn) enemies.push(spawnEnemy(o.spawn, o.x, o.y, run.wave));
    else enemyShots.push(o);
  }

  // Enemy shots: fly straight, cull off-arena, collide with the ship.
  for (const s of enemyShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < -20 || s.x > arena.w + 20 || s.y < -20 || s.y > arena.h + 20) s.dead = true;
    else if (circleHit(s, ship)) { s.dead = true; damagePlayer(); }
  }
  enemyShots = enemyShots.filter(s => !s.dead);
  if (mode !== 'playing') return; // a shot may have ended the run

  // Bullet ↔ enemy collisions carry crit rolls; each hit spawns a floater and
  // feeds the dash recharge credit.
  const crit = { chance: CRIT.chance + ship.mods.critChance, mult: CRIT.mult + ship.mods.critMult };
  const hits = collideBullets(bullets, enemies, rng, crit);
  run.stats.shotsHit += hits.length;
  let dealt = 0;
  for (const h of hits) {
    dealt += h.dealt;
    addFloater(floaters, h.x, h.y, String(h.dealt), h.crit ? 'crit' : 'dmg');
  }

  bullets = bullets.filter(b => !b.dead);
  for (const e of enemies) {
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }

  for (const e of enemies) {
    if (!e.dead && circleHit(e, ship)) {
      // Bosses damage the player on contact but never die from it: they can only
      // be killed through the bullet/hp<=0 path, which grants the kill reward.
      if (e.type !== 'boss') {
        e.dead = true; // enemy explodes on impact, no score
        enemies.push(...deathSpawns(e));
        spawnExplosion(e.x, e.y, e.radius);
        burst(fx, e.x, e.y, '#8a879a', 4, rng); // halved: sprite carries it
      }
      damagePlayer();
      if (mode !== 'playing') break;
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // Gems: move/magnetise/age; collect → score (×multiplier), stat, a shave off the
  // active dash recharge, and a soft chime + tiny glow burst.
  const collected = updateGems(gems, ship, dt);
  for (const c of collected) {
    collectGem(c);
    burst(fx, c.x, c.y, '#5fe8ff', 8, rng, 150, true);
    // The payout was invisible before — show it where it happened, floating
    // clear of the ship sprite.
    addFloater(floaters, c.x, c.y - ship.radius * 1.4, `+${c.value * multiplier(run)}`, 'gem');
  }
  if (collected.length > 0) sfxGem();

  // Record the afterimage trail (last few ship poses) while the dash is fresh.
  dashTrailT = Math.max(0, dashTrailT - dt);
  shipTrail.unshift({ x: ship.x, y: ship.y, angle: ship.angle });
  if (shipTrail.length > 4) shipTrail.length = 4;

  if (mode === 'playing' && pending.length === 0 && telegraphs.length === 0 && enemies.length === 0) {
    if (ship.shield.owned) ship.shield.up = true; // recharge between waves
    enemyShots = []; // wipe hostile fire on wave clear
    // Wave clear is immediate (no loot screen), so VACUUM every remaining field
    // gem — full score/stat/dash payout each — rather than discarding it. This
    // guarantees the boss's 6-gem ring (and any stragglers) always pays out.
    if (gems.list.length > 0) {
      for (const gem of gems.list) collectGem(gem);
      sfxGem(); // single chime, not one per gem
    }
    gems.list = []; // now wipe — every gem has been collected above
    floaters.list = []; // wipe floaters so the upgrade overlay is clean
    offers = rollOffers(ship, rng);
    uiLockout = UPGRADE_LOCKOUT;
    mode = 'upgrade';
  }
}

function tickUpgrade(snap, dt) {
  if (uiLockout > 0) { uiLockout = Math.max(0, uiLockout - dt); return; }
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
    powerLevel += 1; // difficulty scales with player power
    sfxChime();
    startWave(run.wave + 1);
    mode = 'playing';
  }
}

// A swatch click on the menu / game-over screen: repaint, persist, rebuild
// sprites. Returns true if a swatch was hit (so the caller skips starting).
function handlePaintClick(snap) {
  for (const r of paintRects(arena.w, arena.h)) {
    if (snap.clickX >= r.x && snap.clickX <= r.x + r.w &&
        snap.clickY >= r.y && snap.clickY <= r.y + r.h) {
      paint = r.family;
      try { localStorage.setItem('np-shooter-paint', paint); } catch { /* ignore */ }
      initSprites(paint);
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------- rendering ------
const frameIndex = () => Math.floor(clock * 6) % 2; // 6fps 2-frame idle flip

function drawFrame(spr, x, y, angle = 0) {
  const img = Array.isArray(spr) ? spr[frameIndex()] : spr;
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  g.restore();
}

// Draw a sprite (canvas or 2-frame array) centred at x,y, rotated, scaled so its
// larger dimension = `diameter` (aspect preserved, nearest-neighbor). Used for
// ships/enemies/projectiles so pack art and code-gen fallback share one sizing
// rule (spec C: draw diameter ≈ entity radius × 2.5).
function drawScaled(spr, x, y, angle, diameter) {
  const img = Array.isArray(spr) ? spr[frameIndex()] : spr;
  const nat = Math.max(img.width, img.height) || 1;
  const s = diameter / nat;
  const w = img.width * s, h = img.height * s;
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

function render() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  drawStarfield(g, starfield); // parallax stars behind everything

  if (mode === 'loading') {
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#8a879a';
    g.font = `bold ${Math.max(16, Math.round(arena.w / 45))}px monospace`;
    g.fillText('LOADING…', arena.w / 2, arena.h / 2);
    g.restore();
    return;
  }

  if (mode === 'menu') { drawMenu(g, arena.w, arena.h, best, paint, board); return; }

  g.save();
  if (fx.shake > 0) g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  for (const tg of telegraphs) {
    const blink = Math.sin(tg.t * 25) > 0;
    g.strokeStyle = blink ? '#e6743e' : '#8a4a2e';
    g.lineWidth = 2;
    g.strokeRect(tg.x - 10, tg.y - 10, 20, 20);
  }

  // --- Glow pass: bullets + enemy shots + thruster (shadowBlur), then reset ---
  g.save();
  g.shadowBlur = 12;
  // Player bullets → animated projectile sprite (rotated to travel dir), else square.
  g.shadowColor = '#ffd75e';
  const playerProj = ASSETS.projectiles.player;
  if (playerProj) {
    for (const b of bullets) drawScaled(playerProj, b.x, b.y, Math.atan2(b.vy, b.vx), b.radius * 6);
  } else {
    g.fillStyle = '#ffd75e';
    for (const b of bullets) g.fillRect(b.x - b.radius / 2, b.y - b.radius / 2, b.radius, b.radius);
  }
  // Hostile shots → pink projectile sprite; boss shots (bigger radius) use the
  // boss bolt if present. Falls back to the filled circle.
  g.shadowColor = HOSTILE;
  const enemyProj = ASSETS.projectiles.enemy;
  const bossProj = ASSETS.projectiles.boss || enemyProj;
  if (enemyProj) {
    for (const s of enemyShots) {
      const spr = s.radius >= 6 ? bossProj : enemyProj;
      drawScaled(spr, s.x, s.y, Math.atan2(s.vy, s.vx), s.radius * 5);
    }
  } else {
    g.fillStyle = HOSTILE;
    for (const s of enemyShots) {
      g.beginPath();
      g.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Engine thruster behind the ship while thrusting: pack plume (animated) or the
  // code-gen flame. Both trail rearward when rotated by ship.angle.
  if (thrusting) {
    g.shadowColor = '#ff9e3e';
    if (ASSETS.thrust.length) {
      const fr = ASSETS.thrust[Math.floor(clock * 14) % ASSETS.thrust.length];
      const off = ship.radius * 1.2;
      if (fr) drawScaled(fr, ship.x - Math.cos(moveAngle) * off, ship.y - Math.sin(moveAngle) * off, moveAngle, ship.radius * 2.2);
    } else if (SPRITES.flame) {
      const off = ship.radius * 0.8;
      drawFrame(SPRITES.flame, ship.x - Math.cos(moveAngle) * off, ship.y - Math.sin(moveAngle) * off, moveAngle);
    }
  }
  g.restore();

  // Gems: soft cyan glow; blink (skip alternate frames) during the last 1.5s.
  if (gems && gems.list.length && SPRITES.gem) {
    g.save();
    g.shadowBlur = 8;
    g.shadowColor = '#5fe8ff';
    for (const gem of gems.list) {
      if (gemBlinking(gem) && Math.sin(clock * 18) < 0) continue;
      drawFrame(SPRITES.gem, gem.x, gem.y);
    }
    g.restore();
  }

  for (const e of enemies) {
    // Boss art is a large ship cycled by boss number; other enemies use their
    // mapped small ship (code-gen fallback via SPRITES[type]).
    let spr = SPRITES[e.type];
    if (e.type === 'boss') { const b = bossSprite(e.wave); if (b) spr = b; }
    // Real ship art flies nose-first: movers face their velocity, spitter faces
    // the ship, the (non-rotating) boss faces +x like its code-gen predecessor.
    let angle = 0;
    if (e.type === 'spitter') angle = Math.atan2(ship.y - e.y, ship.x - e.x);
    else if (e.type !== 'boss') angle = Math.atan2(e.vy, e.vx);
    const diameter = e.radius * 2.5;
    const flash = (e.type === 'darter' && e.state === 'aim' && Math.sin(e.timer * 30) > 0)
               || (e.type === 'boss' && e.state === 'windup' && Math.sin(clock * 30) > 0);
    if (flash) {
      g.save();
      g.globalAlpha = 0.5;
      drawScaled(spr, e.x, e.y, angle, diameter);
      g.restore();
    } else {
      drawScaled(spr, e.x, e.y, angle, diameter);
    }
  }

  // Dash afterimage: last 3 poses at falling alpha, only while the dash is fresh.
  const shipD = ship.radius * 2.5;
  if (dashTrailT > 0) {
    for (let i = 1; i < Math.min(4, shipTrail.length); i++) {
      const p = shipTrail[i];
      g.globalAlpha = (dashTrailT / 0.35) * (0.32 - (i - 1) * 0.09);
      drawScaled(SPRITES.ship, p.x, p.y, p.angle, shipD);
    }
    g.globalAlpha = 1;
  }

  const blinking = ship.iframes > 0 && Math.sin(ship.iframes * 30) > 0;
  if (!blinking && mode !== 'gameover') drawScaled(SPRITES.ship, ship.x, ship.y, ship.angle, shipD); // destroyed ship isn't drawn under the game-over overlay
  if (ship.shield.up) {
    g.strokeStyle = '#5ea8ff';
    g.lineWidth = 2;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(ship.x, ship.y, ship.radius + 6, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  // Particles: plain-blend pass first, then additive 'lighter' only for the
  // glow-tagged explosion/hit particles (muzzle/dash bursts stay non-glow).
  g.save();
  for (const p of fx.particles) {
    if (p.glow) continue;
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.globalCompositeOperation = 'lighter';
  for (const p of fx.particles) {
    if (!p.glow) continue;
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.restore();
  g.globalAlpha = 1;

  // One-shot explosion sheets (additive), stepped across the 9 frames by lifetime.
  if (explosions.length && ASSETS.explosion.length) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const n = ASSETS.explosion.length;
    for (const ex of explosions) {
      const fi = Math.min(n - 1, Math.floor((ex.t / ex.life) * n));
      const img = ASSETS.explosion[fi];
      if (img) g.drawImage(img, ex.x - ex.size / 2, ex.y - ex.size / 2, ex.size, ex.size);
    }
    g.restore();
  }

  renderFloaters();
  g.restore();

  drawHud(g, arena.w, run, ship);
  const boss = enemies.find(e => e.type === 'boss');
  if (boss) drawBossBar(g, arena.w, boss); // only while a boss is alive
  if (mode === 'paused') drawPause(g, arena.w, arena.h);
  if (mode === 'upgrade' || mode === 'gameover') {
    // Fade the screen in over the input lockout so the guard reads as a
    // transition, not as unresponsiveness.
    const lockTotal = mode === 'upgrade' ? UPGRADE_LOCKOUT : GAMEOVER_LOCKOUT;
    g.save();
    g.globalAlpha = uiLockout > 0 ? 0.35 + 0.65 * (1 - uiLockout / lockTotal) : 1;
    if (mode === 'upgrade') drawOffers(g, arena.w, arena.h, offers, clock);
    else drawGameOver(g, arena.w, arena.h, run, best, paint, board, placedIdx);
    g.restore();
  }
}

function renderFloaters() {
  const u = Math.max(12, Math.round(arena.w / 90));
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const fl of floaters.list) {
    g.globalAlpha = clamp(1 - fl.t / fl.life, 0, 1);
    let size, color, weight = '';
    if (fl.kind === 'crit')      { size = 1.65 * u; color = '#ffd75e'; weight = 'bold '; }
    else if (fl.kind === 'gem')   { size = 1.25 * u; color = '#5fe8ff'; weight = 'bold '; }
    else if (fl.kind === 'combo') { size = 1.5 * u;  color = '#ff9e3e'; weight = 'bold '; }
    else if (fl.kind === 'info')  { size = 1.9 * u;  color = '#e8e6d8'; weight = 'bold '; }
    else                          { size = 1.1 * u;  color = '#ffffff'; }
    g.font = `${weight}${Math.round(size)}px monospace`;
    g.fillStyle = color;
    g.fillText(fl.text, fl.x, fl.y);
  }
  g.globalAlpha = 1;
  g.restore();
}

// ---------------------------------------------------------- dev screenshot ----
// ?screen=upgrade / ?screen=gameover jump straight to that state with fake data
// so headless screenshots can cover those screens. No param → normal boot.
function seedDevScreen(which) {
  startRun();
  if (which === 'upgrade') {
    run.wave = 4; run.score = 3800; run.streak = 7;
    powerLevel = 3;
    applyUpgrade(ship, 'rapid');
    applyUpgrade(ship, 'deadeye');
    applyUpgrade(ship, 'boosttank');
    offers = rollOffers(ship, rng);
    floaters.list = []; // clean overlay for the dev screenshot
    mode = 'upgrade';
  } else if (which === 'boss') {
    // Wave 5 mid-fight: boss at ~55% HP upper-center, escort drifters, gems on
    // the field, HP bar visible.
    run.wave = 5; run.score = 8600; run.streak = 4; powerLevel = 3;
    pending = []; telegraphs = []; enemies = []; enemyShots = [];
    const boss = spawnEnemy('boss', arena.w / 2, arena.h * 0.3, 5);
    boss.hp = Math.round(boss.maxHp * 0.55);
    enemies.push(boss);
    enemies.push(spawnEnemy('drifter', arena.w * 0.3, arena.h * 0.55, 5));
    enemies.push(spawnEnemy('drifter', arena.w * 0.7, arena.h * 0.5, 5));
    spawnGemRing(gems, arena.w / 2, arena.h * 0.52, 40, 6, rng);
    spawnGem(gems, arena.w * 0.42, arena.h * 0.62, 30, rng);
    spawnGem(gems, arena.w * 0.6, arena.h * 0.66, 30, rng);
    floaters.list = [];
    mode = 'playing';
  } else {
    run.score = 12450; run.wave = 9;
    // Seed a board so the game-over leaderboard + placed highlight render.
    const entry = { score: run.score, wave: run.wave, date: '2026-07-10' };
    board = recordRun(
      [{ score: 18400, wave: 12, date: '2026-07-08' }, { score: 9200, wave: 7, date: '2026-07-09' }],
      entry,
    );
    placedIdx = placed(board, entry);
    floaters.list = []; // clean overlay for the dev screenshot (matches upgrade/boss seeds)
    mode = 'gameover';
  }
}

let last = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); // clamp: tab-switch can't teleport entities
  last = t;
  clock += dt;
  updateStarfield(starfield, dt);
  const snap = input.poll();

  if (mode === 'menu' && snap.clicked) {
    if (!handlePaintClick(snap)) { initAudio(); startRun(); }
  }
  else if (mode === 'playing') {
    // Toggling pause skips tickPlaying for this frame, so ~1 frame of world time
    // (this dt, already clamped) is dropped per toggle; ~2 across a pause+resume.
    // Intentional and player-favorable — the world advances slightly less, never
    // more, than wall-clock across a pause.
    if (snap.pausePressed) mode = 'paused'; // Esc/P freezes the world this frame
    else tickPlaying(snap, dt);
  }
  else if (mode === 'paused') {
    if (snap.pausePressed) mode = 'playing'; // resume; runTime excludes paused frames
  }
  else if (mode === 'upgrade') tickUpgrade(snap, dt);
  else if (mode === 'gameover') {
    if (uiLockout > 0) uiLockout = Math.max(0, uiLockout - dt);
    else if (snap.clicked) { if (!handlePaintClick(snap)) startRun(); }
    else if (snap.keyR) startRun();
  }

  render();
  requestAnimationFrame(frame);
}

// Boot: render a LOADING frame until every asset settles (per-slot failures are
// tolerated), then rebind sprites to pack art and enter the menu (or a dev
// screen). A menu click before ASSETS.ready can't land — mode is 'loading'.
const devScreen = new URLSearchParams(location.search).get('screen');
loadAssets().then(() => {
  initSprites(paint); // rebind SPRITES to pack art now that ASSETS.ready is true
  if (devScreen === 'upgrade' || devScreen === 'gameover' || devScreen === 'boss') seedDevScreen(devScreen);
  else mode = 'menu';
});
requestAnimationFrame(frame);

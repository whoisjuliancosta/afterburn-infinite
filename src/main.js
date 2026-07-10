// src/main.js
import { WAVE, CRIT, GEMS, ROCKET, GUN } from './config.js';
import { makeRng, loadBest, saveBest, clamp } from './utils.js';
import { createShip, updateShip, updateGun } from './ship.js';
import { updateBullets, circleHit, collideBullets } from './bullets.js';
import { spawnEnemy, updateEnemy, deathSpawns } from './enemies.js';
import { buildWave, scheduleWave } from './waves.js';
import { createRun, addKill, hitPlayer, multiplier, applyGem } from './run.js';
import { createGems, spawnGem, spawnGemRing, updateGems, gemBlinking, rollDrop } from './gems.js';
import { createRockets, fireRocket, updateRockets } from './rockets.js';
import { loadBoard, recordRun, saveBoard, placed } from './board.js';
import { rollOffers, applyUpgrade } from './upgrades.js';
import { createFloaters, addFloater, updateFloaters } from './floaters.js';
import { initSprites, SPRITES, GLOW } from './sprites.js';
import { ASSETS, loadAssets, bossSprite } from './assets.js';
import { createFx, burst, addShake, addPause, updateFx } from './particles.js';
import { createStarfield, updateStarfield, drawStarfield } from './starfield.js';
import { initAudio, sfxShot, sfxBoost, sfxRocket, sfxExplosion, sfxHit, sfxChime, sfxWave, sfxGem, sfxBossDown } from './audio.js';
import { drawHud, drawMenu, drawGameOver, drawOffers, offerRects, paintRects, drawBossBar, drawPause, drawFieldRing } from './hud.js';
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
let run, ship, bullets, enemies, enemyShots, telegraphs, pending, waveT, fx, floaters, gems, rockets, offers;
let explosions = []; // one-shot 9-frame explosion FX entities at kill points
let powerLevel;         // upgrades taken this run (feeds wave budget)
let thrusting = false;  // last-frame movement state, for the engine flame
let moveAngle = 0;      // nose direction while thrusting — the plume points opposite this
let boosting = false;   // last-frame boost state (plume scale, afterimage, sfx edge)
let wasBoosting = false;// prior-frame boost state, for the boost-start sfx edge
let shipTrail = [];     // recent {x, y, angle} for the boost afterimage
let boostTrailT = 0;    // afterimage lifetime countdown (kept fresh while boosting)
let rocketPending = false; // latched right-click; survives hit-pause frames until the fire check consumes it
let stressMode = false;    // ?screen=stress: worst-case perf scene, sustained each frame (dev/measurement only)

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
  rockets = createRockets();
  offers = [];
  explosions = [];
  placedIdx = -1;
  powerLevel = 0;
  thrusting = false;
  boosting = false;
  wasBoosting = false;
  shipTrail = [];
  boostTrailT = 0;
  rocketPending = false;
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
    // Boss death ring: 6 blue (boost) + 2 red (heart) gems (spec C).
    spawnGemRing(gems, e.x, e.y, gemValue, 6, rng, 'blue');
    spawnGemRing(gems, e.x, e.y, gemValue, 2, rng, 'red');
    ship.hp = Math.min(ship.maxHp, ship.hp + 1);       // heal 1 heart (capped)
    spawnExplosion(e.x, e.y, e.radius, true);
    burst(fx, e.x, e.y, '#ff9e3e', 21, rng, 260, true); // halved: sprite carries it
    addShake(fx, 16);
    addPause(fx, 0.05);
    sfxBossDown();
  } else {
    // Gems v2: one mutually-exclusive roll → blue (boost) / red (heart) / none.
    // Splitter and boss-class kills roll red at 2× (isBig).
    const kind = rollDrop(rng, e.type === 'splitter', ship.mods.luck);
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

// Award a single gem's payout. Gems no longer grant score (spec C): blue tops up
// the boost meter, red accrues toward the next heart. Shared by the collect path
// and the wave-clear vacuum so both stay in lockstep. Returns the applyGem result
// {kind, gained?/healed?/full?} so the caller can raise a kind-appropriate floater.
function collectGem(gem) {
  run.stats.gemsCollected += 1;
  return applyGem(run, ship, gem.kind);
}

// Map an applyGem result to a pickup floater: blue → '+10%' cyan; red at full HP
// (heart lost) → 'FULL'; any other red → '+10% ♥' red.
function gemFloater(res) {
  if (res.kind === 'blue') return { text: '+10%', kind: 'gem' };
  if (res.full) return { text: 'FULL', kind: 'heart' };
  return { text: '+10% ♥', kind: 'heart' };
}

function tickPlaying(snap, dt) {
  run.stats.runTime += dt; // unpaused seconds (paused ticks never reach here)
  updateFloaters(floaters, dt);
  updateFx(fx, dt);
  for (const ex of explosions) ex.t += dt;
  explosions = explosions.filter(ex => ex.t < ex.life);
  if (fx.pause > 0) return; // hit-pause freezes the world, not the fx

  // Movement: W thrust toward the nose + continuous Space boost. Plume points
  // opposite the nose while thrusting; the boost afterimage/plume-scale keys off
  // ship.boosting (true only while the meter is actually draining).
  updateShip(ship, snap, dt, arena);
  boosting = ship.boosting;
  thrusting = snap.thrust || boosting;
  if (thrusting) moveAngle = ship.angle;
  if (boosting) {
    run.stats.boostTime += dt;    // seconds spent boosting (game-over stat)
    boostTrailT = 0.35;           // keep the afterimage fresh while boosting
    if (!wasBoosting) sfxBoost();  // rising-edge blip on boost start only
  }
  wasBoosting = boosting;

  const shots = updateGun(ship, snap, dt, rng);
  if (shots.length > 0) {
    run.stats.shotsFired += shots.length;
    sfxShot();
    burst(fx, ship.x + Math.cos(ship.angle) * ship.radius, ship.y + Math.sin(ship.angle) * ship.radius, '#ffd75e', 3, rng, 90);
  }
  bullets.push(...shots);
  bullets = updateBullets(bullets, dt, arena);

  // Rockets: right-click launches one along the nose. rocketPending is latched in
  // frame() so a click landing on a hit-pause frame (tickPlaying returns above
  // before this line) isn't lost. Consume the latch here — clearing it whether or
  // not the shot fires, so it recovers a pause-eaten click without queuing through
  // the cooldown. fireRocket returns false while cooling down (whoosh only fires).
  if (rocketPending) {
    rocketPending = false;
    if (fireRocket(rockets, ship)) sfxRocket();
  }

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
  for (const e of enemies) updateEnemy(e, ship, dt, out, arena, rng);
  for (const o of out) {
    if (o.spawn) enemies.push(spawnEnemy(o.spawn, o.x, o.y, run.wave));
    else enemyShots.push(o);
  }
  // Hard cap (v5.1 perf): bound hostile shots on screen, culling the oldest.
  if (enemyShots.length > 220) enemyShots.splice(0, enemyShots.length - 220);

  // Enemy shots: fly straight, cull off-arena, collide with the ship.
  for (const s of enemyShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < -20 || s.x > arena.w + 20 || s.y < -20 || s.y > arena.h + 20) s.dead = true;
    else if (circleHit(s, ship)) { s.dead = true; damagePlayer(); }
  }
  enemyShots = enemyShots.filter(s => !s.dead);
  if (mode !== 'playing') return; // a shot may have ended the run

  // Bullet ↔ enemy collisions carry crit rolls; each hit spawns a damage floater.
  const crit = { chance: CRIT.chance + ship.mods.critChance, mult: CRIT.mult + ship.mods.critMult };
  const hits = collideBullets(bullets, enemies, rng, crit);
  run.stats.shotsHit += hits.length;
  let dealt = 0;
  for (const h of hits) {
    dealt += h.dealt;
    addFloater(floaters, h.x, h.y, String(h.dealt), h.crit ? 'crit' : 'dmg');
  }

  bullets = bullets.filter(b => !b.dead);

  // Rockets: fly, detonate on first contact / at range, deal AoE damage (enemy hp
  // mutated in place). Each detonation → big glow burst + shake + per-hit damage
  // floaters; hp<=0 victims fall through to the kill sweep below (score/gems as
  // normal kills). shotsHit isn't credited to rockets (that stat tracks the gun).
  const detonations = updateRockets(rockets, enemies, dt);
  for (const det of detonations) {
    // Range-end detonation in empty air (zero hits): skip the big FX/sfx — just a
    // small fizzle puff so empty booms don't flash the screen (v5 review minor).
    if (det.hits.length === 0) {
      burst(fx, det.x, det.y, '#e6743e', 6, rng, 90); // small non-additive fizzle
      continue;
    }
    burst(fx, det.x, det.y, '#ff9e3e', 26, rng, 300, true); // big additive glow
    spawnExplosion(det.x, det.y, ROCKET.aoeRadius * 0.5);
    addShake(fx, 10);
    addPause(fx, 0.03);
    sfxExplosion();
    for (const h of det.hits) addFloater(floaters, h.enemy.x, h.enemy.y, String(h.damage), 'dmg');
  }

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

  // Gems: move/magnetise/age using the same effective magnet radius the force-
  // field ring renders at (GEMS.magnetRadius × Attractor multiplier). Collect →
  // applyGem payout (blue boost / red heart), stat, a soft chime + tiny glow
  // burst, and a kind-appropriate floater at the pickup point.
  const magnetR = GEMS.magnetRadius * (ship.mods.magnet || 1);
  const collected = updateGems(gems, ship, dt, magnetR);
  for (const c of collected) {
    const res = collectGem(c);
    const fx2 = gemFloater(res);
    burst(fx, c.x, c.y, res.kind === 'red' ? '#e0524a' : '#5fe8ff', 8, rng, 150, true);
    addFloater(floaters, c.x, c.y - ship.radius * 1.4, fx2.text, fx2.kind);
  }
  if (collected.length > 0) sfxGem();

  // Boost afterimage: record the last few ship poses; boostTrailT counts down
  // once boost ends so the trail fades out (kept pinned to 0.35 while boosting).
  boostTrailT = Math.max(0, boostTrailT - dt);
  shipTrail.unshift({ x: ship.x, y: ship.y, angle: ship.angle });
  if (shipTrail.length > 4) shipTrail.length = 4;

  if (mode === 'playing' && pending.length === 0 && telegraphs.length === 0 && enemies.length === 0) {
    if (ship.shield.owned) ship.shield.up = true; // recharge between waves
    enemyShots = []; // wipe hostile fire on wave clear
    // Wave clear is immediate (no loot screen), so VACUUM every remaining field
    // gem — full applyGem payout each (same as a hand-collect) — rather than
    // discarding it. This guarantees the boss's gem ring (and any stragglers)
    // always pays boost/hearts out.
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

// Draw a pre-baked glow sprite (from sprites.js GLOW). `size` is the desired
// on-screen extent of the ORIGINAL content's larger dimension; the baked halo
// scales along with it. `angle` 0 skips the save/rotate entirely (symmetric
// sprites — bullets/shots/gems — so a whole batch runs with no per-entity ctx
// state). `fi` overrides the frame index for plumes with their own cadence.
function drawGlow(glow, x, y, angle, size, fi) {
  const n = glow.frames.length;
  const fr = glow.frames[(fi != null ? fi : (n > 1 ? frameIndex() : 0)) % n];
  const k = size / glow.nat;
  const w = fr.width * k, h = fr.height * k;
  if (angle) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.drawImage(fr, -w / 2, -h / 2, w, h);
    g.restore();
  } else {
    g.drawImage(fr, x - w / 2, y - h / 2, w, h);
  }
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

  // --- Pre-baked glow passes (v5.1 perf): bullets, enemy shots, thruster. All
  // glow is baked into the sprites (GLOW), so the frame loop is plain drawImage
  // with zero shadowBlur. Bullets/shots are symmetric → drawn WITHOUT rotation
  // and WITHOUT per-entity save/restore, one batch each.
  for (const b of bullets) drawGlow(GLOW.bullet, b.x, b.y, 0, b.radius * 6);
  for (const s of enemyShots) {
    drawGlow(s.radius >= 6 ? GLOW.bossShot : GLOW.enemyShot, s.x, s.y, 0, s.radius * 5);
  }
  // Engine thruster behind the ship while thrusting: pack plume (animated) or the
  // code-gen flame. Both trail rearward when rotated by ship.angle. Boost scales
  // the plume up ~50% and reaches further back. Colour (warm/cyan) is a separate
  // pre-baked set, not a runtime shadowColor.
  if (thrusting) {
    const scale = boosting ? 1.5 : 1;
    const plume = boosting ? GLOW.thrustBoost : GLOW.thrustNormal;
    if (GLOW.thrustIsPack) {
      const off = ship.radius * 1.2 * scale;
      const fi = Math.floor(clock * 14);
      drawGlow(plume, ship.x - Math.cos(moveAngle) * off, ship.y - Math.sin(moveAngle) * off, moveAngle, ship.radius * 2.2 * scale, fi);
    } else {
      // Code-gen flame: drawFrame semantics were native×scale, so size = nat×scale.
      const off = ship.radius * 0.8 * scale;
      drawGlow(plume, ship.x - Math.cos(moveAngle) * off, ship.y - Math.sin(moveAngle) * off, moveAngle, plume.nat * scale);
    }
  }

  // Gems: kind-tinted glow (blue = boost, red = heart); drawn ~30% smaller than
  // native (spec C); blink (skip alternate frames) during the last 1.5s. Glow is
  // pre-baked; symmetric so no rotation. One batch, no per-gem ctx state.
  if (gems && gems.list.length) {
    const gemSize = GLOW.gemBlue.nat * 0.7; // matches the old drawFrame(…, 0.7)
    for (const gem of gems.list) {
      if (gemBlinking(gem) && Math.sin(clock * 18) < 0) continue;
      drawGlow(gem.kind === 'red' ? GLOW.gemRed : GLOW.gemBlue, gem.x, gem.y, 0, gemSize);
    }
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

  // Rockets: missile sprite pointed along travel, with a short additive glow
  // trail streaming out the back. Composite toggles once (→ 'lighter' for all
  // trails, → 'source-over' for all missiles), not per rocket; missile glow is
  // pre-baked (GLOW.rocket) so no runtime shadowBlur.
  if (rockets && rockets.list.length) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const rk of rockets.list) {
      const ang = Math.atan2(rk.vy, rk.vx);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      for (let i = 1; i <= 3; i++) {
        const t = i * rk.radius * 1.6;
        g.globalAlpha = 0.4 - i * 0.1;
        g.fillStyle = i === 1 ? '#ffd75e' : '#ff7a3e';
        g.fillRect(rk.x - cos * t - 2, rk.y - sin * t - 2, 4, 4);
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    for (const rk of rockets.list) {
      drawGlow(GLOW.rocket, rk.x, rk.y, Math.atan2(rk.vy, rk.vx), rk.radius * 5);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Force-field ring at the effective gem-magnet radius (spec C), so the pull
  // zone is visible. Same radius fed to updateGems.
  drawFieldRing(g, ship, GEMS.magnetRadius * (ship.mods.magnet || 1), clock);

  // Boost afterimage: last 3 poses at falling alpha while the boost trail is
  // fresh (kept at 0.35 while boosting, then fades).
  const shipD = ship.radius * 2.5;
  if (boostTrailT > 0) {
    for (let i = 1; i < Math.min(4, shipTrail.length); i++) {
      const p = shipTrail[i];
      g.globalAlpha = (boostTrailT / 0.35) * (0.32 - (i - 1) * 0.09);
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
  // glow-tagged explosion/hit particles (muzzle/impact bursts stay non-glow).
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

  drawHud(g, arena.w, run, ship, rockets);
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
    else if (fl.kind === 'heart') { size = 1.25 * u; color = '#ff6b7a'; weight = 'bold '; }
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
// ?screen=stress sustain (dev/measurement only, gated by stressMode). Re-tops the
// worst-case scene every playing frame so the render load stays saturated across
// the whole sample window, while the real sim keeps everything moving/firing.
const STRESS_ENEMY_TYPES = ['drifter', 'darter', 'spitter', 'orbiter', 'weaver', 'splitter'];
function stressBullet() {
  const a = rng() * Math.PI * 2;
  const sp = GUN.bulletSpeed * ship.mods.bulletSpeed;
  return {
    x: rng() * arena.w, y: rng() * arena.h,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    damage: GUN.damage + ship.mods.damage, pierce: ship.mods.pierce, bounces: ship.mods.bounce,
    traveled: 0, range: GUN.bulletRange * ship.mods.bulletSpeed, radius: GUN.bulletRadius, dead: false,
  };
}
function stressShot() {
  const a = rng() * Math.PI * 2;
  return { x: rng() * arena.w, y: rng() * arena.h, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, radius: 6, dead: false };
}
function stressSustain() {
  ship.hp = ship.maxHp; ship.iframes = 0.2; // invulnerable (no death) and non-blinking (visible)
  let boss = enemies.find(e => e.type === 'boss');
  if (!boss) { boss = spawnEnemy('boss', arena.w / 2, arena.h * 0.28, 20); enemies.push(boss); }
  boss.hp = Math.max(1, Math.floor(boss.maxHp * 0.32)); // pin to P3 (<1/3 maxHp): spirals + minis + blinks
  while (enemies.length < 40) enemies.push(spawnEnemy(STRESS_ENEMY_TYPES[Math.floor(rng() * STRESS_ENEMY_TYPES.length)], rng() * arena.w, rng() * arena.h, 20));
  while (bullets.length < 200) bullets.push(stressBullet());
  while (enemyShots.length < 150) enemyShots.push(stressShot());
  if (fx.particles.length < 300) burst(fx, arena.w / 2, arena.h / 2, '#ff9e3e', 300 - fx.particles.length, rng, 260, true);
}

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
    // Wave 10 mid-fight: boss number B=2 (walls + B≥2 minis active), at ~55% HP
    // (P2 phase → bullet wall) upper-center, escort drifters, blue+red gems on the
    // field, HP bar visible. wallTimer primed so a wall sweeps almost immediately.
    run.wave = 10; run.score = 18600; run.streak = 4; powerLevel = 6;
    pending = []; telegraphs = []; enemies = []; enemyShots = [];
    const boss = spawnEnemy('boss', arena.w / 2, arena.h * 0.3, 10);
    boss.hp = Math.round(boss.maxHp * 0.55); // P2 band [1/3, 2/3]
    boss.wallTimer = 0.2; // fire a wall right away so it shows on the seed
    enemies.push(boss);
    enemies.push(spawnEnemy('drifter', arena.w * 0.3, arena.h * 0.55, 10));
    enemies.push(spawnEnemy('drifter', arena.w * 0.7, arena.h * 0.5, 10));
    spawnGemRing(gems, arena.w / 2, arena.h * 0.52, 40, 6, rng, 'blue');
    spawnGemRing(gems, arena.w * 0.5, arena.h * 0.52, 40, 2, rng, 'red');
    spawnGem(gems, arena.w * 0.42, arena.h * 0.62, 30, rng, 'red');
    spawnGem(gems, arena.w * 0.6, arena.h * 0.66, 30, rng, 'blue');
    floaters.list = [];
    mode = 'playing';
  } else if (which === 'stress') {
    // Worst-case render scene for the T-verify perf measurement (spec A.5). A
    // capped-build player, ~40 enemies incl. a P3 boss (spirals + minis + walls),
    // ~150 enemy shots, ~200 bullets and 300 particles — all in real 'playing'
    // mode so the full sim runs every frame. stressSustain() re-tops the scene
    // each frame so the worst case holds for the whole 10s sample (not a static
    // tableau: every entity moves, the boss fires, kills spawn gems/explosions).
    run.wave = 20; run.score = 92000; run.streak = 20; powerLevel = 20;
    // Capped build: caps clamp inside applyUpgrade, so over-applying is safe.
    for (const id of ['rapid', 'rapid', 'rapid', 'rapid', 'rapid', 'rapid', 'spread',
      'spread', 'spread', 'pierce', 'pierce', 'pierce', 'pierce', 'pierce', 'ricochet',
      'ricochet', 'ricochet', 'velocity', 'velocity', 'velocity', 'heavy', 'heavy',
      'bigpayload', 'bigpayload', 'fastreload', 'fastreload', 'lucky', 'lucky',
      'rearguard', 'adrenaline', 'aegis', 'boosttank', 'boosttank', 'attractor', 'attractor']) {
      applyUpgrade(ship, id);
    }
    pending = []; telegraphs = []; enemies = []; enemyShots = []; bullets = [];
    stressMode = true;
    stressSustain();          // seed the population; frame() re-tops it each tick
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
    if (stressMode) stressSustain(); // re-saturate the worst-case scene before the tick
    // Latch a right-click before anything can early-return; tickPlaying consumes it
    // (may be a hit-pause frame that returns before the fire check).
    if (snap.rocketPressed) rocketPending = true;
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
  if (devScreen === 'upgrade' || devScreen === 'gameover' || devScreen === 'boss' || devScreen === 'stress') seedDevScreen(devScreen);
  else mode = 'menu';
});
requestAnimationFrame(frame);

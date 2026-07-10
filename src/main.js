// src/main.js
import { WAVE, CRIT } from './config.js';
import { makeRng, loadBest, saveBest, clamp } from './utils.js';
import { createShip, updateShip, updateGun, tryDash, creditDash } from './ship.js';
import { updateBullets, circleHit, collideBullets } from './bullets.js';
import { spawnEnemy, updateEnemy, deathSpawns } from './enemies.js';
import { buildWave, scheduleWave } from './waves.js';
import { createRun, addKill, hitPlayer, multiplier } from './run.js';
import { rollOffers, applyUpgrade } from './upgrades.js';
import { createFloaters, addFloater, updateFloaters } from './floaters.js';
import { initSprites, SPRITES } from './sprites.js';
import { createFx, burst, addShake, addPause, updateFx } from './particles.js';
import { createStarfield, updateStarfield, drawStarfield } from './starfield.js';
import { initAudio, sfxShot, sfxDash, sfxExplosion, sfxHit, sfxChime, sfxWave } from './audio.js';
import { drawHud, drawMenu, drawGameOver, drawOffers, offerRects, paintRects } from './hud.js';
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

// Ship paint: persisted choice, default white. Guard localStorage (private mode).
function loadPaint() {
  try { return localStorage.getItem('np-shooter-paint') || '#e8e6d8'; }
  catch { return '#e8e6d8'; }
}
let paint = loadPaint();
initSprites(paint);

const input = createInput(canvas);
const rng = makeRng(Date.now());

let mode = 'menu'; // 'menu' | 'playing' | 'upgrade' | 'gameover'
let best = loadBest();
let clock = 0; // global animation clock (sprite frames, previews, floaters)
let run, ship, bullets, enemies, enemyShots, telegraphs, pending, waveT, fx, floaters, offers;
let powerLevel;         // upgrades taken this run (feeds wave budget)
let thrusting = false;  // last-frame thrust state, for the engine flame
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
  offers = [];
  powerLevel = 0;
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

function killEnemy(e) {
  e.dead = true;
  addKill(run, e);
  enemies.push(...deathSpawns(e));
  burst(fx, e.x, e.y, '#ff9e3e', 14, rng);
  addShake(fx, 5);
  addPause(fx, 0.03);
  sfxExplosion();

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
  burst(fx, ship.x, ship.y, result === 'shield' ? '#5ea8ff' : '#e6743e', 20, rng);
  addShake(fx, result === 'shield' ? 6 : 12);
  sfxHit();
  if (result === 'dead') {
    enemyShots = []; // clear hostile fire on death
    if (run.score > best) { best = run.score; saveBest(best); }
    mode = 'gameover';
  }
}

function tickPlaying(snap, dt) {
  updateFloaters(floaters, dt);
  updateFx(fx, dt);
  if (fx.pause > 0) return; // hit-pause freezes the world, not the fx

  // Dash: edge-triggered impulse + iframes, with burst, SFX and afterimage.
  if (snap.dashPressed && tryDash(ship)) {
    sfxDash();
    burst(fx, ship.x - Math.cos(ship.angle) * ship.radius,
              ship.y - Math.sin(ship.angle) * ship.radius, '#3ecfe6', 14, rng, 240);
    dashTrailT = 0.35;
  }

  updateShip(ship, snap, dt, arena);
  thrusting = !!snap.thrust;

  const shots = updateGun(ship, snap, dt, rng);
  if (shots.length > 0) {
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

  for (const e of enemies) updateEnemy(e, ship, dt, enemyShots);

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
  let dealt = 0;
  for (const h of hits) {
    dealt += h.dealt;
    addFloater(floaters, h.x, h.y, String(h.dealt), h.crit ? 'crit' : 'dmg');
  }
  if (dealt > 0) creditDash(ship, dealt);

  bullets = bullets.filter(b => !b.dead);
  for (const e of enemies) {
    if (e.hp <= 0 && !e.dead) killEnemy(e);
  }

  for (const e of enemies) {
    if (!e.dead && circleHit(e, ship)) {
      e.dead = true; // enemy explodes on impact, no score
      enemies.push(...deathSpawns(e));
      burst(fx, e.x, e.y, '#8a879a', 8, rng);
      damagePlayer();
      if (mode !== 'playing') break;
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // Record the afterimage trail (last few ship poses) while the dash is fresh.
  dashTrailT = Math.max(0, dashTrailT - dt);
  shipTrail.unshift({ x: ship.x, y: ship.y, angle: ship.angle });
  if (shipTrail.length > 4) shipTrail.length = 4;

  if (mode === 'playing' && pending.length === 0 && telegraphs.length === 0 && enemies.length === 0) {
    if (ship.shield.owned) ship.shield.up = true; // recharge between waves
    enemyShots = []; // wipe hostile fire on wave clear
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
      paint = r.color;
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

function render() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  drawStarfield(g, starfield); // parallax stars behind everything

  if (mode === 'menu') { drawMenu(g, arena.w, arena.h, best, paint); return; }

  g.save();
  if (fx.shake > 0) g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  for (const tg of telegraphs) {
    const blink = Math.sin(tg.t * 25) > 0;
    g.strokeStyle = blink ? '#e6743e' : '#8a4a2e';
    g.lineWidth = 2;
    g.strokeRect(tg.x - 10, tg.y - 10, 20, 20);
  }

  // --- Glow pass: bullets + enemy shots + flame (shadowBlur), then reset ---
  g.save();
  g.shadowBlur = 12;
  g.shadowColor = '#ffd75e';
  g.fillStyle = '#ffd75e';
  for (const b of bullets) g.fillRect(b.x - b.radius / 2, b.y - b.radius / 2, b.radius, b.radius);
  g.shadowColor = HOSTILE;
  g.fillStyle = HOSTILE;
  for (const s of enemyShots) {
    g.beginPath();
    g.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    g.fill();
  }
  // Engine flame behind the ship while thrusting.
  if (thrusting && SPRITES.flame) {
    g.shadowColor = '#ff9e3e';
    const off = ship.radius * 0.8;
    drawFrame(SPRITES.flame, ship.x - Math.cos(ship.angle) * off, ship.y - Math.sin(ship.angle) * off, ship.angle);
  }
  g.restore();

  for (const e of enemies) {
    const spr = SPRITES[e.type];
    let angle = 0;
    if (e.type === 'darter' || e.type === 'weaver') angle = Math.atan2(e.vy, e.vx);
    else if (e.type === 'spitter') angle = Math.atan2(ship.y - e.y, ship.x - e.x);
    const flash = e.type === 'darter' && e.state === 'aim' && Math.sin(e.timer * 30) > 0;
    if (flash) {
      g.save();
      g.globalAlpha = 0.5;
      drawFrame(spr, e.x, e.y, angle);
      g.restore();
    } else {
      drawFrame(spr, e.x, e.y, angle);
    }
  }

  // Dash afterimage: last 3 poses at falling alpha, only while the dash is fresh.
  if (dashTrailT > 0) {
    for (let i = 1; i < Math.min(4, shipTrail.length); i++) {
      const p = shipTrail[i];
      g.globalAlpha = (dashTrailT / 0.35) * (0.32 - (i - 1) * 0.09);
      drawFrame(SPRITES.ship, p.x, p.y, p.angle);
    }
    g.globalAlpha = 1;
  }

  const blinking = ship.iframes > 0 && Math.sin(ship.iframes * 30) > 0;
  if (!blinking) drawFrame(SPRITES.ship, ship.x, ship.y, ship.angle);
  if (ship.shield.up) {
    g.strokeStyle = '#5ea8ff';
    g.lineWidth = 2;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(ship.x, ship.y, ship.radius + 6, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  // Explosion/thruster particles composite additively for a glow.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of fx.particles) {
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.restore();
  g.globalAlpha = 1;

  renderFloaters();
  g.restore();

  drawHud(g, arena.w, run, ship);
  if (mode === 'upgrade') drawOffers(g, arena.w, arena.h, offers, clock);
  if (mode === 'gameover') drawGameOver(g, arena.w, arena.h, run, best, paint);
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
    applyUpgrade(ship, 'extradash');
    offers = rollOffers(ship, rng);
    mode = 'upgrade';
  } else {
    run.score = 12450; run.wave = 9;
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
  else if (mode === 'playing') tickPlaying(snap, dt);
  else if (mode === 'upgrade') tickUpgrade(snap);
  else if (mode === 'gameover') {
    if (snap.clicked) { if (!handlePaintClick(snap)) startRun(); }
    else if (snap.keyR) startRun();
  }

  render();
  requestAnimationFrame(frame);
}

const devScreen = new URLSearchParams(location.search).get('screen');
if (devScreen === 'upgrade' || devScreen === 'gameover') seedDevScreen(devScreen);
requestAnimationFrame(frame);

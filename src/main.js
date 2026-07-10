// src/main.js
import { WAVE } from './config.js';
import { makeRng, loadBest, saveBest, clamp } from './utils.js';
import { createShip, updateShip, updateGun } from './ship.js';
import { updateBullets, circleHit, collideBullets } from './bullets.js';
import { spawnEnemy, updateEnemy, deathSpawns } from './enemies.js';
import { buildWave, scheduleWave } from './waves.js';
import { createRun, addKill, hitPlayer } from './run.js';
import { rollOffers, applyUpgrade } from './upgrades.js';
import { initSprites, SPRITES } from './sprites.js';
import { createFx, burst, addShake, addPause, updateFx } from './particles.js';
import { initAudio, sfxShot, sfxExplosion, sfxHit, sfxChime, sfxWave } from './audio.js';
import { drawHud, drawMenu, drawGameOver, drawOffers, offerRects } from './hud.js';
import { createInput } from './input.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const arena = { w: 0, h: 0 };

function resize() {
  canvas.width = arena.w = window.innerWidth;
  canvas.height = arena.h = window.innerHeight;
  g.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();
initSprites();

const input = createInput(canvas);
const rng = makeRng(Date.now());

let mode = 'menu'; // 'menu' | 'playing' | 'upgrade' | 'gameover'
let best = loadBest();
let run, ship, bullets, enemies, telegraphs, pending, waveT, fx, offers;

function startRun() {
  run = createRun();
  ship = createShip(arena.w / 2, arena.h / 2);
  bullets = [];
  enemies = [];
  telegraphs = [];
  fx = createFx();
  offers = [];
  startWave(1);
  mode = 'playing';
}

function startWave(n) {
  run.wave = n;
  pending = scheduleWave(buildWave(n, rng), rng, arena);
  waveT = 0;
  sfxWave();
}

function killEnemy(e) {
  e.dead = true;
  addKill(run, e);
  enemies.push(...deathSpawns(e));
  burst(fx, e.x, e.y, '#ff9e3e', 14, rng);
  addShake(fx, 5);
  addPause(fx, 0.03);
  sfxExplosion();
}

function damagePlayer() {
  const result = hitPlayer(run, ship);
  if (result === 'iframe') return;
  burst(fx, ship.x, ship.y, result === 'shield' ? '#5ea8ff' : '#e6743e', 20, rng);
  addShake(fx, result === 'shield' ? 6 : 12);
  sfxHit();
  if (result === 'dead') {
    if (run.score > best) { best = run.score; saveBest(best); }
    mode = 'gameover';
  }
}

function tickPlaying(snap, dt) {
  updateFx(fx, dt);
  if (fx.pause > 0) return; // hit-pause freezes the world, not the fx

  updateShip(ship, snap, dt, arena);

  const shots = updateGun(ship, snap, dt, rng);
  if (shots.length > 0) {
    sfxShot();
    burst(fx, ship.x + Math.cos(ship.angle) * ship.radius, ship.y + Math.sin(ship.angle) * ship.radius, '#ffd75e', 3, rng, 90);
  }
  bullets.push(...shots);
  bullets = updateBullets(bullets, dt);

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

  for (const e of enemies) updateEnemy(e, ship, dt);

  collideBullets(bullets, enemies);
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

  if (mode === 'playing' && pending.length === 0 && telegraphs.length === 0 && enemies.length === 0) {
    if (ship.shield.owned) ship.shield.up = true; // recharge between waves
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
    sfxChime();
    startWave(run.wave + 1);
    mode = 'playing';
  }
}

function drawSprite(spr, x, y, angle = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.drawImage(spr, -spr.width / 2, -spr.height / 2);
  g.restore();
}

function render() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);

  if (mode === 'menu') { drawMenu(g, arena.w, arena.h, best); return; }

  g.save();
  if (fx.shake > 0) g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  for (const tg of telegraphs) {
    const blink = Math.sin(tg.t * 25) > 0;
    g.strokeStyle = blink ? '#e6743e' : '#8a4a2e';
    g.lineWidth = 2;
    g.strokeRect(tg.x - 10, tg.y - 10, 20, 20);
  }

  for (const b of bullets) {
    g.fillStyle = '#ffd75e';
    g.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  for (const e of enemies) {
    const spr = SPRITES[e.type];
    const flash = e.type === 'darter' && e.state === 'aim' && Math.sin(e.timer * 30) > 0;
    if (flash) {
      g.save();
      g.globalAlpha = 0.5;
      drawSprite(spr, e.x, e.y, Math.atan2(e.vy, e.vx));
      g.restore();
    } else {
      drawSprite(spr, e.x, e.y, e.type === 'darter' ? Math.atan2(e.vy, e.vx) : 0);
    }
  }

  const blinking = ship.iframes > 0 && Math.sin(ship.iframes * 30) > 0;
  if (!blinking) drawSprite(SPRITES.ship, ship.x, ship.y, ship.angle);
  if (ship.shield.up) drawSprite(SPRITES.shield, ship.x, ship.y);

  for (const p of fx.particles) {
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.globalAlpha = 1;
  g.restore();

  drawHud(g, arena.w, run, ship);
  if (mode === 'upgrade') drawOffers(g, arena.w, arena.h, offers);
  if (mode === 'gameover') drawGameOver(g, arena.w, arena.h, run, best);
}

let last = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); // clamp: tab-switch can't teleport entities
  last = t;
  const snap = input.poll();

  if (mode === 'menu' && snap.clicked) { initAudio(); startRun(); }
  else if (mode === 'playing') tickPlaying(snap, dt);
  else if (mode === 'upgrade') tickUpgrade(snap);
  else if (mode === 'gameover' && (snap.clicked || snap.keyR)) startRun();

  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

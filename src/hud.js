// src/hud.js
// Browser-only HUD/menu/upgrade rendering. Never imported by tests.
// Imports `multiplier` from run.js (the only logic module it may touch) and
// SPRITES from the browser sprites module.
import { multiplier } from './run.js';
import { ROCKET } from './config.js';
import { SPRITES } from './sprites.js';

const FONT = 'monospace';
const INK = '#e8e6d8';
const DIM = '#8a879a';
const ACCENT = '#ffd75e';
const TAU = Math.PI * 2;

// Ship-paint families (v4): each maps to a pack hull family. Swatch hues are
// sampled to match the actual hulls. Slot order matches the v3 swatches
// (white→metalic, red, blue, green→greyblue, yellow→orange, purple) so returning
// players' muscle memory and legacy-hex migration line up.
const FAMILIES = [
  { key: 'metalic', hue: '#b8c4d8' },
  { key: 'red', hue: '#e0524a' },
  { key: 'blue', hue: '#5ea8ff' },
  { key: 'greyblue', hue: '#5f7a8c' },
  { key: 'orange', hue: '#f6960a' },
  { key: 'purple', hue: '#b07fe8' },
];

// ---------------------------------------------------------------- helpers ----
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function dot(g, color, x, y, r) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function wrapText(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = wd; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------------- HUD ------
// `rockets` (optional) is the rockets store { cooldown } — when present a rocket
// cooldown indicator is drawn beside the boost bar. Omitted until T7 wiring.
export function drawHud(g, w, run, ship, rockets = null) {
  const u = Math.max(12, Math.round(w / 90));
  const margin = Math.round(u * 0.9);
  g.textBaseline = 'top';
  g.textAlign = 'left';

  // Score + multiplier badge (top-left)
  g.font = `bold ${2 * u}px ${FONT}`;
  g.fillStyle = INK;
  const scoreStr = String(run.score);
  g.fillText(scoreStr, margin, margin);
  const mult = multiplier(run);
  if (mult > 1) {
    const sw = g.measureText(scoreStr).width;
    g.font = `bold ${Math.round(1.2 * u)}px ${FONT}`;
    const badge = `x${mult}`;
    const bw = g.measureText(badge).width + u * 0.8;
    const bh = 1.6 * u;
    const bx = margin + sw + Math.round(u * 0.6);
    const by = margin + Math.round(u * 0.25);
    g.fillStyle = ACCENT;
    roundRect(g, bx, by, bw, bh, u * 0.35);
    g.fill();
    g.fillStyle = '#0b0b12';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(badge, bx + bw / 2, by + bh / 2);
    g.textAlign = 'left';
    g.textBaseline = 'top';
  }

  // Wave (top-center)
  g.font = `${Math.round(1.5 * u)}px ${FONT}`;
  g.fillStyle = DIM;
  g.textAlign = 'center';
  g.fillText(`WAVE ${run.wave}`, w / 2, margin);
  g.textAlign = 'left';

  // Hearts (top-right)
  const rightX = w - margin;
  if (SPRITES.heart) {
    const heartH = Math.round(1.6 * u);
    const hs = SPRITES.heart;
    const heartW = Math.round(heartH * (hs.width / hs.height));
    const gap = Math.round(u * 0.25);
    const step = heartW + gap;
    for (let i = 0; i < ship.maxHp; i++) {
      const x = rightX - (ship.maxHp - i) * step;
      const spr = i < ship.hp ? SPRITES.heart : SPRITES.heartEmpty;
      g.drawImage(spr, x, margin, heartW, heartH);
    }
    // Shield heart to the left of the hearts row when owned
    if (ship.shield.owned && SPRITES.shieldHeart) {
      const x = rightX - ship.maxHp * step - step - Math.round(u * 0.3);
      g.globalAlpha = ship.shield.up ? 1 : 0.35;
      g.drawImage(SPRITES.shieldHeart, x, margin, heartW, heartH);
      g.globalAlpha = 1;
    }

    // Under-hearts stack (all right-aligned to the hearts row):
    //   1) heart-progress mini-bar (red, fraction toward the next heart)
    //   2) boost bar (cyan, one segment per unit, shows the meter fraction)
    // A rocket cooldown indicator sits to the left of the boost bar.
    const barLeft = rightX - ship.maxHp * step;
    const barRight = rightX - gap;      // right edge of the last heart
    const barW = Math.max(1, barRight - barLeft);

    // 1) heart-progress mini-bar
    const hpH = Math.max(3, Math.round(u * 0.28));
    const hpY = margin + heartH + Math.round(u * 0.2);
    const hpFrac = Math.max(0, Math.min(1, run.heartProgress || 0));
    g.fillStyle = '#2a1216';
    g.fillRect(barLeft, hpY, barW, hpH);
    g.fillStyle = '#e0362f';
    g.fillRect(barLeft, hpY, Math.round(barW * hpFrac), hpH);
    g.strokeStyle = 'rgba(224,82,74,0.5)';
    g.lineWidth = 1;
    g.strokeRect(barLeft + 0.5, hpY + 0.5, barW - 1, hpH - 1);

    // 2) boost bar
    const bH = Math.max(6, Math.round(u * 0.6));
    const bY = hpY + hpH + Math.round(u * 0.22);
    if (ship.boost) drawBoostBar(g, barLeft, bY, barW, bH, ship.boost);

    // Rocket cooldown indicator, left of the boost bar.
    if (rockets) {
      const rs = Math.round(bH * 1.7);
      const rcx = barLeft - Math.round(u * 0.5) - rs / 2;
      const rcy = bY + bH / 2;
      const cd = Math.max(0, rockets.cooldown || 0);
      drawRocketCooldown(g, rcx, rcy, rs, cd);
    }
  }
  g.textAlign = 'left';
}

// Boost bar: dark track split into `units` segments, cyan fill shows the meter
// (each unit = 100%). meter ∈ [0, units]; a partly-charged unit fills partially.
function drawBoostBar(g, x, y, w, h, boost) {
  const units = Math.max(1, boost.units | 0);
  const segGap = 2;
  const segW = (w - segGap * (units - 1)) / units;
  for (let i = 0; i < units; i++) {
    const sx = x + i * (segW + segGap);
    g.fillStyle = '#0c2a30';                 // dark track
    g.fillRect(sx, y, segW, h);
    const f = Math.max(0, Math.min(1, (boost.meter || 0) - i));
    if (f > 0) {
      g.fillStyle = '#3ecfe6';               // cyan fill
      g.fillRect(sx, y, segW * f, h);
    }
    g.strokeStyle = 'rgba(94,208,230,0.55)'; // thin border
    g.lineWidth = 1;
    g.strokeRect(sx + 0.5, y + 0.5, segW - 1, h - 1);
  }
}

// Rocket cooldown indicator: the missile sprite (nose up) at full alpha when
// ready, dimmed while cooling with a radial sweep that fills as it recharges.
function drawRocketCooldown(g, cx, cy, size, cooldown) {
  const ready = cooldown <= 0;
  const frac = Math.max(0, Math.min(1, 1 - cooldown / ROCKET.cooldown)); // 0→1 = cooling→ready
  // Cooling sweep ring underneath the icon.
  if (!ready) {
    g.strokeStyle = 'rgba(94,208,230,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, size * 0.62, 0, TAU);
    g.stroke();
    g.strokeStyle = '#3ecfe6';
    g.beginPath();
    g.arc(cx, cy, size * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    g.stroke();
  }
  const spr = SPRITES.rocket;
  const img = Array.isArray(spr) ? spr[0] : spr;
  if (img) {
    const nat = Math.max(img.width, img.height) || 1;
    const s = size / nat;
    const iw = img.width * s, ih = img.height * s;
    g.save();
    g.globalAlpha = ready ? 1 : 0.35;
    g.imageSmoothingEnabled = false;
    g.translate(cx, cy);
    g.rotate(-Math.PI / 2); // sprite faces +x; point it up in the HUD
    g.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    g.restore();
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------- FIELD RING ------
// Faint cyan ring at the gem-magnet radius around the ship so the pull zone is
// visible (spec C). ~0.08 alpha with a gentle pulse driven by the `t` clock.
export function drawFieldRing(g, ship, radius, t = 0) {
  const pulse = 1 + Math.sin(t * 1.6) * 0.02;
  g.save();
  g.globalAlpha = 0.08 + 0.02 * (Math.sin(t * 1.6) * 0.5 + 0.5);
  g.strokeStyle = '#5fe8ff';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(ship.x, ship.y, radius * pulse, 0, TAU);
  g.stroke();
  g.restore();
  g.globalAlpha = 1;
}

// ----------------------------------------------------------------- BOSS BAR ---
// Top-center under the wave label. ~34% screen width, red fill over a dark
// track with a thin border. Visibility is the caller's call (only draw while a
// boss is alive). Fraction guarded against a zero maxHp.
export function drawBossBar(g, w, boss) {
  const u = Math.max(12, Math.round(w / 90));
  const margin = Math.round(u * 0.9);
  const bw = Math.round(w * 0.34);
  const bh = Math.round(u * 0.85);
  const bx = Math.round((w - bw) / 2);
  const by = margin + Math.round(u * 2.3); // clears the wave label above
  const frac = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
  g.fillStyle = '#1a0f16';                 // dark track
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#e0362f';                 // red fill
  g.fillRect(bx, by, Math.round(bw * frac), bh);
  g.strokeStyle = 'rgba(232,230,216,0.55)'; // thin border
  g.lineWidth = 1;
  g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
}

// ------------------------------------------------------------------- PAUSE -----
export function drawPause(g, w, h) {
  const u = Math.max(12, Math.round(w / 90));
  g.fillStyle = 'rgba(11, 11, 18, 0.55)'; // dim overlay
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold ${Math.round(2 * u)}px ${FONT}`;
  g.fillText('PAUSED — Esc/P to resume', w / 2, h / 2);
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

// -------------------------------------------------------------- PAINT PICKER --
// Single source of swatch geometry — used for drawing and click hit-testing.
export function paintRects(w, h) {
  const u = Math.max(12, Math.round(w / 90));
  const sw = Math.max(36, Math.round(u * 2.6));
  const gap = Math.round(sw * 0.45);
  const total = FAMILIES.length * sw + (FAMILIES.length - 1) * gap;
  const x0 = (w - total) / 2;
  const y = Math.round(h * 0.8);
  // `family` is the persisted paint value; `hue` is the swatch colour.
  return FAMILIES.map((f, i) => ({ x: x0 + i * (sw + gap), y, w: sw, h: sw, family: f.key, hue: f.hue }));
}

function drawPicker(g, w, h, paint) {
  const u = Math.max(12, Math.round(w / 90));
  const rects = paintRects(w, h);
  // Selected-ship preview, ~3× native, centred above the swatch row.
  if (SPRITES.shipPreview) {
    const spr = SPRITES.shipPreview;
    const scale = 3;
    const pw = spr.width * scale;
    const ph = spr.height * scale;
    const px = w / 2 - pw / 2;
    const py = rects[0].y - Math.round(u * 1.6) - ph;
    g.imageSmoothingEnabled = false;
    g.drawImage(spr, px, py, pw, ph);
  }
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.font = `${u}px ${FONT}`;
  g.fillStyle = DIM;
  g.fillText('CHOOSE YOUR SHIP', w / 2, rects[0].y - Math.round(u * 0.6));
  for (const r of rects) {
    g.fillStyle = r.hue;
    g.fillRect(r.x, r.y, r.w, r.h);
    if (r.family === paint) {
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1;
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
  }
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

// ------------------------------------------------------------------ MENU ------
export function drawMenu(g, w, h, best, paint = 'metalic', board = []) {
  const u = Math.max(12, Math.round(w / 90));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold 42px ${FONT}`;
  g.fillText('UNTITLED SPACE SHOOTER', w / 2, h * 0.28);
  g.font = `16px ${FONT}`;
  g.fillStyle = DIM;
  g.fillText('W thrust · aim with mouse · hold SPACE boost · right-click rocket', w / 2, h * 0.42);
  g.fillText('hold mouse: auto-fire (spray) · tap mouse: precise shots', w / 2, h * 0.47);
  if (best > 0) {
    g.fillStyle = ACCENT;
    g.fillText(`BEST ${best}`, w / 2, h * 0.55);
  }
  // Top-3 leaderboard, small, under best.
  if (board && board.length) {
    g.font = `${Math.round(1.05 * u)}px ${FONT}`;
    g.fillStyle = DIM;
    board.slice(0, 3).forEach((e, i) => {
      g.fillText(`${i + 1}.  ${e.score}  ·  wave ${e.wave}`, w / 2, h * 0.60 + i * Math.round(1.6 * u));
    });
  }
  drawPicker(g, w, h, paint);
  // Start prompt sits BELOW the swatch row: the ~3× ship preview above the
  // swatches occupies the old h*0.72 band and would strike the text through.
  const swatch = paintRects(w, h)[0];
  g.fillStyle = INK;
  g.font = `16px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('— click to start —', w / 2, swatch.y + swatch.h + Math.round(u * 1.8));
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

// -------------------------------------------------------------- GAME OVER -----
export function drawGameOver(g, w, h, run, best, paint = 'metalic', board = [], placedIdx = -1) {
  const u = Math.max(12, Math.round(w / 90));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e6743e';
  g.font = `bold 36px ${FONT}`;
  g.fillText('SHIP DESTROYED', w / 2, h * 0.15);
  g.fillStyle = INK;
  g.font = `20px ${FONT}`;
  g.fillText(`score ${run.score}   ·   wave ${run.wave}`, w / 2, h * 0.23);
  g.fillStyle = run.score >= best ? ACCENT : DIM;
  g.fillText(run.score >= best ? 'NEW BEST!' : `best ${best}`, w / 2, h * 0.29);

  // Two panels: run stats (left) + leaderboard (right).
  const st = run.stats || {};
  // Clamp: pierce can register more hits than shots fired, pushing raw accuracy
  // past 100%.
  const acc = st.shotsFired > 0 ? Math.min(100, Math.round((st.shotsHit / st.shotsFired) * 100)) : 0;
  const secs = Math.floor(st.runTime || 0);
  const timeStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const statLines = [
    ['kills', st.kills || 0],
    ['accuracy', `${acc}%`],
    ['waves', run.wave],
    ['gems', st.gemsCollected || 0],
    ['boost', `${(st.boostTime || 0).toFixed(1)}s`],
    ['boss kills', st.bossKills || 0],
    ['time', timeStr],
  ];

  const panelTop = Math.round(h * 0.4);
  const lineH = Math.round(u * 1.6);
  const colW = Math.round(u * 12);
  const gap = Math.round(u * 3);
  const leftX = Math.round(w / 2 - gap / 2 - colW);
  const rightX = Math.round(w / 2 + gap / 2);
  const rowY = (i) => panelTop + Math.round(u * 1.9) + i * lineH;

  g.textBaseline = 'middle';
  // Left: RUN STATS
  g.textAlign = 'left';
  g.fillStyle = ACCENT;
  g.font = `bold ${Math.round(1.1 * u)}px ${FONT}`;
  g.fillText('RUN STATS', leftX, panelTop);
  g.font = `${Math.round(1.05 * u)}px ${FONT}`;
  statLines.forEach(([label, val], i) => {
    const y = rowY(i);
    g.textAlign = 'left';
    g.fillStyle = DIM;
    g.fillText(label, leftX, y);
    g.textAlign = 'right';
    g.fillStyle = INK;
    g.fillText(String(val), leftX + colW, y);
  });

  // Right: LEADERBOARD (top 5), placed run highlighted.
  g.textAlign = 'left';
  g.fillStyle = ACCENT;
  g.font = `bold ${Math.round(1.1 * u)}px ${FONT}`;
  g.fillText('LEADERBOARD', rightX, panelTop);
  g.font = `${Math.round(1.05 * u)}px ${FONT}`;
  if (!board || board.length === 0) {
    g.fillStyle = DIM;
    g.fillText('no runs yet', rightX, rowY(0));
  } else {
    board.slice(0, 5).forEach((e, i) => {
      const y = rowY(i);
      const hot = i === placedIdx;
      g.textAlign = 'left';
      g.fillStyle = hot ? ACCENT : (i === 0 ? INK : DIM);
      g.fillText(`${i + 1}.  ${e.score}`, rightX, y);
      g.textAlign = 'right';
      g.fillStyle = hot ? ACCENT : DIM;
      g.fillText(`wave ${e.wave}`, rightX + colW, y);
    });
  }

  drawPicker(g, w, h, paint);
  // Prompt below the swatch row — the ship preview above the swatches covers the
  // old h*0.72 band (same reason as the menu).
  const swatch = paintRects(w, h)[0];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = DIM;
  g.font = `16px ${FONT}`;
  g.fillText('click or press R to fly again', w / 2, swatch.y + swatch.h + Math.round(u * 1.8));
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

// -------------------------------------------------------------- UPGRADES ------
// Single source of card geometry (drawing + click hit-testing). Up to 3 across,
// each card min(30% of width, 380px).
export function offerRects(w, h) {
  const cw = Math.min(w * 0.3, 380);
  const ch = Math.min(h * 0.6, cw * 1.15);
  const gap = Math.round(cw * 0.1);
  const total = cw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y = (h - ch) / 2;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}

export function drawOffers(g, w, h, offers, t = 0) {
  const u = Math.max(12, Math.round(w / 90));
  g.fillStyle = 'rgba(11, 11, 18, 0.82)';
  g.fillRect(0, 0, w, h);
  const rects = offerRects(w, h);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold ${Math.round(1.8 * u)}px ${FONT}`;
  g.fillText('WAVE CLEAR — CHOOSE AN UPGRADE', w / 2, rects[0].y - Math.round(u * 1.6));

  offers.forEach((up, i) => {
    const r = rects[i];
    const pad = Math.round(r.w * 0.07);

    // card body + accent border
    g.fillStyle = '#16141f';
    roundRect(g, r.x, r.y, r.w, r.h, Math.round(u * 0.4));
    g.fill();
    g.strokeStyle = ACCENT;
    g.lineWidth = 2;
    roundRect(g, r.x, r.y, r.w, r.h, Math.round(u * 0.4));
    g.stroke();

    // [1/2/3] tag, top-left
    g.fillStyle = DIM;
    g.font = `${Math.round(1.1 * u)}px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(`[${i + 1}]`, r.x + pad, r.y + pad);

    // icon (SPRITES.icons[id]), centered
    const iconSize = Math.round(r.w * 0.22);
    const iconX = r.x + r.w / 2 - iconSize / 2;
    const iconY = r.y + pad + Math.round(u * 0.4);
    const icon = SPRITES.icons && SPRITES.icons[up.id];
    if (icon) g.drawImage(icon, iconX, iconY, iconSize, iconSize);

    // name
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.font = `bold ${Math.round(1.35 * u)}px ${FONT}`;
    const nameY = iconY + iconSize + Math.round(u * 0.5);
    g.fillText(up.name, r.x + r.w / 2, nameY);

    // desc (wrapped)
    g.fillStyle = DIM;
    g.font = `${Math.round(0.95 * u)}px ${FONT}`;
    const descY = nameY + Math.round(1.5 * u);
    const lines = wrapText(g, up.desc, r.w - 2 * pad);
    lines.forEach((ln, k) => {
      g.fillText(ln, r.x + r.w / 2, descY + k * Math.round(1.2 * u));
    });

    // preview vignette strip (bottom)
    const stripH = Math.round(r.h * 0.24);
    const strip = { x: r.x + pad, y: r.y + r.h - pad - stripH, w: r.w - 2 * pad, h: stripH };
    drawUpgradePreview(g, up.id, strip, t);
  });

  g.textAlign = 'left';
  g.textBaseline = 'top';
}

// --------------------------------------------------------- UPGRADE PREVIEWS ---
// Micro-demo per upgrade id, animated by the `t` clock. Clipped to `rect`.
export function drawUpgradePreview(g, id, rect, t = 0) {
  g.save();
  g.fillStyle = '#0d0d16';
  g.fillRect(rect.x, rect.y, rect.w, rect.h);
  g.beginPath();
  g.rect(rect.x, rect.y, rect.w, rect.h);
  g.clip();
  (PREVIEWS[id] || previewDefault)(g, rect, t);
  g.restore();
  g.strokeStyle = '#2a2836';
  g.lineWidth = 1;
  g.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
}

function previewSpread(g, r, t) {
  const cy = r.y + r.h / 2;
  const p = (t * 0.9) % 1;
  dot(g, '#fffbe6', r.x + 5, cy, Math.max(2, r.h * 0.07));
  for (const k of [-2, -1, 0, 1, 2]) {
    const x = r.x + 5 + p * (r.w - 10);
    const y = cy + k * (r.h * 0.18) * p;
    g.globalAlpha = 1 - p * 0.4;
    dot(g, '#ffd75e', x, y, Math.max(1.5, r.h * 0.06));
  }
  g.globalAlpha = 1;
}

function previewRicochet(g, r, t) {
  const wl = r.x + 5, wr = r.x + r.w - 5, cy = r.y + r.h / 2;
  g.strokeStyle = '#5a5560';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(wl, r.y + 3); g.lineTo(wl, r.y + r.h - 3); g.stroke();
  g.beginPath(); g.moveTo(wr, r.y + 3); g.lineTo(wr, r.y + r.h - 3); g.stroke();
  const s = (t * 0.7) % 1;
  const tri = s < 0.5 ? s * 2 : 2 - 2 * s;
  const x = wl + (wr - wl) * tri;
  const y = cy + Math.sin(t * 5) * r.h * 0.22;
  dot(g, '#7fe8ff', x, y, Math.max(2, r.h * 0.08));
}

function previewCrit(g, r, t) {
  // rolling white numbers scrolling up on the left
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.8 + k / 3) % 1;
    const yy = r.y + r.h - p * r.h;
    g.globalAlpha = Math.sin(p * Math.PI);
    g.fillStyle = INK;
    g.font = `${Math.round(r.h * 0.3)}px ${FONT}`;
    const n = ((k * 3 + Math.floor(t)) % 9) + 1;
    g.fillText(String(n), r.x + r.w * 0.32, yy);
  }
  g.globalAlpha = 1;
  // periodic yellow crit pop on the right
  const cyc = t % 1.6;
  if (cyc < 0.6) {
    const s = cyc / 0.6;
    g.globalAlpha = 1 - s;
    g.fillStyle = ACCENT;
    g.font = `bold ${Math.round(r.h * 0.42 * (1 + s * 0.5))}px ${FONT}`;
    g.fillText('!', r.x + r.w * 0.72, r.y + r.h / 2 - s * r.h * 0.2);
    g.globalAlpha = 1;
  }
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

function previewHeart(g, r, t) {
  const size = Math.min(r.w, r.h) * 0.72;
  const hx = r.x + r.w / 2 - size / 2;
  const hy = r.y + r.h / 2 - size / 2;
  const fill = Math.sin(t * 2) * 0.5 + 0.5;
  if (SPRITES.heartEmpty && SPRITES.heart) {
    g.drawImage(SPRITES.heartEmpty, hx, hy, size, size);
    g.save();
    const fh = size * fill;
    g.beginPath();
    g.rect(hx, hy + size - fh, size, fh);
    g.clip();
    g.drawImage(SPRITES.heart, hx, hy, size, size);
    g.restore();
  } else {
    dot(g, '#e0524a', r.x + r.w / 2, r.y + r.h / 2, size * 0.4 * fill);
  }
}

// Boost Tank: a cyan afterimage streak (a boosting ship's trail).
function previewBoost(g, r, t) {
  const cy = r.y + r.h / 2;
  const p = (t * 0.8) % 1;
  const x = r.x + 6 + p * (r.w - 12);
  for (let k = 0; k < 4; k++) {
    g.globalAlpha = (1 - k * 0.28) * 0.9;
    dot(g, '#3ecfe6', x - k * (r.w * 0.06), cy, Math.max(1.5, r.h * 0.08));
  }
  g.globalAlpha = 1;
}

// Attractor: gems spiralling inward to the ship, with a faint pull ring.
function previewAttractor(g, r, t) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const ring = Math.min(r.w, r.h) * 0.42;
  g.globalAlpha = 0.35;
  g.strokeStyle = '#5fe8ff';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, ring, 0, TAU); g.stroke();
  g.globalAlpha = 1;
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.6 + k / 4) % 1;      // 1 → 0 as it's pulled in
    const rad = ring * (1 - p);
    const ang = k * (TAU / 4) + t * 1.2;
    g.globalAlpha = 0.4 + 0.6 * p;
    dot(g, '#5fe8ff', cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, Math.max(1.5, r.h * 0.07));
  }
  g.globalAlpha = 1;
  dot(g, '#e8fdff', cx, cy, Math.max(2, r.h * 0.08));
}

function previewStreaks(g, r, t) {
  g.strokeStyle = '#7fe8ff';
  g.lineWidth = Math.max(1, r.h * 0.05);
  for (let i = 0; i < 5; i++) {
    const yy = r.y + (i + 0.5) * r.h / 5;
    const p = (t * 1.5 + i * 0.37) % 1;
    const x0 = r.x + p * r.w - r.w * 0.3;
    g.globalAlpha = 0.4 + 0.5 * Math.sin(p * Math.PI);
    g.beginPath();
    g.moveTo(x0, yy);
    g.lineTo(x0 + r.w * 0.25, yy);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function previewAegis(g, r, t) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const base = Math.min(r.w, r.h) * 0.28;
  const rr = base + Math.sin(t * 3) * base * 0.18;
  g.strokeStyle = '#5ea8ff';
  g.lineWidth = Math.max(1.5, r.h * 0.06);
  g.globalAlpha = 0.9;
  g.beginPath();
  g.arc(cx, cy, rr, 0, TAU);
  g.stroke();
  g.globalAlpha = 1;
  dot(g, '#e8fdff', cx, cy, Math.max(2, r.h * 0.09));
}

function previewPierce(g, r, t) {
  const cy = r.y + r.h / 2;
  const p = (t * 0.6) % 1;
  const bx = r.x + 4 + p * (r.w - 8);
  for (const d of [0.4, 0.6, 0.8]) {
    const dx = r.x + r.w * d;
    dot(g, bx > dx ? '#5a5560' : '#e0524a', dx, cy, Math.max(2, r.h * 0.09));
  }
  g.strokeStyle = '#7fe8ff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(r.x + 4, cy);
  g.lineTo(bx, cy);
  g.stroke();
  dot(g, '#e8fdff', bx, cy, Math.max(2, r.h * 0.06));
}

function previewRapid(g, r, t) {
  const cy = r.y + r.h / 2;
  for (let i = 0; i < 6; i++) {
    const p = (t * 2.2 + i / 6) % 1;
    const x = r.x + 5 + p * (r.w - 10);
    g.globalAlpha = 1 - p;
    dot(g, '#ffd75e', x, cy, Math.max(1.5, r.h * 0.06));
  }
  g.globalAlpha = 1;
  dot(g, '#fffbe6', r.x + 5, cy, Math.max(2, r.h * 0.06));
}

function previewHeavy(g, r, t) {
  const cy = r.y + r.h / 2;
  const p = (t * 0.5) % 1;
  const x = r.x + r.h * 0.4 + p * (r.w - r.h * 0.8);
  const rr = r.h * 0.3 + Math.sin(t * 3) * r.h * 0.04;
  dot(g, '#ff9e3e', x, cy, rr);
  dot(g, '#c2452e', x, cy, rr * 0.5);
}

function previewDefault(g, r, t) {
  const rr = Math.min(r.w, r.h) * 0.2 * (1 + Math.sin(t * 3) * 0.15);
  dot(g, ACCENT, r.x + r.w / 2, r.y + r.h / 2, rr);
}

const PREVIEWS = {
  spread: previewSpread,
  ricochet: previewRicochet,
  deadeye: previewCrit,
  executioner: previewCrit,
  hull: previewHeart,
  secondwind: previewHeart,
  boosttank: previewBoost,
  attractor: previewAttractor,
  velocity: previewStreaks,
  engine: previewStreaks,
  overclock: previewStreaks,
  aegis: previewAegis,
  pierce: previewPierce,
  rapid: previewRapid,
  heavy: previewHeavy,
};

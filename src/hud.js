// src/hud.js
import { multiplier } from './run.js';

const FONT = 'monospace';
const INK = '#e8e6d8';
const DIM = '#8a879a';
const ACCENT = '#ffd75e';

export function drawHud(g, w, run, ship) {
  g.textBaseline = 'top';
  g.font = `16px ${FONT}`;
  g.fillStyle = INK;
  g.textAlign = 'left';
  g.fillText(`SCORE ${run.score}`, 16, 14);
  const mult = multiplier(run);
  if (mult > 1) {
    g.fillStyle = ACCENT;
    g.fillText(`x${mult}`, 16 + g.measureText(`SCORE ${run.score} `).width, 14);
  }
  g.fillStyle = DIM;
  g.textAlign = 'center';
  g.fillText(`WAVE ${run.wave}`, w / 2, 14);
  // HP pips right-aligned
  for (let i = 0; i < ship.maxHp; i++) {
    g.fillStyle = i < ship.hp ? '#e6743e' : '#3a3745';
    g.fillRect(w - 16 - (ship.maxHp - i) * 18, 14, 12, 12);
  }
  if (ship.shield.owned) {
    g.fillStyle = ship.shield.up ? '#5ea8ff' : '#3a3745';
    g.fillRect(w - 16 - (ship.maxHp + 1) * 18 - 6, 14, 12, 12);
  }
  g.textAlign = 'left';
}

export function drawMenu(g, w, h, best) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold 42px ${FONT}`;
  g.fillText('UNTITLED SPACE SHOOTER', w / 2, h * 0.32);
  g.font = `16px ${FONT}`;
  g.fillStyle = DIM;
  g.fillText('A/D or ←/→ rotate · W or ↑ thrust', w / 2, h * 0.48);
  g.fillText('hold mouse: auto-fire (spray) · tap mouse: precise shots', w / 2, h * 0.53);
  if (best > 0) {
    g.fillStyle = ACCENT;
    g.fillText(`BEST ${best}`, w / 2, h * 0.62);
  }
  g.fillStyle = INK;
  g.fillText('— click to start —', w / 2, h * 0.72);
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

export function drawGameOver(g, w, h, run, best) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e6743e';
  g.font = `bold 36px ${FONT}`;
  g.fillText('SHIP DESTROYED', w / 2, h * 0.34);
  g.fillStyle = INK;
  g.font = `20px ${FONT}`;
  g.fillText(`score ${run.score}   ·   wave ${run.wave}`, w / 2, h * 0.46);
  g.fillStyle = run.score >= best ? ACCENT : DIM;
  g.fillText(run.score >= best ? 'NEW BEST!' : `best ${best}`, w / 2, h * 0.53);
  g.fillStyle = DIM;
  g.font = `16px ${FONT}`;
  g.fillText('click or press R to fly again', w / 2, h * 0.66);
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

export function offerRects(w, h) {
  const cw = 220, ch = 150, gap = 30;
  const total = cw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y = (h - ch) / 2;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}

export function drawOffers(g, w, h, offers) {
  g.fillStyle = 'rgba(11, 11, 18, 0.75)';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.font = `bold 24px ${FONT}`;
  g.fillText('WAVE CLEAR — CHOOSE AN UPGRADE', w / 2, h / 2 - 130);
  const rects = offerRects(w, h);
  offers.forEach((u, i) => {
    const r = rects[i];
    g.fillStyle = '#16141f';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = ACCENT;
    g.lineWidth = 2;
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.fillStyle = DIM;
    g.font = `14px ${FONT}`;
    g.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 26);
    g.fillStyle = INK;
    g.font = `bold 18px ${FONT}`;
    g.fillText(u.name, r.x + r.w / 2, r.y + 62);
    g.fillStyle = DIM;
    g.font = `14px ${FONT}`;
    g.fillText(u.desc, r.x + r.w / 2, r.y + 96);
  });
  g.textAlign = 'left';
  g.textBaseline = 'top';
}

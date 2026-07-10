// src/main.js — TEMPORARY gallery (Task 12 rewrites this file entirely)
import { initSprites, SPRITES } from './sprites.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  g.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

initSprites();

function frame() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  let x = 40;
  for (const [name, spr] of Object.entries(SPRITES)) {
    g.drawImage(spr, x, 60);
    g.fillStyle = '#e8e6d8';
    g.font = '12px monospace';
    g.fillText(name, x, 50);
    x += spr.width + 40;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

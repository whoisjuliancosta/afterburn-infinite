// src/main.js — stub, replaced in Task 12
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  g.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

function frame() {
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#e8e6d8';
  g.font = '16px monospace';
  g.fillText('scaffold ok', 20, 30);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

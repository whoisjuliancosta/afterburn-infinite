// src/audio.js
let ctx = null;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
}

function blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur, vol = 0.2) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(gain).connect(ctx.destination);
  src.start(t);
}

export function sfxShot()      { blip(880, 0.07, 'square', 0.05, 220); }
// Boost start: a soft rising whoosh — a low sine sweeping up under a short airy
// noise wash. Quiet so it can fire on every boost tap without fatiguing.
export function sfxBoost() {
  blip(180, 0.30, 'sine', 0.07, 540);
  noise(0.22, 0.06);
}
// Rocket launch: a deep whoosh-boom — a longer noise body over a low sawtooth
// sweeping down, punchier than an explosion.
export function sfxRocket() {
  noise(0.35, 0.18);
  blip(160, 0.34, 'sawtooth', 0.16, 46);
  setTimeout(() => blip(90, 0.26, 'sawtooth', 0.14, 30), 60);
}
export function sfxExplosion() { noise(0.25, 0.25); blip(140, 0.2, 'sawtooth', 0.1, 40); }
export function sfxHit()       { noise(0.35, 0.3); blip(90, 0.35, 'sawtooth', 0.18, 30); }
export function sfxChime()     { blip(523, 0.12, 'triangle', 0.15); setTimeout(() => blip(784, 0.2, 'triangle', 0.15), 90); }
export function sfxWave()      { blip(330, 0.1, 'triangle', 0.12); setTimeout(() => blip(440, 0.15, 'triangle', 0.12), 100); }
export function sfxGem()        { blip(1245, 0.05, 'triangle', 0.045, 1660); } // short high quiet blip
export function sfxBossDown() { // descending 3-note dirge
  blip(660, 0.18, 'sawtooth', 0.16, 480);
  setTimeout(() => blip(440, 0.22, 'sawtooth', 0.16, 300), 150);
  setTimeout(() => blip(220, 0.4, 'sawtooth', 0.16, 80), 330);
}

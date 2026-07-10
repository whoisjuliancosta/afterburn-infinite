// src/particles.js
import { TAU } from './utils.js';

export function createFx() {
  return { particles: [], shake: 0, pause: 0 };
}

export function burst(fx, x, y, color, n, rng, speed = 160, glow = false) {
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const s = speed * (0.3 + rng() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.3 + rng() * 0.4, t: 0, color, glow,
    });
  }
}

export function addShake(fx, mag) {
  fx.shake = Math.max(fx.shake, mag);
}

export function addPause(fx, seconds) {
  fx.pause = Math.max(fx.pause, seconds);
}

export function updateFx(fx, dt) {
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.pause = Math.max(0, fx.pause - dt);
  for (const p of fx.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  fx.particles = fx.particles.filter(p => p.t < p.life);
}

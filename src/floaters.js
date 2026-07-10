// src/floaters.js
// Floating text: damage numbers, crit pops, combo streak popups, info banners.

const RISE = 30; // px/s upward drift
const MAX_LIVE = 40;
const LIFETIME = { dmg: 0.7, crit: 0.7, combo: 1.2, info: 1.2, gem: 0.9 };

export function createFloaters() {
  return { list: [] };
}

export function addFloater(f, x, y, text, kind) {
  const life = LIFETIME[kind] ?? 0.7;
  f.list.push({ x, y, text, kind, life, t: 0 });
  if (f.list.length > MAX_LIVE) f.list.shift(); // drop oldest
}

export function updateFloaters(f, dt) {
  for (const fl of f.list) {
    fl.t += dt;
    fl.y -= RISE * dt;
  }
  f.list = f.list.filter(fl => fl.t < fl.life);
}

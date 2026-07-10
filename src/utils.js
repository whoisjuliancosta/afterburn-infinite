export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Signed shortest rotation from angle a to angle b, in (-PI, PI].
export const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Deterministic LCG so game logic is testable with a fixed seed.
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const BEST_KEY = 'np-shooter-best';

export function loadBest() {
  try { return Number(globalThis.localStorage?.getItem(BEST_KEY)) || 0; }
  catch { return 0; }
}

export function saveBest(score) {
  try { globalThis.localStorage?.setItem(BEST_KEY, String(score)); }
  catch { /* private mode: session-only best */ }
}

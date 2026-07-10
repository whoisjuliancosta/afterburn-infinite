// src/waves.js
import { ENEMIES, WAVE } from './config.js';

const BUYABLE = ['drifter', 'darter', 'splitter'];

export function waveBudget(wave) {
  return WAVE.baseBudget + WAVE.budgetPerWave * (wave - 1);
}

export function buildWave(wave, rng) {
  let budget = waveBudget(wave);
  const types = [];
  while (budget > 0) {
    const affordable = BUYABLE.filter(t => ENEMIES[t].cost <= budget);
    const type = affordable[Math.floor(rng() * affordable.length)];
    types.push(type);
    budget -= ENEMIES[type].cost;
  }
  return types;
}

export function scheduleWave(types, rng, arena) {
  return types
    .map((type, i) => {
      const { x, y } = edgePoint(Math.floor(rng() * 4), rng(), arena);
      return { at: i * WAVE.spawnInterval + rng() * 0.4, type, x, y };
    })
    .sort((a, b) => a.at - b.at);
}

function edgePoint(edge, t, arena) {
  const m = 20; // inset so telegraphs are fully visible
  if (edge === 0) return { x: t * arena.w, y: m };
  if (edge === 1) return { x: arena.w - m, y: t * arena.h };
  if (edge === 2) return { x: t * arena.w, y: arena.h - m };
  return { x: m, y: t * arena.h };
}

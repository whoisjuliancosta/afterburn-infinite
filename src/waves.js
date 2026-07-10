// src/waves.js
import { ENEMIES, WAVE } from './config.js';

// Order matters only for filtering; unlock gating decides what is buyable per wave.
const BUYABLE = ['drifter', 'darter', 'spitter', 'splitter', 'orbiter', 'weaver'];

export function waveBudget(wave, power = 0) {
  return Math.round(
    WAVE.baseBudget +
    WAVE.budgetPerWave * (wave - 1) +
    WAVE.powerBudget * power +
    (wave > WAVE.lateStart ? WAVE.lateBudgetPerWave * (wave - WAVE.lateStart) : 0)
  );
}

export function spawnIntervalFor(wave) {
  return Math.max(
    WAVE.spawnIntervalFloor,
    WAVE.spawnInterval - WAVE.spawnIntervalStep * (wave - 1)
  );
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}

// Random budget purchase of unlock-gated buyable types. Cost-0 types are excluded
// explicitly so a free unit (e.g. the boss) can never enter and spin the loop.
function purchase(budget, wave, rng) {
  const unlocked = BUYABLE.filter(t => ENEMIES[t].unlock <= wave && ENEMIES[t].cost > 0);
  const types = [];
  while (budget > 0) {
    const affordable = unlocked.filter(t => ENEMIES[t].cost <= budget);
    if (affordable.length === 0) break;
    const type = affordable[Math.floor(rng() * affordable.length)];
    types.push(type);
    budget -= ENEMIES[type].cost;
  }
  return types;
}

export function buildWave(wave, rng, power = 0) {
  if (isBossWave(wave)) {
    const escort = purchase(Math.round(0.4 * waveBudget(wave, power)), wave, rng);
    return ['boss', ...escort];
  }
  return purchase(waveBudget(wave, power), wave, rng);
}

export function scheduleWave(types, rng, arena, wave = 1) {
  const interval = spawnIntervalFor(wave);
  return types
    .map((type, i) => {
      const { x, y } = edgePoint(Math.floor(rng() * 4), rng(), arena);
      return { at: i * interval + rng() * 0.4, type, x, y };
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

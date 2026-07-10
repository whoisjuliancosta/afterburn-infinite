// src/legend.js
// Pure-logic data layer for the Legend / paytable screen (spec v5.2 T5).
// Node-clean: no window/document/canvas/Date, no rng. Every stat is derived from
// the config's ENEMIES / GEMS tables — nothing is hand-copied, so a balance tweak
// in config.js flows straight into the legend.
import { ENEMIES, GEMS } from './config.js';

// The engine's damage model is flat: ALL enemy contact and ALL enemy shots deal
// exactly 1 heart (hitPlayer subtracts one hp). Stated once here, shown per-row.
export const CONTACT_DMG = 1;

// Behavior one-liners (the "what it does" of the paytable). Keyed by enemy type.
const BLURBS = {
  drifter:  'drifts straight at you',
  darter:   'lunges in dashes',
  splitter: 'splits into 2 minis on death',
  mini:     'fast and fragile',
  spitter:  'spits aimed volleys',
  orbiter:  'circles you and strafes',
  weaver:   'weaves a sine path',
};

// Human display names. Fallback to an upper-cased type if one is ever missing.
const NAMES = {
  drifter: 'DRIFTER', darter: 'DARTER', splitter: 'SPLITTER', mini: 'MINI',
  spitter: 'SPITTER', orbiter: 'ORBITER', weaver: 'WEAVER', boss: 'BOSS',
};

const nameOf = (type) => NAMES[type] || type.toUpperCase();

// One display row per non-boss enemy type, in config order. Stats mirror ENEMIES
// so they can never drift from the real values.
export function legendRows() {
  return Object.keys(ENEMIES)
    .filter(type => type !== 'boss')
    .map(type => {
      const def = ENEMIES[type];
      const row = {
        type,
        name: nameOf(type),
        blurb: BLURBS[type] || '',
        hp: def.hp,
        speed: def.speed,
        dmg: CONTACT_DMG,
        score: def.score,
        unlock: def.unlock,           // undefined for mini (never wave-spawned)
      };
      // Mini isn't unlocked by wave — it's spawned by splitters and the boss.
      if (row.unlock === undefined) row.note = 'spawned by splitters & the boss';
      return row;
    });
}

// The boss gets its own wide card: three phase blurbs plus cadence + drop notes.
export function bossRow() {
  const def = ENEMIES.boss;
  return {
    type: 'boss',
    name: nameOf('boss'),
    hp: def.hp,
    speed: def.speed,
    dmg: CONTACT_DMG,
    score: def.score,
    cadence: 'every 5th wave, scales each time',
    phases: [
      'P1 — aimed bursts',
      'P2 — bullet walls',
      'P3 — blink-teleports + spawns minis',
    ],
    drop: 'drops a gem ring + heals 1 ♥',
  };
}

// Pickup rows: percentages derived from GEMS so the legend and the live payout
// stay single-sourced (blue boost fill, red heart fill).
export function pickupRows() {
  const bluePct = Math.round(GEMS.boostFill * 100);
  const redPct = Math.round(GEMS.heartFill * 100);
  return [
    { kind: 'blue', name: 'BLUE GEM', effect: `+${bluePct}% boost` },
    { kind: 'red', name: 'RED GEM', effect: `+${redPct}% ♥ — overfill starts a new heart container` },
  ];
}

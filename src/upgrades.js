// src/upgrades.js
import { CAPS, BOOST } from './config.js';

const EPS = 1e-9;
const MAGNET_CAP = 1.45 ** 6; // Attractor: 6 stacks max
// v5.1 upgrade stack ceilings (own limits — not in the CAPS table).
const AOE_CAP = 1.4 ** 6;      // Big Payload: 6 stacks
const RELOAD_CAP = 0.75 ** 6; // Fast Reload: 6 stacks (floor multiplier)
const DRAIN_CAP = 0.75 ** 6;  // Efficient Burners: 6 stacks (floor multiplier)
const LUCK_CAP = 1.3 ** 6;     // Lucky Charm: 6 stacks

export const UPGRADES = [
  { id: 'rapid',    name: 'Rapid Fire',      desc: '+25% fire rate',           apply: s => { s.mods.fireRate *= 1.25; } },
  { id: 'heavy',    name: 'Heavy Rounds',    desc: '+1 bullet damage',         apply: s => { s.mods.damage += 1; } },
  { id: 'engine',   name: 'Engine Tune',     desc: '+20% thrust & max speed',  apply: s => { s.mods.engine *= 1.2; } },
  { id: 'hull',     name: 'Hull Plating',    desc: '+1 max HP, heal 1',        apply: s => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'pierce',   name: 'Piercing Shots',  desc: 'Bullets pierce +1 enemy',  apply: s => { s.mods.pierce += 1; } },
  { id: 'spread',   name: 'Spread Shot',     desc: '+2 side bullets on auto',  apply: s => { s.mods.spread += 1; } },
  { id: 'velocity', name: 'Velocity Rounds', desc: '+40% bullet speed/range',  apply: s => { s.mods.bulletSpeed *= 1.4; } },
  { id: 'aegis',    name: 'Aegis Shield',    desc: 'Blocks 1 hit, recharges',  apply: s => { s.shield.owned = true; s.shield.up = true; } },
  { id: 'deadeye',      name: 'Deadeye',        desc: '+8% crit chance',              apply: s => { s.mods.critChance += 0.08; } },
  { id: 'executioner',  name: 'Executioner',    desc: '+50% crit damage',             apply: s => { s.mods.critMult += 0.5; } },
  { id: 'boosttank',    name: 'Boost Tank',     desc: '+1 boost unit (6 stacks max)',
    apply: s => { s.boost.units = Math.min(BOOST.maxUnits, s.boost.units + 1); s.boost.stacks = (s.boost.stacks || 0) + 1; } },
  { id: 'attractor',    name: 'Attractor',      desc: '+45% gem pull radius (6 stacks max)',
    apply: s => { s.mods.magnet = (s.mods.magnet || 1) * 1.45; } },
  { id: 'ricochet',     name: 'Ricochet',       desc: 'Bullets bounce off walls +1',  apply: s => { s.mods.bounce += 1; } },
  { id: 'overclock',    name: 'Overclock',      desc: '+10% fire rate & bullet speed', apply: s => { s.mods.fireRate *= 1.1; s.mods.bulletSpeed *= 1.1; } },
  { id: 'secondwind',   name: 'Second Wind',    desc: 'Heal 2',                       apply: s => { s.hp = Math.min(s.maxHp, s.hp + 2); } },
  // v5.1 pool additions (15 → 21).
  { id: 'bigpayload',   name: 'Big Payload',    desc: '+40% rocket blast radius (6 stacks max)',
    apply: s => { s.mods.rocketAoe *= 1.4; } },
  { id: 'fastreload',   name: 'Fast Reload',    desc: '-25% rocket cooldown (6 stacks max)',
    apply: s => { s.mods.rocketReload *= 0.75; } },
  { id: 'burners',      name: 'Efficient Burners', desc: '-25% boost drain (6 stacks max)',
    apply: s => { s.mods.boostDrain *= 0.75; } },
  { id: 'lucky',        name: 'Lucky Charm',    desc: '+30% gem drop chance (6 stacks max)',
    apply: s => { s.mods.luck *= 1.3; } },
  { id: 'rearguard',    name: 'Rear Guard',     desc: '+1 backward bullet on auto (3 stacks max)',
    apply: s => { s.mods.rear = (s.mods.rear || 0) + 1; } },
  { id: 'adrenaline',   name: 'Adrenaline',     desc: 'Below half HP: +15% fire rate, +10% speed',
    apply: s => { s.mods.adrenaline = 1; } },
];

// True once an upgrade's target stat is maxed out and it should stop being offered.
function isExcluded(ship, id) {
  const atCap = (mod, cap) => ship.mods[mod] >= cap - EPS;
  switch (id) {
    case 'aegis':     return ship.shield.owned;
    case 'boosttank': return (ship.boost.stacks || 0) >= 6;
    case 'attractor': return (ship.mods.magnet || 1) >= MAGNET_CAP - EPS;
    case 'rapid':     return atCap('fireRate', CAPS.fireRate);
    case 'engine':    return atCap('engine', CAPS.engine);
    case 'velocity':  return atCap('bulletSpeed', CAPS.bulletSpeed);
    case 'pierce':    return atCap('pierce', CAPS.pierce);
    case 'spread':    return atCap('spread', CAPS.spread);
    case 'ricochet':  return atCap('bounce', CAPS.bounce);
    // Overclock touches both fireRate and bulletSpeed — only useless when both cap.
    case 'overclock': return atCap('fireRate', CAPS.fireRate) && atCap('bulletSpeed', CAPS.bulletSpeed);
    // v5.1 upgrades: each hides at its own 2-stack (or 1-stack) ceiling.
    case 'bigpayload': return (ship.mods.rocketAoe ?? 1) >= AOE_CAP - EPS;
    case 'fastreload': return (ship.mods.rocketReload ?? 1) <= RELOAD_CAP + EPS;
    case 'burners':    return (ship.mods.boostDrain ?? 1) <= DRAIN_CAP + EPS;
    case 'lucky':      return (ship.mods.luck ?? 1) >= LUCK_CAP - EPS;
    case 'rearguard':  return (ship.mods.rear || 0) >= 3;
    case 'adrenaline': return (ship.mods.adrenaline || 0) >= 1;
    default:          return false;
  }
}

export function rollOffers(ship, rng) {
  const avail = UPGRADES.filter(u => !isExcluded(ship, u.id));
  const offers = [];
  while (offers.length < 3 && avail.length > 0) {
    offers.push(avail.splice(Math.floor(rng() * avail.length), 1)[0]);
  }
  return offers;
}

// Clamp every capped mod to its ceiling (spec E). Each cap is independent.
function clampMods(ship) {
  const m = ship.mods;
  m.fireRate    = Math.min(m.fireRate, CAPS.fireRate);
  m.engine      = Math.min(m.engine, CAPS.engine);
  m.bulletSpeed = Math.min(m.bulletSpeed, CAPS.bulletSpeed);
  m.pierce      = Math.min(m.pierce, CAPS.pierce);
  m.spread      = Math.min(m.spread, CAPS.spread);
  m.bounce      = Math.min(m.bounce, CAPS.bounce);
}

export function applyUpgrade(ship, id) {
  UPGRADES.find(u => u.id === id).apply(ship);
  clampMods(ship);
}

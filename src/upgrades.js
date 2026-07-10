// src/upgrades.js
export const UPGRADES = [
  { id: 'rapid',    name: 'Rapid Fire',      desc: '+25% fire rate',           apply: s => { s.mods.fireRate *= 1.25; } },
  { id: 'heavy',    name: 'Heavy Rounds',    desc: '+1 bullet damage',         apply: s => { s.mods.damage += 1; } },
  { id: 'engine',   name: 'Engine Tune',     desc: '+20% thrust & max speed',  apply: s => { s.mods.engine *= 1.2; } },
  { id: 'hull',     name: 'Hull Plating',    desc: '+1 max HP, heal 1',        apply: s => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'pierce',   name: 'Piercing Shots',  desc: 'Bullets pierce +1 enemy',  apply: s => { s.mods.pierce += 1; } },
  { id: 'spread',   name: 'Spread Shot',     desc: '+2 side bullets on auto',  apply: s => { s.mods.spread += 1; } },
  { id: 'velocity', name: 'Velocity Rounds', desc: '+40% bullet speed/range',  apply: s => { s.mods.bulletSpeed *= 1.4; } },
  { id: 'aegis',    name: 'Aegis Shield',    desc: 'Blocks 1 hit, recharges',  apply: s => { s.shield.owned = true; s.shield.up = true; } },
];

export function rollOffers(ship, rng) {
  const avail = UPGRADES.filter(u => !(u.id === 'aegis' && ship.shield.owned));
  const offers = [];
  while (offers.length < 3 && avail.length > 0) {
    offers.push(avail.splice(Math.floor(rng() * avail.length), 1)[0]);
  }
  return offers;
}

export function applyUpgrade(ship, id) {
  UPGRADES.find(u => u.id === id).apply(ship);
}

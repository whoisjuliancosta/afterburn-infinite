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
  { id: 'deadeye',      name: 'Deadeye',        desc: '+8% crit chance',              apply: s => { s.mods.critChance += 0.08; } },
  { id: 'executioner',  name: 'Executioner',    desc: '+50% crit damage',             apply: s => { s.mods.critMult += 0.5; } },
  { id: 'extradash',    name: 'Extra Dash',     desc: '+1 dash charge (2 stacks max)',       apply: s => { s.dash.max += 1; s.dash.charges += 1; s.dash.stacks += 1; } },
  { id: 'recovery',     name: 'Quick Recovery', desc: 'Dash recharges 25% faster',    apply: s => { s.mods.dashRate *= 1.25; } },
  { id: 'ricochet',     name: 'Ricochet',       desc: 'Bullets bounce off walls +1',  apply: s => { s.mods.bounce += 1; } },
  { id: 'overclock',    name: 'Overclock',      desc: '+10% fire rate & bullet speed', apply: s => { s.mods.fireRate *= 1.1; s.mods.bulletSpeed *= 1.1; } },
  { id: 'secondwind',   name: 'Second Wind',    desc: 'Heal 2',                       apply: s => { s.hp = Math.min(s.maxHp, s.hp + 2); } },
];

export function rollOffers(ship, rng) {
  const avail = UPGRADES.filter(u =>
    !(u.id === 'aegis' && ship.shield.owned) &&
    !(u.id === 'extradash' && ship.dash.stacks >= 2));
  const offers = [];
  while (offers.length < 3 && avail.length > 0) {
    offers.push(avail.splice(Math.floor(rng() * avail.length), 1)[0]);
  }
  return offers;
}

export function applyUpgrade(ship, id) {
  UPGRADES.find(u => u.id === id).apply(ship);
}

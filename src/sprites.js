// src/sprites.js
export const SPRITES = {};

export function makeSprite(rows, palette, scale = 3) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale;
  c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = palette[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return c;
}

// All art faces +x (right). '.' = transparent.
const SHIP_ROWS = [
  '..GG.......',
  '..WWWG.....',
  'RRWWWWWG...',
  'RRWWWWWWWWY',
  'RRWWWWWG...',
  '..WWWG.....',
  '..GG.......',
];
const SHIP_PAL = { W: '#e8e6d8', G: '#7a8a99', R: '#e6743e', Y: '#ffd75e' };

const DRIFTER_ROWS = [
  '..PPP..',
  '.PDDDP.',
  'PDDEDDP',
  'PDEEEDP',
  'PDDEDDP',
  '.PDDDP.',
  '..PPP..',
];
const DRIFTER_PAL = { P: '#8e4ec6', D: '#5c2e8a', E: '#ff5edb' };

const DARTER_ROWS = [
  '....C.',
  'CCCEC.',
  '.CCCCE',
  'CCCEC.',
  '....C.',
];
const DARTER_PAL = { C: '#3ecfe6', E: '#e8fdff' };

const SPLITTER_ROWS = [
  '..OOOOO..',
  '.OYYYYYO.',
  'OYYOOOYYO',
  'OYOYYYOYO',
  'OYYOOOYYO',
  '.OYYYYYO.',
  '..OOOOO..',
];
const SPLITTER_PAL = { O: '#c2452e', Y: '#ff9e3e' };

const MINI_ROWS = [
  '.OO.',
  'OYYO',
  'OYYO',
  '.OO.',
];

const SHIELD_ROWS = [
  '..BBB..',
  '.B...B.',
  'B.....B',
  'B.....B',
  'B.....B',
  '.B...B.',
  '..BBB..',
];
const SHIELD_PAL = { B: '#5ea8ff' };

export function initSprites() {
  SPRITES.ship = makeSprite(SHIP_ROWS, SHIP_PAL);
  SPRITES.drifter = makeSprite(DRIFTER_ROWS, DRIFTER_PAL);
  SPRITES.darter = makeSprite(DARTER_ROWS, DARTER_PAL);
  SPRITES.splitter = makeSprite(SPLITTER_ROWS, SPLITTER_PAL);
  SPRITES.mini = makeSprite(MINI_ROWS, SPLITTER_PAL);
  SPRITES.shield = makeSprite(SHIELD_ROWS, SHIELD_PAL, 4);
}

// src/sprites.js
// Browser-only module (uses document.createElement). Never imported by tests.
// All art faces +x (right). '.' = transparent. Entities are FRAME ARRAYS for
// a subtle 2-frame idle; render picks a frame with Math.floor(t*6)%2.
export const SPRITES = {};

export function makeSprite(rows, palette, scale = 4) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale;
  c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const fill = palette[ch];
      if (!fill) return;
      g.fillStyle = fill;
      g.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return c;
}

// Two-palette idle: build the same grid twice, differing only in the animated
// tokens, so every entity gets a distinctive but cheap blink/shimmer.
function makeFrames(rows, palA, palB, scale = 4) {
  return [makeSprite(rows, palA, scale), makeSprite(rows, palB, scale)];
}

// Darken a #rrggbb hex by factor (0..1) for hull shading / flame tint.
function darken(hex, factor = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const gg = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}

// ---------------------------------------------------------------- SHIP -------
// 17px wide. H = hull (paint), h = hull shade, O = outline, C = cockpit,
// E = engine nozzle. Cockpit blinks between frames; outline/cockpit fixed so
// all 6 paints read well.
const SHIP_ROWS = [
  '.....OOOO........',
  '....OHHHHO.......',
  '...OHHHHHHO......',
  '..OHHHHHHHHO.....',
  'EEOHHHHHHHHHO....',
  'EEOHHHHCCHHHHHO..',
  'EEOHHHHCCHHHHHHHO',
  'EEOHHHHCCHHHHHO..',
  'EEOhhhhhhhhhO....',
  '..OhhhhhhhhO.....',
  '...OhhhhhhO......',
  '....OhhhhO.......',
  '.....OOOO........',
];
const SHIP_FIXED = { O: '#1a1420', C: '#7fe8ff', E: '#8a8a99' };
const SHIP_FIXED_DIM = { O: '#1a1420', C: '#2f5a6b', E: '#8a8a99' };

// --------------------------------------------------------------- FLAME -------
// 7px, points left (rear of ship). F = hot core (fixed), P = paint tint.
const FLAME_F1 = [
  '.....PP',
  '..PPFFF',
  'PPFFFFF',
  '..PPFFF',
  '.....PP',
];
const FLAME_F2 = [
  '....PPP',
  '.PFFFFF',
  'PFFFFFF',
  '.PFFFFF',
  '....PPP',
];
const FLAME_CORE = '#fffbe6';

// ------------------------------------------------------------- DRIFTER -------
const DRIFTER_ROWS = [
  '....PPPPP....',
  '..PPDDDDDPP..',
  '.PDDDDDDDDDP.',
  '.PDDDEEEDDDP.',
  'PDDDEEEEEDDDP',
  'PDDDEEEEEDDDP',
  'PDDDEEEEEDDDP',
  'PDDDEEEEEDDDP',
  'PDDDEEEEEDDDP',
  '.PDDDEEEDDDP.',
  '.PDDDDDDDDDP.',
  '..PPDDDDDPP..',
  '....PPPPP....',
];
const DRIFTER_A = { P: '#8e4ec6', D: '#5c2e8a', E: '#ff5edb' };
const DRIFTER_B = { P: '#8e4ec6', D: '#5c2e8a', E: '#a03c9a' };

// -------------------------------------------------------------- DARTER -------
const DARTER_ROWS = [
  '......C......',
  '.....CCC.....',
  '....CCCCC....',
  '..CCCCEECCC..',
  'CCCCCEEEECCCC',
  '..CCCCEECCC..',
  '....CCCCC....',
  '.....CCC.....',
  '......C......',
];
const DARTER_A = { C: '#3ecfe6', E: '#e8fdff' };
const DARTER_B = { C: '#3ecfe6', E: '#7fd0e0' };

// ------------------------------------------------------------ SPLITTER -------
const SPLITTER_ROWS = [
  '.....OOOOOOO.....',
  '...OOYYYYYYYOO...',
  '..OYYYYYYYYYYYO..',
  '.OYYYYOOOOOYYYYO.',
  '.OYYYOEEEEEOYYYO.',
  'OYYYYOEEEEEOYYYYO',
  'OYYYYOEEEEEOYYYYO',
  'OYYYYOEEEEEOYYYYO',
  'OYYYYOEEEEEOYYYYO',
  'OYYYYOEEEEEOYYYYO',
  '.OYYYOEEEEEOYYYO.',
  '.OYYYYOOOOOYYYYO.',
  '..OYYYYYYYYYYYO..',
  '...OOYYYYYYYOO...',
  '.....OOOOOOO.....',
];
const SPLITTER_A = { O: '#c2452e', Y: '#ff9e3e', E: '#ffe08a' };
const SPLITTER_B = { O: '#c2452e', Y: '#ff9e3e', E: '#b8702a' };

// ---------------------------------------------------------------- MINI -------
const MINI_ROWS = [
  '..OOOOO..',
  '.OYYYYYO.',
  'OYYEEEYYO',
  'OYEEEEEYO',
  'OYEEEEEYO',
  'OYEEEEEYO',
  'OYYEEEYYO',
  '.OYYYYYO.',
  '..OOOOO..',
];
// reuses SPLITTER palettes.

// ------------------------------------------------------------- SPITTER -------
// Body S (green) with a metal cannon B pointing +x and an eye/mouth E.
const SPITTER_ROWS = [
  '...MMMMMMM.....',
  '..MSSSSSSSMM...',
  '.MSSSSSSSSSM...',
  'MSSSEESSSSSSM..',
  'MSSEEEESSSSBBB.',
  'MSSEEEESSSBBBBB',
  'MSSEEEESSSBBBBB',
  'MSSEEEESSSBBBBB',
  'MSSEEEESSSSBBB.',
  'MSSSEESSSSSSM..',
  '.MSSSSSSSSSM...',
  '..MSSSSSSSMM...',
  '...MMMMMMM.....',
];
const SPITTER_A = { M: '#1f5c3a', S: '#3fa06a', E: '#c8ff9e', B: '#9aa4ad' };
const SPITTER_B = { M: '#1f5c3a', S: '#3fa06a', E: '#5f8a55', B: '#9aa4ad' };

// ------------------------------------------------------------- ORBITER -------
// Core I with a satellite ring; alternating ring tokens R/r shimmer around the
// ring between frames to read as rotation. E center blinks.
const ORBITER_ROWS = [
  '......RrR......',
  '....Rr...rR....',
  '...r.......r...',
  '..R.........R..',
  '.r....III....r.',
  '.R...IIIII...R.',
  'r...IIIIIII...r',
  'R...IIIEIII...R',
  'r...IIIIIII...r',
  '.R...IIIII...R.',
  '.r....III....r.',
  '..R.........R..',
  '...r.......r...',
  '....Rr...rR....',
  '......RrR......',
];
const ORBITER_A = { R: '#ffd75e', r: '#a8862f', I: '#5a6cff', E: '#e8fdff' };
const ORBITER_B = { R: '#a8862f', r: '#ffd75e', I: '#5a6cff', E: '#7a86c0' };

// -------------------------------------------------------------- WEAVER -------
// Double-chevron arrow (serpentine reader) pointing +x. E clusters blink.
const WEAVER_ROWS = [
  '.............WW',
  '...WW.......WWW',
  '..WWWW.....WWWW',
  '.WWWWWW...WWWWW',
  'WWWWEWWWWWWWWEW',
  'WWWEEEWWWWWEEEW',
  'WWWWEWWWWWWWWEW',
  '.WWWWWW...WWWWW',
  '..WWWW.....WWWW',
  '...WW.......WWW',
  '.............WW',
];
const WEAVER_A = { W: '#4fe0a0', E: '#eaffd0' };
const WEAVER_B = { W: '#4fe0a0', E: '#2f8a63' };

// ---------------------------------------------------------------- BOSS -------
// 28px source (scale 4 → ~112px). A crowned warlord: gold crown spikes (K),
// deep-purple armored hull (B/b) with a magenta rim (R) framing twin glowing
// cores (C, the animated token) that read as menacing eyes. Its own palette,
// silhouette clearly unlike the round splitter. Windup flash is applied by the
// renderer (alpha pulse) reading state === 'windup'.
const BOSS_ROWS = [
  '.....K....K..KK..K....K.....',
  '....KK...KKKKKKKKKK...KK....',
  '...OKKO.OKKKKKKKKKKO.OKKO...',
  '...OBBOOOBBBBOOBBBBOOOBBO...',
  '..OBBBBBBBBBBRRBBBBBBBBBBO..',
  '.OBBBBBBBBBBBBBBBBBBBBBBBBO.',
  'OBBBBBBRRRRBBBBBBRRRRBBBBBBO',
  'OBBBBBRCCCCRBBBBRCCCCRBBBBBO',
  'OBBBBRCCCCCCCBBCCCCCCCRBBBBO',
  'OBBBBRCCCCCCCCCCCCCCCCRBBBBO',
  'OBBBBRCCCCCCCCCCCCCCCCRBBBBO',
  'OBBBBBRCCCCRBBBBRCCCCRBBBBBO',
  'OBBBBBBRRRRBBBBBBRRRRBBBBBBO',
  '.OBBBBBBBBBBBBBBBBBBBBBBBBO.',
  '..OBBBBBBBBBBRRBBBBBBBBBBO..',
  '...OBBOOOBBBBOOBBBBOOOBBO...',
  '....OBBObbbOBBBBObbbOBBO....',
  '.....OOOObbObbbbObbOOOO.....',
  '.......OOOOOObbOOOOOO.......',
  '..........OOOOOOOO..........',
];
const BOSS_A = { K: '#ffcf4a', O: '#140a1e', B: '#3a1a5c', b: '#26113d', R: '#8a3ecf', C: '#ff2e6e' };
const BOSS_B = { K: '#ffe08a', O: '#140a1e', B: '#3a1a5c', b: '#26113d', R: '#b06ee0', C: '#ff8ac0' };

// ----------------------------------------------------------------- GEM -------
// Small cyan/teal diamond, 2 frames sparkle: center glint S flashes white (A)
// then blends into the fill (B) for a twinkle; the edge/fill also shimmer.
const GEM_ROWS = [
  '....C....',
  '...CEC...',
  '..CEEEC..',
  '.CEEEEEC.',
  'CEEESEEEC',
  '.CEEEEEC.',
  '..CEEEC..',
  '...CEC...',
  '....C....',
];
const GEM_A = { C: '#1fb8d4', E: '#5fe8ff', S: '#ffffff' };
const GEM_B = { C: '#26c8e0', E: '#7ff2ff', S: '#7ff2ff' };

// --------------------------------------------------------------- HEARTS ------
const HEART_ROWS = [
  '.RR.RR.',
  'RRRRRRR',
  'RRRRRRR',
  '.RRRRR.',
  '..RRR..',
  '...R...',
];
const HEART_PAL = { R: '#e0524a' };

const HEART_EMPTY_ROWS = [
  '.OO.OO.',
  'O..O..O',
  'O.....O',
  '.O...O.',
  '..O.O..',
  '...O...',
];
const HEART_EMPTY_PAL = { O: '#5a5560' };
const SHIELD_HEART_PAL = { O: '#5ea8ff' };

// -------------------------------------------------------------- DASH PIP -----
const DASH_PIP_ROWS = [
  '..C..',
  '.CCC.',
  'CCCCC',
  '.CCC.',
  '..C..',
];
const DASH_PIP_PAL = { C: '#3ecfe6' };

// ---------------------------------------------------------------- ICONS ------
// 16px-source procedural icons, one per upgrade id. Simple shapes; hud scales
// them up on the upgrade cards.
function makeIcon(draw) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const g = c.getContext('2d');
  draw(g);
  return c;
}
function px(g, color, x, y, w = 1, h = 1) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}
function disc(g, color, cx, cy, r) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

function buildIcons() {
  return {
    // fire rate — three fast yellow chevrons
    rapid: makeIcon((g) => {
      for (const dx of [1, 6, 11]) {
        px(g, '#ffd75e', dx, 3, 3, 2);
        px(g, '#ffd75e', dx + 2, 5, 2, 6);
        px(g, '#ffd75e', dx, 11, 3, 2);
      }
    }),
    // damage — big orange slug
    heavy: makeIcon((g) => {
      disc(g, '#ff9e3e', 8, 8, 6);
      disc(g, '#c2452e', 8, 8, 3);
    }),
    // move speed — blue double arrow
    engine: makeIcon((g) => {
      g.fillStyle = '#5ea8ff';
      for (const ox of [1, 7]) {
        g.beginPath();
        g.moveTo(ox, 3); g.lineTo(ox + 6, 8); g.lineTo(ox, 13); g.closePath();
        g.fill();
      }
    }),
    // max hp — red heart
    hull: makeIcon((g) => {
      disc(g, '#e0524a', 5, 6, 3);
      disc(g, '#e0524a', 11, 6, 3);
      g.fillStyle = '#e0524a';
      g.beginPath();
      g.moveTo(2, 7); g.lineTo(8, 14); g.lineTo(14, 7); g.lineTo(8, 9); g.closePath();
      g.fill();
    }),
    // pierce — arrow through a bar
    pierce: makeIcon((g) => {
      px(g, '#c8c8d0', 2, 7, 12, 2);
      px(g, '#5ea8ff', 6, 3, 2, 10);
      g.fillStyle = '#5ea8ff';
      g.beginPath();
      g.moveTo(13, 5); g.lineTo(15, 8); g.lineTo(13, 11); g.closePath();
      g.fill();
    }),
    // spread — fanning dots
    spread: makeIcon((g) => {
      disc(g, '#ffd75e', 2, 8, 1.5);
      disc(g, '#ffd75e', 7, 3, 1.5);
      disc(g, '#ffd75e', 7, 8, 1.5);
      disc(g, '#ffd75e', 7, 13, 1.5);
      disc(g, '#ffd75e', 13, 2, 1.5);
      disc(g, '#ffd75e', 13, 8, 1.5);
      disc(g, '#ffd75e', 13, 14, 1.5);
    }),
    // bullet speed — streaking bolt
    velocity: makeIcon((g) => {
      px(g, '#7fe8ff', 1, 7, 8, 1);
      px(g, '#7fe8ff', 3, 9, 8, 1);
      disc(g, '#e8fdff', 13, 8, 2.5);
    }),
    // shield — blue crest
    aegis: makeIcon((g) => {
      g.fillStyle = '#5ea8ff';
      g.beginPath();
      g.moveTo(8, 1); g.lineTo(14, 4); g.lineTo(12, 12); g.lineTo(8, 15);
      g.lineTo(4, 12); g.lineTo(2, 4); g.closePath();
      g.fill();
      disc(g, '#e8fdff', 8, 7, 2);
    }),
    // crit chance — target crosshair
    deadeye: makeIcon((g) => {
      g.strokeStyle = '#ffd75e';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(8, 8, 5, 0, Math.PI * 2); g.stroke();
      px(g, '#ffd75e', 7, 0, 2, 4);
      px(g, '#ffd75e', 7, 12, 2, 4);
      px(g, '#ffd75e', 0, 7, 4, 2);
      px(g, '#ffd75e', 12, 7, 4, 2);
      disc(g, '#e0524a', 8, 8, 1.5);
    }),
    // crit mult — red fang/X
    executioner: makeIcon((g) => {
      g.strokeStyle = '#e0524a';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(3, 3); g.lineTo(13, 13); g.stroke();
      g.beginPath(); g.moveTo(13, 3); g.lineTo(3, 13); g.stroke();
    }),
    // extra dash — cyan double chevron
    extradash: makeIcon((g) => {
      g.strokeStyle = '#3ecfe6';
      g.lineWidth = 2;
      for (const ox of [3, 8]) {
        g.beginPath();
        g.moveTo(ox, 3); g.lineTo(ox + 4, 8); g.lineTo(ox, 13);
        g.stroke();
      }
    }),
    // recovery — circular refresh arrow
    recovery: makeIcon((g) => {
      g.strokeStyle = '#63d471';
      g.lineWidth = 2;
      g.beginPath(); g.arc(8, 8, 5, Math.PI * 0.4, Math.PI * 1.9); g.stroke();
      g.fillStyle = '#63d471';
      g.beginPath();
      g.moveTo(10, 1); g.lineTo(13, 4); g.lineTo(9, 5); g.closePath();
      g.fill();
    }),
    // ricochet — bouncing angle path between walls
    ricochet: makeIcon((g) => {
      px(g, '#5a5560', 1, 1, 1, 14);
      px(g, '#5a5560', 14, 1, 1, 14);
      g.strokeStyle = '#7fe8ff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(2, 3); g.lineTo(14, 8); g.lineTo(2, 13);
      g.stroke();
      disc(g, '#e8fdff', 2, 13, 1.5);
    }),
    // overclock — gauge with bolt
    overclock: makeIcon((g) => {
      g.strokeStyle = '#c8c8d0';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(8, 9, 6, Math.PI, Math.PI * 2); g.stroke();
      g.fillStyle = '#ffd75e';
      g.beginPath();
      g.moveTo(9, 3); g.lineTo(6, 9); g.lineTo(8, 9); g.lineTo(7, 13);
      g.lineTo(11, 7); g.lineTo(9, 7); g.closePath();
      g.fill();
    }),
    // second wind — green heal cross on heart
    secondwind: makeIcon((g) => {
      disc(g, '#63d471', 8, 8, 6);
      px(g, '#eafff0', 6, 4, 4, 8);
      px(g, '#eafff0', 4, 6, 8, 4);
    }),
  };
}

// ------------------------------------------------------------ initSprites ----
export function initSprites(paint = '#e8e6d8') {
  const hullShade = darken(paint, 0.62);
  const shipA = { ...SHIP_FIXED, H: paint, h: hullShade };
  const shipB = { ...SHIP_FIXED_DIM, H: paint, h: hullShade };
  SPRITES.ship = makeFrames(SHIP_ROWS, shipA, shipB);

  const flamePal = { F: FLAME_CORE, P: paint };
  SPRITES.flame = [makeSprite(FLAME_F1, flamePal), makeSprite(FLAME_F2, flamePal)];

  SPRITES.drifter = makeFrames(DRIFTER_ROWS, DRIFTER_A, DRIFTER_B);
  SPRITES.darter = makeFrames(DARTER_ROWS, DARTER_A, DARTER_B);
  SPRITES.splitter = makeFrames(SPLITTER_ROWS, SPLITTER_A, SPLITTER_B);
  SPRITES.mini = makeFrames(MINI_ROWS, SPLITTER_A, SPLITTER_B);
  SPRITES.spitter = makeFrames(SPITTER_ROWS, SPITTER_A, SPITTER_B);
  SPRITES.orbiter = makeFrames(ORBITER_ROWS, ORBITER_A, ORBITER_B);
  SPRITES.weaver = makeFrames(WEAVER_ROWS, WEAVER_A, WEAVER_B);
  SPRITES.boss = makeFrames(BOSS_ROWS, BOSS_A, BOSS_B);
  SPRITES.gem = makeFrames(GEM_ROWS, GEM_A, GEM_B);

  SPRITES.heart = makeSprite(HEART_ROWS, HEART_PAL);
  SPRITES.heartEmpty = makeSprite(HEART_EMPTY_ROWS, HEART_EMPTY_PAL);
  SPRITES.shieldHeart = makeSprite(HEART_EMPTY_ROWS, SHIELD_HEART_PAL);
  SPRITES.dashPip = makeSprite(DASH_PIP_ROWS, DASH_PIP_PAL);

  SPRITES.icons = buildIcons();
}

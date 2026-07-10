// src/sprites.js
// Browser-only module (uses document.createElement). Never imported by tests.
// All art faces +x (right). '.' = transparent. Entities are FRAME ARRAYS for
// a subtle 2-frame idle; render picks a frame with Math.floor(t*6)%2.
//
// v4: when the asset pack is loaded (ASSETS.ready), each SPRITES slot below is
// backed by pre-rotated pack art; otherwise the v3 code-generated sprite for
// that slot is used. Gems/hearts/pips/icons/shieldHeart stay code-generated.
import { ASSETS } from './assets.js';

export const SPRITES = {};

// Player paint is now a family KEY. Each family maps to a representative hull
// hex used ONLY for the code-gen fallback ship (sampled from the pack hulls).
const FAMILY_HEX = {
  metalic: '#c0cbdc',
  red: '#e0524a',
  blue: '#5ea8ff',
  purple: '#b07fe8',
  orange: '#f6960a',
  greyblue: '#5f7a8c',
};

// Enemy type -> pack ship key (variant chosen by eye for silhouette distinctness).
const ENEMY_ART = {
  drifter: 'green_03',
  darter: 'darkgrey_01',
  spitter: 'darkgrey_04',
  orbiter: 'green_02',
  weaver: 'green_04',
  splitter: 'darkgrey_02',
  mini: 'darkgrey_06',
};

// Wrap a single canvas as a 2-frame array so drawFrame's frame flip just repeats
// (the pack has no idle frames — acceptable per spec).
function packFrames(canvas) {
  return [canvas, canvas];
}

// Rotate a canvas 90° counter-clockwise (for the nose-up menu preview of the
// code-gen ship, which faces +x).
function rotateCCWCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.translate(c.width / 2, c.height / 2);
  g.rotate(-Math.PI / 2);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

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
// Red gem (hearts): same diamond grid, red/pink palette. Drawn ~30% smaller by
// the renderer, same as the blue gem.
const GEM_RED_A = { C: '#c42a2a', E: '#ff6a6a', S: '#ffffff' };
const GEM_RED_B = { C: '#d63a3a', E: '#ff8f8f', S: '#ffd0d0' };

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

// --------------------------------------------------------------- ROCKET ------
// Code-gen fallback for the right-click rocket (pack missile-1/2 override it
// when loaded). A small grey dart facing +x with a warm exhaust flicker at the
// rear (F, the animated token). D = body, T = nose tip.
const ROCKET_ROWS = [
  '..DD.....',
  '.DDDDD...',
  'FDDDDDDDT',
  '.DDDDD...',
  '..DD.....',
];
const ROCKET_A = { D: '#9aa4ad', T: '#dfe8ff', F: '#ffcf6a' };
const ROCKET_B = { D: '#9aa4ad', T: '#dfe8ff', F: '#ff8a3c' };

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
    // boost tank — a cyan fuel cell with an up-arrow (extra boost capacity)
    boosttank: makeIcon((g) => {
      g.fillStyle = '#0e2a30';
      g.fillRect(2, 4, 10, 9);        // tank body (dark)
      g.fillStyle = '#3ecfe6';
      g.fillRect(2, 8, 10, 5);        // fuel fill (cyan)
      g.strokeStyle = '#3ecfe6';
      g.lineWidth = 1;
      g.strokeRect(2.5, 4.5, 9, 8);
      px(g, '#3ecfe6', 12, 6, 2, 4);  // nozzle cap
      g.fillStyle = '#eaffff';        // up-arrow = boost
      g.beginPath(); g.moveTo(7, 5); g.lineTo(9, 8); g.lineTo(5, 8); g.closePath(); g.fill();
    }),
    // attractor — concentric pull rings drawing a gem inward (magnet radius)
    attractor: makeIcon((g) => {
      g.strokeStyle = '#5fe8ff';
      g.lineWidth = 1.5;
      for (const rr of [3, 6, 9]) {
        g.globalAlpha = 1 - (rr - 3) / 12;
        g.beginPath(); g.arc(2, 8, rr, -Math.PI / 2.4, Math.PI / 2.4); g.stroke();
      }
      g.globalAlpha = 1;
      disc(g, '#5fe8ff', 13, 8, 2);   // gem being pulled in
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
    // big payload — a fat warhead over a wide blast ring (bigger rocket AoE)
    bigpayload: makeIcon((g) => {
      g.strokeStyle = '#ff9e3e';
      g.lineWidth = 1;
      g.globalAlpha = 0.7;
      g.beginPath(); g.arc(8, 9, 6, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#e0524a';                       // warhead body
      g.beginPath();
      g.moveTo(8, 2); g.lineTo(11, 6); g.lineTo(11, 11); g.lineTo(5, 11); g.lineTo(5, 6);
      g.closePath(); g.fill();
      px(g, '#ffd75e', 7, 4, 2, 3);                  // nose glint
    }),
    // fast reload — a rocket with a curved reload arrow (shorter cooldown)
    fastreload: makeIcon((g) => {
      g.strokeStyle = '#3ecfe6';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(8, 8, 5, Math.PI * 0.15, Math.PI * 1.7); g.stroke();
      g.fillStyle = '#3ecfe6';                       // arrowhead
      g.beginPath(); g.moveTo(12, 4); g.lineTo(14, 8); g.lineTo(10, 7); g.closePath(); g.fill();
      px(g, '#ff9e3e', 7, 6, 2, 5);                  // tiny rocket
      g.fillStyle = '#ffd75e';
      g.beginPath(); g.moveTo(7, 4); g.lineTo(9, 6); g.lineTo(7, 6); g.closePath(); g.fill();
    }),
    // efficient burners — a downsized cyan flame plume (less drain)
    burners: makeIcon((g) => {
      g.fillStyle = '#3ecfe6';
      g.beginPath();
      g.moveTo(8, 2); g.lineTo(12, 9); g.lineTo(8, 14); g.lineTo(4, 9); g.closePath();
      g.fill();
      g.fillStyle = '#eaffff';
      g.beginPath();
      g.moveTo(8, 5); g.lineTo(10, 9); g.lineTo(8, 12); g.lineTo(6, 9); g.closePath();
      g.fill();
    }),
    // lucky charm — a golden four-leaf clover
    lucky: makeIcon((g) => {
      disc(g, '#63d471', 5, 5, 3);
      disc(g, '#63d471', 11, 5, 3);
      disc(g, '#63d471', 5, 11, 3);
      disc(g, '#63d471', 11, 11, 3);
      px(g, '#3a8a4a', 7, 8, 2, 6);                  // stem
      disc(g, '#eafff0', 8, 8, 1.2);                 // center highlight
    }),
    // rear guard — ship chevron with a backward-firing bolt
    rearguard: makeIcon((g) => {
      g.fillStyle = '#c8c8d0';                       // ship pointing right
      g.beginPath(); g.moveTo(11, 8); g.lineTo(5, 4); g.lineTo(7, 8); g.lineTo(5, 12); g.closePath(); g.fill();
      px(g, '#ffd75e', 1, 7, 4, 2);                  // rear bolt
      disc(g, '#fffbe6', 1, 8, 1.2);
    }),
    // adrenaline — a red lightning bolt over a heart pulse
    adrenaline: makeIcon((g) => {
      disc(g, '#e0524a', 8, 9, 5);
      g.fillStyle = '#ffd75e';
      g.beginPath();
      g.moveTo(9, 3); g.lineTo(5, 9); g.lineTo(8, 9); g.lineTo(7, 14);
      g.lineTo(12, 7); g.lineTo(9, 7); g.closePath();
      g.fill();
    }),
  };
}

// ------------------------------------------------------------ initSprites ----
// `paint` is a family key ('metalic'|'red'|'blue'|'purple'|'orange'|'greyblue').
export function initSprites(paint = 'metalic') {
  const hull = FAMILY_HEX[paint] || FAMILY_HEX.metalic;
  const hullShade = darken(hull, 0.62);
  const shipA = { ...SHIP_FIXED, H: hull, h: hullShade };
  const shipB = { ...SHIP_FIXED_DIM, H: hull, h: hullShade };

  // --- Code-gen fallbacks (always built so every slot has art) ---
  SPRITES.ship = makeFrames(SHIP_ROWS, shipA, shipB);

  const flamePal = { F: FLAME_CORE, P: hull };
  SPRITES.flame = [makeSprite(FLAME_F1, flamePal), makeSprite(FLAME_F2, flamePal)];

  SPRITES.drifter = makeFrames(DRIFTER_ROWS, DRIFTER_A, DRIFTER_B);
  SPRITES.darter = makeFrames(DARTER_ROWS, DARTER_A, DARTER_B);
  SPRITES.splitter = makeFrames(SPLITTER_ROWS, SPLITTER_A, SPLITTER_B);
  SPRITES.mini = makeFrames(MINI_ROWS, SPLITTER_A, SPLITTER_B);
  SPRITES.spitter = makeFrames(SPITTER_ROWS, SPITTER_A, SPITTER_B);
  SPRITES.orbiter = makeFrames(ORBITER_ROWS, ORBITER_A, ORBITER_B);
  SPRITES.weaver = makeFrames(WEAVER_ROWS, WEAVER_A, WEAVER_B);
  SPRITES.boss = makeFrames(BOSS_ROWS, BOSS_A, BOSS_B);
  SPRITES.gem = makeFrames(GEM_ROWS, GEM_A, GEM_B);      // blue = boost
  SPRITES.gemRed = makeFrames(GEM_ROWS, GEM_RED_A, GEM_RED_B); // red = hearts
  SPRITES.rocket = makeFrames(ROCKET_ROWS, ROCKET_A, ROCKET_B); // code-gen dart

  SPRITES.heart = makeSprite(HEART_ROWS, HEART_PAL);
  SPRITES.heartEmpty = makeSprite(HEART_EMPTY_ROWS, HEART_EMPTY_PAL);
  SPRITES.shieldHeart = makeSprite(HEART_EMPTY_ROWS, SHIELD_HEART_PAL);

  SPRITES.icons = buildIcons();

  // --- Pack-art overrides (per slot, only when the PNG actually loaded) ---
  // Menu preview defaults to a nose-up rotation of the code-gen ship.
  SPRITES.shipPreview = rotateCCWCanvas(SPRITES.ship[0]);

  if (ASSETS.ready) {
    const shipArt = ASSETS.ships[`${paint}_01`];
    if (shipArt) SPRITES.ship = packFrames(shipArt);
    const shipUp = ASSETS.shipsUp[`${paint}_01`];
    if (shipUp) SPRITES.shipPreview = shipUp;

    for (const [type, key] of Object.entries(ENEMY_ART)) {
      const art = ASSETS.ships[key];
      if (art) SPRITES[type] = packFrames(art);
    }

    // Rocket: pre-rotated pack missile frames when present (2-frame animation),
    // otherwise the code-gen dart stays.
    const missile = (ASSETS.missile || []).filter(Boolean);
    if (missile.length >= 2) SPRITES.rocket = missile;
    else if (missile.length === 1) SPRITES.rocket = packFrames(missile[0]);
  }
}

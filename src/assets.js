// src/assets.js
// Browser-only module (uses Image / document.createElement). Never imported by
// tests. Loads the v4 "Pixel Spaceships for SHMUP" pack at runtime from the
// statically-served assets/ dir, pre-rotates ship/projectile/thruster art 90°
// clockwise onto offscreen canvases (nearest-neighbor) so the engine's
// rotate-by-angle draw code works unchanged — the pack faces UP, the engine
// faces +x. Every image load is non-fatal: a miss is recorded and the consumer
// falls back to the v3 code-generated sprite for that slot, so the game stays
// fully playable with all assets absent.

const BASE = 'assets/';

export const ASSETS = {
  ready: false,
  ships: {},        // 'blue_01' -> pre-rotated canvas (nose faces +x)
  shipsUp: {},      // 'blue_01' -> native nose-up canvas (menu preview)
  large: {},        // 'large_red_01' -> pre-rotated canvas (nose faces +x)
  thrust: [],       // vertical-thrust 1..4, pre-rotated (plume trails -x / rear)
  missile: [],      // rocket missile-1..2 frames, pre-rotated (nose faces +x)
  explosion: [],    // explosion 1..9 frames, unrotated (radial)
  projectiles: {},  // 'player'|'enemy'|'boss' -> pre-rotated capsule canvas
  missing: [],      // recorded 404s / decode failures, for diagnostics
};

// Ship families/variants the game actually references (player hulls + enemies).
const SHIP_KEYS = [
  // player families, variant _01
  'metalic_01', 'red_01', 'blue_01', 'purple_01', 'orange_01', 'greyblue_01',
  // enemy palette (chosen by eye for silhouette distinctness)
  'green_03',    // drifter  (round teardrop blob)
  'darkgrey_01', // darter   (sleek red-accent dart)
  'darkgrey_04', // spitter  (compact twin-nozzle gun platform)
  'green_02',    // orbiter  (spiky insectoid alien)
  'green_04',    // weaver   (wide manta wings)
  'darkgrey_02', // splitter (bulky wide hull, drawn larger)
  'darkgrey_06', // mini     (small spiky fighter, drawn ~60%)
];

const LARGE_KEYS = [
  'large_red_01', 'large_blue_01', 'large_grey_01',
  'large-seagreen-01', 'large-seagreen-02', 'large-seagreen-03',
  'large-seagreen-04', 'large-seagreen-05',
];

// Boss art cycled by boss number (wave/5): 1st red, 2nd blue, 3rd grey, then the
// seagreen set rotates for the 4th boss onward.
const BOSS_CYCLE = [
  'large_red_01', 'large_blue_01', 'large_grey_01',
  'large-seagreen-01', 'large-seagreen-02', 'large-seagreen-03',
  'large-seagreen-04', 'large-seagreen-05',
];

// Projectile PNGs are 5 colour variants (blue/pink/green/orange/red), NOT
// animation frames — so a fixed hue is picked per role rather than cycled.
const PROJECTILE_FILES = {
  player: 'projectile01-4', // orange, warm to match the yellow muzzle glow
  enemy: 'projectile03-2',  // pink, matches the hostile-shot glow
  boss: 'projectile04-2',   // pink, keeps hostile colour coding, bulkier bolt
};

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Copy an image to a plain offscreen canvas (nearest-neighbor).
function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  return c;
}

// Rotate 90° clockwise onto a fresh canvas (dims swapped). +90° in canvas space
// (y-down) is a clockwise turn, so UP (nose) maps to +x (right).
function rotateCW(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = h;
  c.height = w;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.translate(c.width / 2, c.height / 2);
  g.rotate(Math.PI / 2);
  g.drawImage(img, -w / 2, -h / 2);
  return c;
}

// Load one image, record a miss on failure, and hand the loaded <img> (or null)
// to the caller's store function. Always resolves — per-slot failure tolerance.
function loadInto(file, onLoad) {
  return loadImage(BASE + file).then((img) => {
    if (img) onLoad(img);
    else ASSETS.missing.push(file);
  });
}

// Kick off every load; resolve once all settle (successes AND misses). Sets
// ASSETS.ready. Safe to call once at boot.
export function loadAssets() {
  const jobs = [];

  for (const key of SHIP_KEYS) {
    jobs.push(loadInto(`ships/${key}.png`, (img) => {
      ASSETS.ships[key] = rotateCW(img);
      ASSETS.shipsUp[key] = toCanvas(img);
    }));
  }

  for (const key of LARGE_KEYS) {
    jobs.push(loadInto(`ships/${key}.png`, (img) => {
      ASSETS.large[key] = rotateCW(img);
    }));
  }

  for (let i = 1; i <= 4; i++) {
    const idx = i - 1;
    jobs.push(loadInto(`fx/vertical-thrust-0${i}.png`, (img) => {
      ASSETS.thrust[idx] = rotateCW(img);
    }));
  }

  // Rocket art: two-frame missile from the pack, faces UP → pre-rotate to +x so
  // the engine's rotate-by-angle draw code works unchanged. Miss → code-gen dart.
  for (let i = 1; i <= 2; i++) {
    const idx = i - 1;
    jobs.push(loadInto(`fx/missile-${i}.png`, (img) => {
      ASSETS.missile[idx] = rotateCW(img);
    }));
  }

  for (let i = 1; i <= 9; i++) {
    const idx = i - 1;
    jobs.push(loadInto(`fx/explosion-0${i}.png`, (img) => {
      ASSETS.explosion[idx] = toCanvas(img);
    }));
  }

  for (const [role, file] of Object.entries(PROJECTILE_FILES)) {
    jobs.push(loadInto(`fx/${file}.png`, (img) => {
      ASSETS.projectiles[role] = rotateCW(img);
    }));
  }

  return Promise.all(jobs).then(() => {
    ASSETS.ready = true;
    return ASSETS;
  });
}

// Boss art for a given wave (bosses appear on waves 5,10,15,…). Returns a
// pre-rotated canvas or null (→ code-gen fallback).
export function bossSprite(wave) {
  const n = Math.max(1, Math.floor(wave / 5)); // 1-indexed boss number
  const key = BOSS_CYCLE[(n - 1) % BOSS_CYCLE.length];
  return ASSETS.large[key] || null;
}

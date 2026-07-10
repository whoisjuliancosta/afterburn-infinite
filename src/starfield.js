// src/starfield.js
// Browser-only module (cosmetic parallax starfield). Never imported by tests.
// Math.random is fine here: purely decorative, no determinism required.
//
// v5.1 perf: each parallax layer's static stars are pre-rendered ONCE to an
// offscreen canvas at build time; per frame we blit each layer canvas at its
// scrolled+wrapped offset (≤4 blits/layer) instead of drawing ~290 arcs. The
// whole layer breathes via a single global-alpha oscillation (subtle, per-layer
// phase) rather than a per-star twinkle. The ~12 bright accent stars stay
// individually drawn, each as a pre-baked additive glow canvas (no runtime
// shadowBlur). Rebuilt on resize by main (createStarfield).

// Far -> near. count: stars in the layer; speed: drift px/s (bigger = nearer);
// rScale: multiplies the star's base radius so near stars read as closer.
const LAYERS = [
  { count: 150, speed: 4, rScale: 0.7 },
  { count: 90, speed: 9, rScale: 1.0 },
  { count: 50, speed: 16, rScale: 1.3 },
];

// A handful of larger "bright" stars get a soft additive glow so the field has
// depth accents. Distributed across the nearer layers at build time.
const BRIGHT_COUNT = 12;

// Drift heading: lower-left, i.e. (-1, +1) normalized so speed is the true px/s.
const DIR = 1 / Math.SQRT2;

// Reference content radius the bright-star glow is baked at; each accent star
// scales this canvas to its own radius at draw time.
const GLOW_R = 4;

function makeStar(w, h, layer) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    // Base radius 0.5..1.5, then scaled by the layer for parallax depth.
    r: (0.5 + Math.random()) * layer.rScale,
    // Base alpha lifted ~40% for readability over the dark arena.
    baseAlpha: Math.min(1, (0.35 + Math.random() * 0.5) * 1.4),
    twinklePhase: Math.random() * Math.PI * 2,
    bright: false,
  };
}

// Bake the additive bright-star glow ONCE: a bright dot with a soft blue halo,
// on a padded transparent canvas. Drawn additively at runtime, scaled per star.
function bakeBrightGlow() {
  const pad = 16; // 2×blur so the halo isn't clipped
  const size = GLOW_R * 2 + pad * 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.shadowBlur = 8;
  g.shadowColor = '#bcd2ff';
  g.fillStyle = '#eef4ff';
  g.beginPath();
  g.arc(size / 2, size / 2, GLOW_R, 0, Math.PI * 2);
  g.fill();
  return c;
}

// Render a layer's static (non-bright) stars once onto an offscreen canvas at
// their resting baseAlpha. The runtime global-alpha oscillation multiplies this.
function bakeLayer(w, h, stars) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  for (const s of stars) {
    if (s.bright) continue;
    g.globalAlpha = s.baseAlpha;
    // Dim blue-white: brighter stars trend whiter, dimmer trend bluer.
    g.fillStyle = s.baseAlpha > 0.65 ? '#dfe8ff' : '#9fb8e6';
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

export function createStarfield(w, h) {
  const sf = { w, h, t: 0, layers: [], bright: [], glow: bakeBrightGlow() };

  // Generate every star, tracking which layer (speed) each belongs to.
  const layerStars = LAYERS.map((layer) => {
    const stars = [];
    for (let i = 0; i < layer.count; i++) stars.push(makeStar(w, h, layer));
    return { speed: layer.speed, stars };
  });

  // Promote ~12 stars in the nearer layers to "bright": bigger radius, full base
  // alpha, drawn individually with the additive glow (not baked into the layer).
  const near = layerStars.slice(1); // the two faster/closer layers
  for (let i = 0; i < BRIGHT_COUNT && near.length; i++) {
    const ls = near[i % near.length];
    const s = ls.stars[Math.floor(Math.random() * ls.stars.length)];
    if (s.bright) continue; // don't double-promote the same star
    s.bright = true;
    s.r *= 1.9;
    s.baseAlpha = 1;
    sf.bright.push({ x: s.x, y: s.y, r: s.r, speed: ls.speed, twinklePhase: s.twinklePhase });
  }

  // Bake each layer's static stars; give each a phase so they don't pulse in
  // lockstep. ox/oy are the scroll offsets, wrapped into [0,w)×[0,h).
  layerStars.forEach((ls, i) => {
    sf.layers.push({
      speed: ls.speed,
      canvas: bakeLayer(w, h, ls.stars),
      ox: 0, oy: 0,
      phase: (i / LAYERS.length) * Math.PI * 2,
    });
  });
  return sf;
}

// Wrap v into [0, m).
function wrap(v, m) {
  return ((v % m) + m) % m;
}

export function updateStarfield(sf, dt) {
  sf.t += dt;
  const { w, h } = sf;
  for (const layer of sf.layers) {
    // Stars drift lower-left → shift the layer canvas the same way.
    layer.ox = wrap(layer.ox - layer.speed * DIR * dt, w);
    layer.oy = wrap(layer.oy + layer.speed * DIR * dt, h);
  }
  for (const s of sf.bright) {
    s.x = wrap(s.x - s.speed * DIR * dt, w);
    s.y = wrap(s.y + s.speed * DIR * dt, h);
  }
}

export function drawStarfield(g, sf) {
  const { w, h } = sf;
  g.save();
  // Static layers: blit each pre-baked canvas at its scrolled offset, tiled so
  // the wrap seams are covered (≤4 blits/layer), under a subtle alpha breathe.
  for (const layer of sf.layers) {
    const tw = 0.5 + 0.5 * Math.sin(sf.t * 2 + layer.phase);
    g.globalAlpha = 0.4 + 0.6 * tw; // multiplies each star's baked baseAlpha
    const { ox, oy, canvas } = layer;
    g.drawImage(canvas, ox, oy);
    g.drawImage(canvas, ox - w, oy);
    g.drawImage(canvas, ox, oy - h);
    g.drawImage(canvas, ox - w, oy - h);
  }
  // Bright accent stars: individual additive glow blits, per-star twinkle.
  g.globalCompositeOperation = 'lighter';
  const gl = sf.glow;
  const glNat = GLOW_R * 2;
  for (const s of sf.bright) {
    const tw = 0.5 + 0.5 * Math.sin(sf.t * 2 + s.twinklePhase);
    g.globalAlpha = Math.max(0, Math.min(1, 0.4 + 0.6 * tw));
    const k = (s.r * 2) / glNat;
    const dw = gl.width * k, dh = gl.height * k;
    g.drawImage(gl, s.x - dw / 2, s.y - dh / 2, dw, dh);
  }
  g.restore();
}

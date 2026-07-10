// src/starfield.js
// Browser-only module (cosmetic parallax starfield). Never imported by tests.
// Math.random is fine here: purely decorative, no determinism required.
//
// Three parallax layers of code-generated stars drift slowly toward the
// lower-left. Nearer layers are fewer, bigger and faster (parallax). Each star
// twinkles via a sine on its alpha. Store w/h so main can recreate on resize.

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

export function createStarfield(w, h) {
  const sf = { w, h, t: 0, layers: [] };
  for (const layer of LAYERS) {
    const stars = [];
    for (let i = 0; i < layer.count; i++) stars.push(makeStar(w, h, layer));
    sf.layers.push({ speed: layer.speed, stars });
  }
  // Promote ~12 stars in the nearer layers to "bright": bigger radius, full
  // base alpha, and a soft additive glow at draw time.
  const near = sf.layers.slice(1); // the two faster/closer layers
  for (let i = 0; i < BRIGHT_COUNT && near.length; i++) {
    const layer = near[i % near.length];
    const s = layer.stars[Math.floor(Math.random() * layer.stars.length)];
    s.bright = true;
    s.r *= 1.9;
    s.baseAlpha = 1;
  }
  return sf;
}

export function updateStarfield(sf, dt) {
  sf.t += dt;
  const { w, h } = sf;
  for (const layer of sf.layers) {
    const dx = -layer.speed * DIR * dt; // toward left
    const dy = layer.speed * DIR * dt;  // toward bottom
    for (const s of layer.stars) {
      s.x += dx;
      s.y += dy;
      // Wraparound on both axes so the field is seamless.
      if (s.x < 0) s.x += w;
      else if (s.x >= w) s.x -= w;
      if (s.y < 0) s.y += h;
      else if (s.y >= h) s.y -= h;
    }
  }
}

export function drawStarfield(g, sf) {
  g.save();
  for (const layer of sf.layers) {
    for (const s of layer.stars) {
      // Sine twinkle: modulate alpha around baseAlpha, clamped to [0,1].
      const tw = 0.5 + 0.5 * Math.sin(sf.t * 2 + s.twinklePhase);
      const a = Math.max(0, Math.min(1, s.baseAlpha * (0.4 + 0.6 * tw)));
      g.globalAlpha = a;
      // Dim blue-white: brighter stars trend whiter, dimmer trend bluer.
      g.fillStyle = s.baseAlpha > 0.65 ? '#dfe8ff' : '#9fb8e6';
      if (s.bright) {
        // Soft additive halo for the accent stars.
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.shadowBlur = 8;
        g.shadowColor = '#bcd2ff';
        g.fillStyle = '#eef4ff';
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
        g.restore();
        continue;
      }
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

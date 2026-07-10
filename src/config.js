export const SHIP = {
  radius: 12,
  turnRate: 3.6,     // rad/s
  thrust: 320,       // px/s^2
  maxSpeed: 260,     // px/s
  friction: 1.2,     // exponential damping coefficient per second
  recoil: 18,        // px/s pushback per shot
  maxHp: 3,
  iframeTime: 1.2,   // s of invulnerability after a hit
};

export const GUN = {
  autoInterval: 0.22,    // s between full-auto shots at fireRate 1
  semiFloor: 0.8,        // semi-auto cooldown = semiFloor * auto interval
  bulletSpeed: 420,
  bulletRange: 480,
  bulletRadius: 3,
  damage: 1,
  spreadAngle: 0.14,     // rad of random jitter on full-auto shots
  spreadShotAngle: 0.28, // rad offset per Spread Shot side bullet
};

export const ENEMIES = {
  drifter:  { cost: 1, hp: 2, speed: 60,  radius: 12, score: 100 },
  darter:   { cost: 2, hp: 1, speed: 90,  radius: 9,  score: 150,
              aimRange: 260, aimTime: 0.7, lungeSpeed: 330, lungeTime: 0.45 },
  splitter: { cost: 3, hp: 5, speed: 40,  radius: 18, score: 200 },
  mini:     { cost: 0, hp: 1, speed: 110, radius: 8,  score: 75 },
};

export const WAVE = {
  baseBudget: 3,
  budgetPerWave: 2,      // budget = 3 + 2*(wave-1)
  scalePerWave: 0.04,    // +4% enemy hp/speed per wave
  spawnInterval: 1.1,    // s between trickled spawns
  telegraphTime: 1.0,    // s of spawn warning marker
};

export const SCORE = { streakStep: 5, maxMult: 5 }; // mult = 1 + floor(streak/5), capped

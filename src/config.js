export const DASH = { impulse: 560, charges: 2, rechargeTime: 6, damageCredit: 0.35, iframes: 0.25, speedCapMult: 1.8 };

export const CRIT = { chance: 0.10, mult: 2 };

export const SHIP = {
  radius: 18,
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
  bulletSpeed: 460,
  bulletRange: 560,
  bulletRadius: 4,
  damage: 1,
  spreadAngle: 0.14,     // rad of random jitter on full-auto shots
  spreadShotAngle: 0.28, // rad offset per Spread Shot side bullet
};

export const ENEMIES = {
  drifter:  { cost: 1, hp: 2, speed: 60,  radius: 17, score: 100, unlock: 1 },
  darter:   { cost: 2, hp: 1, speed: 90,  radius: 13, score: 150, unlock: 1,
              aimRange: 260, aimTime: 0.7, lungeSpeed: 330, lungeTime: 0.45 },
  splitter: { cost: 3, hp: 5, speed: 40,  radius: 26, score: 200, unlock: 4 },
  mini:     { cost: 0, hp: 1, speed: 110, radius: 11, score: 75 },
  spitter:  { cost: 2, hp: 2, speed: 55,  radius: 16, score: 175, unlock: 3,
              standoff: 320, fireEvery: 2.2, shotSpeed: 200, shotRadius: 5 },
  orbiter:  { cost: 3, hp: 3, speed: 120, radius: 14, score: 200, unlock: 5,
              orbitRadius: 240, spiralRate: 12 },
  weaver:   { cost: 3, hp: 2, speed: 95,  radius: 13, score: 225, unlock: 7,
              weaveAmp: 90, weaveFreq: 2.2 },
};

export const WAVE = {
  baseBudget: 3,
  budgetPerWave: 2,      // budget = 3 + 2*(wave-1)
  scalePerWave: 0.06,    // +6% enemy hp/speed per wave
  spawnInterval: 1.1,    // s between trickled spawns
  telegraphTime: 1.0,    // s of spawn warning marker
};

export const SCORE = { streakStep: 5, maxMult: 5 }; // mult = 1 + floor(streak/5), capped

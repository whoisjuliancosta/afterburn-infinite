export const BOOST = { drainPerSec: 0.40, thrustMult: 2.4, speedMult: 1.9, baseUnits: 1, maxUnits: 3 };

export const CRIT = { chance: 0.10, mult: 2 };

// Upgrade stat caps (spec E). applyUpgrade clamps each mod here; rollOffers hides
// an upgrade once its target mod is at cap.
export const CAPS = { fireRate: 3, engine: 2, bulletSpeed: 2.5, pierce: 5, spread: 3, bounce: 3 };

export const SHIP = {
  radius: 18,
  thrust: 680,       // px/s^2 (twin-stick: terminal speed thrust/friction exceeds the cap)
  maxSpeed: 260,     // px/s
  friction: 2.4,     // exponential damping per second — light drift, responsive stops
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
              weaveAmp: 70, weaveFreq: 0.9 },
  boss:     { cost: 0, hp: 60, speed: 32, radius: 42, score: 2000, unlock: 5,
              ringEvery: 3.0, ringCount: 10, chargeEvery: 7.0, chargeSpeed: 380,
              chargeTime: 0.6, spawnEvery: 8.0, shotSpeed: 170, shotRadius: 6,
              burstEvery: 4.0, wallEvery: 9.0, blinkEvery: 7.0,
              blinkTelegraph: 0.6, blinkMinDist: 260 },
};

export const WAVE = {
  baseBudget: 4,
  budgetPerWave: 2.5,        // budget = round(4 + 2.5*(wave-1) + 1.5*power + late)
  powerBudget: 1.5,          // extra budget per player upgrade taken this run
  lateBudgetPerWave: 3,      // extra budget per wave past lateStart (accelerating)
  lateStart: 10,             // wave after which the late budget term kicks in
  scalePerWave: 0.07,        // +7% enemy hp/speed per wave
  spawnInterval: 1.1,        // s between trickled spawns at wave 1 (base)
  spawnIntervalFloor: 0.22,  // fastest trickle
  spawnIntervalStep: 0.06,   // spacing shaved per wave past 1
  telegraphTime: 1.0,        // s of spawn warning marker
};

export const SCORE = { streakStep: 5, maxMult: 5 }; // mult = 1 + floor(streak/5), capped

export const GEMS = { lifetime: 6, magnetRadius: 200, magnetAccel: 900, maxSpeed: 480, radius: 5, blueChance: 0.35, redChance: 0.08, boostFill: 0.10, heartFill: 0.10 };

export const ROCKET = { cooldown: 5, speed: 360, damage: 8, aoeRadius: 110, radius: 6, range: 900 };

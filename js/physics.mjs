/* ============================================================================
   DRAG BIKE 3D — js/physics.mjs
   Fisika + data murni (TANPA DOM, TANPA Three.js) supaya bisa diuji di Node.
   Angka-angka dipertahankan persis dari v1 (2D) agar balapan terasa sama:
   top speed standar 180, max 235, 0-100 ~2,40 dtk, finis 402m ~10,28 dtk.
   ============================================================================ */

export const TRACK_M = 402; // quarter mile

export const GEAR_MAX = [60, 100, 140, 185, 999]; // km/jam batas tiap gigi
export const RPM_MIN = 3000;
export const RPM_MAX = 12000;
export const POWER_LOW = 8000;
export const POWER_HIGH = 10500; // power band
export const OPT_SHIFT = 9500;

export const UPGRADES = {
  mesin:   { name: 'Mesin',   icon: '🔩', desc: '+8 km/jam top speed & +8% akselerasi per level.', base: 150, max: 5 },
  knalpot: { name: 'Knalpot', icon: '🔊', desc: '+3 km/jam top speed & +5% akselerasi per level.', base: 120, max: 5 },
  ban:     { name: 'Ban',     icon: '🛞', desc: '+6% grip saat start & +2% akselerasi per level.', base: 100, max: 5 },
  nitro:   { name: 'Nitro',   icon: '💨', desc: '+0,5 detik durasi nitro per level.',             base: 100, max: 5 }
};

export const BOTS = [
  { id: 'pemula',  name: 'Budi Santai', diff: 'Pemula',  topSpeed: 175, reactMin: 0.55, reactMax: 0.85, shiftErr: 650, nitroChance: 0.5,  reward: 100, color: '#2ecc71', desc: 'Baru belajar. Reaksi lambat, sering salah gigi.' },
  { id: 'pro',     name: 'Raka Kilat',  diff: 'Pro',     topSpeed: 198, reactMin: 0.35, reactMax: 0.50, shiftErr: 300, nitroChance: 0.75, reward: 250, color: '#f39c12', desc: 'Pembalap jalanan. Reaksi cepat, gigi rapi.' },
  { id: 'legenda', name: 'Dedi Petir',  diff: 'Legenda', topSpeed: 218, reactMin: 0.20, reactMax: 0.30, shiftErr: 100, nitroChance: 0.9,  reward: 500, color: '#e74c3c', desc: 'Sang legenda drag. Hampir sempurna di semua hal.' }
];

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function kmh(ms) { return ms * 3.6; }

/* Stat motor dari level upgrade. */
export function bikeStats(up) {
  up = up || { mesin: 0, knalpot: 0, ban: 0, nitro: 0 };
  const top = 180 + up.mesin * 8 + up.knalpot * 3; // km/jam
  const accel = 1 + up.mesin * 0.08 + up.knalpot * 0.05 + up.ban * 0.02;
  const grip = 0.70 + up.ban * 0.06; // 0.70 - 1.00
  const nitroDur = 2 + up.nitro * 0.5; // detik
  return { topSpeed: top, topMs: top / 3.6, accel, grip, nitroDur };
}

export function createRacer(name, color, stats) {
  return {
    name, color, stats,
    dist: 0, speed: 0, gear: 1, rpm: RPM_MIN,
    gas: false, nitroActive: false, nitroLeft: stats.nitroDur,
    finished: false, finishTime: null, reaction: null, falseStart: false
  };
}

/* RPM dari kecepatan di gigi saat ini. */
export function rpmFor(r) {
  const sp = kmh(r.speed);
  const gmax = Math.min(GEAR_MAX[r.gear - 1], r.stats.topSpeed);
  const gmin = r.gear === 1 ? 0 : GEAR_MAX[r.gear - 2];
  const frac = clamp((sp - gmin) / Math.max(1, gmax - gmin), 0, 1);
  return RPM_MIN + frac * (RPM_MAX - RPM_MIN);
}

export function shiftUp(r) {
  if (r.gear < 5) { r.gear++; r.rpm = rpmFor(r); return true; }
  return false;
}

/* Pindah gigi otomatis di RPM optimal (dipakai bot & simulasi stat). */
export function autoShift(r) {
  if (r.rpm >= OPT_SHIFT && r.gear < 5) shiftUp(r);
}

export function stepRacer(r, dt) {
  if (r.finished) return;
  const sp = kmh(r.speed);
  const top = r.stats.topSpeed * (r.nitroActive ? 1.15 : 1);
  let accel = 0;
  if (r.gas) {
    const gearPull = 1.55 - r.gear * 0.16; // gigi rendah = tarikan besar
    accel = 9.5 * r.stats.accel * gearPull;
    if (r.rpm >= POWER_LOW && r.rpm <= POWER_HIGH) accel *= 1.18; // power band
    if (r.rpm > 11000) accel *= 0.25; // mentok limiter
    if (r.speed < 15 / 3.6) accel *= r.stats.grip; // grip saat start
    if (r.nitroActive && r.nitroLeft > 0) {
      accel *= 1.38;
      r.nitroLeft -= dt;
      if (r.nitroLeft <= 0) r.nitroActive = false;
    }
  }
  r.speed += accel * dt;
  if (!r.gas) r.speed -= r.speed * 0.25 * dt; // engine braking ringan
  if (r.speed < 0) r.speed = 0;
  if (kmh(r.speed) > top) r.speed = top / 3.6;
  r.dist += r.speed * dt;
  r.rpm = rpmFor(r);
  if (r.dist >= TRACK_M) { r.dist = TRACK_M; r.finished = true; }
}

/* Simulasi 0-100 km/jam dengan pindah gigi otomatis (untuk tampilan stat). */
export function simulate0100(stats) {
  const st = stats || bikeStats();
  const r = createRacer('Sim', '#fff', st);
  r.gas = true;
  const dt = 0.02;
  let t = 0;
  while (t < 12) {
    autoShift(r);
    stepRacer(r, dt);
    t += dt;
    if (kmh(r.speed) >= 100) return t;
  }
  return null;
}

/* Simulasi finis 402m dengan pindah gigi otomatis (untuk harness). */
export function simulateFinish(stats, useNitro) {
  const st = stats || bikeStats();
  const r = createRacer('Sim', '#fff', st);
  r.gas = true;
  if (useNitro) r.nitroActive = true;
  const dt = 0.02;
  let t = 0;
  while (t < 30) {
    autoShift(r);
    stepRacer(r, dt);
    t += dt;
    if (r.finished) return t;
  }
  return null;
}

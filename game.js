/* ============================================================================
   DRAG BIKE — game balap motor drag race 402m (quarter mile)
   Kode orisinal. Grafis: canvas. Suara: WebAudio. Tanpa aset eksternal.
   Mode: Balap (vs bot AI), Mabar Lokal 2P, Mabar Online (WebSocket).
   ============================================================================ */
(function () {
'use strict';

/* ---------------- Util ---------------- */
var $ = function (id) { return document.getElementById(id); };
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rand(a, b) { return a + Math.random() * (b - a); }
function fmtTime(s) { return s == null ? '-' : s.toFixed(2) + ' dtk'; }
function kmh(ms) { return ms * 3.6; }

/* ---------------- Data & Penyimpanan ---------------- */
var TRACK_M = 402;                 // quarter mile
var SAVE_COINS = 'dragbike_coins';
var SAVE_UP = 'dragbike_upgrades';

var UPGRADES = {
  mesin:   { name: 'Mesin',   icon: '🔩', desc: '+8 km/jam top speed & +8% akselerasi per level.', base: 150, max: 5 },
  knalpot: { name: 'Knalpot', icon: '🔊', desc: '+3 km/jam top speed & +5% akselerasi per level.', base: 120, max: 5 },
  ban:     { name: 'Ban',     icon: '🛞', desc: '+6% grip saat start & +2% akselerasi per level.', base: 100, max: 5 },
  nitro:   { name: 'Nitro',   icon: '💨', desc: '+0,5 detik durasi nitro per level.',             base: 100, max: 5 }
};

var BOTS = [
  { id: 'pemula',  name: 'Budi Santai', diff: 'Pemula',  topSpeed: 175, reactMin: 0.55, reactMax: 0.85, shiftErr: 650, nitroChance: 0.5,  reward: 100, color: '#2ecc71', desc: 'Baru belajar. Reaksi lambat, sering salah gigi.' },
  { id: 'pro',     name: 'Raka Kilat',  diff: 'Pro',     topSpeed: 198, reactMin: 0.35, reactMax: 0.50, shiftErr: 300, nitroChance: 0.75, reward: 250, color: '#f39c12', desc: 'Pembalap jalanan. Reaksi cepat, gigi rapi.' },
  { id: 'legenda', name: 'Dedi Petir',  diff: 'Legenda', topSpeed: 218, reactMin: 0.20, reactMax: 0.30, shiftErr: 100, nitroChance: 0.9,  reward: 500, color: '#e74c3c', desc: 'Sang legenda drag. Hampir sempurna di semua hal.' }
];

var state = {
  coins: 0,
  upgrades: { mesin: 0, knalpot: 0, ban: 0, nitro: 0 },
  screen: 'menu'
};

function loadSave() {
  try {
    state.coins = parseInt(localStorage.getItem(SAVE_COINS) || '0', 10) || 0;
    var up = JSON.parse(localStorage.getItem(SAVE_UP) || '{}');
    for (var k in state.upgrades) state.upgrades[k] = clamp(parseInt(up[k] || 0, 10) || 0, 0, 5);
  } catch (e) { /* localStorage tidak tersedia (mis. file:// dibatasi) */ }
}
function saveAll() {
  try {
    localStorage.setItem(SAVE_COINS, String(state.coins));
    localStorage.setItem(SAVE_UP, JSON.stringify(state.upgrades));
  } catch (e) { /* abaikan */ }
}

/* ---------------- Stat motor ---------------- */
function bikeStats(up) {
  up = up || state.upgrades;
  var top = 180 + up.mesin * 8 + up.knalpot * 3;                 // km/jam
  var accel = 1 + up.mesin * 0.08 + up.knalpot * 0.05 + up.ban * 0.02;
  var grip = 0.70 + up.ban * 0.06;                                // 0.70 - 1.00
  var nitroDur = 2 + up.nitro * 0.5;                              // detik
  return { topSpeed: top, topMs: top / 3.6, accel: accel, grip: grip, nitroDur: nitroDur };
}

/* Simulasi 0-100 km/jam dengan pindah gigi otomatis (untuk tampilan stat). */
function simulate0100() {
  var st = bikeStats();
  var r = createRacer('Sim', '#fff', st);
  r.gas = true;
  var dt = 0.02, t = 0;
  while (t < 12) {
    autoShift(r);
    stepRacer(r, dt);
    t += dt;
    if (kmh(r.speed) >= 100) return t;
  }
  return null;
}

/* ---------------- Suara mesin (WebAudio) ---------------- */
var AudioFX = {
  ctx: null, osc: null, osc2: null, gain: null, started: false,
  init: function () {
    if (this.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.osc = this.ctx.createOscillator(); this.osc.type = 'sawtooth';
      this.osc2 = this.ctx.createOscillator(); this.osc2.type = 'square';
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0;
      var filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900;
      this.osc.connect(filt); this.osc2.connect(filt); filt.connect(this.gain); this.gain.connect(this.ctx.destination);
      this.osc.start(); this.osc2.start(); this.started = true;
    } catch (e) { /* suara opsional */ }
  },
  engine: function (rpm, gas) {
    if (!this.started || !this.ctx) return;
    var f = 55 + (rpm / 12000) * 260;
    this.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
    this.gain.gain.setTargetAtTime(gas ? 0.05 : 0.015, this.ctx.currentTime, 0.08);
  },
  beep: function (freq, dur) {
    if (!this.started || !this.ctx) return;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },
  stop: function () { if (this.gain) this.gain.gain.value = 0; }
};

/* ---------------- Fisika pembalap ---------------- */
var GEAR_MAX = [60, 100, 140, 185, 999];   // km/jam batas tiap gigi (gigi 5 = top speed)
var RPM_MIN = 3000, RPM_MAX = 12000;
var POWER_LOW = 8000, POWER_HIGH = 10500;  // power band
var OPT_SHIFT = 9500;

function createRacer(name, color, stats) {
  return {
    name: name, color: color, stats: stats,
    dist: 0, speed: 0, gear: 1, rpm: RPM_MIN,
    gas: false, nitroActive: false, nitroLeft: stats.nitroDur,
    finished: false, finishTime: null, reaction: null, falseStart: false,
    wheelspin: 0, smoke: []
  };
}

/* RPM dari kecepatan di gigi saat ini. */
function rpmFor(r) {
  var sp = kmh(r.speed);
  var gmax = Math.min(GEAR_MAX[r.gear - 1], r.stats.topSpeed);
  var gmin = r.gear === 1 ? 0 : GEAR_MAX[r.gear - 2];
  var frac = clamp((sp - gmin) / Math.max(1, gmax - gmin), 0, 1);
  return RPM_MIN + frac * (RPM_MAX - RPM_MIN);
}

function shiftUp(r) {
  if (r.gear < 5) { r.gear++; r.rpm = rpmFor(r); return true; }
  return false;
}

/* Pindah gigi otomatis di RPM optimal (dipakai bot & simulasi stat). */
function autoShift(r) {
  if (r.rpm >= OPT_SHIFT && r.gear < 5) shiftUp(r);
}

function stepRacer(r, dt) {
  if (r.finished) return;
  var sp = kmh(r.speed);
  var top = r.stats.topSpeed * (r.nitroActive ? 1.15 : 1);
  var accel = 0;
  if (r.gas) {
    var gearPull = 1.55 - r.gear * 0.16;                    // gigi rendah = tarikan besar
    accel = 9.5 * r.stats.accel * gearPull;
    if (r.rpm >= POWER_LOW && r.rpm <= POWER_HIGH) accel *= 1.18;  // power band
    if (r.rpm > 11000) accel *= 0.25;                                // mentok limiter
    if (r.speed < 15 / 3.6) accel *= r.stats.grip;                  // grip saat start
    if (r.nitroActive && r.nitroLeft > 0) { accel *= 1.38; r.nitroLeft -= dt; if (r.nitroLeft <= 0) r.nitroActive = false; }
  }
  r.speed += accel * dt;
  if (!r.gas) r.speed -= r.speed * 0.25 * dt;               // engine braking ringan
  if (r.speed < 0) r.speed = 0;
  if (kmh(r.speed) > top) r.speed = top / 3.6;
  r.dist += r.speed * dt;
  r.rpm = rpmFor(r);
  if (r.dist >= TRACK_M) { r.dist = TRACK_M; r.finished = true; }
}

/* ---------------- Partikel asap ---------------- */
function spawnSmoke(r, x, y) {
  if (r.smoke.length < 60) r.smoke.push({ x: x, y: y, r: 4 + Math.random() * 5, life: 1 });
}
function updateSmoke(r, dt) {
  for (var i = r.smoke.length - 1; i >= 0; i--) {
    var p = r.smoke[i]; p.life -= dt * 1.4; p.r += dt * 22; p.x -= dt * 30;
    if (p.life <= 0) r.smoke.splice(i, 1);
  }
}

/* Ekspos fungsi murni untuk pengujian (node --check / harness). */
if (typeof window !== 'undefined') {
  window.DragBike = { createRacer: createRacer, stepRacer: stepRacer, autoShift: autoShift, bikeStats: bikeStats, simulate0100: simulate0100, TRACK_M: TRACK_M };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createRacer: createRacer, stepRacer: stepRacer, autoShift: autoShift, bikeStats: bikeStats, simulate0100: simulate0100, TRACK_M: TRACK_M };
}

/* ============================================================================
   BAGIAN 2 — Mesin balapan, AI bot, rendering canvas, HUD
   ============================================================================ */

/* ---------------- State balapan ---------------- */
var race = null;   // { mode:'bot'|'local'|'online', racers:[], phase, clock, goAt, ... }

function newRace(mode, racers, meta) {
  race = {
    mode: mode, racers: racers, meta: meta || {},
    phase: 'countdown', clock: 0, countStep: -1, goAt: 0,
    countT: 0, result: null, winner: null
  };
  return race;
}

function startCountdown() {
  race.phase = 'countdown';
  race.countT = 0; race.countStep = -1;
  race.goAt = 3.6 + rand(0.4, 1.2);   // 3 lampu + jeda acak sebelum GO
  $('countdown-overlay').classList.remove('hidden');
  $('countdown-overlay').classList.remove('go');
  $('false-start').classList.add('hidden');
  $('result-panel').classList.add('hidden');
  AudioFX.init();
}

/* Dipanggil tiap frame saat countdown. */
function updateCountdown(dt) {
  race.countT += dt;
  var step = Math.floor(race.countT / 1.0);   // 0,1,2 = lampu 3,2,1
  if (step !== race.countStep && step <= 2) {
    race.countStep = step;
    var ov = $('countdown-overlay');
    ov.textContent = String(3 - step);
    AudioFX.beep(440, 0.15);
  }
  if (race.countT >= race.goAt) {
    race.phase = 'racing';
    race.clock = 0;
    var ov2 = $('countdown-overlay');
    ov2.textContent = 'GO!'; ov2.classList.add('go');
    AudioFX.beep(880, 0.35);
    setTimeout(function () { ov2.classList.add('hidden'); }, 700);
  }
}

/* Gas ditekan: cek false start & catat reaction time. */
function onGasDown(r) {
  AudioFX.init();
  if (!race) return;
  if (race.phase === 'countdown') {
    r.falseStart = true;
    r.gas = false;
    $('false-start').classList.remove('hidden');
    AudioFX.beep(180, 0.5);
    if (race.mode === 'bot' || race.mode === 'online') finishRace(r, true);
    return;
  }
  if (race.phase !== 'racing') return;
  r.gas = true;
  if (r.reaction == null) r.reaction = race.clock;
}
function onGasUp(r) { if (r) r.gas = false; }
function onGear(r) { if (race && race.phase === 'racing' && r && !r.finished) shiftUp(r); }
function onNitro(r) {
  if (race && race.phase === 'racing' && r && !r.finished && r.nitroLeft > 0) r.nitroActive = true;
}

/* ---------------- AI Bot ---------------- */
function makeBotRacer(bot) {
  var st = { topSpeed: bot.topSpeed, topMs: bot.topSpeed / 3.6, accel: 1 + (bot.topSpeed - 180) / 220, grip: 0.9, nitroDur: 2.5 };
  var r = createRacer(bot.name, bot.color, st);
  r.bot = bot;
  r.botReactAt = rand(bot.reactMin, bot.reactMax);
  r.botShiftAt = OPT_SHIFT + rand(-bot.shiftErr, bot.shiftErr);
  r.botNitroAt = rand(0.55, 0.7) * TRACK_M;
  r.botNitroDone = false;
  return r;
}

function updateBot(r, dt) {
  if (race.phase !== 'racing' || r.finished || r.falseStart) return;
  if (race.clock >= r.botReactAt) {
    if (r.reaction == null) r.reaction = race.clock;
    r.gas = true;
  }
  if (r.gas && r.rpm >= r.botShiftAt && r.gear < 5) shiftUp(r);
  if (!r.botNitroDone && r.dist >= r.botNitroAt && Math.random() < r.bot.nitroChance) {
    r.nitroActive = true; r.botNitroDone = true;
  }
}

/* ---------------- Loop utama balapan ---------------- */
var lastTs = 0, rafId = 0;
function raceLoop(ts) {
  if (!race) return;
  var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;

  if (race.phase === 'countdown') updateCountdown(dt);
  if (race.phase === 'racing') {
    race.clock += dt;
    race.racers.forEach(function (r) {
      if (r.bot) updateBot(r, dt);
      stepRacer(r, dt);
      // Asap ban saat start
      if (r.gas && r.speed < 20 / 3.6 && Math.random() < 0.6) {
        var pos = bikeScreenPos(r);
        spawnSmoke(r, pos.x - 34, pos.y + 16);
      }
      updateSmoke(r, dt);
      if (r.finished && r.finishTime == null) {
        r.finishTime = race.clock;
        if (race.mode === 'bot' || race.mode === 'local') checkRaceEnd();
        if (race.mode === 'online') Online.send({ type: 'finish', time: r.finishTime });
      }
    });
    if (race.mode === 'online') Online.tick(dt);
    // Suara mesin pemain utama
    var me = race.racers[0];
    AudioFX.engine(me.rpm, me.gas);
  }

  drawRace();
  updateHUD();

  if (race.phase === 'finished') { AudioFX.stop(); return; }
  rafId = requestAnimationFrame(raceLoop);
}

function checkRaceEnd() {
  if (!race || race.phase !== 'racing') return;
  var done = race.racers.every(function (r) { return r.finished || r.falseStart; });
  var anyFinish = race.racers.some(function (r) { return r.finished; });
  if (done || (anyFinish && race.mode === 'bot')) finishRace(null, false);
  else if (done) finishRace(null, false);
}

function finishRace(loser, isFalseStart) {
  if (!race || race.phase === 'finished') return;
  race.phase = 'finished';
  cancelAnimationFrame(rafId);
  AudioFX.stop();

  var me = race.racers[0];
  var winner = null, title = '', coins = 0;
  if (race.mode === 'bot') {
    var bot = race.racers[1];
    if (isFalseStart || me.falseStart) { winner = bot; title = '❌ FALSE START — KAMU KALAH'; coins = 0; }
    else if (me.finished && (!bot.finished || me.finishTime <= bot.finishTime)) { winner = me; title = '🏆 MENANG!'; coins = race.meta.bot.reward; }
    else { winner = bot; title = '😢 KALAH — Coba Lagi!'; coins = 25; }
  } else if (race.mode === 'local') {
    var p1 = race.racers[0], p2 = race.racers[1];
    if (p1.falseStart && !p2.falseStart) { winner = p2; title = '🏆 ' + p2.name + ' MENANG!'; }
    else if (p2.falseStart && !p1.falseStart) { winner = p1; title = '🏆 ' + p1.name + ' MENANG!'; }
    else if (p1.falseStart && p2.falseStart) { winner = null; title = '🤝 Keduanya False Start!'; }
    else if (p1.finished && (!p2.finished || p1.finishTime <= p2.finishTime)) { winner = p1; title = '🏆 ' + p1.name + ' MENANG!'; }
    else { winner = p2; title = '🏆 ' + p2.name + ' MENANG!'; }
    coins = winner ? 150 : 0;
  } else if (race.mode === 'online') {
    winner = race.meta.onlineWinner || null;
    title = winner && winner === race.meta.myName ? '🏆 MENANG!' : (winner ? '😢 ' + winner + ' MENANG' : '🏁 BALAPAN SELESAI');
    coins = winner === race.meta.myName ? 300 : 25;
  }

  state.coins += coins; saveAll();
  race.result = { title: title, coins: coins, winner: winner };
  showResult(me, coins, title);
}

/* ---------------- HUD & hasil ---------------- */
function updateHUD() {
  if (!race) return;
  var me = race.racers[0];
  $('speed-text').textContent = Math.round(kmh(me.speed));
  $('gear-text').textContent = me.finished ? 'F' : (me.speed < 1 && race.phase !== 'racing' ? 'N' : me.gear);
  $('dist-text').textContent = Math.round(me.dist);
  $('react-text').textContent = me.reaction == null ? '-' : me.reaction.toFixed(2) + 's';
  $('race-clock').textContent = race.clock.toFixed(2);
  $('rpm-text').textContent = Math.round(me.rpm);
  $('rpm-needle').style.left = (10 + (me.rpm / RPM_MAX) * 80) + '%';
  $('nitro-fill').style.width = (me.nitroLeft / me.stats.nitroDur * 100) + '%';
  $('nitro-text').textContent = me.nitroLeft.toFixed(1) + ' dtk';
}

function showResult(me, coins, title) {
  $('result-title').textContent = title;
  $('result-time').textContent = me.finishTime != null ? fmtTime(me.finishTime) : (me.falseStart ? 'False Start' : '-');
  $('result-speed').textContent = Math.round(kmh(me.speed)) + ' km/jam';
  $('result-react').textContent = me.reaction == null ? '-' : me.reaction.toFixed(2) + ' dtk';
  $('result-coins').textContent = '+' + coins + ' 🪙';
  // Podium
  var order = race.racers.slice().sort(function (a, b) {
    if (a.falseStart && !b.falseStart) return 1;
    if (!a.falseStart && b.falseStart) return -1;
    return (a.finishTime || 99) - (b.finishTime || 99);
  });
  var pod = $('result-podium'); pod.innerHTML = '';
  order.slice(0, 3).forEach(function (r, i) {
    var d = document.createElement('div');
    d.className = 'step ' + (i === 0 ? 'first' : i === 1 ? 'second' : 'third');
    d.innerHTML = ['🥇', '🥈', '🥉'][i] + '<br>' + r.name + '<br>' + (r.finishTime != null ? r.finishTime.toFixed(2) + ' dtk' : (r.falseStart ? 'DQ' : 'DNF'));
    pod.appendChild(d);
  });
  $('result-panel').classList.remove('hidden');
  AudioFX.beep(660, 0.2); setTimeout(function () { AudioFX.beep(880, 0.3); }, 200);
}

/* ---------------- Rendering canvas ---------------- */
var canvas = null, ctx2d = null;
function bikeScreenPos(r) {
  // Kamera mengikuti pembalap terdepan; jendela pandang ~150 m
  if (!canvas) canvas = $('race-canvas');
  var leader = Math.max.apply(null, race.racers.map(function (x) { return x.dist; }));
  var W = canvas.width;
  var x = W * 0.55 + (r.dist - leader) * (W / 150);
  return { x: x, leader: leader };
}

function drawRace() {
  if (!canvas) { canvas = $('race-canvas'); ctx2d = canvas.getContext('2d'); }
  var c = ctx2d, W = canvas.width, H = canvas.height;
  var lanes = race.racers.length;
  var laneH = H / lanes;
  var leader = Math.max.apply(null, race.racers.map(function (x) { return x.dist; }));

  // Langit
  var sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a2340'); sky.addColorStop(0.55, '#2c1a3d'); sky.addColorStop(0.55, '#0d0f1a'); sky.addColorStop(1, '#0d0f1a');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);

  // Matahari terbenam + gedung siluet
  c.fillStyle = '#ff9d00'; c.beginPath(); c.arc(W * 0.8, H * 0.22, 34, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#131728';
  var off = (leader * 3) % 120;
  for (var bx = -off; bx < W; bx += 120) {
    var bh = 40 + ((bx * 7) % 50);
    c.fillRect(bx, H * 0.55 - bh, 70, bh);
  }

  // Garis start & finis + patok jarak (parallax terhadap leader)
  function worldX(m) { return W * 0.55 + (m - leader) * (W / 150); }
  c.strokeStyle = '#ffffff'; c.lineWidth = 3;
  var sx = worldX(0);
  if (sx > -20 && sx < W + 20) { c.beginPath(); c.moveTo(sx, H * 0.55); c.lineTo(sx, H); c.stroke(); }
  var fx = worldX(TRACK_M);
  if (fx > -20 && fx < W + 20) {
    for (var fy = H * 0.55; fy < H; fy += 12) {
      c.fillStyle = (Math.floor(fy / 12) % 2 === 0) ? '#fff' : '#111';
      c.fillRect(fx - 5, fy, 10, 12);
    }
  }
  c.fillStyle = '#9aa3c7'; c.font = '12px sans-serif'; c.textAlign = 'center';
  for (var m = 50; m < TRACK_M; m += 50) {
    var px = worldX(m);
    if (px > 0 && px < W) { c.fillRect(px, H * 0.55, 2, 10); c.fillText(m + 'm', px, H * 0.55 - 6); }
  }

  // Lintasan per pemain
  race.racers.forEach(function (r, i) {
    var y0 = laneH * i, yRoad = y0 + laneH * 0.62;
    // Aspal
    c.fillStyle = '#232838'; c.fillRect(0, yRoad - 26, W, 52);
    c.strokeStyle = '#ffd54f'; c.lineWidth = 2; c.setLineDash([18, 14]);
    c.beginPath(); c.moveTo(0, yRoad); c.lineTo(W, yRoad); c.stroke(); c.setLineDash([]);
    // Nama
    c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'left';
    c.fillText((i + 1) + '. ' + r.name + (r.finished ? '  🏁 ' + r.finishTime.toFixed(2) + 's' : ''), 10, y0 + 20);
    // Asap
    var pos = bikeScreenPos(r);
    r.smoke.forEach(function (p) {
      c.globalAlpha = Math.max(0, p.life) * 0.5;
      c.fillStyle = '#bbb'; c.beginPath(); c.arc(p.x, yRoad + 8, p.r, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
    drawBike(c, pos.x, yRoad, r);
  });
}

/* Gambar motor sport dari samping (canvas murni). */
function drawBike(c, x, yRoad, r) {
  var lean = r.gas ? -0.06 : 0;
  c.save(); c.translate(x, yRoad); c.rotate(lean);
  var wheelY = 14;
  // Roda
  c.fillStyle = '#111';
  [[-26, wheelY], [26, wheelY]].forEach(function (w) {
    c.beginPath(); c.arc(w[0], w[1], 13, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#888'; c.lineWidth = 2;
    c.beginPath(); c.arc(w[0], w[1], 6, 0, Math.PI * 2); c.stroke();
  });
  // Bodi motor
  c.fillStyle = r.color;
  c.beginPath();
  c.moveTo(-30, 8); c.lineTo(-8, -12); c.lineTo(18, -12); c.lineTo(30, 6); c.lineTo(10, 10); c.lineTo(-14, 10);
  c.closePath(); c.fill();
  // Knalpot + api nitro
  c.fillStyle = '#bbb'; c.fillRect(-34, 6, 12, 5);
  if (r.nitroActive) {
    c.fillStyle = '#00e5ff';
    c.beginPath(); c.moveTo(-34, 8); c.lineTo(-52 - Math.random() * 12, 2); c.lineTo(-52 - Math.random() * 12, 14); c.closePath(); c.fill();
  }
  // Pembalap
  c.strokeStyle = '#222'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-4, -12); c.lineTo(8, -22); c.stroke();       // badan
  c.beginPath(); c.moveTo(8, -22); c.lineTo(16, -14); c.stroke();       // lengan
  c.fillStyle = '#ffd9b3'; c.beginPath(); c.arc(12, -28, 6, 0, Math.PI * 2); c.fill(); // kepala
  c.fillStyle = r.color; c.beginPath(); c.arc(12, -28, 7, Math.PI, 0); c.fill();       // helm
  c.restore();
  // Bendera finis kecil kalau sudah finis
  if (r.finished) {
    c.fillStyle = '#2ecc71'; c.font = 'bold 13px sans-serif'; c.textAlign = 'left';
    c.fillText('FINISH ✓', x + 40, yRoad - 24);
  }
}

/* ============================================================================
   BAGIAN 3 — Input, mode balap, mabar online, garasi, navigasi layar
   ============================================================================ */

/* ---------------- Navigasi layar ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  $(id).classList.add('active');
  state.screen = id;
  if (id === 'screen-menu') refreshMenu();
  if (id === 'screen-garage') renderGarage();
  if (window.scrollTo) window.scrollTo(0, 0);
}

function refreshMenu() {
  $('menu-coins').textContent = state.coins;
  var st = bikeStats();
  var t0100 = simulate0100();
  $('menu-stats').textContent = 'Top Speed: ' + st.topSpeed + ' km/jam  •  0-100: ' + (t0100 ? t0100.toFixed(2) + ' dtk' : '-') + '  •  Nitro: ' + st.nitroDur.toFixed(1) + ' dtk';
}

/* ---------------- Mode: Balap vs Bot ---------------- */
var selectedBot = BOTS[1];
function renderBots() {
  var grid = $('bot-grid'); grid.innerHTML = '';
  BOTS.forEach(function (b) {
    var d = document.createElement('div');
    d.className = 'bot-card';
    d.innerHTML = '<h3>' + b.name + '</h3><span class="diff ' + b.id + '">' + b.diff + '</span>' +
      '<p>Top speed ' + b.topSpeed + ' km/jam<br>' + b.desc + '</p>' +
      '<div class="reward">🏆 Hadiah menang: ' + b.reward + ' 🪙</div>';
    d.onclick = function () { selectedBot = b; startBotRace(); };
    grid.appendChild(d);
  });
}

function startBotRace() {
  var me = createRacer('Kamu', '#3498db', bikeStats());
  var bot = makeBotRacer(selectedBot);
  newRace('bot', [me, bot], { bot: selectedBot });
  $('race-title').textContent = 'Drag Race 402m';
  $('race-opponent').textContent = 'vs ' + selectedBot.name + ' (' + selectedBot.diff + ')';
  $('touch-single').classList.remove('hidden');
  $('touch-duo').classList.add('hidden');
  showScreen('screen-race');
  lastTs = performance.now();
  startCountdown();
  rafId = requestAnimationFrame(raceLoop);
}

/* ---------------- Mode: Mabar Lokal 2P ---------------- */
function startLocalRace() {
  var n1 = ($('local-name1').value || 'Rider 1').trim();
  var n2 = ($('local-name2').value || 'Rider 2').trim();
  var st = bikeStats();
  var p1 = createRacer(n1, '#3498db', st);
  var p2 = createRacer(n2, '#2ecc71', st);
  newRace('local', [p1, p2], {});
  $('race-title').textContent = 'Mabar Lokal — 2 Pemain';
  $('race-opponent').textContent = n1 + ' vs ' + n2;
  $('touch-single').classList.add('hidden');
  $('touch-duo').classList.remove('hidden');
  showScreen('screen-race');
  lastTs = performance.now();
  startCountdown();
  rafId = requestAnimationFrame(raceLoop);
}

/* ---------------- Mode: Mabar Online (WebSocket) ---------------- */
var Online = {
  ws: null, room: null, myName: 'Rider', isHost: false, connected: false, sendT: 0,
  log: function (msg) { $('online-status').textContent = msg; },
  connect: function (serverUrl, room, name, asHost) {
    this.myName = name; this.isHost = asHost;
    try { this.ws = new WebSocket(serverUrl); } catch (e) { this.log('❌ URL server tidak valid.'); return; }
    var self = this;
    this.ws.onopen = function () {
      self.connected = true;
      self.log('✅ Terhubung ke server. ' + (asHost ? 'Membuat room...' : 'Gabung room...'));
      self.send({ type: asHost ? 'create' : 'join', room: room, name: name });
    };
    this.ws.onmessage = function (ev) { self.onMsg(JSON.parse(ev.data)); };
    this.ws.onclose = function () { self.connected = false; self.log('⚠ Koneksi ke server putus.'); };
    this.ws.onerror = function () { self.log('❌ Tidak bisa terhubung ke server. Pastikan server.js jalan.'); };
  },
  send: function (obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  },
  onMsg: function (m) {
    if (m.type === 'room') {
      this.room = m.room;
      this.log('🏠 Room: ' + m.room + ' — bagikan kode ini ke temanmu!');
      this.renderPlayers(m.players);
      if (this.isHost) $('btn-online-start').classList.remove('hidden');
    } else if (m.type === 'players') {
      this.renderPlayers(m.players);
    } else if (m.type === 'countdown') {
      // Countdown sinkron dari server
      this.beginOnlineRace(m.players);
    } else if (m.type === 'state') {
      if (race && race.mode === 'online') {
        m.players.forEach(function (p) {
          var r = race.racers.find(function (x) { return x.name === p.name; });
          if (r && p.name !== Online.myName) { r.dist = p.dist; r.speed = p.speed; if (p.finished) { r.finished = true; r.finishTime = p.time; } }
        });
      }
    } else if (m.type === 'result') {
      if (race && race.mode === 'online') {
        race.meta.onlineWinner = m.winner;
        race.racers.forEach(function (r) { if (r.name === m.winner) { r.finished = true; r.finishTime = m.times[m.winner]; } });
        if (race.phase === 'racing') finishRace(null, false);
      }
    } else if (m.type === 'error') {
      this.log('❌ ' + m.msg);
    }
  },
  renderPlayers: function (players) {
    var el = $('player-list'); el.innerHTML = '';
    players.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'player';
      d.textContent = (p.host ? '👑 ' : '🏍️ ') + p.name + (p.name === Online.myName ? ' (kamu)' : '');
      el.appendChild(d);
    });
  },
  beginOnlineRace: function (players) {
    var colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12'];
    var st = bikeStats();
    var racers = players.map(function (p, i) {
      var r = createRacer(p.name, colors[i % colors.length], st);
      r.online = true;
      return r;
    });
    // Urutan: pemain sendiri di lane pertama (HUD)
    racers.sort(function (a, b) { return a.name === Online.myName ? -1 : b.name === Online.myName ? 1 : 0; });
    newRace('online', racers, { myName: Online.myName });
    $('race-title').textContent = 'Mabar Online — Room ' + Online.room;
    $('race-opponent').textContent = racers.map(function (r) { return r.name; }).join(' vs ');
    $('touch-single').classList.remove('hidden');
    $('touch-duo').classList.add('hidden');
    showScreen('screen-race');
    lastTs = performance.now();
    startCountdown();
    rafId = requestAnimationFrame(raceLoop);
  },
  tick: function (dt) {
    this.sendT += dt;
    if (this.sendT >= 0.1 && race && race.phase === 'racing') {
      this.sendT = 0;
      var me = race.racers[0];
      this.send({ type: 'input', dist: me.dist, speed: me.speed, finished: me.finished, time: me.finishTime });
    }
  }
};

/* ---------------- Garasi ---------------- */
function renderGarage() {
  $('garage-coins').textContent = state.coins;
  var st = bikeStats();
  $('stat-top').textContent = st.topSpeed + ' km/jam';
  var t0100 = simulate0100();
  $('stat-0100').textContent = t0100 ? t0100.toFixed(2) + ' dtk' : '-';
  $('stat-nitro').textContent = st.nitroDur.toFixed(1) + ' dtk';
  var grid = $('upgrade-grid'); grid.innerHTML = '';
  Object.keys(UPGRADES).forEach(function (key) {
    var u = UPGRADES[key], lvl = state.upgrades[key];
    var cost = lvl >= u.max ? null : u.base * (lvl + 1);
    var d = document.createElement('div');
    d.className = 'upgrade-card';
    var pips = '';
    for (var i = 0; i < u.max; i++) pips += i < lvl ? '●' : '○';
    d.innerHTML = '<h3>' + u.icon + ' ' + u.name + '</h3><p>' + u.desc + '</p>' +
      '<div class="levels">' + pips + ' Lv ' + lvl + '/' + u.max + '</div>';
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = cost == null ? 'MAX ✓' : 'Upgrade — ' + cost + ' 🪙';
    btn.disabled = cost == null || state.coins < cost;
    btn.onclick = function () {
      if (state.coins >= cost) {
        state.coins -= cost; state.upgrades[key]++; saveAll(); renderGarage(); refreshMenu();
      }
    };
    d.appendChild(btn);
    grid.appendChild(d);
  });
}

/* ---------------- Input: keyboard & sentuh ---------------- */
function meRacer() { return race ? race.racers[0] : null; }
function p2Racer() { return race && race.racers[1] ? race.racers[1] : null; }

var KEYMAP = {
  // gas, gigi, nitro — pemain 1
  KeyA: ['p1', 'gas'], Space: ['p1', 'gas'],
  KeyS: ['p1', 'gear'], ShiftLeft: ['p1', 'gear'], ShiftRight: ['p1', 'gear'],
  KeyD: ['p1', 'nitro'], KeyN: ['p1', 'nitro'],
  // pemain 2
  ArrowUp: ['p2', 'gas'],
  ArrowRight: ['p2', 'gear'],
  Enter: ['p2', 'nitro']
};

document.addEventListener('keydown', function (e) {
  if (!race || state.screen !== 'screen-race') return;
  var m = KEYMAP[e.code];
  if (!m) return;
  e.preventDefault();
  if (e.repeat && m[1] !== 'gas') return;
  var r = m[0] === 'p1' ? meRacer() : p2Racer();
  if (!r) return;
  if (race.mode !== 'local' && m[0] === 'p2') r = meRacer(); // balap sendiri: semua tombol = pemain
  if (m[1] === 'gas') onGasDown(r);
  else if (m[1] === 'gear') onGear(r);
  else if (m[1] === 'nitro') onNitro(r);
});
document.addEventListener('keyup', function (e) {
  if (!race) return;
  var m = KEYMAP[e.code];
  if (!m || m[1] !== 'gas') return;
  var r = m[0] === 'p1' ? meRacer() : p2Racer();
  if (!r || (race.mode !== 'local' && m[0] === 'p2')) r = meRacer();
  onGasUp(r);
});

function bindHold(id, down, up) {
  var el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', function (e) { e.preventDefault(); down(); });
  el.addEventListener('pointerup', function (e) { e.preventDefault(); if (up) up(); });
  el.addEventListener('pointerleave', function () { if (up) up(); });
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

function bindTouch() {
  bindHold('touch-gas', function () { onGasDown(meRacer()); }, function () { onGasUp(meRacer()); });
  bindHold('touch-gear', function () { onGear(meRacer()); });
  bindHold('touch-nitro', function () { onNitro(meRacer()); });
  bindHold('touch-p1-gas', function () { onGasDown(meRacer()); }, function () { onGasUp(meRacer()); });
  bindHold('touch-p1-gear', function () { onGear(meRacer()); });
  bindHold('touch-p1-nitro', function () { onNitro(meRacer()); });
  bindHold('touch-p2-gas', function () { onGasDown(p2Racer()); }, function () { onGasUp(p2Racer()); });
  bindHold('touch-p2-gear', function () { onGear(p2Racer()); });
  bindHold('touch-p2-nitro', function () { onNitro(p2Racer()); });
}

/* ---------------- Tombol & tab ---------------- */
function bindUI() {
  $('btn-race').onclick = function () { renderBots(); showScreen('screen-bots'); };
  $('btn-multi').onclick = function () { showScreen('screen-multi'); };
  $('btn-garage').onclick = function () { renderGarage(); showScreen('screen-garage'); };
  $('btn-howto').onclick = function () { showScreen('screen-howto'); };
  $('btn-garage-back').onclick = function () { showScreen('screen-menu'); };
  $('btn-howto-back').onclick = function () { showScreen('screen-menu'); };
  $('btn-multi-back').onclick = function () { showScreen('screen-menu'); };
  $('btn-bots-back').onclick = function () { showScreen('screen-menu'); };
  $('btn-race-quit').onclick = function () { if (race) { race.phase = 'finished'; cancelAnimationFrame(rafId); AudioFX.stop(); } showScreen('screen-menu'); };
  $('btn-race-again').onclick = function () {
    if (!race) return;
    if (race.mode === 'bot') startBotRace();
    else if (race.mode === 'local') startLocalRace();
    else showScreen('screen-multi');
  };
  $('btn-race-menu').onclick = function () { showScreen('screen-menu'); };
  $('btn-local-start').onclick = function () { AudioFX.init(); startLocalRace(); };

  $('tab-local').onclick = function () {
    $('tab-local').classList.add('active'); $('tab-online').classList.remove('active');
    $('panel-local').classList.remove('hidden'); $('panel-online').classList.add('hidden');
  };
  $('tab-online').onclick = function () {
    $('tab-online').classList.add('active'); $('tab-local').classList.remove('active');
    $('panel-online').classList.remove('hidden'); $('panel-local').classList.add('hidden');
  };
  $('btn-create-room').onclick = function () {
    var name = ($('online-name').value || 'Rider').trim();
    var server = ($('online-server').value || 'ws://localhost:8080').trim();
    var room = ($('online-room').value || '').trim().toUpperCase() || Math.random().toString(36).slice(2, 8).toUpperCase();
    $('online-room').value = room;
    Online.connect(server, room, name, true);
  };
  $('btn-join-room').onclick = function () {
    var name = ($('online-name').value || 'Rider').trim();
    var server = ($('online-server').value || 'ws://localhost:8080').trim();
    var room = ($('online-room').value || '').trim().toUpperCase();
    if (!room) { Online.log('❌ Isi dulu kode room yang mau digabung.'); return; }
    Online.connect(server, room, name, false);
  };
  $('btn-online-start').onclick = function () {
    Online.send({ type: 'start' });
    Online.log('🏁 Countdown dimulai untuk semua pemain...');
  };
}

/* ---------------- Init ---------------- */
loadSave();
bindUI();
bindTouch();
refreshMenu();
showScreen('screen-menu');

})();

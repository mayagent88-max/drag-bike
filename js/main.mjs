/* ============================================================================
   DRAG BIKE 3D — js/main.mjs
   Logika game (port v1) + rendering Three.js.
   Mode: Balap vs bot AI, Mabar Lokal 2P (split-screen scissor), Mabar Online.
   ============================================================================ */
import * as THREE from 'three';
import {
  TRACK_M, BOTS, UPGRADES, POWER_LOW, POWER_HIGH, OPT_SHIFT, RPM_MIN, RPM_MAX,
  clamp, rand, kmh, bikeStats, createRacer, rpmFor, shiftUp, autoShift,
  stepRacer, simulate0100
} from './physics.mjs';
import { AudioFX } from './audio.mjs';
import { buildBike, createSmokePool } from './bike.mjs';
import { buildTrack, laneX } from './track.mjs';

/* ---------------- Util DOM ---------------- */
const $ = (id) => document.getElementById(id);
const fmtTime = (s) => (s == null ? '-' : s.toFixed(2) + ' dtk');

/* ---------------- Data & Penyimpanan ---------------- */
const SAVE_COINS = 'dragbike_coins';
const SAVE_UP = 'dragbike_upgrades';
const state = {
  coins: 0,
  upgrades: { mesin: 0, knalpot: 0, ban: 0, nitro: 0 },
  screen: 'menu'
};

function loadSave() {
  try {
    state.coins = parseInt(localStorage.getItem(SAVE_COINS) || '0', 10) || 0;
    const up = JSON.parse(localStorage.getItem(SAVE_UP) || '{}');
    for (const k in state.upgrades) state.upgrades[k] = clamp(parseInt(up[k] || 0, 10) || 0, 0, 5);
  } catch (e) { /* localStorage tidak tersedia */ }
}
function saveAll() {
  try {
    localStorage.setItem(SAVE_COINS, String(state.coins));
    localStorage.setItem(SAVE_UP, JSON.stringify(state.upgrades));
  } catch (e) { /* abaikan */ }
}

/* ---------------- Setup Three.js ---------------- */
const glWrap = $('gl-wrap');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  glWrap.innerHTML = '<p style="padding:20px">❌ Perangkat ini tidak mendukung WebGL — game 3D tidak bisa jalan.</p>';
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 600);
const track = buildTrack(scene);
const smoke = createSmokePool(scene, 48);

function sizeRenderer() {
  if (!renderer) return;
  const w = glWrap.clientWidth || 960;
  const h = glWrap.clientHeight || 540;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
if (renderer) {
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  glWrap.appendChild(renderer.domElement);
  sizeRenderer();
  window.addEventListener('resize', sizeRenderer);
}

/* Kamera: state lerp per pembalap (untuk split-screen). */
const camStates = [0, 1, 2, 3].map(() => ({
  pos: new THREE.Vector3(0, 3.3, 8.5),
  look: new THREE.Vector3(0, 1, -12)
}));
let camMode = 'chase'; // 'chase' | 'side'
let orbitAngle = 0.6;

function positionCamera(racer, lane, idx, instant) {
  const cs = camStates[idx];
  const z = -racer.dist;
  let px, py, pz, lx, ly, lz;
  if (camMode === 'side') {
    px = lane + 13; py = 2.4; pz = z + 3;
    lx = lane; ly = 1; lz = z - 8;
  } else {
    px = lane * 0.6; py = 3.3; pz = z + 8.5;
    lx = lane; ly = 1.0; lz = z - 12;
  }
  if (instant) {
    cs.pos.set(px, py, pz);
    cs.look.set(lx, ly, lz);
  } else {
    const k = 1 - Math.exp(-6 * 0.016);
    cs.pos.lerp(new THREE.Vector3(px, py, pz), k);
    cs.look.lerp(new THREE.Vector3(lx, ly, lz), k);
  }
  // Getaran halus saat RPM tinggi
  if (racer.gas && camMode === 'chase') {
    const sh = (racer.rpm / RPM_MAX) * 0.07;
    cs.pos.x += (Math.random() - 0.5) * sh;
    cs.pos.y += (Math.random() - 0.5) * sh;
  }
  camera.position.copy(cs.pos);
  camera.lookAt(cs.look);
}

/* Motor 3D untuk preview (menu/garasi) */
let previewBike = null;
function rebuildPreview() {
  if (!renderer) return;
  if (previewBike) scene.remove(previewBike.group);
  previewBike = buildBike('#e74c3c', state.upgrades);
  previewBike.group.position.set(0, 0, 2);
  previewBike.group.rotation.y = 0.5;
  scene.add(previewBike.group);
}

/* Motor 3D untuk tiap pembalap saat balapan. */
const raceBikes = new Map(); // racer -> bike
function clearRaceBikes() {
  raceBikes.forEach((b) => scene.remove(b.group));
  raceBikes.clear();
}
function ensureRaceBikes() {
  if (!race) return;
  race.racers.forEach((r, i) => {
    if (!raceBikes.has(r)) {
      const bike = buildBike(r.color, state.upgrades);
      bike.group.position.set(laneX(i, race.racers.length), 0, 0);
      scene.add(bike.group);
      raceBikes.set(r, bike);
    }
  });
  if (previewBike) previewBike.group.visible = false;
}

/* ---------------- State balapan ---------------- */
let race = null;

function newRace(mode, racers, meta) {
  race = {
    mode, racers, meta: meta || {},
    phase: 'countdown', clock: 0, countStep: -1, goAt: 0,
    countT: 0, result: null, winner: null, goLightsOff: false
  };
  clearRaceBikes();
  return race;
}

function startCountdown() {
  race.phase = 'countdown';
  race.countT = 0; race.countStep = -1;
  race.goAt = 3.6 + rand(0.4, 1.2);
  $('countdown-overlay').classList.remove('hidden');
  $('countdown-overlay').classList.remove('go');
  $('false-start').classList.add('hidden');
  $('result-panel').classList.add('hidden');
  track.setLights(-1);
  AudioFX.init();
  ensureRaceBikes();
  // Kamera langsung ke posisi start
  race.racers.forEach((r, i) => positionCamera(r, laneX(i, race.racers.length), i, true));
}

function updateCountdown(dt) {
  race.countT += dt;
  const step = Math.floor(race.countT / 1.0);
  if (step !== race.countStep && step <= 2) {
    race.countStep = step;
    const ov = $('countdown-overlay');
    ov.textContent = String(3 - step);
    track.setLights(step);
    AudioFX.beep(440, 0.15);
  }
  if (race.countT >= race.goAt) {
    race.phase = 'racing';
    race.clock = 0;
    const ov2 = $('countdown-overlay');
    ov2.textContent = 'GO!';
    ov2.classList.add('go');
    track.setLights(3);
    AudioFX.beep(880, 0.35);
    setTimeout(() => { ov2.classList.add('hidden'); }, 700);
  }
}

function onGasDown(r) {
  AudioFX.init();
  if (!race || !r) return;
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
  const st = { topSpeed: bot.topSpeed, topMs: bot.topSpeed / 3.6, accel: 1 + (bot.topSpeed - 180) / 220, grip: 0.9, nitroDur: 2.5 };
  const r = createRacer(bot.name, bot.color, st);
  r.bot = bot;
  r.botReactAt = rand(bot.reactMin, bot.reactMax);
  r.botShiftAt = OPT_SHIFT + rand(-bot.shiftErr, bot.shiftErr);
  r.botNitroAt = rand(0.55, 0.7) * TRACK_M;
  r.botNitroDone = false;
  return r;
}

function updateBot(r) {
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

/* ---------------- Logika balapan per frame ---------------- */
function updateRace(dt) {
  if (!race) return;
  if (race.phase === 'countdown') updateCountdown(dt);
  if (race.phase === 'racing') {
    race.clock += dt;
    if (!race.goLightsOff && race.clock > 1.2) { track.setLights(-1); race.goLightsOff = true; }
    race.racers.forEach((r) => {
      if (r.bot) updateBot(r);
      stepRacer(r, dt);
      if (r.finished && r.finishTime == null) {
        r.finishTime = race.clock;
        if (race.mode === 'bot' || race.mode === 'local') checkRaceEnd();
        if (race.mode === 'online') Online.send({ type: 'finish', time: r.finishTime });
      }
    });
    if (race.mode === 'online') Online.tick(dt);
    const me = race.racers[0];
    AudioFX.engine(me.rpm, me.gas);
  }
}

function checkRaceEnd() {
  if (!race || race.phase !== 'racing') return;
  const done = race.racers.every((r) => r.finished || r.falseStart);
  const anyFinish = race.racers.some((r) => r.finished);
  if (done || (anyFinish && race.mode === 'bot')) finishRace(null, false);
}

function finishRace(loser, isFalseStart) {
  if (!race || race.phase === 'finished') return;
  race.phase = 'finished';
  AudioFX.stop();

  const me = race.racers[0];
  let winner = null, title = '', coins = 0;
  if (race.mode === 'bot') {
    const bot = race.racers[1];
    if (isFalseStart || me.falseStart) { winner = bot; title = '❌ FALSE START — KAMU KALAH'; coins = 0; }
    else if (me.finished && (!bot.finished || me.finishTime <= bot.finishTime)) { winner = me; title = '🏆 MENANG!'; coins = race.meta.bot.reward; }
    else { winner = bot; title = '😢 KALAH — Coba Lagi!'; coins = 25; }
  } else if (race.mode === 'local') {
    const p1 = race.racers[0], p2 = race.racers[1];
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
  race.result = { title, coins, winner };
  showResult(me, coins, title);
}

/* ---------------- HUD & hasil ---------------- */
function updateHUD() {
  if (!race) return;
  const me = race.racers[0];
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
  const order = race.racers.slice().sort((a, b) => {
    if (a.falseStart && !b.falseStart) return 1;
    if (!a.falseStart && b.falseStart) return -1;
    return (a.finishTime || 99) - (b.finishTime || 99);
  });
  const pod = $('result-podium'); pod.innerHTML = '';
  order.slice(0, 3).forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'step ' + (i === 0 ? 'first' : i === 1 ? 'second' : 'third');
    d.innerHTML = ['🥇', '🥈', '🥉'][i] + '<br>' + r.name + '<br>' + (r.finishTime != null ? r.finishTime.toFixed(2) + ' dtk' : (r.falseStart ? 'DQ' : 'DNF'));
    pod.appendChild(d);
  });
  $('result-panel').classList.remove('hidden');
  AudioFX.beep(660, 0.2); setTimeout(() => { AudioFX.beep(880, 0.3); }, 200);
}

/* ---------------- Rendering 3D per frame ---------------- */
function render3D(dt) {
  if (!renderer) return;
  // Update posisi + visual motor balapan
  if (race && (race.phase === 'countdown' || race.phase === 'racing' || race.phase === 'finished')) {
    ensureRaceBikes();
    race.racers.forEach((r, i) => {
      const bike = raceBikes.get(r);
      if (!bike) return;
      const lx = laneX(i, race.racers.length);
      bike.group.position.set(lx, 0, -r.dist);
      bike.update(r, dt);
      // Asap ban saat start
      if (r.gas && r.speed < 20 / 3.6 && Math.random() < 0.6) {
        smoke.spawn(lx, 0.35, -r.dist + 0.7);
      }
    });
    smoke.update(dt);
  } else if (previewBike) {
    // Menu / garasi: motor preview berputar pelan; sembunyikan motor balapan lama
    raceBikes.forEach((b) => { b.group.visible = false; });
    previewBike.group.visible = true;
    previewBike.group.rotation.y += dt * 0.4;
  }

  const w = glWrap.clientWidth || 960;
  const h = glWrap.clientHeight || 540;

  if (race && race.mode === 'local' && race.phase !== 'finished' && race.racers.length === 2) {
    // Split-screen: atas = P1, bawah = P2
    renderer.setScissorTest(true);
    renderer.setViewport(0, h / 2, w, h / 2);
    renderer.setScissor(0, h / 2, w, h / 2);
    camera.aspect = w / (h / 2);
    camera.updateProjectionMatrix();
    positionCamera(race.racers[0], laneX(0, 2), 0, false);
    renderer.render(scene, camera);
    renderer.setViewport(0, 0, w, h / 2);
    renderer.setScissor(0, 0, w, h / 2);
    positionCamera(race.racers[1], laneX(1, 2), 1, false);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  } else if (race && (race.phase === 'countdown' || race.phase === 'racing' || race.phase === 'finished')) {
    positionCamera(race.racers[0], laneX(0, race.racers.length), 0, false);
    renderer.render(scene, camera);
  } else {
    // Menu / garasi: kamera orbit mengelilingi motor preview
    orbitAngle += dt * 0.25;
    const radius = state.screen === 'screen-garage' ? 4.2 : 6.5;
    const height = state.screen === 'screen-garage' ? 1.7 : 2.4;
    camera.position.set(Math.sin(orbitAngle) * radius, height, 2 + Math.cos(orbitAngle) * radius);
    camera.lookAt(0, 0.9, 2);
    renderer.render(scene, camera);
  }
}

/* ---------------- Loop utama ---------------- */
let lastTs = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (race && race.phase !== 'finished') updateRace(dt);
  render3D(dt);
  if (race && state.screen === 'screen-race') updateHUD();
}

/* ---------------- Navigasi layar ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.classList.remove('active'); });
  $(id).classList.add('active');
  state.screen = id;
  if (id === 'screen-menu') refreshMenu();
  if (id === 'screen-garage') { renderGarage(); rebuildPreview(); }
  if (id === 'screen-race') sizeRenderer();
  if (window.scrollTo) window.scrollTo(0, 0);
}

function refreshMenu() {
  $('menu-coins').textContent = state.coins;
  const st = bikeStats();
  const t0100 = simulate0100();
  $('menu-stats').textContent = 'Top Speed: ' + st.topSpeed + ' km/jam  •  0-100: ' + (t0100 ? t0100.toFixed(2) + ' dtk' : '-') + '  •  Nitro: ' + st.nitroDur.toFixed(1) + ' dtk';
}

/* ---------------- Mode: Balap vs Bot ---------------- */
let selectedBot = BOTS[1];
function renderBots() {
  const grid = $('bot-grid'); grid.innerHTML = '';
  BOTS.forEach((b) => {
    const d = document.createElement('div');
    d.className = 'bot-card';
    d.innerHTML = '<h3>' + b.name + '</h3><span class="diff ' + b.id + '">' + b.diff + '</span>' +
      '<p>Top speed ' + b.topSpeed + ' km/jam<br>' + b.desc + '</p>' +
      '<div class="reward">🏆 Hadiah menang: ' + b.reward + ' 🪙</div>';
    d.onclick = () => { selectedBot = b; startBotRace(); };
    grid.appendChild(d);
  });
}

function startBotRace() {
  const me = createRacer('Kamu', '#3498db', bikeStats());
  const bot = makeBotRacer(selectedBot);
  newRace('bot', [me, bot], { bot: selectedBot });
  $('race-title').textContent = 'Drag Race 402m';
  $('race-opponent').textContent = 'vs ' + selectedBot.name + ' (' + selectedBot.diff + ')';
  $('touch-single').classList.remove('hidden');
  $('touch-duo').classList.add('hidden');
  showScreen('screen-race');
  startCountdown();
}

/* ---------------- Mode: Mabar Lokal 2P ---------------- */
function startLocalRace() {
  const n1 = ($('local-name1').value || 'Rider 1').trim();
  const n2 = ($('local-name2').value || 'Rider 2').trim();
  const st = bikeStats();
  const p1 = createRacer(n1, '#3498db', st);
  const p2 = createRacer(n2, '#2ecc71', st);
  newRace('local', [p1, p2], {});
  $('race-title').textContent = 'Mabar Lokal — 2 Pemain';
  $('race-opponent').textContent = n1 + ' vs ' + n2;
  $('touch-single').classList.add('hidden');
  $('touch-duo').classList.remove('hidden');
  showScreen('screen-race');
  startCountdown();
}

/* ---------------- Mode: Mabar Online (WebSocket) ---------------- */
const Online = {
  ws: null, room: null, myName: 'Rider', isHost: false, connected: false, sendT: 0,
  log(msg) { $('online-status').textContent = msg; },
  connect(serverUrl, room, name, asHost) {
    this.myName = name; this.isHost = asHost;
    try { this.ws = new WebSocket(serverUrl); } catch (e) { this.log('❌ URL server tidak valid.'); return; }
    const self = this;
    this.ws.onopen = function () {
      self.connected = true;
      self.log('✅ Terhubung ke server. ' + (asHost ? 'Membuat room...' : 'Gabung room...'));
      self.send({ type: asHost ? 'create' : 'join', room, name });
    };
    this.ws.onmessage = function (ev) { self.onMsg(JSON.parse(ev.data)); };
    this.ws.onclose = function () { self.connected = false; self.log('⚠ Koneksi ke server putus.'); };
    this.ws.onerror = function () { self.log('❌ Tidak bisa terhubung ke server. Pastikan server.js jalan.'); };
  },
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  },
  onMsg(m) {
    if (m.type === 'room') {
      this.room = m.room;
      this.log('🏠 Room: ' + m.room + ' — bagikan kode ini ke temanmu!');
      this.renderPlayers(m.players);
      if (this.isHost) $('btn-online-start').classList.remove('hidden');
    } else if (m.type === 'players') {
      this.renderPlayers(m.players);
    } else if (m.type === 'countdown') {
      this.beginOnlineRace(m.players);
    } else if (m.type === 'state') {
      if (race && race.mode === 'online') {
        m.players.forEach((p) => {
          const r = race.racers.find((x) => x.name === p.name);
          if (r && p.name !== Online.myName) {
            r.dist = p.dist; r.speed = p.speed;
            if (p.finished) { r.finished = true; r.finishTime = p.time; }
          }
        });
      }
    } else if (m.type === 'result') {
      if (race && race.mode === 'online') {
        race.meta.onlineWinner = m.winner;
        race.racers.forEach((r) => { if (r.name === m.winner) { r.finished = true; r.finishTime = m.times[m.winner]; } });
        if (race.phase === 'racing') finishRace(null, false);
      }
    } else if (m.type === 'error') {
      this.log('❌ ' + m.msg);
    }
  },
  renderPlayers(players) {
    const el = $('player-list'); el.innerHTML = '';
    players.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'player';
      d.textContent = (p.host ? '👑 ' : '🏍️ ') + p.name + (p.name === Online.myName ? ' (kamu)' : '');
      el.appendChild(d);
    });
  },
  beginOnlineRace(players) {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12'];
    const st = bikeStats();
    const racers = players.map((p, i) => {
      const r = createRacer(p.name, colors[i % colors.length], st);
      r.online = true;
      return r;
    });
    racers.sort((a, b) => (a.name === Online.myName ? -1 : b.name === Online.myName ? 1 : 0));
    newRace('online', racers, { myName: Online.myName });
    $('race-title').textContent = 'Mabar Online — Room ' + Online.room;
    $('race-opponent').textContent = racers.map((r) => r.name).join(' vs ');
    $('touch-single').classList.remove('hidden');
    $('touch-duo').classList.add('hidden');
    showScreen('screen-race');
    startCountdown();
  },
  tick(dt) {
    this.sendT += dt;
    if (this.sendT >= 0.1 && race && race.phase === 'racing') {
      this.sendT = 0;
      const me = race.racers[0];
      this.send({ type: 'input', dist: me.dist, speed: me.speed, finished: me.finished, time: me.finishTime });
    }
  }
};

/* ---------------- Garasi ---------------- */
function renderGarage() {
  $('garage-coins').textContent = state.coins;
  const st = bikeStats();
  $('stat-top').textContent = st.topSpeed + ' km/jam';
  const t0100 = simulate0100();
  $('stat-0100').textContent = t0100 ? t0100.toFixed(2) + ' dtk' : '-';
  $('stat-nitro').textContent = st.nitroDur.toFixed(1) + ' dtk';
  const grid = $('upgrade-grid'); grid.innerHTML = '';
  Object.keys(UPGRADES).forEach((key) => {
    const u = UPGRADES[key], lvl = state.upgrades[key];
    const cost = lvl >= u.max ? null : u.base * (lvl + 1);
    const d = document.createElement('div');
    d.className = 'upgrade-card';
    let pips = '';
    for (let i = 0; i < u.max; i++) pips += i < lvl ? '●' : '○';
    d.innerHTML = '<h3>' + u.icon + ' ' + u.name + '</h3><p>' + u.desc + '</p>' +
      '<div class="levels">' + pips + ' Lv ' + lvl + '/' + u.max + '</div>';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = cost == null ? 'MAX ✓' : 'Upgrade — ' + cost + ' 🪙';
    btn.disabled = cost == null || state.coins < cost;
    btn.onclick = () => {
      if (state.coins >= cost) {
        state.coins -= cost; state.upgrades[key]++; saveAll();
        renderGarage(); refreshMenu(); rebuildPreview();
      }
    };
    d.appendChild(btn);
    grid.appendChild(d);
  });
}

/* ---------------- Input: keyboard & sentuh ---------------- */
function meRacer() { return race ? race.racers[0] : null; }
function p2Racer() { return race && race.racers[1] ? race.racers[1] : null; }

const KEYMAP = {
  KeyA: ['p1', 'gas'], Space: ['p1', 'gas'],
  KeyS: ['p1', 'gear'], ShiftLeft: ['p1', 'gear'], ShiftRight: ['p1', 'gear'],
  KeyD: ['p1', 'nitro'], KeyN: ['p1', 'nitro'],
  ArrowUp: ['p2', 'gas'],
  ArrowRight: ['p2', 'gear'],
  Enter: ['p2', 'nitro']
};

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && race && state.screen === 'screen-race') {
    camMode = camMode === 'chase' ? 'side' : 'chase';
    return;
  }
  if (!race || state.screen !== 'screen-race') return;
  const m = KEYMAP[e.code];
  if (!m) return;
  e.preventDefault();
  if (e.repeat && m[1] !== 'gas') return;
  let r = m[0] === 'p1' ? meRacer() : p2Racer();
  if (!r) return;
  if (race.mode !== 'local' && m[0] === 'p2') r = meRacer();
  if (m[1] === 'gas') onGasDown(r);
  else if (m[1] === 'gear') onGear(r);
  else if (m[1] === 'nitro') onNitro(r);
});
document.addEventListener('keyup', (e) => {
  if (!race) return;
  const m = KEYMAP[e.code];
  if (!m || m[1] !== 'gas') return;
  let r = m[0] === 'p1' ? meRacer() : p2Racer();
  if (!r || (race.mode !== 'local' && m[0] === 'p2')) r = meRacer();
  onGasUp(r);
});

function bindHold(id, down, up) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); if (up) up(); });
  el.addEventListener('pointerleave', () => { if (up) up(); });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); });
}

function bindTouch() {
  bindHold('touch-gas', () => { onGasDown(meRacer()); }, () => { onGasUp(meRacer()); });
  bindHold('touch-gear', () => { onGear(meRacer()); });
  bindHold('touch-nitro', () => { onNitro(meRacer()); });
  bindHold('touch-p1-gas', () => { onGasDown(meRacer()); }, () => { onGasUp(meRacer()); });
  bindHold('touch-p1-gear', () => { onGear(meRacer()); });
  bindHold('touch-p1-nitro', () => { onNitro(meRacer()); });
  bindHold('touch-p2-gas', () => { onGasDown(p2Racer()); }, () => { onGasUp(p2Racer()); });
  bindHold('touch-p2-gear', () => { onGear(p2Racer()); });
  bindHold('touch-p2-nitro', () => { onNitro(p2Racer()); });
}

/* ---------------- Tombol & tab ---------------- */
function bindUI() {
  $('btn-race').onclick = () => { renderBots(); showScreen('screen-bots'); };
  $('btn-multi').onclick = () => { showScreen('screen-multi'); };
  $('btn-garage').onclick = () => { renderGarage(); showScreen('screen-garage'); };
  $('btn-howto').onclick = () => { showScreen('screen-howto'); };
  $('btn-garage-back').onclick = () => { showScreen('screen-menu'); };
  $('btn-howto-back').onclick = () => { showScreen('screen-menu'); };
  $('btn-multi-back').onclick = () => { showScreen('screen-menu'); };
  $('btn-bots-back').onclick = () => { showScreen('screen-menu'); };
  $('btn-race-quit').onclick = () => {
    if (race) { race.phase = 'finished'; AudioFX.stop(); }
    showScreen('screen-menu');
  };
  $('btn-race-again').onclick = () => {
    if (!race) return;
    if (race.mode === 'bot') startBotRace();
    else if (race.mode === 'local') startLocalRace();
    else showScreen('screen-multi');
  };
  $('btn-race-menu').onclick = () => { showScreen('screen-menu'); };
  $('btn-local-start').onclick = () => { AudioFX.init(); startLocalRace(); };

  $('tab-local').onclick = () => {
    $('tab-local').classList.add('active'); $('tab-online').classList.remove('active');
    $('panel-local').classList.remove('hidden'); $('panel-online').classList.add('hidden');
  };
  $('tab-online').onclick = () => {
    $('tab-online').classList.add('active'); $('tab-local').classList.remove('active');
    $('panel-online').classList.remove('hidden'); $('panel-local').classList.add('hidden');
  };
  $('btn-create-room').onclick = () => {
    const name = ($('online-name').value || 'Rider').trim();
    const server = ($('online-server').value || 'ws://localhost:8080').trim();
    const room = ($('online-room').value || '').trim().toUpperCase() || Math.random().toString(36).slice(2, 8).toUpperCase();
    $('online-room').value = room;
    Online.connect(server, room, name, true);
  };
  $('btn-join-room').onclick = () => {
    const name = ($('online-name').value || 'Rider').trim();
    const server = ($('online-server').value || 'ws://localhost:8080').trim();
    const room = ($('online-room').value || '').trim().toUpperCase();
    if (!room) { Online.log('❌ Isi dulu kode room yang mau digabung.'); return; }
    Online.connect(server, room, name, false);
  };
  $('btn-online-start').onclick = () => {
    Online.send({ type: 'start' });
    Online.log('🏁 Countdown dimulai untuk semua pemain...');
  };
  const camBtn = $('btn-cam');
  if (camBtn) camBtn.onclick = () => { camMode = camMode === 'chase' ? 'side' : 'chase'; };
}

/* ---------------- Init ---------------- */
loadSave();
bindUI();
bindTouch();
rebuildPreview();
refreshMenu();
showScreen('screen-menu');
if (renderer) requestAnimationFrame(tick);

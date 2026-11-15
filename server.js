/* ============================================================================
   DRAG BIKE — server.js
   Server multiplayer sederhana (Node.js, TANPA dependensi eksternal).
   Implementasi WebSocket minimal dengan modul bawaan: http + crypto.
   Jalankan:  node server.js        (default port 8080)
              PORT=9000 node server.js
   ============================================================================ */
'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_PLAYERS = 4;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ---------------- Room ---------------- */
const rooms = new Map(); // code -> { code, players: Map<ws, player> }

function getOrCreateRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code: code, players: new Map(), winner: null, started: false });
  return rooms.get(code);
}
function roomPlayers(room) {
  return Array.from(room.players.values()).map(function (p) {
    return { name: p.name, host: p.host, dist: p.dist, speed: p.speed, finished: p.finished };
  });
}
function broadcast(room, obj, except) {
  const data = JSON.stringify(obj);
  room.players.forEach(function (p, ws) {
    if (ws !== except) sendText(ws, data);
  });
}

/* ---------------- WebSocket minimal ---------------- */
function acceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

/* Kirim satu frame teks (tanpa mask, sesuai spek server -> client). */
function sendText(ws, data) {
  if (!ws._wsOpen) return; // _wsOpen diset true setelah handshake WebSocket sukses
  const payload = Buffer.from(data, 'utf8');
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  try { ws.write(Buffer.concat([header, payload])); } catch (e) { /* abaikan */ }
}

function sendClose(ws) {
  try { ws.write(Buffer.from([0x88, 0x00])); } catch (e) { /* abaikan */ }
}

/* Parse frame yang masuk (client -> server selalu ter-mask). */
function parseFrames(ws, chunk) {
  ws._buf = ws._buf ? Buffer.concat([ws._buf, chunk]) : chunk;
  while (true) {
    const buf = ws._buf;
    if (buf.length < 2) return;
    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < 4) return;
      len = buf.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (buf.length < 10) return;
      len = Number(buf.readBigUInt64BE(2)); off = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) return; // frame belum lengkap
    let payload = buf.slice(off + maskLen, off + maskLen + len);
    if (masked) {
      const mask = buf.slice(off, off + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }
    ws._buf = buf.slice(off + maskLen + len);

    if (opcode === 0x9) { // ping -> pong
      try { ws.write(Buffer.from([0x8A, 0x00])); } catch (e) {}
    } else if (opcode === 0x8) { // close
      sendClose(ws); ws.end(); return;
    } else if (opcode === 0x1 && fin) { // text, satu frame utuh
      handleMessage(ws, payload.toString('utf8'));
    }
    // opcode 0x0 (continuation) & 0x2 (binary) diabaikan — klien hanya kirim teks.
  }
}

/* ---------------- Logika game ---------------- */
function handleMessage(ws, text) {
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return sendText(ws, JSON.stringify({ type: 'error', msg: 'Pesan bukan JSON.' })); }
  const room = ws._room;

  if (msg.type === 'create' || msg.type === 'join') {
    const code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const name = String(msg.name || 'Rider').slice(0, 12);
    if (!code) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Kode room kosong.' }));
    const r = getOrCreateRoom(code);
    if (msg.type === 'join' && !rooms.has(code)) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Room ' + code + ' tidak ditemukan. Buat dulu.' }));
    if (r.players.size >= MAX_PLAYERS) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Room penuh (max ' + MAX_PLAYERS + ' pemain).' }));
    if (r.started) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Balapan di room ini sudah mulai.' }));
    const isHost = r.players.size === 0;
    ws._room = r; ws._name = name;
    r.players.set(ws, { name: name, host: isHost, dist: 0, speed: 0, finished: false, time: null });
    sendText(ws, JSON.stringify({ type: 'room', room: code, players: roomPlayers(r) }));
    broadcast(r, { type: 'players', players: roomPlayers(r) }, ws);
    console.log('[room ' + code + '] ' + name + ' bergabung (' + r.players.size + '/' + MAX_PLAYERS + ')' + (isHost ? ' [HOST]' : ''));
    return;
  }

  if (!room) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Kamu belum gabung room.' }));
  const me = room.players.get(ws);
  if (!me) return;

  if (msg.type === 'start') {
    if (!me.host) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Hanya host yang bisa memulai balapan.' }));
    if (room.players.size < 2) return sendText(ws, JSON.stringify({ type: 'error', msg: 'Butuh minimal 2 pemain untuk mabar.' }));
    room.started = true; room.winner = null;
    room.players.forEach(function (p) { p.dist = 0; p.speed = 0; p.finished = false; p.time = null; });
    broadcast(room, { type: 'countdown', at: Date.now(), players: roomPlayers(room) });
    console.log('[room ' + room.code + '] countdown dimulai (' + room.players.size + ' pemain)');
    return;
  }

  if (msg.type === 'input') {
    me.dist = Math.max(0, Math.min(402, Number(msg.dist) || 0));
    me.speed = Math.max(0, Number(msg.speed) || 0);
    me.finished = !!msg.finished;
    if (msg.time != null) me.time = Number(msg.time);
    broadcast(room, { type: 'state', players: roomPlayers(room) }, ws);
    return;
  }

  if (msg.type === 'finish') {
    me.finished = true;
    me.time = Number(msg.time) || 0;
    if (!room.winner) {
      room.winner = me.name;
      const times = {};
      room.players.forEach(function (p) { times[p.name] = p.time; });
      broadcast(room, { type: 'result', winner: me.name, times: times });
      console.log('[room ' + room.code + '] pemenang: ' + me.name + ' (' + me.time.toFixed(2) + ' dtk)');
    }
    return;
  }
}

function handleDisconnect(ws) {
  ws._wsOpen = false;
  const room = ws._room;
  if (!room) return;
  const me = room.players.get(ws);
  room.players.delete(ws);
  if (me) {
    console.log('[room ' + room.code + '] ' + me.name + ' keluar (' + room.players.size + ' tersisa)');
    if (me.host && room.players.size > 0) {
      const next = room.players.values().next().value;
      next.host = true;
      console.log('[room ' + room.code + '] host baru: ' + next.name);
    }
    if (room.players.size === 0) {
      rooms.delete(room.code);
      console.log('[room ' + room.code + '] ditutup (kosong)');
    } else {
      broadcast(room, { type: 'players', players: roomPlayers(room) });
    }
  }
}

/* ---------------- HTTP + Upgrade ---------------- */
const server = http.createServer(function (req, res) {
  if (req.url === '/rooms') {
    const list = Array.from(rooms.values()).map(function (r) {
      return { room: r.code, players: r.players.size, started: r.started };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Drag Bike server jalan. Hubungkan game via WebSocket ke ws://HOST:' + PORT + '\nRoom aktif: ' + rooms.size + '\n');
});

server.on('upgrade', function (req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = acceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket._wsOpen = true; // penanda koneksi WS aktif (net.Socket.readyState hanya getter)
  socket._buf = head && head.length ? head : null;
  socket.on('data', function (chunk) { parseFrames(socket, chunk); });
  socket.on('close', function () { handleDisconnect(socket); });
  socket.on('error', function () { handleDisconnect(socket); });
});

server.listen(PORT, function () {
  console.log('🏁 Drag Bike server jalan di ws://localhost:' + PORT);
  console.log('   Cek room aktif: curl http://localhost:' + PORT + '/rooms');
});

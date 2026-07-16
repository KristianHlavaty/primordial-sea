/* Primordial Sea — local-network multiplayer host.

   A single zero-dependency Node script (no npm install). It does two things:

   1. Serves the game's static files over HTTP (so everyone on the LAN just
      opens this machine's address in a browser — no install for joiners).
   2. Runs a lobby + relay over WebSocket on the SAME port at /ws. It tracks
      rooms (create / list / join / leave) and forwards opaque game packets
      between the browsers in a room. It runs NO game logic — the host player's
      browser is the authority (see src/net/). That keeps the whole simulation
      in the existing engine and this server tiny.

   Run:  node server/relay.mjs [port]      (default 8899)                   */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');           // the game folder (parent of server/)
const PORT = Number(process.env.PORT || process.argv[2] || 8899);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/* ---------------- static file server ---------------- */

const server = http.createServer((req, res) => {
  let safe = path.normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^[/\\]+/, '');   // strip leading slashes, collapse ..
  if (safe === '' || safe === '.' || safe.endsWith(path.sep) || safe.endsWith('/')) safe += 'index.html';  // "/", "//", "/foo/" -> index.html
  const file = path.join(ROOT, safe);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404 — not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------------- minimal WebSocket ---------------- */

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

server.on('upgrade', (req, socket) => {
  if ((req.headers['upgrade'] || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  attach(socket);
});

/* Decode outgoing text/close/pong (server frames are never masked). */
function encode(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

const MAX_TRANSIENT_BUFFER = 512 * 1024;
const encodeJson = obj => encode(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));

/* Pull one complete frame off the front of buf, unmasking the payload.
   Returns { fin, opcode, payload, rest } or null if buf is still incomplete. */
function parseFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0, opcode = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < off + 2) return null; len = buf.readUInt16BE(off); off += 2; }
  else if (len === 127) { if (buf.length < off + 8) return null; len = Number(buf.readBigUInt64BE(off)); off += 8; }
  let mask;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.subarray(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  let payload = buf.subarray(off, off + len);
  if (masked) { const out = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3]; payload = out; }
  return { fin, opcode, payload, rest: buf.subarray(off + len) };
}

function attach(socket) {
  const conn = makeConn(socket);
  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    let f;
    while ((f = parseFrame(buf))) {
      buf = f.rest;
      if (f.opcode === 0x8) { drop(conn); try { socket.end(encode(0x8, Buffer.alloc(0))); } catch { } return; }
      else if (f.opcode === 0x9) conn.sendRaw(0xA, f.payload);   // ping -> pong
      else if (f.opcode === 0xA) { /* pong */ }
      else if (f.opcode === 0x1 || f.opcode === 0x2) { conn._frag = [f.payload]; conn._fop = f.opcode; if (f.fin) flush(conn); }
      else if (f.opcode === 0x0 && conn._frag) { conn._frag.push(f.payload); if (f.fin) flush(conn); }
    }
  });
  socket.on('close', () => drop(conn));
  socket.on('error', () => drop(conn));
}

function flush(conn) {
  const full = Buffer.concat(conn._frag), op = conn._fop; conn._frag = null; conn._fop = 0;
  if (op !== 0x1) return;   // only text carries JSON
  let msg; try { msg = JSON.parse(full.toString('utf8')); } catch { return; }
  onMessage(conn, msg);
}

/* ---------------- lobby state ---------------- */

let nextConn = 1, nextRoom = 1;
const conns = new Map();   // id -> conn
const rooms = new Map();   // id -> room

function makeConn(socket) {
  const conn = {
    id: nextConn++, socket, profile: null, roomId: null, _frag: null, _fop: 0,
    send(obj, transient = false) { this.sendFrame(encodeJson(obj), transient); },
    sendFrame(frame, transient = false) {
      try {
        if (!socket.destroyed && (!transient || (socket.writableLength || 0) < MAX_TRANSIENT_BUFFER)) socket.write(frame);
      } catch { }
    },
    sendRaw(op, payload) { try { if (!socket.destroyed) socket.write(encode(op, payload)); } catch { } },
  };
  conns.set(conn.id, conn);
  return conn;
}

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

function roomList() {
  return [...rooms.values()].map(r => ({
    id: r.id, name: r.name, hostName: r.hostName, hostColor: r.hostColor,
    map: r.map, mapName: r.mapName, stage: r.stage, tier: r.tier, era: r.era,
    fantasy: r.fantasy, evolution: r.evolution, cheats: r.cheats, bosses: r.bosses, mapTransitions: r.mapTransitions, funItems: r.funItems,
    count: r.members.length, maxPlayers: r.maxPlayers, started: r.started,
  }));
}

function roomDetail(r) {
  return {
    id: r.id, name: r.name, map: r.map, mapName: r.mapName, stage: r.stage, tier: r.tier, era: r.era,
    fantasy: r.fantasy, evolution: r.evolution, cheats: r.cheats, bosses: r.bosses, mapTransitions: r.mapTransitions, funItems: r.funItems,
    maxPlayers: r.maxPlayers, host: r.host, started: r.started,
    players: r.members.map(cid => {
      const c = conns.get(cid), p = (c && c.profile) || {};
      return { connId: cid, id: p.id || '', name: p.name || 'Nameless', color: p.color || '#5ec8f2', species: r.species[cid] || null, isHost: cid === r.host };
    }),
  };
}

/* Push the fresh room list to everyone currently sitting in the lobby. */
function broadcastRooms() {
  const list = roomList();
  for (const c of conns.values()) if (c.roomId == null) c.send({ t: 'rooms', rooms: list });
}
function broadcastRoom(r) {
  const detail = roomDetail(r);
  for (const cid of r.members) { const c = conns.get(cid); if (c) c.send({ t: 'roomUpdate', room: detail }); }
}

function leave(conn, notifySelf) {
  const r = conn.roomId != null ? rooms.get(conn.roomId) : null;
  conn.roomId = null;
  if (r) {
    r.members = r.members.filter(id => id !== conn.id);
    delete r.species[conn.id];
    if (conn.id === r.host || r.members.length === 0) {
      // host left (or room emptied) — close it and evict everyone
      for (const cid of r.members) { const c = conns.get(cid); if (c) { c.roomId = null; c.send({ t: 'roomClosed', roomId: r.id }); } }
      rooms.delete(r.id);
    } else broadcastRoom(r);
  }
  if (notifySelf) conn.send({ t: 'left' });
  broadcastRooms();
}

function drop(conn) {
  if (!conns.has(conn.id)) return;
  leave(conn, false);
  conns.delete(conn.id);
}

function onMessage(conn, m) {
  switch (m && m.t) {
    case 'hello': {
      const p = m.profile || {};
      conn.profile = { id: str(p.id, 40) || ('c' + conn.id), name: str(p.name, 16) || 'Nameless', color: str(p.color, 24) || '#5ec8f2' };
      conn.send({ t: 'welcome', connId: conn.id, rooms: roomList() });
      break;
    }
    case 'listRooms':
      conn.send({ t: 'rooms', rooms: roomList() });
      break;
    case 'createRoom': {
      if (!conn.profile) { conn.send({ t: 'error', msg: 'say hello first' }); break; }
      if (conn.roomId != null) leave(conn, false);
      const r = {
        id: nextRoom++, name: str(m.name, 32) || (conn.profile.name + "'s game"),
        host: conn.id, hostName: conn.profile.name, hostColor: conn.profile.color,
        map: str(m.map, 40), mapName: str(m.mapName, 60), stage: str(m.stage, 20),
        tier: int(m.tier, 1, 9, 1), era: int(m.era, 0, 30, 0), maxPlayers: int(m.maxPlayers, 2, 8, 4),
        fantasy: m.fantasy === true, evolution: m.evolution !== false, cheats: m.cheats === true,
        bosses: m.bosses === true, mapTransitions: m.mapTransitions === true, funItems: m.funItems === true,
        started: false, members: [conn.id], species: {},
      };
      if (m.species) r.species[conn.id] = str(m.species, 40);
      rooms.set(r.id, r);
      conn.roomId = r.id;
      conn.send({ t: 'joined', room: roomDetail(r), you: conn.id });
      broadcastRooms();
      break;
    }
    case 'joinRoom': {
      if (!conn.profile) { conn.send({ t: 'error', msg: 'say hello first' }); break; }
      const r = rooms.get(int(m.roomId, 1, 1e9, -1));
      if (!r) { conn.send({ t: 'error', msg: 'That game no longer exists.' }); break; }
      if (r.members.length >= r.maxPlayers) { conn.send({ t: 'error', msg: 'That game is full.' }); break; }
      if (conn.roomId != null && conn.roomId !== r.id) leave(conn, false);
      if (!r.members.includes(conn.id)) r.members.push(conn.id);
      conn.roomId = r.id;
      if (m.species) r.species[conn.id] = str(m.species, 40);
      conn.send({ t: 'joined', room: roomDetail(r), you: conn.id });
      broadcastRoom(r);
      broadcastRooms();
      break;
    }
    case 'setSpecies': {
      const r = conn.roomId != null ? rooms.get(conn.roomId) : null;
      if (r) { r.species[conn.id] = str(m.species, 40); broadcastRoom(r); }
      break;
    }
    case 'start': {
      const r = conn.roomId != null ? rooms.get(conn.roomId) : null;
      if (r && conn.id === r.host) { r.started = true; broadcastRoom(r); broadcastRooms(); }
      break;
    }
    case 'leaveRoom':
      leave(conn, true);
      break;
    case 'relay': {
      // opaque game packet — forward to room peers (or a specific peer via m.to)
      const r = conn.roomId != null ? rooms.get(conn.roomId) : null;
      if (!r) break;
      const out = { t: 'relay', from: conn.id, data: m.data };
      const transient = m.data && (m.data.k === 'S' || m.data.k === 'I');
      const frame = encodeJson(out);   // serialize once, even for a room broadcast
      if (m.to != null) { const c = conns.get(m.to); if (c && c.roomId === r.id) c.sendFrame(frame, transient); }
      else for (const cid of r.members) if (cid !== conn.id) { const c = conns.get(cid); if (c) c.sendFrame(frame, transient); }
      break;
    }
    default:
      conn.send({ t: 'error', msg: 'unknown message' });
  }
}

/* ---------------- start ---------------- */

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) for (const ni of ifaces[name]) if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
  return out;
}

server.listen(PORT, () => {
  const lines = ['', '  Primordial Sea — multiplayer host is running.', ''];
  lines.push('  On THIS machine:   http://localhost:' + PORT + '/');
  for (const ip of lanAddresses()) lines.push('  On the network:    http://' + ip + ':' + PORT + '/   <- share this');
  lines.push('', '  Everyone opens one of those in a browser. Ctrl+C to stop.', '');
  console.log(lines.join('\n'));
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error('\n  Port ' + PORT + ' is already in use. Try: node server/relay.mjs 8900\n');
  else console.error(e);
  process.exit(1);
});

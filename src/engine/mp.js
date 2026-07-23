/* Multiplayer component projection and compatibility glue (Phase 6).

   Authority model: the HOST's browser runs the real Engine.update() and owns
   every occupied map world. Each other player is a RemotePlayer entity the host moves from the
   input packets that player sends. ~20×/s the host broadcasts a SNAPSHOT of the
   player's current world; clients render it and send their input up ~30×/s. The relay server
   (server/relay.mjs) just forwards these packets between the browsers in a room.

   Clients do NOT simulate authoritative gameplay. Snapshot records are
   projected into component-backed replica objects and smoothed toward their
   NETWORK_REPLICA targets each frame.

   Protocol v2 preserves the legacy compact packet letters inside the relay's
   {t:'relay', data}, adding only pv/ps metadata for mixed-version rooms:
     host -> clients:  {k:'S', ...snapshot}   {k:'W', ...worldInit}
     client -> host:   {k:'I', tx,ty,m,b}  {k:'A'|'U'|'D', i}  {k:'E', id}
                       {k:'C', action}  {k:'ready'} */
import { RemotePlayer } from './entities/RemotePlayer.js';
import { spawnInitial } from './systems/spawning.js';
import { SPECIES, speciesOfStageTier, speciesStage } from '../data/species.js';
import { ABILITY_SETS, ACTIVE_TIMER } from '../data/abilities.js';
import { NPCS } from '../data/npcs.js';
import { MAPS, OPPOSITE_EDGE, EDGE_TRIGGER_PAD, EDGE_PASSAGE_ASSIST, EDGE_DWELL_TIME } from '../data/maps.js';
import { BOSSES } from '../data/bosses.js';
import { ITEMS, ITEM_SLOT_COUNT } from '../data/items.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { angLerp, clamp, lerp, hyp } from '../core/math.js';
import { ComponentTypes as C } from './components/componentTypes.js';
import { GameEvents } from './events.js';
import {
  LEGACY_PROTOCOL_VERSION,
  MULTIPLAYER_PROTOCOL_VERSION,
  MultiplayerPacketKinds as PacketKinds,
  adaptPacketToVersion,
  decodeMultiplayerPacket,
  encodeMultiplayerPacket,
  isNewerSnapshotSequence,
  negotiateProtocol,
  readyPacket,
} from './net/ComponentSnapshotProtocol.js';

const HOST_HZ = 20, CLIENT_HZ = 30;
const INPUT_KEEPALIVE = 0.25;
const connKey = conn => String(conn);

const peerProtocol = (mp, conn) =>
  mp.peerProtocols?.get(connKey(conn)) || LEGACY_PROTOCOL_VERSION;

const noteProtocol = (engine, conn, version) => {
  const mp = engine.mp;
  if (!mp) return;
  if (mp.role === 'host') {
    const key = connKey(conn), previous = mp.peerProtocols.get(key);
    if (previous === version) return;
    mp.peerProtocols.set(key, version);
    engine.events.emit(GameEvents.NET_PROTOCOL_NEGOTIATED, { connId: conn, version, previous: previous ?? null });
  } else {
    const previous = mp.negotiatedProtocol;
    if (previous === version) return;
    mp.negotiatedProtocol = version;
    mp.protocolVersion = version;
    engine.events.emit(GameEvents.NET_PROTOCOL_NEGOTIATED, { connId: mp.host, version, previous: previous ?? null });
  }
};

const dropPacket = (engine, from, decoded, reason) => {
  engine.events.emit(GameEvents.NET_PACKET_DROPPED, {
    from, kind: decoded?.kind || null, version: decoded?.version || null,
    sequence: decoded?.data?.q ?? null, reason,
  });
};

/* The host can simulate several adjacent maps at once. The Engine object is
   reused as the simulation context, while these fields are swapped between
   persistent map worlds. Player entities stay global and carry their mapId. */
const WORLD_ARRAY_FIELDS = [
  'creatures', 'plants', 'food', 'worldItems', 'itemProjectiles', 'vehicles',
  'webs', 'obstacles', 'flow', 'particles', 'bubbles', 'eggs', 'fx', 'floaters',
];
const WORLD_SCALAR_FIELDS = ['spawnT', 'itemSpawnT', 'vehicleSpawnT', 'vehicleTarget'];

function worldState(engine, mapId, fresh = false) {
  const map = MAPS[mapId];
  const state = { mapId, stage: map.stage, theme: map.theme, W: map.W, H: map.H };
  for (const field of WORLD_ARRAY_FIELDS) state[field] = fresh ? [] : engine[field];
  for (const field of WORLD_SCALAR_FIELDS) state[field] = fresh ? 0 : engine[field];
  return state;
}

function saveActiveWorld(engine) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.worlds || !mp.worlds.has(engine.mapId)) return;
  const state = mp.worlds.get(engine.mapId);
  for (const field of WORLD_ARRAY_FIELDS) state[field] = engine[field];
  for (const field of WORLD_SCALAR_FIELDS) state[field] = engine[field];
}

export function mpActivateWorld(engine, mapId) {
  const mp = engine.mp, state = mp && mp.worlds && mp.worlds.get(mapId);
  if (!state) return false;
  engine.mapId = state.mapId; engine.stage = state.stage; engine.theme = state.theme;
  engine.W = state.W; engine.H = state.H;
  for (const field of WORLD_ARRAY_FIELDS) engine[field] = state[field];
  for (const field of WORLD_SCALAR_FIELDS) engine[field] = state[field];
  return true;
}

function ensureWorld(engine, mapId, focusPlayer) {
  const mp = engine.mp;
  if (mp.worlds.has(mapId)) return mp.worlds.get(mapId);
  saveActiveWorld(engine);
  const previousMap = engine.mapId;
  const state = worldState(engine, mapId, true);
  mp.worlds.set(mapId, state);
  mpActivateWorld(engine, mapId);
  engine._worldFocusPlayer = focusPlayer;
  spawnInitial(engine);
  engine._worldFocusPlayer = null;
  saveActiveWorld(engine);
  mpActivateWorld(engine, previousMap);
  return state;
}

function withPlayerWorld(engine, player, action) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.worlds || !player || !player.mapId) return action();
  saveActiveWorld(engine);
  const previousMap = engine.mapId;
  if (!mpActivateWorld(engine, player.mapId)) return;
  try { return action(); }
  finally { saveActiveWorld(engine); mpActivateWorld(engine, previousMap); }
}

const sendTransient = (lobby, packet) => {
  if (!lobby) return;
  if (lobby.rawTransient) lobby.rawTransient(packet); else lobby.raw(packet);
};
export function mpSendPacket(engine, kind, payload = {}, { transient = false, broadcast = false } = {}) {
  const mp = engine.mp;
  if (!mp || !mp.lobby) return false;
  const version = mp.role === 'client'
    ? (mp.protocolVersion || MULTIPLAYER_PROTOCOL_VERSION)
    : MULTIPLAYER_PROTOCOL_VERSION;
  const relay = {
    t: 'relay',
    ...(!broadcast && mp.role === 'client' ? { to: mp.host } : {}),
    data: encodeMultiplayerPacket(kind, payload, version),
  };
  if (transient) sendTransient(mp.lobby, relay); else mp.lobby.raw(relay);
  return true;
}
const roundTo = (n, places) => { const scale = 10 ** places; return Math.round(n * scale) / scale; };

const resolveSpecies = (id, stage, tier, fantasy) => {
  const eligible = speciesOfStageTier(stage, tier, fantasy);
  return id && eligible.includes(id) ? id : (eligible[0] || 'protocell');
};

/* ---------------- start ---------------- */

export function mpStartHost(engine, { room, profile, lobby, selfConn, roster }) {
  engine.resetRun();
  const fantasy = !!room.fantasy;
  const evolution = room.evolution !== false;
  const bosses = room.bosses === true;
  const mapTransitions = room.mapTransitions === true;
  const items = room.items !== false;
  const funItems = items && room.funItems === true;
  const cheats = room.cheats === true;
  engine.fantasyEvolution = fantasy; engine.cheatsEnabled = cheats; engine.invincible = false;
  const map = MAPS[room.map], stage = map.stage, tier = room.tier;
  engine.era = room.era || 0;
  engine.mp = {
    role: 'host', lobby, self: selfConn, roster: roster || {}, stage, tier, fantasy, evolution, bosses, mapTransitions, items, funItems, cheats,
    selfName: profile ? profile.name : 'Host', selfColor: profile ? profile.color : '#8affd0',
    inputs: {}, seq: 0, sendAcc: 0, nextNet: 1, feed: [], feedId: 0,
    inputSequences: new Map(),
    worlds: new Map(), dirtyWorldFor: new Set(), edgePrompts: new Map(),
    peerProtocols: new Map(),
  };
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier, fantasy);
  engine.player = null; engine.makePlayer(mine);
  engine.remotePlayers = [];
  engine.loadMap(room.map);
  engine.player.mapId = room.map;
  for (const cid in roster) {
    if (String(cid) === String(selfConn)) continue;
    const remote = new RemotePlayer(resolveSpecies(roster[cid].species, stage, tier, fantasy), engine,
      { connId: Number(cid), name: roster[cid].name, color: roster[cid].color });
    remote.mapId = room.map;
    engine.remotePlayers.push(remote);
  }
  engine.mp.worlds.set(room.map, worldState(engine, room.map));
  engine.mp.worldDirty = false;
  engine.playing = true; engine.paused = false; engine.dead = false;
  engine.sfx.unlock(); engine.pushHud(true);
}

export function mpStartClient(engine, { room, profile, lobby, selfConn, hostConn, roster }) {
  engine.resetRun();
  const previousMapId = engine.mapId;
  const fantasy = !!room.fantasy;
  const evolution = room.evolution !== false;
  const bosses = room.bosses === true;
  const mapTransitions = room.mapTransitions === true;
  const items = room.items !== false;
  const funItems = items && room.funItems === true;
  const cheats = room.cheats === true;
  engine.fantasyEvolution = fantasy; engine.cheatsEnabled = cheats; engine.invincible = false;
  const map = MAPS[room.map], stage = map.stage, tier = room.tier;
  engine.era = room.era || 0;
  engine.mp = {
    role: 'client', lobby, self: selfConn, host: hostConn, roster: roster || {}, stage, tier, fantasy, evolution, bosses, mapTransitions, items, funItems, cheats,
    selfName: profile ? profile.name : 'You', selfColor: profile ? profile.color : '#8affd0',
    sendAcc: 0, inputKeepalive: INPUT_KEEPALIVE, lastInput: null, reAsk: 0, gotInit: false,
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, negotiatedProtocol: null,
    inputSeq: 0,
    lastSnapshotSeq: -1,
    rosterStats: [],
    npcById: new Map(), rpById: new Map(), foodById: new Map(), itemById: new Map(), projectileById: new Map(), vehicleById: new Map(),
    seenNpcs: new Set(), seenPlayers: new Set(), seenFood: new Set(), seenItems: new Set(), seenProjectiles: new Set(), seenVehicles: new Set(), feed: [], feedId: 0,
  };
  engine.mapId = room.map; engine.stage = stage; engine.theme = map.theme; engine.W = map.W; engine.H = map.H;
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier, fantasy);
  engine.player = null; engine.makePlayer(mine);
  engine.player.mapId = room.map;
  engine.player.x = engine.W / 2; engine.player.y = engine.H / 2; engine.player._netInit = false;
  engine.remotePlayers = []; engine.creatures = []; engine.plants = []; engine.food = []; engine.obstacles = []; engine.webs = []; engine.bubbles = [];
  engine.worldItems = []; engine.itemProjectiles = []; engine.vehicles = [];
  seedBubbles(engine);
  engine.cam.x = clamp(engine.player.x - engine.vw / 2, 0, Math.max(0, engine.W - engine.vw));
  engine.cam.y = clamp(engine.player.y - engine.vh / 2, 0, Math.max(0, engine.H - engine.vh));
  engine.captureRenderState();
  engine.playing = true; engine.paused = false; engine.dead = false;
  engine.emitMapChanged(previousMapId);
  engine.sfx.unlock();
  if (lobby) lobby.raw({ t: 'relay', to: hostConn, data: readyPacket() });
  engine.pushHud(true);
}

function seedBubbles(engine) {
  if (engine.stage !== 'sea' || !engine.vw) return;
  for (let i = 0; i < 90; i++) engine.bubbles.push({ x: Math.random() * engine.vw, y: Math.random() * engine.vh, r: 0.6 + Math.random() * 2, sp: 6 + Math.random() * 20, ph: Math.random() * 6.28 });
}

/* ---------------- packets ---------------- */

export function mpOnPacket(engine, from, data) {
  const mp = engine.mp; if (!mp || !data) return;
  const decoded = decodeMultiplayerPacket(data);
  if (!decoded) { dropPacket(engine, from, null, 'unknown-packet'); return; }
  engine.events.emit(GameEvents.NET_PACKET_DECODED, {
    from, kind: decoded.kind, version: decoded.version, schema: decoded.schema,
    sequence: decoded.data.q ?? null,
  });
  data = decoded.data;
  if (mp.role === 'host') {
    if (decoded.kind === PacketKinds.READY) {
      const version = negotiateProtocol(data);
      noteProtocol(engine, from, version);
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (mp.lobby && rp) withPlayerWorld(engine, rp, () => {
        mp.lobby.raw({
          t: 'relay', to: from,
          data: adaptPacketToVersion(buildWorldInit(engine), version),
        });
      });
      return;
    }
    noteProtocol(engine, from, decoded.version);
    if (decoded.kind === PacketKinds.INPUT) {
      const key = connKey(from), previous = mp.inputSequences.get(key);
      if (Number.isFinite(data.q) && !isNewerSnapshotSequence(data.q, previous)) {
        dropPacket(engine, from, decoded, 'stale-input');
        return;
      }
      if (Number.isFinite(data.q)) mp.inputSequences.set(key, data.q);
      let rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) rp.input = {
        sequence: Number.isFinite(data.q) ? data.q : (rp.input?.sequence ?? null),
        tx: clamp(Number(data.tx) || 0, -1, 1),
        ty: clamp(Number(data.ty) || 0, -1, 1),
        moving: !!data.m, bite: !!data.b,
      };
    } else if (decoded.kind === PacketKinds.ABILITY) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp && !rp.vehicleType && !(rp.mpEvolveChoices && rp.mpEvolveChoices.length)) withPlayerWorld(engine, rp, () => engine.componentSystems.activateAbility(engine, data.i, rp));
    } else if (decoded.kind === PacketKinds.EVOLUTION) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => commitEvolution(engine, rp, data.id));
    } else if (decoded.kind === PacketKinds.CHEAT) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => applyCheat(engine, rp, data.action));
    } else if (decoded.kind === PacketKinds.ITEM_USE) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => engine.componentSystems.useItem(engine, rp, data.i | 0));
    } else if (decoded.kind === PacketKinds.ITEM_DROP) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => engine.componentSystems.dropItem(engine, rp, data.i | 0));
    } else if (decoded.kind === PacketKinds.VEHICLE) {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => engine.componentSystems.toggleVehicle(engine, rp));
    }
  } else if (mp.role === 'client') {
    noteProtocol(engine, from, decoded.version);
    if (decoded.kind === PacketKinds.SNAPSHOT) {
      if (data.map && data.map !== engine.mapId) { dropPacket(engine, from, decoded, 'wrong-map'); return; }
      if (!isNewerSnapshotSequence(data.q, mp.lastSnapshotSeq)) { dropPacket(engine, from, decoded, 'stale-sequence'); return; }
      if (Number.isFinite(data.q)) mp.lastSnapshotSeq = data.q;
      applySnapshot(engine, data);
      engine.events.emit(GameEvents.NET_SNAPSHOT_APPLIED, {
        from, version: decoded.version, sequence: data.q, mapId: engine.mapId,
        players: data.players.length, npcs: data.npcs.length,
      });
    } else if (decoded.kind === PacketKinds.WORLD_INIT) applyWorldInit(engine, data);
    else if (decoded.kind === PacketKinds.FEED) engine.mpAddFeed(data.text, data.color);
  }
}

function ensureRemote(engine, connId) {
  const mp = engine.mp, r = mp.roster[connId] || {};
  const rp = new RemotePlayer(resolveSpecies(r.species, mp.stage, mp.tier, mp.fantasy), engine, { connId, name: r.name, color: r.color });
  rp.mapId = engine.player.mapId || engine.mapId;
  engine.remotePlayers.push(rp);
  engine.notifyScheduleChange();
  return rp;
}

/* ---------------- same-stage evolution ---------------- */

const evolutionChoices = (engine, player) => {
  const mp = engine.mp;
  if (!mp || !mp.evolution || !player || player.level < MAX_LEVEL) return [];
  return player.species.evolvesTo.filter(id =>
    SPECIES[id] && speciesStage(id) === engine.stage && (mp.fantasy || !SPECIES[id].fantasy));
};

/* Called by Player.addXp on the authoritative host when an individual player
   reaches level 10. The rest of the match keeps running while they choose. */
export function mpQueueEvolution(engine, player) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || (player.mpEvolveChoices && player.mpEvolveChoices.length)) return;
  const choices = evolutionChoices(engine, player);
  if (!choices.length) return;   // apex of this stage: never cross into the next one
  if (player.vehicle) engine.componentSystems.toggleVehicle(engine, player);
  player.mpEvolveChoices = choices;
  if (player === engine.player) {
    engine.setInputSuppressed(true);
    engine.sfx.play('egg');
    engine.pushHud(true);
  } else {
    player.input = { tx: 0, ty: 0, moving: false, bite: false };
  }
  mp.sendAcc = 1 / HOST_HZ;
}

/* EvolveModal calls this for the local player. Clients submit the choice;
   hosts apply their own choice directly. The host validates both paths. */
export function mpChooseEvolution(engine, id) {
  const mp = engine.mp, player = engine.player;
  if (!mp || !player || !(player.mpEvolveChoices || []).includes(id)) return;
  if (mp.role === 'client') {
    mpSendPacket(engine, PacketKinds.EVOLUTION, { id });
    return;
  }
  commitEvolution(engine, player, id);
}

function commitEvolution(engine, player, id) {
  const choices = player.mpEvolveChoices || [];
  if (!choices.includes(id) || !SPECIES[id] || speciesStage(id) !== engine.stage) return;
  const kills = player.kills || 0, deaths = player.deaths || 0, invincible = !!player.mpInvincible, mapId = player.mapId || engine.mapId;
  let evolved;
  if (player === engine.player) {
    engine.makePlayer(id);
    evolved = engine.player;
    engine.setInputSuppressed(false);
  } else {
    const index = engine.remotePlayers.indexOf(player);
    if (index < 0) return;
    evolved = new RemotePlayer(id, engine, {
      connId: player.connId, name: player.name, color: player.color,
    }, player);
    engine.remotePlayers[index] = evolved;
  }
  evolved.mapId = mapId;
  evolved.kills = kills; evolved.deaths = deaths; evolved.mpInvincible = invincible; evolved.mpEvolveChoices = [];
  evolved.spawnProtT = Math.max(evolved.spawnProtT || 0, 1.5);
  engine.sfx.play('evolve'); engine.shake = Math.min(10, engine.shake + 5);
  engine.mp.sendAcc = 1 / HOST_HZ;
  engine.pushHud(true);
}

/* Testing cheats use the same authority model as combat and evolution. A
   client requests an action, then the host applies it to that client's entity. */
export function mpUseCheat(engine, action) {
  const mp = engine.mp;
  if (!mp || !mp.cheats || !engine.player) return;
  if (mp.role === 'client') {
    mpSendPacket(engine, PacketKinds.CHEAT, { action });
    return;
  }
  applyCheat(engine, engine.player, action);
}

export function mpUseItem(engine, slot) {
  const mp = engine.mp; if (!mp || !engine.player || slot < 0 || slot >= ITEM_SLOT_COUNT) return;
  if (mp.role === 'client') {
    mpSendPacket(engine, PacketKinds.ITEM_USE, { i: slot }, { transient: true });
  } else engine.componentSystems.useItem(engine, engine.player, slot);
}

export function mpDropItem(engine, slot) {
  const mp = engine.mp; if (!mp || !engine.player || slot < 0 || slot >= ITEM_SLOT_COUNT) return;
  if (mp.role === 'client') {
    mpSendPacket(engine, PacketKinds.ITEM_DROP, { i: slot });
  } else engine.componentSystems.dropItem(engine, engine.player, slot);
}

export function mpToggleVehicle(engine) {
  const mp = engine.mp; if (!mp || !engine.player) return;
  if (mp.role === 'client') {
    mpSendPacket(engine, PacketKinds.VEHICLE);
  } else engine.componentSystems.toggleVehicle(engine, engine.player);
}

function applyCheat(engine, player, action) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.cheats || !player) return;
  if (action === 'invincible') player.mpInvincible = !player.mpInvincible;
  else if (action === 'level' && player.level < MAX_LEVEL && !(player.mpEvolveChoices && player.mpEvolveChoices.length)) {
    player.addXp(engine, xpNeed(player.level) / 2);
  } else return;
  mp.sendAcc = 1 / HOST_HZ;
  engine.pushHud(true);
}

/* Each player crosses independently. The host keeps every occupied map alive
   and only changes the crossing player's map membership and landing point. */
export function mpMaybeCrossMap(engine, dt) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.mapTransitions) {
    engine.nearEdge = null;
    return false;
  }
  const map = MAPS[engine.mapId], neighbors = (map && map.neighbors) || {};
  const passageAllows = (player, edge) => {
    const gate = map.passages && map.passages[edge]; if (!gate) return true;
    const horizontal = edge === 'top' || edge === 'bottom';
    const pos = horizontal ? player.x : player.y, span = horizontal ? engine.W : engine.H;
    return Math.abs(pos - span * gate.center) <= gate.width * 0.5 + Math.min(EDGE_PASSAGE_ASSIST, player.radius);
  };
  const edgeOf = player => {
    if (neighbors.left && passageAllows(player, 'left') && player.x <= player.radius + EDGE_TRIGGER_PAD) return 'left';
    if (neighbors.right && passageAllows(player, 'right') && player.x >= engine.W - player.radius - EDGE_TRIGGER_PAD) return 'right';
    if (neighbors.top && passageAllows(player, 'top') && player.y <= player.radius + EDGE_TRIGGER_PAD) return 'top';
    if (neighbors.bottom && passageAllows(player, 'bottom') && player.y >= engine.H - player.radius - EDGE_TRIGGER_PAD) return 'bottom';
    return null;
  };

  let crossed = false;
  for (const player of engine.allPlayers()) {
    if (!player || player.deadT > 0) continue;
    player._transitionCd = Math.max(0, (player._transitionCd || 0) - dt);
    const edge = edgeOf(player);
    const conn = player === engine.player ? mp.self : player.connId;
    const edgeKey = edge || null;
    if (edgeKey !== player._edgeKey) { player._edgeKey = edgeKey; player._edgeDwell = 0; }
    if (!edge) {
      player._edgeDwell = 0; mp.edgePrompts.delete(conn); continue;
    }
    const targetId = neighbors[edge], target = MAPS[targetId];
    mp.edgePrompts.set(conn, target.name);
    if (player._transitionCd > 0) continue;
    if (edge === 'left') player.vx = Math.min(0, player.vx);
    else if (edge === 'right') player.vx = Math.max(0, player.vx);
    else if (edge === 'top') player.vy = Math.min(0, player.vy);
    else if (edge === 'bottom') player.vy = Math.max(0, player.vy);
    player._edgeDwell = (player._edgeDwell || 0) + dt;
    if (player._edgeDwell >= EDGE_DWELL_TIME) {
      if (player.vehicle) engine.componentSystems.exitVehicle(engine, player, true);
      const arrive = OPPOSITE_EDGE[edge], horizontal = arrive === 'top' || arrive === 'bottom';
      const gate = target.passages && target.passages[arrive];
      const center = (horizontal ? target.W : target.H) * (gate ? gate.center : 0.5);
      if (arrive === 'right') { player.x = target.W - player.radius - 90; player.y = center; }
      else if (arrive === 'left') { player.x = player.radius + 90; player.y = center; }
      else if (arrive === 'top') { player.x = center; player.y = player.radius + 90; }
      else if (arrive === 'bottom') { player.x = center; player.y = target.H - player.radius - 90; }
      player.x = clamp(player.x, player.radius, target.W - player.radius);
      player.y = clamp(player.y, player.radius, target.H - player.radius);
      player.vx = 0; player.vy = 0; player.mapId = targetId;
      player._transitionCd = 1.2; player._edgeKey = null; player._edgeDwell = 0;
      ensureWorld(engine, targetId, player);
      mp.edgePrompts.delete(conn);
      if (player !== engine.player) mp.dirtyWorldFor.add(conn);
      else {
        engine.cam.x = clamp(player.x - engine.vw / 2, 0, Math.max(0, target.W - engine.vw));
        engine.cam.y = clamp(player.y - engine.vh / 2, 0, Math.max(0, target.H - engine.vh));
      }
      engine.visitedMaps.add(targetId);
      crossed = true;
    }
  }
  engine.nearEdge = mp.edgePrompts.get(mp.self) || null;
  return crossed;
}

/* Run the ordinary world update once for every occupied host-side map, then
   restore the host player's map for rendering, input, HUD and camera work. */
export function mpUpdateWorlds(engine, dt, updateWorld) {
  const mp = engine.mp;
  const previousVisibleMap = engine.mapId;
  saveActiveWorld(engine);
  const players = engine.player ? [engine.player, ...engine.remotePlayers] : engine.remotePlayers.slice();
  const occupied = [...new Set(players.map(player => player.mapId).filter(mapId => mp.worlds.has(mapId)))];
  for (const mapId of occupied) {
    mpActivateWorld(engine, mapId);
    engine._worldFocusPlayer = players.find(player => player.mapId === mapId) || null;
    updateWorld();
    saveActiveWorld(engine);
  }
  engine._worldFocusPlayer = null;
  mpActivateWorld(engine, engine.player.mapId);
  if (engine.mapId !== previousVisibleMap) {
    engine.captureRenderState(); engine.emitMapChanged(previousVisibleMap);
  }
  engine.nearEdge = mp.edgePrompts.get(mp.self) || null;
}

/* ---------------- host: broadcast ---------------- */

export function mpBroadcast(engine, dt) {
  const mp = engine.mp;
  if (!engine.remotePlayers.length) { mp.sendAcc = 0; return; }
  saveActiveWorld(engine);
  const restoreMap = engine.player.mapId;
  for (const conn of mp.dirtyWorldFor) {
    const player = engine.remotePlayers.find(remote => String(remote.connId) === String(conn));
    if (player && mpActivateWorld(engine, player.mapId) && mp.lobby) {
      mp.lobby.raw({
        t: 'relay', to: player.connId,
        data: adaptPacketToVersion(buildWorldInit(engine), peerProtocol(mp, player.connId)),
      });
    }
  }
  mp.dirtyWorldFor.clear();
  mp.sendAcc += dt;
  if (mp.sendAcc < 1 / HOST_HZ) { mpActivateWorld(engine, restoreMap); return; }
  mp.sendAcc %= 1 / HOST_HZ;
  const recipientsByMap = new Map();
  for (const player of engine.remotePlayers) {
    if (!recipientsByMap.has(player.mapId)) recipientsByMap.set(player.mapId, []);
    recipientsByMap.get(player.mapId).push(player);
  }
  for (const [mapId, recipients] of recipientsByMap) {
    if (!mpActivateWorld(engine, mapId)) continue;
    for (const player of recipients) {
      sendTransient(mp.lobby, {
        t: 'relay', to: player.connId,
        data: adaptPacketToVersion(buildSnapshot(engine, player.connId), peerProtocol(mp, player.connId)),
      });
    }
  }
  mpActivateWorld(engine, restoreMap);
}

/* Run immediately before the runtime's component projection. IDs allocated
   here become NETWORK_IDENTITY components in that same fixed step, including
   entities newly spawned in an inactive host map. */
export function mpPrepareSnapshot(engine) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.worlds) return;
  saveActiveWorld(engine);
  for (const state of mp.worlds.values()) {
    for (const field of ['creatures', 'food', 'worldItems', 'itemProjectiles', 'vehicles']) {
      for (const source of state[field] || []) if (source.netId == null) source.netId = mp.nextNet++;
    }
  }
}

const componentFor = (engine, source, type) =>
  engine.componentSystems.adapter.componentFor(source, type);
const componentValue = (component, field, source, sourceField = field, fallback = 0) => {
  const value = component && component[field] !== undefined ? component[field] : source[sourceField];
  return value == null ? fallback : value;
};

function buildPowerState(pl, abilityState = null, status = null) {
  const state = field => componentValue(abilityState, field, pl, field, 0);
  const statusValue = field => componentValue(status, field, pl, field, 0);
  const point = value => value ? Math.round(value) : 0;
  return {
    eg: Math.ceil(state('engulfT') * 100), ea: roundTo(state('engulfAngle') || pl.angle || 0, 2),
    sv: Math.ceil(state('shockVisualT') * 100), sl: (pl.shockLinks || []).map(link => [point(link.x), point(link.y)]),
    ic: Math.ceil(state('inkCloudT') * 10), ix: point(state('inkX')), iy: point(state('inkY')), dx: point(state('decoyX')), dy: point(state('decoyY')), da: roundTo(state('decoyAngle'), 2),
    vx: point(state('vortexX')), vy: point(state('vortexY')),
    cr: Math.ceil(state('crushT') * 100), ca: roundTo(state('crushAngle'), 2), im: Math.ceil(state('impaleT') * 100), ia: roundTo(Number.isFinite(state('impaleAngle')) ? state('impaleAngle') : (pl.angle || 0), 2), ir: Math.round(state('impaleReach')),
    lp: Math.ceil(state('leapT') * 100), lm: Math.ceil(state('leapMax') * 100), lk: state('leapKind') || undefined, lx: point(pl.leapX), ly: point(pl.leapY),
    st: Math.ceil(state('stompT') * 100), sx: point(state('stompX')), sy: point(state('stompY')), ts: Math.ceil(state('tailSweepT') * 100),
    mo: Math.round(state('sprintMomentum') * 100), ef: Math.ceil(state('evasionFlashT') * 100),
    fc: state('filterCombo'), cc: Math.round(state('camoCharge') * 100), ap: state('armorPlates'),
    fo: Math.round(state('fortify') * 100), sa: Math.round(state('sailHeat') * 100), rb: Math.ceil(state('rebirthT') * 100),
    bc: state('barbCharge'), se: Math.ceil(state('senseCd') * 10), rd: Math.ceil(state('regenDelay') * 10), ai: Math.ceil(state('airStride') * 10), ru: state('rebirthUsed') ? 1 : 0,
    hs: Math.round(state('hardenStored')), ws: Math.round(state('withdrawStored')), bb: state('burstBreach') ? 1 : 0,
    sn: Math.ceil(statusValue('stunT') * 10), so: Math.ceil(statusValue('slowT') * 10), ar: Math.ceil(statusValue('armorBreakT') * 10), vu: Math.ceil(statusValue('vulnerableT') * 10),
    vs: statusValue('venomStacks'), vm: Math.ceil(statusValue('venomMarkT') * 10),
    bp: (state('bloomPoints') || []).map(link => [point(link.x), point(link.y)]),
  };
}

function applyPowerState(pl, state = {}) {
  pl.engulfT = (state.eg || 0) / 100; pl.engulfAngle = state.ea || pl.angle || 0;
  pl.shockVisualT = (state.sv || 0) / 100; pl.shockLinks = (state.sl || []).map(link => ({ x: link[0], y: link[1] }));
  pl.inkCloudT = (state.ic || 0) / 10; pl.inkX = state.ix || 0; pl.inkY = state.iy || 0; pl.decoyX = state.dx || 0; pl.decoyY = state.dy || 0; pl.decoyAngle = state.da || 0;
  pl.vortexX = state.vx || 0; pl.vortexY = state.vy || 0;
  pl.crushT = (state.cr || 0) / 100; pl.crushAngle = state.ca || 0; pl.impaleT = (state.im || 0) / 100; pl.impaleAngle = Number.isFinite(state.ia) ? state.ia : (pl.angle || 0); pl.impaleReach = state.ir || 0;
  pl.leapT = (state.lp || 0) / 100; pl.leapMax = (state.lm || 0) / 100; pl.leapKind = state.lk || null; pl.leapX = state.lx || 0; pl.leapY = state.ly || 0;
  pl.stompT = (state.st || 0) / 100; pl.stompX = state.sx || 0; pl.stompY = state.sy || 0; pl.tailSweepT = (state.ts || 0) / 100;
  pl.sprintMomentum = (state.mo || 0) / 100; pl.evasionFlashT = (state.ef || 0) / 100;
  pl.filterCombo = state.fc || 0; pl.camoCharge = (state.cc || 0) / 100; pl.armorPlates = state.ap || 0;
  pl.fortify = (state.fo || 0) / 100; pl.sailHeat = (state.sa || 0) / 100; pl.rebirthT = (state.rb || 0) / 100;
  pl.barbCharge = state.bc || 0; pl.senseCd = (state.se || 0) / 10; pl.regenDelay = (state.rd || 0) / 10; pl.airStride = (state.ai || 0) / 10; pl.rebirthUsed = !!state.ru;
  pl.hardenStored = state.hs || 0; pl.withdrawStored = state.ws || 0; pl.burstBreach = state.bb ? 1 : 0;
  pl.stunT = (state.sn || 0) / 10; pl.slowT = (state.so || 0) / 10; pl.armorBreakT = (state.ar || 0) / 10; pl.vulnerableT = (state.vu || 0) / 10;
  pl.venomStacks = state.vs || 0; pl.venomMarkT = (state.vm || 0) / 10;
  pl.bloomPoints = (state.bp || []).map(link => ({ x: link[0], y: link[1] }));
}

function buildSnapshot(engine, recipientConn) {
  const mp = engine.mp, players = [];
  const pushP = (pl, c) => {
    const transform = componentFor(engine, pl, C.TRANSFORM);
    const health = componentFor(engine, pl, C.HEALTH);
    const experience = componentFor(engine, pl, C.EXPERIENCE);
    const combat = componentFor(engine, pl, C.COMBAT);
    const status = componentFor(engine, pl, C.STATUS);
    const shield = componentFor(engine, pl, C.SHIELD);
    const loadout = componentFor(engine, pl, C.ABILITY_LOADOUT);
    const ability = componentFor(engine, pl, C.ABILITY_STATE);
    const inventory = componentFor(engine, pl, C.INVENTORY);
    const respawn = componentFor(engine, pl, C.RESPAWN);
    const pilot = componentFor(engine, pl, C.VEHICLE_PILOT);
    const abilities = componentValue(loadout, 'abilities', pl, 'abilities', []);
    const cooldowns = componentValue(ability, 'acd', pl, 'acd', {});
    // Cooldown/active times travel as deciseconds to keep the 20 Hz snapshot
    // compact while still giving joined clients responsive ability feedback.
    const abilityState = abilities.map(id => {
      const timer = ACTIVE_TIMER[id];
      return [Math.ceil((cooldowns[id] || 0) * 10), timer ? Math.ceil(componentValue(ability, timer, pl) * 10) : 0];
    });
    players.push({
      c, s: pl.speciesId,
      x: Math.round(componentValue(transform, 'x', pl)), y: Math.round(componentValue(transform, 'y', pl)),
      a: roundTo(componentValue(transform, 'angle', pl), 2),
      hp: Math.round(componentValue(health, 'hp', pl)), mhp: Math.round(componentValue(health, 'maxHp', pl)),
      lv: componentValue(experience, 'level', pl, 'level', 1), xp: Math.round(componentValue(experience, 'xp', pl)),
      b: roundTo(componentValue(combat, 'biteAnim', pl), 2),
      sh: Math.round(componentValue(shield, 'shield', pl)), sm: Math.round(componentValue(shield, 'shieldMax', pl)),
      ff: Math.ceil(componentValue(shield, 'forceFieldT', pl) * 10),
      ab: abilityState, k: componentValue(combat, 'kills', pl), d: Math.ceil(componentValue(respawn, 'deadT', pl)),
      ev: pl.mpEvolveChoices && pl.mpEvolveChoices.length ? pl.mpEvolveChoices : undefined,
      iv: pl.mpInvincible ? 1 : 0,
      sq: pl.cameraShakeSeq || 0, sk: pl.cameraShakePower || 0,
      ca: componentValue(ability, 'castT', pl) > 0 ? componentValue(ability, 'castAbility', pl, 'castAbility', null) : undefined,
      cq: componentValue(ability, 'castSeq', pl), ct: Math.ceil(componentValue(ability, 'castT', pl) * 10),
      grt: Math.ceil(componentValue(ability, 'graspT', pl) * 100),
      grx: componentValue(ability, 'graspT', pl) > 0 ? Math.round(componentValue(ability, 'graspX', pl)) : undefined,
      gry: componentValue(ability, 'graspT', pl) > 0 ? Math.round(componentValue(ability, 'graspY', pl)) : undefined,
      pw: buildPowerState(pl, ability, status),
      vh: componentValue(pilot, 'vehicleNetId', pl, 'vehicleNetId', 0),
      vt: componentValue(pilot, 'vehicleType', pl, 'vehicleType', null) || undefined,
      it: componentValue(inventory, 'items', pl, 'items', []).map(item => item ? [item.id, item.uses, Math.ceil((item.cd || 0) * 10)] : 0),
    });
  };
  for (const player of engine.allPlayers()) pushP(player, player === engine.player ? mp.self : player.connId);
  const npcs = [];
  for (const c of engine.creatures) {
    if (c.netId == null) c.netId = mp.nextNet++;
    const transform = componentFor(engine, c, C.TRANSFORM);
    const health = componentFor(engine, c, C.HEALTH);
    const collider = componentFor(engine, c, C.COLLIDER);
    const experience = componentFor(engine, c, C.EXPERIENCE);
    const combat = componentFor(engine, c, C.COMBAT);
    const status = componentFor(engine, c, C.STATUS);
    const bossState = componentFor(engine, c, C.BOSS);
    const telegraph = componentFor(engine, c, C.TELEGRAPH);
    const network = componentFor(engine, c, C.NETWORK_IDENTITY);
    const npc = {
      n: componentValue(network, 'netId', c, 'netId', 0), k: c.key,
      x: Math.round(componentValue(transform, 'x', c)), y: Math.round(componentValue(transform, 'y', c)),
      a: roundTo(componentValue(transform, 'angle', c), 2),
      hp: Math.round(componentValue(health, 'hp', c)), mhp: Math.round(componentValue(health, 'maxHp', c)),
      r: Math.round(componentValue(collider, 'radius', c)), lv: componentValue(experience, 'level', c, 'level', 1),
      st: componentValue(status, 'stunT', c) > 0 ? 1 : 0, mo: Math.ceil(componentValue(combat, 'mouth', c) * 100),
      ar: Math.ceil(componentValue(status, 'armorBreakT', c) * 10),
      vu: Math.ceil(componentValue(status, 'vulnerableT', c) * 10),
      vs: componentValue(status, 'venomStacks', c),
      vm: Math.ceil(componentValue(status, 'venomMarkT', c) * 10),
    };
    if (c.boss) {
      npc.bk = componentValue(bossState, 'bossKind', c, 'bossKind', null);
      npc.h = Math.ceil(componentValue(status, 'hardenT', c) * 10);
      npc.e = componentValue(bossState, 'engaged', c) ? 1 : 0;
      const currentTelegraph = componentValue(telegraph, 'telegraph', c, 'telegraph', null);
      npc.tg = currentTelegraph ? { ...currentTelegraph, t: roundTo(currentTelegraph.t, 2), max: roundTo(currentTelegraph.max, 2) } : undefined;
      if (c.bossKind === 'panderodus') npc.ps = {
        m: c.panderodusMode, st: roundTo(c.stateT || 0, 2), pi: c.passIndex || 0, pd: c.passDirection || 1,
        py: Math.round(c.passY || 0), pp: roundTo(c.passPauseT || 0, 2), sc: roundTo(c.screamT || 0, 2),
        tt: roundTo(c.tailSlapT || 0, 2), it: roundTo(c.impactT || 0, 2), ix: Math.round(c.impactX || 0),
        iy: Math.round(c.impactY || 0), ia: roundTo(c.impactAngle || 0, 2), is: c.impactSeq || 0,
        lt: roundTo(c.latchT || 0, 2), lc: c.latchConn || 0,
      };
    } else if (!NPCS[c.key]) {
      npc.pl = c.plan; npc.co = c.cocoon ? 1 : 0; npc.lo = c.lumenOrb ? 1 : 0;
      if (c.hatchT != null) npc.ht = roundTo(c.hatchT, 1);
    }
    npcs.push(npc);
    if (npcs.length >= 80) break;
  }
  const food = [];
  for (const f of engine.food) {
    if (f.netId == null) f.netId = mp.nextNet++;
    const transform = componentFor(engine, f, C.TRANSFORM);
    const foodState = componentFor(engine, f, C.FOOD);
    const network = componentFor(engine, f, C.NETWORK_IDENTITY);
    food.push({
      n: componentValue(network, 'netId', f, 'netId', 0),
      x: Math.round(componentValue(transform, 'x', f)), y: Math.round(componentValue(transform, 'y', f)),
      m: componentValue(foodState, 'kind', f, 'kind', 'plant') === 'meat' ? 1 : 0,
    });
    if (food.length >= 60) break;
  }
  const dynamicWebs = engine.webs.filter(w => w.life != null).map(w => ({
    x: Math.round(w.x), y: Math.round(w.y), r: Math.round(w.r), angle: roundTo(w.angle || 0, 2), life: roundTo(w.life, 1), abilityWeb: !!w.abilityWeb,
  }));
  const worldItems = engine.worldItems.map(item => {
    if (item.netId == null) item.netId = mp.nextNet++;
    const transform = componentFor(engine, item, C.TRANSFORM);
    const itemState = componentFor(engine, item, C.ITEM);
    const network = componentFor(engine, item, C.NETWORK_IDENTITY);
    return {
      n: componentValue(network, 'netId', item, 'netId', 0),
      t: componentValue(itemState, 'type', item, 'type', null),
      x: Math.round(componentValue(transform, 'x', item)), y: Math.round(componentValue(transform, 'y', item)),
      u: componentValue(itemState, 'uses', item, 'uses', 0),
    };
  });
  const itemProjectiles = engine.itemProjectiles.map(projectile => {
    if (projectile.netId == null) projectile.netId = mp.nextNet++;
    const transform = componentFor(engine, projectile, C.TRANSFORM);
    const collider = componentFor(engine, projectile, C.COLLIDER);
    const projectileState = componentFor(engine, projectile, C.PROJECTILE);
    const lifetime = componentFor(engine, projectile, C.LIFETIME);
    const network = componentFor(engine, projectile, C.NETWORK_IDENTITY);
    return {
      n: componentValue(network, 'netId', projectile, 'netId', 0),
      t: componentValue(projectileState, 'type', projectile, 'type', null),
      v: componentValue(projectileState, 'visual', projectile, 'visual', null),
      x: Math.round(componentValue(transform, 'x', projectile)), y: Math.round(componentValue(transform, 'y', projectile)),
      a: roundTo(componentValue(transform, 'angle', projectile), 2),
      r: Math.round(componentValue(collider, 'radius', projectile, 'radius', 0)),
      l: roundTo(componentValue(lifetime, 'life', projectile, 'life', 0), 2),
      ml: roundTo(projectile.maxLife || 0, 2), len: Math.round(projectile.length || 0),
      sp: roundTo(projectile.spread || 0, 2), c: projectile.color, sd: projectile.seed,
      ar: !!componentValue(projectileState, 'armed', projectile, 'armed', false), at: roundTo(projectile.armT || 0, 2), am: roundTo(projectile.armMax || 0, 2),
      tr: Math.round(projectile.triggerRadius || 0),
    };
  });
  const vehicles = engine.vehicles.map(vehicle => {
    const transform = componentFor(engine, vehicle, C.TRANSFORM);
    const collider = componentFor(engine, vehicle, C.COLLIDER);
    const vehicleState = componentFor(engine, vehicle, C.VEHICLE);
    const network = componentFor(engine, vehicle, C.NETWORK_IDENTITY);
    return {
      n: componentValue(network, 'netId', vehicle, 'netId', 0),
      t: componentValue(vehicleState, 'type', vehicle, 'type', null),
      x: Math.round(componentValue(transform, 'x', vehicle)), y: Math.round(componentValue(transform, 'y', vehicle)),
      a: roundTo(componentValue(transform, 'angle', vehicle), 2),
      hp: Math.round(componentValue(vehicleState, 'hp', vehicle)), mhp: componentValue(vehicleState, 'maxHp', vehicle),
      r: componentValue(collider, 'radius', vehicle, 'radius', 0),
      oc: componentValue(vehicleState, 'occupantConn', vehicle, 'occupantConn', null),
      cd: Math.ceil(componentValue(vehicleState, 'weaponCd', vehicle) * 100),
      tm: Number.isFinite(componentValue(vehicleState, 'timeLeft', vehicle, 'timeLeft', null))
        ? Math.ceil(componentValue(vehicleState, 'timeLeft', vehicle, 'timeLeft', 0) * 10)
        : undefined,
    };
  });
  const rosterPlayers = [engine.player, ...engine.remotePlayers].map(player => {
    const experience = componentFor(engine, player, C.EXPERIENCE);
    const combat = componentFor(engine, player, C.COMBAT);
    const respawn = componentFor(engine, player, C.RESPAWN);
    const mapMember = componentFor(engine, player, C.MAP_MEMBER);
    return {
      c: player === engine.player ? mp.self : player.connId,
      lv: componentValue(experience, 'level', player, 'level', 1),
      k: componentValue(combat, 'kills', player),
      d: componentValue(respawn, 'deadT', player) > 0 ? 1 : 0,
      map: componentValue(mapMember, 'mapId', player, 'mapId', engine.mapId),
    };
  });
  return {
    k: 'S', q: mp.seq++, map: engine.mapId,
    players, npcs, food, dynamicWebs, worldItems, itemProjectiles, vehicles,
    rosterPlayers,
    edgeC: mp.edgePrompts.has(recipientConn) ? recipientConn : null, edgeName: mp.edgePrompts.get(recipientConn) || null,
    perks: engine.perks, bossesDefeated: [...engine.bossesDefeated],
  };
}

function buildWorldInit(engine) {
  return {
    k: 'W', map: engine.mapId, era: engine.era, W: engine.W, H: engine.H, theme: engine.theme,
    obstacles: engine.obstacles.map(o => ({ kind: o.kind, x: o.x, y: o.y, r: o.r, angle: o.angle, seed: o.seed })),
    plants: engine.plants.map(p => ({ kind: p.kind, x: p.x, y: p.y, h: p.h, sway: p.sway, amount: p.amount, max: p.max })),
    webs: engine.webs.map(w => ({ x: w.x, y: w.y, r: w.r, angle: w.angle })),
  };
}

/* ---------------- client: apply + smooth ---------------- */

function makeRenderPlayer(engine, pd) {
  const r = engine.mp.roster[pd.c] || {}, sp = SPECIES[pd.s];
  const player = {
    connId: pd.c, name: r.name || 'Player', color: r.color || '#8affd0', species: pd.s,
    plan: sp.plan, radius: sp.stats.radius, scale: 1, animOff: (pd.c * 13) % 100,
    vx: 0, vy: 0, mouth: 0, hurt: 0, x: pd.x, y: pd.y, angle: pd.a, gx: pd.x, gy: pd.y, ga: pd.a,
    hp: pd.hp, maxHp: pd.mhp, level: pd.lv, xp: pd.xp || 0, shield: pd.sh, shieldMax: pd.sm || 0,
    forceFieldT: (pd.ff || 0) / 10,
    abilities: (ABILITY_SETS[pd.s] || []).slice(), acd: {}, biteAnim: pd.b, kills: pd.k || 0, deadT: pd.d || 0,
    mpInvincible: !!pd.iv, items: Array(ITEM_SLOT_COUNT).fill(null),
    castAbility: pd.ca || null, castT: (pd.ct || 0) / 10, castSeq: pd.cq || 0,
    graspT: (pd.grt || 0) / 100, graspX: pd.grx || 0, graspY: pd.gry || 0,
    cameraShakeSeq: pd.sq || 0, cameraShakePower: pd.sk || 0,
    vehicle: null, vehicleType: pd.vt || null, vehicleNetId: pd.vh || null,
  };
  applyAbilityState(player, pd.ab);
  applyPowerState(player, pd.pw);
  applyItemState(player, pd.it);
  return player;
}
function makeRenderNpc(nd) {
  const boss = nd.bk && BOSSES[nd.bk];
  if (boss) return {
    netId: nd.n, key: nd.bk, bossKind: nd.bk, kind: boss.kind, title: boss.title, short: boss.short,
    plan: { ...boss.plan }, boss: true, role: 'predator', scale: boss.scale || 1, animOff: (nd.n * 7) % 100,
    vx: 0, vy: 0, mouth: (nd.mo || 0) / 100, hurt: 0, hpBarT: 0, stunT: 0, slowT: 0, hardenT: (nd.h || 0) / 10,
    armorBreakT: (nd.ar || 0) / 10, vulnerableT: (nd.vu || 0) / 10, venomStacks: nd.vs || 0, venomMarkT: (nd.vm || 0) / 10,
    engaged: !!nd.e, telegraph: nd.tg || null,
    panderodusMode: nd.ps ? nd.ps.m : 'hunt', stateT: nd.ps ? nd.ps.st || 0 : 0,
    passIndex: nd.ps ? nd.ps.pi || 0 : 0, passDirection: nd.ps ? nd.ps.pd || 1 : 1, passY: nd.ps ? nd.ps.py || 0 : 0,
    passPauseT: nd.ps ? nd.ps.pp || 0 : 0, screamT: nd.ps ? nd.ps.sc || 0 : 0, tailSlapT: nd.ps ? nd.ps.tt || 0 : 0,
    impactT: nd.ps ? nd.ps.it || 0 : 0, impactX: nd.ps ? nd.ps.ix || 0 : 0, impactY: nd.ps ? nd.ps.iy || 0 : 0,
    impactAngle: nd.ps ? nd.ps.ia || 0 : 0, impactSeq: nd.ps ? nd.ps.is || 0 : 0,
    latchT: nd.ps ? nd.ps.lt || 0 : 0, latchConn: nd.ps ? nd.ps.lc || 0 : 0,
    x: nd.x, y: nd.y, angle: nd.a, gx: nd.x, gy: nd.y, ga: nd.a,
    hp: nd.hp, maxHp: nd.mhp, radius: nd.r, level: nd.lv,
  };
  const s = NPCS[nd.k], plan = nd.pl || (s ? s.plan : { kind: 'microbe', body: '#88a', accent: '#ccd' });
  return {
    netId: nd.n, key: nd.k, plan, boss: false, role: s ? s.role : 'prey', scale: 1, animOff: (nd.n * 7) % 100,
    vx: 0, vy: 0, mouth: 0, hurt: 0, hpBarT: 0, stunT: 0, armorBreakT: (nd.ar || 0) / 10, vulnerableT: (nd.vu || 0) / 10,
    venomStacks: nd.vs || 0, venomMarkT: (nd.vm || 0) / 10, x: nd.x, y: nd.y, angle: nd.a, gx: nd.x, gy: nd.y, ga: nd.a,
    hp: nd.hp, maxHp: nd.mhp, radius: nd.r, level: nd.lv, cocoon: !!nd.co, lumenOrb: !!nd.lo, hatchT: nd.ht,
  };
}

function applyAbilityState(player, state) {
  if (!player || !Array.isArray(state)) return;
  if (!player.acd) player.acd = {};
  for (let i = 0; i < player.abilities.length; i++) {
    const id = player.abilities[i], slot = state[i] || [0, 0];
    player.acd[id] = (slot[0] || 0) / 10;
    const timer = ACTIVE_TIMER[id];
    if (timer) player[timer] = (slot[1] || 0) / 10;
  }
}

function applyItemState(player, state) {
  if (!player) return;
  player.items = Array.from({ length: ITEM_SLOT_COUNT }, (_, i) => {
    const item = Array.isArray(state) && state[i];
    return item && ITEMS[item[0]] ? { id: item[0], uses: item[1] || 0, cd: (item[2] || 0) / 10 } : null;
  });
}

function applySnapshot(engine, s) {
  const mp = engine.mp;
  if (Array.isArray(s.rosterPlayers)) mp.rosterStats = s.rosterPlayers.map(player => ({ ...player }));
  engine.nearEdge = s.edgeC === mp.self ? (s.edgeName || null) : null;
  if (s.perks) engine.perks = {
    dmgReduce: s.perks.dmgReduce || 0, dodge: s.perks.dodge || 0, webResist: s.perks.webResist || 0,
    shockAfterglow: s.perks.shockAfterglow || 0, list: Array.isArray(s.perks.list) ? s.perks.list.map(x => ({ ...x })) : [],
  };
  if (Array.isArray(s.bossesDefeated)) engine.bossesDefeated = new Set(s.bossesDefeated);
  const seen = mp.seenPlayers; seen.clear();
  for (const pd of s.players) {
    if (pd.c === mp.self) {
      const hadChoices = !!(engine.player.mpEvolveChoices && engine.player.mpEvolveChoices.length);
      const previousVehicleType = engine.player.vehicleType;
      const shakeSeen = engine.player._cameraShakeSeen || 0;
      const castSeen = engine.player._castSeen || 0;
      if (engine.player.speciesId !== pd.s && SPECIES[pd.s]) engine.makePlayer(pd.s);
      const pl = engine.player;
      pl.gx = pd.x; pl.gy = pd.y; pl.ga = pd.a; pl.hp = pd.hp; pl.maxHp = pd.mhp; pl.level = pd.lv; pl.xp = pd.xp || 0;
      pl.snapshotSeq = s.q;
      pl.shield = pd.sh; pl.shieldMax = pd.sm || 0; pl.forceFieldT = (pd.ff || 0) / 10; applyAbilityState(pl, pd.ab);
      applyPowerState(pl, pd.pw);
      applyItemState(pl, pd.it);
      pl.kills = pd.k || 0; pl.deadT = pd.d || 0;
      pl.mpInvincible = !!pd.iv;
      pl.castAbility = pd.ca || null; pl.castT = (pd.ct || 0) / 10; pl.castSeq = pd.cq || 0; pl._castSeen = castSeen;
      if (pl.castSeq > pl._castSeen) {
        engine.sfx.play(pl.castAbility === 'frenzy' ? 'frenzy' : pl.castAbility === 'ram' ? 'ram' : 'power');
      }
      pl._castSeen = pl.castSeq;
      pl.graspT = (pd.grt || 0) / 100;
      if (Number.isFinite(pd.grx)) pl.graspX = pd.grx;
      if (Number.isFinite(pd.gry)) pl.graspY = pd.gry;
      pl.cameraShakeSeq = pd.sq || 0; pl.cameraShakePower = pd.sk || 0; pl._cameraShakeSeen = shakeSeen;
      if (pl.cameraShakeSeq > pl._cameraShakeSeen) {
        engine.shake = Math.min(22, engine.shake + pl.cameraShakePower);
        engine.sfx.play('ram_hit');
      }
      pl._cameraShakeSeen = pl.cameraShakeSeq;
      pl.vehicle = null; pl.vehicleType = pd.vt || null; pl.vehicleNetId = pd.vh || null;
      if (!previousVehicleType && pl.vehicleType) engine.sfx.play('vehicle_enter');
      else if (previousVehicleType && !pl.vehicleType) engine.sfx.play('vehicle_exit');
      pl.mpEvolveChoices = Array.isArray(pd.ev) ? pd.ev.slice() : [];
      if (pl.mpEvolveChoices.length) engine.setInputSuppressed(true);
      else if (hadChoices) engine.setInputSuppressed(false);
      if (!pl._netInit) { pl.x = pd.x; pl.y = pd.y; pl.angle = pd.a; pl._netInit = true; }
      continue;
    }
    seen.add(pd.c);
    let rp = mp.rpById.get(pd.c);
    if (!rp) { rp = makeRenderPlayer(engine, pd); mp.rpById.set(pd.c, rp); engine.remotePlayers.push(rp); }
    else if (rp.species !== pd.s) {
      rp.species = pd.s; rp.plan = SPECIES[pd.s].plan; rp.radius = SPECIES[pd.s].stats.radius;
      rp.abilities = (ABILITY_SETS[pd.s] || []).slice(); rp.acd = {};
    }
    rp.gx = pd.x; rp.gy = pd.y; rp.ga = pd.a; rp.hp = pd.hp; rp.maxHp = pd.mhp; rp.level = pd.lv; rp.xp = pd.xp || 0;
    rp.snapshotSeq = s.q;
    rp.shield = pd.sh; rp.shieldMax = pd.sm || 0; rp.forceFieldT = (pd.ff || 0) / 10; applyAbilityState(rp, pd.ab);
    applyPowerState(rp, pd.pw);
    applyItemState(rp, pd.it);
    rp.kills = pd.k || 0; rp.deadT = pd.d || 0; rp.mpInvincible = !!pd.iv;
    rp.castAbility = pd.ca || null; rp.castT = (pd.ct || 0) / 10; rp.castSeq = pd.cq || 0;
    rp.graspT = (pd.grt || 0) / 100;
    if (Number.isFinite(pd.grx)) rp.graspX = pd.grx;
    if (Number.isFinite(pd.gry)) rp.graspY = pd.gry;
    rp.vehicle = null; rp.vehicleType = pd.vt || null; rp.vehicleNetId = pd.vh || null;
    if (pd.b > (rp.biteAnim || 0)) rp.biteAnim = pd.b;
  }
  for (const [cid, rp] of mp.rpById) if (!seen.has(cid)) { mp.rpById.delete(cid); const i = engine.remotePlayers.indexOf(rp); if (i >= 0) engine.remotePlayers.splice(i, 1); }

  const seenN = mp.seenNpcs; seenN.clear();
  for (const nd of s.npcs) {
    seenN.add(nd.n);
    let c = mp.npcById.get(nd.n);
    const fresh = !c;
    if (!c) { c = makeRenderNpc(nd); mp.npcById.set(nd.n, c); }
    const previousSpecial = c.telegraph && c.telegraph.special;
    const previousMode = c.panderodusMode, previousPassIndex = c.passIndex || 0, previousImpactSeq = c.impactSeq || 0;
    c.gx = nd.x; c.gy = nd.y; c.ga = nd.a; c.hp = nd.hp; c.maxHp = nd.mhp; c.radius = nd.r; c.level = nd.lv;
    c.snapshotSeq = s.q;
    c.mouth = Math.max(c.mouth || 0, (nd.mo || 0) / 100);
    c.stunT = nd.st ? 0.4 : 0; c.hpBarT = nd.hp < nd.mhp ? 1.2 : c.hpBarT;
    c.armorBreakT = (nd.ar || 0) / 10; c.vulnerableT = (nd.vu || 0) / 10; c.venomStacks = nd.vs || 0; c.venomMarkT = (nd.vm || 0) / 10;
    if (c.boss) {
      c.hardenT = (nd.h || 0) / 10; c.engaged = !!nd.e; c.telegraph = nd.tg || null;
      if (c.bossKind === 'panderodus' && nd.ps) {
        Object.assign(c, {
          panderodusMode: nd.ps.m || 'hunt', stateT: nd.ps.st || 0, passIndex: nd.ps.pi || 0,
          passDirection: nd.ps.pd || 1, passY: nd.ps.py || 0, passPauseT: nd.ps.pp || 0,
          screamT: nd.ps.sc || 0, tailSlapT: nd.ps.tt || 0, impactT: nd.ps.it || 0,
          impactX: nd.ps.ix || 0, impactY: nd.ps.iy || 0, impactAngle: nd.ps.ia || 0,
          impactSeq: nd.ps.is || 0, latchT: nd.ps.lt || 0, latchConn: nd.ps.lc || 0,
        });
        const special = c.telegraph && c.telegraph.special;
        if (special === 'fangCharge' && (fresh || previousSpecial !== special)) engine.sfx.play('panderodus_scream');
        if (c.panderodusMode === 'pass' && (fresh || previousMode !== 'pass' || c.passIndex !== previousPassIndex)) {
          if (previousMode !== 'pass') { c.x = nd.x; c.y = nd.y; }
          engine.sfx.play('panderodus_pass');
        }
        if (c.panderodusMode === 'latched' && (fresh || previousMode !== 'latched')) engine.sfx.play('panderodus_latch');
        if (c.impactSeq > previousImpactSeq) { engine.shake = Math.min(22, engine.shake + 18); engine.sfx.play('panderodus_crash'); }
      }
    }
    if (c.cocoon && nd.ht != null) c.hatchT = nd.ht;
  }
  for (const [nid] of mp.npcById) if (!seenN.has(nid)) mp.npcById.delete(nid);
  engine.creatures.length = 0;
  for (const c of mp.npcById.values()) engine.creatures.push(c);

  const seenF = mp.seenFood; seenF.clear();
  for (const fd of s.food) {
    seenF.add(fd.n);
    let f = mp.foodById.get(fd.n);
    if (!f) {
      f = { netId: fd.n, x: fd.x, y: fd.y, kind: fd.m ? 'meat' : 'plant', r: 4, life: 1, vx: 0, vy: 0 };
      mp.foodById.set(fd.n, f);
    } else { f.x = fd.x; f.y = fd.y; f.kind = fd.m ? 'meat' : 'plant'; }
    f.snapshotSeq = s.q;
  }
  for (const [fid] of mp.foodById) if (!seenF.has(fid)) mp.foodById.delete(fid);
  engine.food.length = 0;
  for (const f of mp.foodById.values()) engine.food.push(f);
  const staticWebs = engine.webs.filter(w => w.life == null);
  engine.webs = staticWebs.concat((s.dynamicWebs || []).map(w => ({ ...w })));

  const seenI = mp.seenItems; seenI.clear();
  for (const itemData of (s.worldItems || [])) {
    if (!ITEMS[itemData.t]) continue;
    seenI.add(itemData.n);
    let item = mp.itemById.get(itemData.n);
    if (!item) {
      item = { netId: itemData.n, type: itemData.t, x: itemData.x, y: itemData.y, gx: itemData.x, gy: itemData.y, uses: itemData.u, radius: 18, bob: itemData.n % 6.28 };
      mp.itemById.set(itemData.n, item);
    }
    item.type = itemData.t; item.gx = itemData.x; item.gy = itemData.y; item.uses = itemData.u;
    item.snapshotSeq = s.q;
  }
  for (const [id] of mp.itemById) if (!seenI.has(id)) mp.itemById.delete(id);
  engine.worldItems = [...mp.itemById.values()];

  const seenV = mp.seenVehicles; seenV.clear();
  for (const vehicleData of (s.vehicles || [])) {
    seenV.add(vehicleData.n);
    let vehicle = mp.vehicleById.get(vehicleData.n);
    if (!vehicle) {
      vehicle = { netId: vehicleData.n, x: vehicleData.x, y: vehicleData.y, gx: vehicleData.x, gy: vehicleData.y, angle: vehicleData.a, ga: vehicleData.a, hurt: 0 };
      mp.vehicleById.set(vehicleData.n, vehicle);
    }
    if (vehicle.hp != null && vehicleData.hp < vehicle.hp) vehicle.hurt = 1;
    Object.assign(vehicle, {
      type: vehicleData.t, gx: vehicleData.x, gy: vehicleData.y, ga: vehicleData.a,
      hp: vehicleData.hp, maxHp: vehicleData.mhp, radius: vehicleData.r,
      occupantConn: vehicleData.oc, weaponCd: (vehicleData.cd || 0) / 100,
      timeLeft: vehicleData.tm == null ? null : vehicleData.tm / 10,
      snapshotSeq: s.q,
    });
  }
  for (const [id] of mp.vehicleById) if (!seenV.has(id)) mp.vehicleById.delete(id);
  engine.vehicles = [...mp.vehicleById.values()];

  const seenP = mp.seenProjectiles; seenP.clear();
  for (const projectileData of (s.itemProjectiles || [])) {
    seenP.add(projectileData.n);
    let projectile = mp.projectileById.get(projectileData.n);
    const fresh = !projectile;
    const previousVisual = projectile && projectile.visual;
    const previousArmed = projectile && projectile.armed;
    if (!projectile) {
      projectile = { netId: projectileData.n, x: projectileData.x, y: projectileData.y, gx: projectileData.x, gy: projectileData.y };
      mp.projectileById.set(projectileData.n, projectile);
    }
    Object.assign(projectile, {
      type: projectileData.t, visual: projectileData.v, gx: projectileData.x, gy: projectileData.y,
      angle: projectileData.a, radius: projectileData.r, life: projectileData.l, maxLife: projectileData.ml,
      length: projectileData.len, spread: projectileData.sp, color: projectileData.c, seed: projectileData.sd,
      armed: !!projectileData.ar, armT: projectileData.at || 0, armMax: projectileData.am || 0,
      triggerRadius: projectileData.tr || 0,
      snapshotSeq: s.q,
    });
    if (projectile.visual === 'mine' && fresh) {
      engine.sfx.play(projectile.armed ? 'mine_arm' : 'mine_deploy');
    } else if (projectile.visual === 'mine' && projectile.armed && !previousArmed) {
      engine.sfx.play('mine_arm');
    } else if (fresh && projectile.visual === 'laser_pointer') {
      engine.sfx.play('laser_pointer');
    } else if (fresh && projectile.visual === 'cat_attack') {
      engine.sfx.play('cat_appear');
    } else if (fresh && projectile.visual === 'cat_slash') {
      engine.shake = Math.min(22, engine.shake + 1.5); engine.sfx.play('cat_scratch');
    } else if (projectile.visual === 'black_hole' && previousVisual !== 'black_hole') {
      engine.shake = Math.min(22, engine.shake + 10); engine.sfx.play('black_hole');
    } else if (fresh && projectile.visual === 'force_field_burst') {
      engine.sfx.play('force_field');
    } else if (fresh && projectile.visual === 'projectile' && projectile.type === 'black_hole_generator') {
      engine.sfx.play('black_hole_charge');
    } else if (fresh && projectile.visual === 'orbital_beam') {
      engine.shake = Math.min(22, engine.shake + 22); engine.sfx.play('orbital_strike');
    } else if (fresh && projectile.visual === 'orbital_marker') {
      engine.sfx.play('orbital_lock');
    } else if (fresh && projectile.visual === 'blast') {
      const torpedo = projectile.type === 'vehicle_torpedo';
      const mine = projectile.type === 'underwater_mine';
      engine.shake = Math.min(22, engine.shake + (projectile.type === 'rocket_launcher' ? 17 : projectile.type === 'vehicle_missile' ? 16 : projectile.type === 'grenade' ? 14 : mine ? 18 : torpedo ? 15 : 10));
      engine.sfx.play(mine ? 'mine_explosion' : torpedo ? 'torpedo_hit' : projectile.type === 'grenade' || projectile.type === 'rocket_launcher' || projectile.type === 'vehicle_missile' ? 'explosion' : 'power');
    } else if (fresh && projectile.visual === 'pulse') {
      engine.shake = Math.min(22, engine.shake + 9); engine.sfx.play('power');
    } else if (fresh && projectile.visual === 'muzzle') {
      engine.sfx.play(projectile.type === 'shotgun' ? 'shotgun' : projectile.type === 'vehicle_torpedo' ? 'torpedo' : projectile.type === 'vehicle_missile' ? 'missile' : projectile.type === 'rocket_launcher' ? 'rocket' : 'shot');
    }
  }
  for (const [id] of mp.projectileById) if (!seenP.has(id)) mp.projectileById.delete(id);
  engine.itemProjectiles = [...mp.projectileById.values()];
}

function applyWorldInit(engine, w) {
  const mp = engine.mp, previousMapId = engine.mapId, mapChanged = !!(w.map && w.map !== engine.mapId);
  mp.gotInit = true;
  engine.W = w.W; engine.H = w.H; engine.theme = w.theme; engine.era = w.era || 0;
  if (w.map) {
    engine.mapId = w.map;
    if (engine.player) engine.player.mapId = w.map;
    engine.visitedMaps.add(w.map);
    if (MAPS[w.map]) { engine.stage = MAPS[w.map].stage; mp.stage = engine.stage; }
  }
  if (mapChanged) {
    mp.npcById.clear(); mp.rpById.clear(); mp.foodById.clear(); mp.itemById.clear(); mp.projectileById.clear(); mp.vehicleById.clear();
    mp.seenNpcs.clear(); mp.seenPlayers.clear(); mp.seenFood.clear(); mp.seenItems.clear(); mp.seenProjectiles.clear(); mp.seenVehicles.clear();
    engine.creatures.length = 0; engine.remotePlayers.length = 0; engine.food.length = 0;
    engine.worldItems.length = 0; engine.itemProjectiles.length = 0; engine.vehicles.length = 0;
    engine.bubbles.length = 0; seedBubbles(engine);
    if (engine.player) engine.player._netInit = false;
    engine.transitionCd = 1.2; engine.nearEdge = null;
  }
  engine.obstacles = (w.obstacles || []).map(o => ({ ...o }));
  engine.plants = (w.plants || []).map(p => ({ ...p, value: 1, eatCd: 0, regen: 0 }));
  engine.webs = (w.webs || []).map(x => ({ ...x }));
  if (mapChanged) { engine.captureRenderState(); engine.emitMapChanged(previousMapId); }
}

export function mpClientUpdate(engine, dt) {
  engine.time += dt;
  const k = 1 - Math.exp(-dt * 14);
  const smooth = e => {
    if (e.gx == null) return;
    e.x += (e.gx - e.x) * k; e.y += (e.gy - e.y) * k;
    if (Number.isFinite(e.ga)) e.angle = angLerp(Number.isFinite(e.angle) ? e.angle : e.ga, e.ga, k);
  };
  const decay = e => {
    e.biteAnim = Math.max(0, (e.biteAnim || 0) - dt * 3); e.mouth = e.biteAnim; e.hurt = Math.max(0, (e.hurt || 0) - dt * 3);
    e.forceFieldT = Math.max(0, (e.forceFieldT || 0) - dt);
    e.castT = Math.max(0, (e.castT || 0) - dt);
    e.graspT = Math.max(0, (e.graspT || 0) - dt);
    e.engulfT = Math.max(0, (e.engulfT || 0) - dt); e.shockVisualT = Math.max(0, (e.shockVisualT || 0) - dt);
    e.inkCloudT = Math.max(0, (e.inkCloudT || 0) - dt); e.crushT = Math.max(0, (e.crushT || 0) - dt);
    e.impaleT = Math.max(0, (e.impaleT || 0) - dt); e.leapT = Math.max(0, (e.leapT || 0) - dt);
    e.stompT = Math.max(0, (e.stompT || 0) - dt); e.tailSweepT = Math.max(0, (e.tailSweepT || 0) - dt);
    e.evasionFlashT = Math.max(0, (e.evasionFlashT || 0) - dt); e.rebirthT = Math.max(0, (e.rebirthT || 0) - dt);
    e.senseCd = Math.max(0, (e.senseCd || 0) - dt); e.regenDelay = Math.max(0, (e.regenDelay || 0) - dt);
    e.stunT = Math.max(0, (e.stunT || 0) - dt); e.slowT = Math.max(0, (e.slowT || 0) - dt);
    e.armorBreakT = Math.max(0, (e.armorBreakT || 0) - dt); e.vulnerableT = Math.max(0, (e.vulnerableT || 0) - dt);
    e.venomMarkT = Math.max(0, (e.venomMarkT || 0) - dt); if (e.venomMarkT <= 0) e.venomStacks = 0;
    for (const id of (e.abilities || [])) {
      if (e.acd && e.acd[id] > 0) e.acd[id] = Math.max(0, e.acd[id] - dt);
      const timer = ACTIVE_TIMER[id]; if (timer && e[timer] > 0) e[timer] = Math.max(0, e[timer] - dt);
    }
    for (const item of (e.items || [])) if (item && item.cd > 0) item.cd = Math.max(0, item.cd - dt);
  };
  if (engine.player) { smooth(engine.player); decay(engine.player); }
  for (const rp of engine.remotePlayers) { smooth(rp); decay(rp); }
  for (const c of engine.creatures) {
    smooth(c); c.mouth = Math.max(0, (c.mouth || 0) - dt * 3); c.hurt = Math.max(0, (c.hurt || 0) - dt * 3);
    if (c.hpBarT > 0) c.hpBarT -= dt;
    if (c.hardenT > 0) c.hardenT = Math.max(0, c.hardenT - dt);
    c.armorBreakT = Math.max(0, (c.armorBreakT || 0) - dt); c.vulnerableT = Math.max(0, (c.vulnerableT || 0) - dt); c.venomMarkT = Math.max(0, (c.venomMarkT || 0) - dt);
    if (c.telegraph && c.telegraph.t > 0) c.telegraph.t = Math.max(0, c.telegraph.t - dt);
    if (c.bossKind === 'panderodus') {
      c.screamT = Math.max(0, (c.screamT || 0) - dt); c.tailSlapT = Math.max(0, (c.tailSlapT || 0) - dt);
      c.impactT = Math.max(0, (c.impactT || 0) - dt); c.latchT = Math.max(0, (c.latchT || 0) - dt);
      c.stateT = Math.max(0, (c.stateT || 0) - dt); c.passPauseT = Math.max(0, (c.passPauseT || 0) - dt);
    }
    if (c.cocoon && c.hatchT > 0) c.hatchT = Math.max(0, c.hatchT - dt);
  }
  for (const item of engine.worldItems) smooth(item);
  for (const projectile of engine.itemProjectiles) {
    smooth(projectile); projectile.life = Math.max(0, (projectile.life || 0) - dt);
    if (projectile.visual === 'mine' && !projectile.armed) projectile.armT = Math.max(0, (projectile.armT || 0) - dt);
  }
  for (const vehicle of engine.vehicles) {
    smooth(vehicle); vehicle.weaponCd = Math.max(0, (vehicle.weaponCd || 0) - dt);
    vehicle.hurt = Math.max(0, (vehicle.hurt || 0) - dt * 3);
    if (Number.isFinite(vehicle.timeLeft)) vehicle.timeLeft = Math.max(0, vehicle.timeLeft - dt);
  }

  const p = engine.player;
  if (p) {
    engine.cam.x = lerp(engine.cam.x, clamp(p.x - engine.vw / 2, 0, Math.max(0, engine.W - engine.vw)), 1 - Math.exp(-dt * 6));
    engine.cam.y = lerp(engine.cam.y, clamp(p.y - engine.vh / 2, 0, Math.max(0, engine.H - engine.vh)), 1 - Math.exp(-dt * 6));
    engine.worldMouse.x = engine.cam.x + engine.mouse.x; engine.worldMouse.y = engine.cam.y + engine.mouse.y;
  }
  engine.shake *= Math.exp(-dt * 8);
  engine.updateFlow(dt);
  engine.updateBubbles(dt, false);
  for (let i = engine.particles.length - 1; i >= 0; i--) { const q = engine.particles[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) engine.particles.splice(i, 1); }
  for (let i = engine.floaters.length - 1; i >= 0; i--) { const ft = engine.floaters[i]; ft.x += ft.vx * dt; ft.y += ft.vy * dt; ft.life -= dt; if (ft.life <= 0) engine.floaters.splice(i, 1); }
  for (let i = engine.fx.length - 1; i >= 0; i--) { engine.fx[i].t += dt; if (engine.fx[i].t >= engine.fx[i].max) engine.fx.splice(i, 1); }

  const mp = engine.mp;
  mp.sendAcc += dt; mp.inputKeepalive += dt;
  if (mp.sendAcc >= 1 / CLIENT_HZ && mp.lobby && p) {
    mp.sendAcc %= 1 / CLIENT_HZ;
    const mv = p.steer(engine);
    const inputPayload = {
      q: mp.inputSeq++,
      tx: roundTo(mv.tx, 3), ty: roundTo(mv.ty, 3),
      m: mv.moving ? 1 : 0, b: engine.biteHeld ? 1 : 0,
    };
    const input = encodeMultiplayerPacket(PacketKinds.INPUT, inputPayload, mp.protocolVersion);
    const prev = mp.lastInput;
    const changed = !prev || input.tx !== prev.tx || input.ty !== prev.ty || input.m !== prev.m || input.b !== prev.b;
    if (changed || mp.inputKeepalive >= INPUT_KEEPALIVE) {
      sendTransient(mp.lobby, { t: 'relay', to: mp.host, data: input });
      mp.lastInput = input; mp.inputKeepalive = 0;
    }
    if (engine.biteHeld) p.biteAnim = 1;
  }
  if (!mp.gotInit) {
    mp.reAsk -= dt;
    if (mp.reAsk <= 0) {
      mp.reAsk = 0.6;
      if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: readyPacket(mp.protocolVersion) });
    }
  }
  if (mp.feed.length) mp.feed = mp.feed.filter(f => engine.time - f.t < 5);
  engine.pushHud();
}

/* Roster snapshot for the HUD (all players, self first). */
export function mpRoster(engine) {
  const mp = engine.mp; if (!mp) return null;
  if (mp.role === 'client' && mp.rosterStats.length) {
    return mp.rosterStats.map(stat => {
      const profile = mp.roster[stat.c] || {};
      return {
        connId: stat.c, name: String(stat.c) === String(mp.self) ? mp.selfName : (profile.name || 'Player'),
        color: String(stat.c) === String(mp.self) ? mp.selfColor : (profile.color || '#8affd0'),
        level: stat.lv || 1, kills: stat.k || 0, dead: !!stat.d, self: String(stat.c) === String(mp.self), mapId: stat.map,
      };
    }).sort((a, b) => b.kills - a.kills);
  }
  const out = [{ connId: mp.self, name: mp.selfName, color: mp.selfColor, level: engine.player ? engine.player.level : 1, kills: engine.player ? (engine.player.kills || 0) : 0, dead: !!(engine.player && engine.player.deadT > 0), self: true, mapId: engine.player && engine.player.mapId }];
  for (const rp of engine.remotePlayers) out.push({ connId: rp.connId, name: rp.name, color: rp.color, level: rp.level || 1, kills: rp.kills || 0, dead: rp.deadT > 0, self: false, mapId: rp.mapId });
  return out.sort((a, b) => b.kills - a.kills);
}

/* Plain, already-normalized marker data for the React minimap. */
export function mpMinimap(engine) {
  const mp = engine.mp; if (!mp || !engine.W || !engine.H) return null;
  const marker = (player, self) => ({
    connId: self ? mp.self : player.connId,
    name: self ? mp.selfName : player.name,
    color: self ? mp.selfColor : player.color,
    x: clamp(player.x / engine.W * 100, 0, 100), y: clamp(player.y / engine.H * 100, 0, 100),
    dead: player.deadT > 0, self,
  });
  const players = [];
  if (engine.player) players.push(marker(engine.player, true));
  const remotes = engine.visibleRemotePlayers ? engine.visibleRemotePlayers() : engine.remotePlayers;
  for (const player of remotes) players.push(marker(player, false));
  const bosses = mp.bosses ? engine.creatures.filter(c => c.boss).map(c => ({
    id: c.bossKind, name: c.short || c.title || 'Boss', color: (c.plan && c.plan.accent) || '#ff697a',
    x: clamp(c.x / engine.W * 100, 0, 100), y: clamp(c.y / engine.H * 100, 0, 100),
    hp: c.maxHp ? clamp(c.hp / c.maxHp, 0, 1) : 1,
  })) : [];
  return { mapId: engine.mapId, name: MAPS[engine.mapId] ? MAPS[engine.mapId].name : '', W: engine.W, H: engine.H, players, bosses };
}

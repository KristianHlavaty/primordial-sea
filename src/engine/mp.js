/* Multiplayer glue for the engine (Phase 3).

   Authority model: the HOST's browser runs the real Engine.update() and owns
   every occupied map world. Each other player is a RemotePlayer entity the host moves from the
   input packets that player sends. ~20×/s the host broadcasts a SNAPSHOT of the
   player's current world; clients render it and send their input up ~30×/s. The relay server
   (server/relay.mjs) just forwards these packets between the browsers in a room.

   Clients do NOT simulate: they keep their own creature + everyone else + the
   NPCs as plain objects, smoothing them toward the latest snapshot each frame.

   Packet kinds (inside the relay's {t:'relay', data}):
     host -> clients:  {k:'S', ...snapshot}   {k:'W', ...worldInit}
     client -> host:   {k:'I', tx,ty,m,b}  {k:'A'|'U'|'D', i}  {k:'E', id}
                       {k:'C', action}  {k:'ready'} */
import { RemotePlayer } from './entities/RemotePlayer.js';
import { activateAbility } from './systems/abilities.js';
import { useHeldItem, dropHeldItem } from './systems/items.js';
import { toggleVehicle, exitVehicle } from './systems/vehicles.js';
import { spawnInitial } from './systems/spawning.js';
import { SPECIES, speciesOfStageTier, speciesStage } from '../data/species.js';
import { ABILITY_SETS, ACTIVE_TIMER } from '../data/abilities.js';
import { NPCS } from '../data/npcs.js';
import { MAPS, OPPOSITE_EDGE } from '../data/maps.js';
import { BOSSES } from '../data/bosses.js';
import { ITEMS, ITEM_SLOT_COUNT } from '../data/items.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { angLerp, clamp, lerp, hyp } from '../core/math.js';

const HOST_HZ = 20, CLIENT_HZ = 30;
const INPUT_KEEPALIVE = 0.25;

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
    worlds: new Map(), dirtyWorldFor: new Set(), edgePrompts: new Map(),
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
  engine.sfx.unlock();
  if (lobby) lobby.raw({ t: 'relay', to: hostConn, data: { k: 'ready' } });
  engine.pushHud(true);
}

function seedBubbles(engine) {
  if (engine.stage !== 'sea' || !engine.vw) return;
  for (let i = 0; i < 90; i++) engine.bubbles.push({ x: Math.random() * engine.vw, y: Math.random() * engine.vh, r: 0.6 + Math.random() * 2, sp: 6 + Math.random() * 20, ph: Math.random() * 6.28 });
}

/* ---------------- packets ---------------- */

export function mpOnPacket(engine, from, data) {
  const mp = engine.mp; if (!mp || !data) return;
  if (mp.role === 'host') {
    if (data.k === 'I') {
      let rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) rp.input = { tx: data.tx || 0, ty: data.ty || 0, moving: !!data.m, bite: !!data.b };
    } else if (data.k === 'A') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp && !rp.vehicleType && !(rp.mpEvolveChoices && rp.mpEvolveChoices.length)) withPlayerWorld(engine, rp, () => activateAbility(engine, data.i, rp));
    } else if (data.k === 'E') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => commitEvolution(engine, rp, data.id));
    } else if (data.k === 'C') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => applyCheat(engine, rp, data.action));
    } else if (data.k === 'U') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => useHeldItem(engine, rp, data.i | 0));
    } else if (data.k === 'D') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => dropHeldItem(engine, rp, data.i | 0));
    } else if (data.k === 'V') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) withPlayerWorld(engine, rp, () => toggleVehicle(engine, rp));
    } else if (data.k === 'ready') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (mp.lobby && rp) withPlayerWorld(engine, rp, () => mp.lobby.raw({ t: 'relay', to: from, data: buildWorldInit(engine) }));
    }
  } else if (mp.role === 'client') {
    if (data.k === 'S') applySnapshot(engine, data);
    else if (data.k === 'W') applyWorldInit(engine, data);
    else if (data.k === 'K') engine.mpAddFeed(data.text, data.color);
  }
}

function ensureRemote(engine, connId) {
  const mp = engine.mp, r = mp.roster[connId] || {};
  const rp = new RemotePlayer(resolveSpecies(r.species, mp.stage, mp.tier, mp.fantasy), engine, { connId, name: r.name, color: r.color });
  rp.mapId = engine.player.mapId || engine.mapId;
  engine.remotePlayers.push(rp);
  if (engine.onScheduleChange) engine.onScheduleChange();
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
  if (player.vehicle) toggleVehicle(engine, player);
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
    if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: { k: 'E', id } });
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
    if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: { k: 'C', action } });
    return;
  }
  applyCheat(engine, engine.player, action);
}

export function mpUseItem(engine, slot) {
  const mp = engine.mp; if (!mp || !engine.player || slot < 0 || slot >= ITEM_SLOT_COUNT) return;
  if (mp.role === 'client') {
    if (mp.lobby) sendTransient(mp.lobby, { t: 'relay', to: mp.host, data: { k: 'U', i: slot } });
  } else useHeldItem(engine, engine.player, slot);
}

export function mpDropItem(engine, slot) {
  const mp = engine.mp; if (!mp || !engine.player || slot < 0 || slot >= ITEM_SLOT_COUNT) return;
  if (mp.role === 'client') {
    if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: { k: 'D', i: slot } });
  } else dropHeldItem(engine, engine.player, slot);
}

export function mpToggleVehicle(engine) {
  const mp = engine.mp; if (!mp || !engine.player) return;
  if (mp.role === 'client') {
    if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: { k: 'V' } });
  } else toggleVehicle(engine, engine.player);
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
    return Math.abs(pos - span * gate.center) <= gate.width * 0.5;
  };
  const edgeOf = player => {
    if (neighbors.left && passageAllows(player, 'left') && player.x <= player.radius + 6) return 'left';
    if (neighbors.right && passageAllows(player, 'right') && player.x >= engine.W - player.radius - 6) return 'right';
    if (neighbors.top && passageAllows(player, 'top') && player.y <= player.radius + 6) return 'top';
    if (neighbors.bottom && passageAllows(player, 'bottom') && player.y >= engine.H - player.radius - 6) return 'bottom';
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
    player._edgeDwell = (player._edgeDwell || 0) + dt;
    if (player._edgeDwell > 0.3) {
      if (player.vehicle) exitVehicle(engine, player, true);
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
      mp.lobby.raw({ t: 'relay', to: player.connId, data: buildWorldInit(engine) });
    }
  }
  mp.dirtyWorldFor.clear();
  mp.sendAcc += dt;
  if (mp.sendAcc < 1 / HOST_HZ) { mpActivateWorld(engine, restoreMap); return; }
  mp.sendAcc %= 1 / HOST_HZ;
  for (const player of engine.remotePlayers) {
    if (!mpActivateWorld(engine, player.mapId)) continue;
    sendTransient(mp.lobby, { t: 'relay', to: player.connId, data: buildSnapshot(engine, player.connId) });
  }
  mpActivateWorld(engine, restoreMap);
}

function buildPowerState(pl) {
  const point = value => value ? Math.round(value) : 0;
  return {
    eg: Math.ceil((pl.engulfT || 0) * 100), ea: roundTo(pl.engulfAngle || pl.angle || 0, 2),
    sv: Math.ceil((pl.shockVisualT || 0) * 100), sl: (pl.shockLinks || []).map(link => [point(link.x), point(link.y)]),
    ic: Math.ceil((pl.inkCloudT || 0) * 10), ix: point(pl.inkX), iy: point(pl.inkY), dx: point(pl.decoyX), dy: point(pl.decoyY), da: roundTo(pl.decoyAngle || 0, 2),
    vx: point(pl.vortexX), vy: point(pl.vortexY),
    cr: Math.ceil((pl.crushT || 0) * 100), ca: roundTo(pl.crushAngle || 0, 2), im: Math.ceil((pl.impaleT || 0) * 100), ia: roundTo(Number.isFinite(pl.impaleAngle) ? pl.impaleAngle : (pl.angle || 0), 2), ir: Math.round(pl.impaleReach || 0),
    lp: Math.ceil((pl.leapT || 0) * 100), lm: Math.ceil((pl.leapMax || 0) * 100), lk: pl.leapKind || undefined, lx: point(pl.leapX), ly: point(pl.leapY),
    st: Math.ceil((pl.stompT || 0) * 100), sx: point(pl.stompX), sy: point(pl.stompY), ts: Math.ceil((pl.tailSweepT || 0) * 100),
    mo: Math.round((pl.sprintMomentum || 0) * 100), ef: Math.ceil((pl.evasionFlashT || 0) * 100),
    fc: pl.filterCombo || 0, cc: Math.round((pl.camoCharge || 0) * 100), ap: pl.armorPlates || 0,
    fo: Math.round((pl.fortify || 0) * 100), sa: Math.round((pl.sailHeat || 0) * 100), rb: Math.ceil((pl.rebirthT || 0) * 100),
    bc: pl.barbCharge || 0, se: Math.ceil((pl.senseCd || 0) * 10), rd: Math.ceil((pl.regenDelay || 0) * 10), ai: Math.ceil((pl.airStride || 0) * 10), ru: pl.rebirthUsed ? 1 : 0,
    hs: Math.round(pl.hardenStored || 0), ws: Math.round(pl.withdrawStored || 0), bb: pl.burstBreach ? 1 : 0,
    sn: Math.ceil((pl.stunT || 0) * 10), so: Math.ceil((pl.slowT || 0) * 10), ar: Math.ceil((pl.armorBreakT || 0) * 10), vu: Math.ceil((pl.vulnerableT || 0) * 10),
    vs: pl.venomStacks || 0, vm: Math.ceil((pl.venomMarkT || 0) * 10),
    bp: (pl.bloomPoints || []).map(link => [point(link.x), point(link.y)]),
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
    // Cooldown/active times travel as deciseconds to keep the 20 Hz snapshot
    // compact while still giving joined clients responsive ability feedback.
    const abilityState = pl.abilities.map(id => {
      const timer = ACTIVE_TIMER[id];
      return [Math.ceil((pl.acd[id] || 0) * 10), timer ? Math.ceil((pl[timer] || 0) * 10) : 0];
    });
    players.push({
      c, s: pl.speciesId, x: Math.round(pl.x), y: Math.round(pl.y), a: roundTo(pl.angle, 2),
      hp: Math.round(pl.hp), mhp: Math.round(pl.maxHp), lv: pl.level, xp: Math.round(pl.xp || 0),
      b: roundTo(pl.biteAnim || 0, 2), sh: Math.round(pl.shield || 0), sm: Math.round(pl.shieldMax || 0),
      ff: Math.ceil((pl.forceFieldT || 0) * 10),
      ab: abilityState, k: pl.kills || 0, d: Math.ceil(pl.deadT || 0),
      ev: pl.mpEvolveChoices && pl.mpEvolveChoices.length ? pl.mpEvolveChoices : undefined,
      iv: pl.mpInvincible ? 1 : 0,
      sq: pl.cameraShakeSeq || 0, sk: pl.cameraShakePower || 0,
      ca: pl.castT > 0 ? pl.castAbility : undefined, cq: pl.castSeq || 0, ct: Math.ceil((pl.castT || 0) * 10),
      grt: Math.ceil((pl.graspT || 0) * 100),
      grx: pl.graspT > 0 ? Math.round(pl.graspX) : undefined, gry: pl.graspT > 0 ? Math.round(pl.graspY) : undefined,
      pw: buildPowerState(pl),
      vh: pl.vehicle ? pl.vehicle.netId : 0, vt: pl.vehicle ? pl.vehicle.type : undefined,
      it: (pl.items || []).map(item => item ? [item.id, item.uses, Math.ceil((item.cd || 0) * 10)] : 0),
    });
  };
  for (const player of engine.allPlayers()) pushP(player, player === engine.player ? mp.self : player.connId);
  const npcs = [];
  for (const c of engine.creatures) {
    if (c.netId == null) c.netId = mp.nextNet++;
    const npc = { n: c.netId, k: c.key, x: Math.round(c.x), y: Math.round(c.y), a: roundTo(c.angle, 2), hp: Math.round(c.hp), mhp: Math.round(c.maxHp), r: Math.round(c.radius), lv: c.level || 1, st: c.stunT > 0 ? 1 : 0,
      ar: Math.ceil((c.armorBreakT || 0) * 10), vu: Math.ceil((c.vulnerableT || 0) * 10), vs: c.venomStacks || 0, vm: Math.ceil((c.venomMarkT || 0) * 10) };
    if (c.boss) {
      npc.bk = c.bossKind; npc.h = Math.ceil((c.hardenT || 0) * 10); npc.e = c.engaged ? 1 : 0;
      npc.tg = c.telegraph ? { ...c.telegraph, t: roundTo(c.telegraph.t, 2), max: roundTo(c.telegraph.max, 2) } : undefined;
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
    food.push({ n: f.netId, x: Math.round(f.x), y: Math.round(f.y), m: f.kind === 'meat' ? 1 : 0 });
    if (food.length >= 60) break;
  }
  const dynamicWebs = engine.webs.filter(w => w.life != null).map(w => ({
    x: Math.round(w.x), y: Math.round(w.y), r: Math.round(w.r), angle: roundTo(w.angle || 0, 2), life: roundTo(w.life, 1), abilityWeb: !!w.abilityWeb,
  }));
  const worldItems = engine.worldItems.map(item => {
    if (item.netId == null) item.netId = mp.nextNet++;
    return { n: item.netId, t: item.type, x: Math.round(item.x), y: Math.round(item.y), u: item.uses };
  });
  const itemProjectiles = engine.itemProjectiles.map(projectile => {
    if (projectile.netId == null) projectile.netId = mp.nextNet++;
    return {
      n: projectile.netId, t: projectile.type, v: projectile.visual, x: Math.round(projectile.x), y: Math.round(projectile.y),
      a: roundTo(projectile.angle || 0, 2), r: Math.round(projectile.radius || 0), l: roundTo(projectile.life || 0, 2),
      ml: roundTo(projectile.maxLife || 0, 2), len: Math.round(projectile.length || 0),
      sp: roundTo(projectile.spread || 0, 2), c: projectile.color, sd: projectile.seed,
      ar: !!projectile.armed, at: roundTo(projectile.armT || 0, 2), am: roundTo(projectile.armMax || 0, 2),
      tr: Math.round(projectile.triggerRadius || 0),
    };
  });
  const vehicles = engine.vehicles.map(vehicle => ({
    n: vehicle.netId, t: vehicle.type, x: Math.round(vehicle.x), y: Math.round(vehicle.y),
    a: roundTo(vehicle.angle || 0, 2), hp: Math.round(vehicle.hp), mhp: vehicle.maxHp,
    r: vehicle.radius, oc: vehicle.occupantConn, cd: Math.ceil((vehicle.weaponCd || 0) * 100),
    tm: Number.isFinite(vehicle.timeLeft) ? Math.ceil(vehicle.timeLeft * 10) : undefined,
  }));
  const rosterPlayers = [engine.player, ...engine.remotePlayers].map(player => ({
    c: player === engine.player ? mp.self : player.connId,
    lv: player.level || 1, k: player.kills || 0, d: player.deadT > 0 ? 1 : 0, map: player.mapId || engine.mapId,
  }));
  return {
    k: 'S', q: mp.seq++, players, npcs, food, dynamicWebs, worldItems, itemProjectiles, vehicles,
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
    vx: 0, vy: 0, mouth: 0, hurt: 0, hpBarT: 0, stunT: 0, slowT: 0, hardenT: (nd.h || 0) / 10,
    armorBreakT: (nd.ar || 0) / 10, vulnerableT: (nd.vu || 0) / 10, venomStacks: nd.vs || 0, venomMarkT: (nd.vm || 0) / 10,
    engaged: !!nd.e, telegraph: nd.tg || null,
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
    if (!c) { c = makeRenderNpc(nd); mp.npcById.set(nd.n, c); }
    c.gx = nd.x; c.gy = nd.y; c.ga = nd.a; c.hp = nd.hp; c.maxHp = nd.mhp; c.radius = nd.r; c.level = nd.lv;
    c.stunT = nd.st ? 0.4 : 0; c.hpBarT = nd.hp < nd.mhp ? 1.2 : c.hpBarT;
    c.armorBreakT = (nd.ar || 0) / 10; c.vulnerableT = (nd.vu || 0) / 10; c.venomStacks = nd.vs || 0; c.venomMarkT = (nd.vm || 0) / 10;
    if (c.boss) { c.hardenT = (nd.h || 0) / 10; c.engaged = !!nd.e; c.telegraph = nd.tg || null; }
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
    });
    if (projectile.visual === 'mine' && fresh) {
      engine.sfx.play(projectile.armed ? 'mine_arm' : 'mine_deploy');
    } else if (projectile.visual === 'mine' && projectile.armed && !previousArmed) {
      engine.sfx.play('mine_arm');
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
  const mp = engine.mp, mapChanged = !!(w.map && w.map !== engine.mapId);
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
  for (const b of engine.bubbles) { b.y -= b.sp * dt; b.x += Math.sin(engine.time + b.ph) * 6 * dt; if (b.y < -4) { b.y = engine.vh + 4; b.x = Math.random() * engine.vw; } }
  for (let i = engine.particles.length - 1; i >= 0; i--) { const q = engine.particles[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) engine.particles.splice(i, 1); }
  for (let i = engine.floaters.length - 1; i >= 0; i--) { const ft = engine.floaters[i]; ft.x += ft.vx * dt; ft.y += ft.vy * dt; ft.life -= dt; if (ft.life <= 0) engine.floaters.splice(i, 1); }
  for (let i = engine.fx.length - 1; i >= 0; i--) { engine.fx[i].t += dt; if (engine.fx[i].t >= engine.fx[i].max) engine.fx.splice(i, 1); }

  const mp = engine.mp;
  mp.sendAcc += dt; mp.inputKeepalive += dt;
  if (mp.sendAcc >= 1 / CLIENT_HZ && mp.lobby && p) {
    mp.sendAcc %= 1 / CLIENT_HZ;
    const mv = p.steer(engine);
    const input = { k: 'I', tx: roundTo(mv.tx, 3), ty: roundTo(mv.ty, 3), m: mv.moving ? 1 : 0, b: engine.biteHeld ? 1 : 0 };
    const prev = mp.lastInput;
    const changed = !prev || input.tx !== prev.tx || input.ty !== prev.ty || input.m !== prev.m || input.b !== prev.b;
    if (changed || mp.inputKeepalive >= INPUT_KEEPALIVE) {
      sendTransient(mp.lobby, { t: 'relay', to: mp.host, data: input });
      mp.lastInput = input; mp.inputKeepalive = 0;
    }
    if (engine.biteHeld) p.biteAnim = 1;
  }
  if (!mp.gotInit) { mp.reAsk -= dt; if (mp.reAsk <= 0) { mp.reAsk = 0.6; if (mp.lobby) mp.lobby.raw({ t: 'relay', to: mp.host, data: { k: 'ready' } }); } }
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

/* Multiplayer glue for the engine (Phase 3).

   Authority model: the HOST's browser runs the real Engine.update() and owns
   the world. Each other player is a RemotePlayer entity the host moves from the
   input packets that player sends. ~20×/s the host broadcasts a SNAPSHOT of the
   world; clients render it and send their input up ~30×/s. The relay server
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
import { SPECIES, speciesOfStageTier, speciesStage } from '../data/species.js';
import { ABILITY_SETS, ACTIVE_TIMER } from '../data/abilities.js';
import { NPCS } from '../data/npcs.js';
import { MAPS } from '../data/maps.js';
import { BOSSES } from '../data/bosses.js';
import { ITEMS, ITEM_SLOT_COUNT } from '../data/items.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { angLerp, clamp, lerp, hyp } from '../core/math.js';

const HOST_HZ = 20, CLIENT_HZ = 30;
const INPUT_KEEPALIVE = 0.25;

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
    worldDirty: false, edgeKey: null, edgeDwell: 0, edgeConn: null, edgeName: null,
  };
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier, fantasy);
  engine.player = null; engine.makePlayer(mine);
  engine.remotePlayers = [];
  engine.loadMap(room.map);
  for (const cid in roster) {
    if (String(cid) === String(selfConn)) continue;
    engine.remotePlayers.push(new RemotePlayer(resolveSpecies(roster[cid].species, stage, tier, fantasy), engine,
      { connId: Number(cid), name: roster[cid].name, color: roster[cid].color }));
  }
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
    npcById: new Map(), rpById: new Map(), foodById: new Map(), itemById: new Map(), projectileById: new Map(),
    seenNpcs: new Set(), seenPlayers: new Set(), seenFood: new Set(), seenItems: new Set(), seenProjectiles: new Set(), feed: [], feedId: 0,
  };
  engine.mapId = room.map; engine.stage = stage; engine.theme = map.theme; engine.W = map.W; engine.H = map.H;
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier, fantasy);
  engine.player = null; engine.makePlayer(mine);
  engine.player.x = engine.W / 2; engine.player.y = engine.H / 2; engine.player._netInit = false;
  engine.remotePlayers = []; engine.creatures = []; engine.plants = []; engine.food = []; engine.obstacles = []; engine.webs = []; engine.bubbles = [];
  engine.worldItems = []; engine.itemProjectiles = [];
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
      if (rp && !(rp.mpEvolveChoices && rp.mpEvolveChoices.length)) activateAbility(engine, data.i, rp);
    } else if (data.k === 'E') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) commitEvolution(engine, rp, data.id);
    } else if (data.k === 'C') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) applyCheat(engine, rp, data.action);
    } else if (data.k === 'U') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) useHeldItem(engine, rp, data.i | 0);
    } else if (data.k === 'D') {
      const rp = engine.remotePlayers.find(r => r.connId === from) || ensureRemote(engine, from);
      if (rp) dropHeldItem(engine, rp, data.i | 0);
    } else if (data.k === 'ready') {
      if (mp.lobby) mp.lobby.raw({ t: 'relay', to: from, data: buildWorldInit(engine) });
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
  const kills = player.kills || 0, deaths = player.deaths || 0, invincible = !!player.mpInvincible;
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

/* A multiplayer room shares one authoritative map. When map travel is
   enabled, any living player can hold against a connected edge to move the
   entire room to that neighboring map. */
export function mpMaybeCrossMap(engine, dt) {
  const mp = engine.mp;
  if (!mp || mp.role !== 'host' || !mp.mapTransitions) {
    engine.nearEdge = null;
    return false;
  }
  if (engine.transitionCd > 0) engine.transitionCd -= dt;
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

  let candidate = null;
  for (const player of engine.allPlayers()) {
    if (!player || player.deadT > 0) continue;
    const edge = edgeOf(player);
    if (edge) {
      candidate = { player, edge, conn: player === engine.player ? mp.self : player.connId, name: MAPS[neighbors[edge]].name };
      break;
    }
  }
  mp.edgeConn = candidate ? candidate.conn : null;
  mp.edgeName = candidate ? candidate.name : null;
  engine.nearEdge = candidate && candidate.player === engine.player ? candidate.name : null;
  const edgeKey = candidate ? (String(candidate.conn) + ':' + candidate.edge) : null;
  if (edgeKey !== mp.edgeKey) { mp.edgeKey = edgeKey; mp.edgeDwell = 0; }
  if (candidate && engine.transitionCd <= 0) {
    mp.edgeDwell += dt;
    if (mp.edgeDwell > 0.3) {
      engine.loadMap(neighbors[candidate.edge], candidate.edge);
      mp.edgeKey = null; mp.edgeDwell = 0; mp.edgeConn = null; mp.edgeName = null;
      return true;
    }
  } else if (!candidate) mp.edgeDwell = 0;
  return false;
}

/* ---------------- host: broadcast ---------------- */

export function mpBroadcast(engine, dt) {
  const mp = engine.mp;
  if (!engine.remotePlayers.length) { mp.sendAcc = 0; return; }
  if (mp.worldDirty) {
    if (mp.lobby) mp.lobby.raw({ t: 'relay', data: buildWorldInit(engine) });
    mp.worldDirty = false;
  }
  mp.sendAcc += dt;
  if (mp.sendAcc < 1 / HOST_HZ) return;
  mp.sendAcc %= 1 / HOST_HZ;
  sendTransient(mp.lobby, { t: 'relay', data: buildSnapshot(engine) });
}

function buildSnapshot(engine) {
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
      ab: abilityState, k: pl.kills || 0, d: Math.ceil(pl.deadT || 0),
      ev: pl.mpEvolveChoices && pl.mpEvolveChoices.length ? pl.mpEvolveChoices : undefined,
      iv: pl.mpInvincible ? 1 : 0,
      it: (pl.items || []).map(item => item ? [item.id, item.uses, Math.ceil((item.cd || 0) * 10)] : 0),
    });
  };
  pushP(engine.player, mp.self);
  for (const rp of engine.remotePlayers) pushP(rp, rp.connId);
  const npcs = [];
  for (const c of engine.creatures) {
    if (c.netId == null) c.netId = mp.nextNet++;
    const npc = { n: c.netId, k: c.key, x: Math.round(c.x), y: Math.round(c.y), a: roundTo(c.angle, 2), hp: Math.round(c.hp), mhp: Math.round(c.maxHp), r: Math.round(c.radius), lv: c.level || 1, st: c.stunT > 0 ? 1 : 0 };
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
    x: Math.round(w.x), y: Math.round(w.y), r: Math.round(w.r), angle: roundTo(w.angle || 0, 2), life: roundTo(w.life, 1),
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
      sp: roundTo(projectile.spread || 0, 2), c: projectile.color,
    };
  });
  return {
    k: 'S', q: mp.seq++, players, npcs, food, dynamicWebs, worldItems, itemProjectiles,
    edgeC: mp.edgeConn, edgeName: mp.edgeName,
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
    abilities: (ABILITY_SETS[pd.s] || []).slice(), acd: {}, biteAnim: pd.b, kills: pd.k || 0, deadT: pd.d || 0,
    mpInvincible: !!pd.iv, items: Array(ITEM_SLOT_COUNT).fill(null),
  };
  applyAbilityState(player, pd.ab);
  applyItemState(player, pd.it);
  return player;
}
function makeRenderNpc(nd) {
  const boss = nd.bk && BOSSES[nd.bk];
  if (boss) return {
    netId: nd.n, key: nd.bk, bossKind: nd.bk, kind: boss.kind, title: boss.title, short: boss.short,
    plan: { ...boss.plan }, boss: true, role: 'predator', scale: boss.scale || 1, animOff: (nd.n * 7) % 100,
    vx: 0, vy: 0, mouth: 0, hurt: 0, hpBarT: 0, stunT: 0, slowT: 0, hardenT: (nd.h || 0) / 10,
    engaged: !!nd.e, telegraph: nd.tg || null,
    x: nd.x, y: nd.y, angle: nd.a, gx: nd.x, gy: nd.y, ga: nd.a,
    hp: nd.hp, maxHp: nd.mhp, radius: nd.r, level: nd.lv,
  };
  const s = NPCS[nd.k], plan = nd.pl || (s ? s.plan : { kind: 'microbe', body: '#88a', accent: '#ccd' });
  return {
    netId: nd.n, key: nd.k, plan, boss: false, role: s ? s.role : 'prey', scale: 1, animOff: (nd.n * 7) % 100,
    vx: 0, vy: 0, mouth: 0, hurt: 0, hpBarT: 0, stunT: 0, x: nd.x, y: nd.y, angle: nd.a, gx: nd.x, gy: nd.y, ga: nd.a,
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
      if (engine.player.speciesId !== pd.s && SPECIES[pd.s]) engine.makePlayer(pd.s);
      const pl = engine.player;
      pl.gx = pd.x; pl.gy = pd.y; pl.ga = pd.a; pl.hp = pd.hp; pl.maxHp = pd.mhp; pl.level = pd.lv; pl.xp = pd.xp || 0;
      pl.shield = pd.sh; pl.shieldMax = pd.sm || 0; applyAbilityState(pl, pd.ab);
      applyItemState(pl, pd.it);
      pl.kills = pd.k || 0; pl.deadT = pd.d || 0;
      pl.mpInvincible = !!pd.iv;
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
    rp.shield = pd.sh; rp.shieldMax = pd.sm || 0; applyAbilityState(rp, pd.ab);
    applyItemState(rp, pd.it);
    rp.kills = pd.k || 0; rp.deadT = pd.d || 0; rp.mpInvincible = !!pd.iv;
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

  const seenP = mp.seenProjectiles; seenP.clear();
  for (const projectileData of (s.itemProjectiles || [])) {
    seenP.add(projectileData.n);
    let projectile = mp.projectileById.get(projectileData.n);
    if (!projectile) {
      projectile = { netId: projectileData.n, x: projectileData.x, y: projectileData.y, gx: projectileData.x, gy: projectileData.y };
      mp.projectileById.set(projectileData.n, projectile);
    }
    Object.assign(projectile, {
      type: projectileData.t, visual: projectileData.v, gx: projectileData.x, gy: projectileData.y,
      angle: projectileData.a, radius: projectileData.r, life: projectileData.l, maxLife: projectileData.ml,
      length: projectileData.len, spread: projectileData.sp, color: projectileData.c,
    });
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
    if (MAPS[w.map]) { engine.stage = MAPS[w.map].stage; mp.stage = engine.stage; }
  }
  if (mapChanged) {
    mp.npcById.clear(); mp.rpById.clear(); mp.foodById.clear(); mp.itemById.clear(); mp.projectileById.clear();
    mp.seenNpcs.clear(); mp.seenPlayers.clear(); mp.seenFood.clear(); mp.seenItems.clear(); mp.seenProjectiles.clear();
    engine.creatures.length = 0; engine.remotePlayers.length = 0; engine.food.length = 0;
    engine.worldItems.length = 0; engine.itemProjectiles.length = 0;
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
    if (c.telegraph && c.telegraph.t > 0) c.telegraph.t = Math.max(0, c.telegraph.t - dt);
    if (c.cocoon && c.hatchT > 0) c.hatchT = Math.max(0, c.hatchT - dt);
  }
  for (const item of engine.worldItems) smooth(item);
  for (const projectile of engine.itemProjectiles) { smooth(projectile); projectile.life = Math.max(0, (projectile.life || 0) - dt); }

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
  const out = [{ connId: mp.self, name: mp.selfName, color: mp.selfColor, level: engine.player ? engine.player.level : 1, kills: engine.player ? (engine.player.kills || 0) : 0, dead: !!(engine.player && engine.player.deadT > 0), self: true }];
  for (const rp of engine.remotePlayers) out.push({ connId: rp.connId, name: rp.name, color: rp.color, level: rp.level || 1, kills: rp.kills || 0, dead: rp.deadT > 0, self: false });
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
  for (const player of engine.remotePlayers) players.push(marker(player, false));
  const bosses = mp.bosses ? engine.creatures.filter(c => c.boss).map(c => ({
    id: c.bossKind, name: c.short || c.title || 'Boss', color: (c.plan && c.plan.accent) || '#ff697a',
    x: clamp(c.x / engine.W * 100, 0, 100), y: clamp(c.y / engine.H * 100, 0, 100),
    hp: c.maxHp ? clamp(c.hp / c.maxHp, 0, 1) : 1,
  })) : [];
  return { mapId: engine.mapId, name: MAPS[engine.mapId] ? MAPS[engine.mapId].name : '', W: engine.W, H: engine.H, players, bosses };
}

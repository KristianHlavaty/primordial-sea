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
     client -> host:   {k:'I', tx,ty,m,b}     {k:'ready'}                       */
import { RemotePlayer } from './entities/RemotePlayer.js';
import { activateAbility } from './systems/abilities.js';
import { SPECIES, speciesOfStageTier } from '../data/species.js';
import { ABILITY_SETS, ACTIVE_TIMER } from '../data/abilities.js';
import { NPCS } from '../data/npcs.js';
import { MAPS } from '../data/maps.js';
import { angLerp, clamp, lerp, hyp } from '../core/math.js';

const HOST_HZ = 20, CLIENT_HZ = 30;
const INPUT_KEEPALIVE = 0.25;

const sendTransient = (lobby, packet) => {
  if (!lobby) return;
  if (lobby.rawTransient) lobby.rawTransient(packet); else lobby.raw(packet);
};
const roundTo = (n, places) => { const scale = 10 ** places; return Math.round(n * scale) / scale; };

const defaultSpecies = (stage, tier) => speciesOfStageTier(stage, tier, true)[0] || 'protocell';
const resolveSpecies = (id, stage, tier) => (id && SPECIES[id]) ? id : defaultSpecies(stage, tier);

/* ---------------- start ---------------- */

export function mpStartHost(engine, { room, profile, lobby, selfConn, roster }) {
  engine.resetRun();
  engine.fantasyEvolution = false; engine.cheatsEnabled = false; engine.invincible = false;
  const map = MAPS[room.map], stage = map.stage, tier = room.tier;
  engine.era = room.era || 0;
  engine.mp = {
    role: 'host', lobby, self: selfConn, roster: roster || {}, stage, tier,
    selfName: profile ? profile.name : 'Host', selfColor: profile ? profile.color : '#8affd0',
    inputs: {}, seq: 0, sendAcc: 0, nextNet: 1, feed: [], feedId: 0,
  };
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier);
  engine.player = null; engine.makePlayer(mine);
  engine.remotePlayers = [];
  engine.loadMap(room.map);                       // builds the arena (bosses skipped in MP)
  for (const cid in roster) {
    if (String(cid) === String(selfConn)) continue;
    engine.remotePlayers.push(new RemotePlayer(resolveSpecies(roster[cid].species, stage, tier), engine,
      { connId: Number(cid), name: roster[cid].name, color: roster[cid].color }));
  }
  engine.playing = true; engine.paused = false; engine.dead = false;
  engine.sfx.unlock(); engine.pushHud(true);
}

export function mpStartClient(engine, { room, profile, lobby, selfConn, hostConn, roster }) {
  engine.resetRun();
  engine.fantasyEvolution = false;
  const map = MAPS[room.map], stage = map.stage, tier = room.tier;
  engine.era = room.era || 0;
  engine.mp = {
    role: 'client', lobby, self: selfConn, host: hostConn, roster: roster || {}, stage, tier,
    selfName: profile ? profile.name : 'You', selfColor: profile ? profile.color : '#8affd0',
    sendAcc: 0, inputKeepalive: INPUT_KEEPALIVE, lastInput: null, reAsk: 0, gotInit: false,
    npcById: new Map(), rpById: new Map(), foodById: new Map(),
    seenNpcs: new Set(), seenPlayers: new Set(), seenFood: new Set(), feed: [], feedId: 0,
  };
  engine.mapId = room.map; engine.stage = stage; engine.theme = map.theme; engine.W = map.W; engine.H = map.H;
  const mine = resolveSpecies(roster[selfConn] && roster[selfConn].species, stage, tier);
  engine.player = null; engine.makePlayer(mine);
  engine.player.x = engine.W / 2; engine.player.y = engine.H / 2; engine.player._netInit = false;
  engine.remotePlayers = []; engine.creatures = []; engine.plants = []; engine.food = []; engine.obstacles = []; engine.webs = []; engine.bubbles = [];
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
      if (rp) activateAbility(engine, data.i, rp);
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
  const rp = new RemotePlayer(resolveSpecies(r.species, mp.stage, mp.tier), engine, { connId, name: r.name, color: r.color });
  engine.remotePlayers.push(rp);
  if (engine.onScheduleChange) engine.onScheduleChange();
  return rp;
}

/* ---------------- host: broadcast ---------------- */

export function mpBroadcast(engine, dt) {
  const mp = engine.mp;
  if (!engine.remotePlayers.length) { mp.sendAcc = 0; return; }
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
    });
  };
  pushP(engine.player, mp.self);
  for (const rp of engine.remotePlayers) pushP(rp, rp.connId);
  const npcs = [];
  for (const c of engine.creatures) {
    if (c.boss) continue;
    if (c.netId == null) c.netId = mp.nextNet++;
    npcs.push({ n: c.netId, k: c.key, x: Math.round(c.x), y: Math.round(c.y), a: roundTo(c.angle, 2), hp: Math.round(c.hp), mhp: Math.round(c.maxHp), r: Math.round(c.radius), lv: c.level || 1, st: c.stunT > 0 ? 1 : 0 });
    if (npcs.length >= 80) break;
  }
  const food = [];
  for (const f of engine.food) {
    if (f.netId == null) f.netId = mp.nextNet++;
    food.push({ n: f.netId, x: Math.round(f.x), y: Math.round(f.y), m: f.kind === 'meat' ? 1 : 0 });
    if (food.length >= 60) break;
  }
  return { k: 'S', q: mp.seq++, players, npcs, food };
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
  };
  applyAbilityState(player, pd.ab);
  return player;
}
function makeRenderNpc(nd) {
  const s = NPCS[nd.k], plan = s ? s.plan : { kind: 'microbe', body: '#88a', accent: '#ccd' };
  return {
    netId: nd.n, key: nd.k, plan, boss: false, role: s ? s.role : 'prey', scale: 1, animOff: (nd.n * 7) % 100,
    vx: 0, vy: 0, mouth: 0, hurt: 0, hpBarT: 0, stunT: 0, x: nd.x, y: nd.y, angle: nd.a, gx: nd.x, gy: nd.y, ga: nd.a,
    hp: nd.hp, maxHp: nd.mhp, radius: nd.r, level: nd.lv,
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

function applySnapshot(engine, s) {
  const mp = engine.mp;
  const seen = mp.seenPlayers; seen.clear();
  for (const pd of s.players) {
    if (pd.c === mp.self) {
      const pl = engine.player;
      pl.gx = pd.x; pl.gy = pd.y; pl.ga = pd.a; pl.hp = pd.hp; pl.maxHp = pd.mhp; pl.level = pd.lv; pl.xp = pd.xp || 0;
      pl.shield = pd.sh; pl.shieldMax = pd.sm || 0; applyAbilityState(pl, pd.ab);
      pl.kills = pd.k || 0; pl.deadT = pd.d || 0;
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
    rp.kills = pd.k || 0; rp.deadT = pd.d || 0;
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
}

function applyWorldInit(engine, w) {
  engine.mp.gotInit = true;
  engine.W = w.W; engine.H = w.H; engine.theme = w.theme; if (w.map) engine.mapId = w.map;
  engine.obstacles = (w.obstacles || []).map(o => ({ ...o }));
  engine.plants = (w.plants || []).map(p => ({ ...p, value: 1, eatCd: 0, regen: 0 }));
  engine.webs = (w.webs || []).map(x => ({ ...x }));
}

export function mpClientUpdate(engine, dt) {
  engine.time += dt;
  const k = 1 - Math.exp(-dt * 14);
  const smooth = e => { if (e.gx != null) { e.x += (e.gx - e.x) * k; e.y += (e.gy - e.y) * k; e.angle = angLerp(e.angle, e.ga, k); } };
  const decay = e => {
    e.biteAnim = Math.max(0, (e.biteAnim || 0) - dt * 3); e.mouth = e.biteAnim; e.hurt = Math.max(0, (e.hurt || 0) - dt * 3);
    for (const id of (e.abilities || [])) {
      if (e.acd && e.acd[id] > 0) e.acd[id] = Math.max(0, e.acd[id] - dt);
      const timer = ACTIVE_TIMER[id]; if (timer && e[timer] > 0) e[timer] = Math.max(0, e[timer] - dt);
    }
  };
  if (engine.player) { smooth(engine.player); decay(engine.player); }
  for (const rp of engine.remotePlayers) { smooth(rp); decay(rp); }
  for (const c of engine.creatures) { smooth(c); c.mouth = Math.max(0, (c.mouth || 0) - dt * 3); c.hurt = Math.max(0, (c.hurt || 0) - dt * 3); if (c.hpBarT > 0) c.hpBarT -= dt; }

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

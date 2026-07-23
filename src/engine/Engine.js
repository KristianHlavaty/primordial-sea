/* The game simulation facade: owns source-object world collections and advances them. The
   runtime owns clocks, platform adapters and rendering; UI state is published
   through subscriber events as plain snapshot objects.

   The world is one of many MAPS (data/maps.js), grouped into STAGES (sea, land).
   loadMap() swaps the active map — resizing the world, reseeding stage-matched
   creatures/plants and the map's dedicated boss(es). You move between land maps
   by walking off a connected edge; you move from sea to land by "crawling
   ashore" (an evolution that changes stage).

   World structure:
   - player            Player entity (entities/Player.js)
   - creatures         Creature/Boss entities
   - plants            edible flora (plain objects; drawn by render/drawPlant.js)
   - food              meat/plant pellets that drift toward the player
   - particles/fx/floaters/eggs/bubbles   cosmetic bits */
import { Player } from './entities/Player.js';
import { ABILITIES, ACTIVE_TIMER } from '../data/abilities.js';
import { ITEMS, ITEM_KEYS } from '../data/items.js';
import { VEHICLES } from '../data/vehicles.js';
import { PERKS, BOSSES } from '../data/bosses.js';
import { MAPS, STAGES, firstMapOf, OPPOSITE_EDGE } from '../data/maps.js';
import { SPECIES, landPioneers, speciesStage } from '../data/species.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { freshTalentState, computeTalentBonus, talentValue, TALENT_TREES, TALENT_BY_ID, TREE_BY_ID } from '../data/talents.js';
import { clamp, lerp } from '../core/math.js';
import { spawnInitial } from './systems/spawning.js';
import { GameplaySystemPhases } from './systems/GameplayComponentSystems.js';
import { mpStartHost, mpStartClient, mpClientUpdate, mpOnPacket, mpBroadcast, mpPrepareSnapshot, mpRoster, mpMinimap, mpMaybeCrossMap, mpUpdateWorlds, mpActivateWorld, mpQueueEvolution, mpChooseEvolution, mpUseCheat, mpUseItem, mpDropItem, mpToggleVehicle, mpSendPacket } from './mp.js';
import { MultiplayerPacketKinds as PacketKinds } from './net/ComponentSnapshotProtocol.js';
import { GameEvents } from './events.js';

const CURRENT_SPEED = 165;   // sea-stage water current — px/s of drift at full strength

export class Engine {
  constructor({ events, componentWorld, componentSystems, audio } = {}) {
    if (!events || !componentWorld || !componentSystems || !audio) throw new Error('Engine requires runtime-owned events, componentWorld, componentSystems and audio');
    this.events = events;
    this.componentWorld = componentWorld;
    this.componentSystems = componentSystems;
    this.sfx = audio;

    // current map / viewport
    this.mapId = 'sea_shallows'; this.stage = 'sea'; this.theme = 'sea';
    this.W = 4400; this.H = 2700;
    this.vw = 0; this.vh = 0; this.dpr = 1;

    // simulation state
    this.time = 0; this.era = 0;
    this.player = null;
    this.mp = null;                 // multiplayer session (engine/mp.js) — null in single-player
    this.remotePlayers = [];        // host: RemotePlayer entities; client: interpolated render-objects
    this.creatures = []; this.plants = []; this.food = [];
    this.worldItems = []; this.itemProjectiles = []; this.itemSpawnT = 0;
    this.vehicles = []; this.vehicleSeq = 0; this.vehicleSpawnT = 0; this.vehicleTarget = 0;
    this.webs = [];
    this.obstacles = [];   // static land blockers (rocks, logs, stumps…)
    this.flow = [];   // sea-current streak particles (screen-space visual)
    this.particles = []; this.bubbles = []; this.eggs = []; this.fx = []; this.floaters = [];
    this.cam = { x: 0, y: 0 }; this.shake = 0; this.danger = 0;

    // input state (written by ui/input.js)
    this.mouse = { x: 0, y: 0 }; this.worldMouse = { x: 0, y: 0 };
    this.keys = {}; this.biteHeld = false; this.inputSuppressed = false;

    // flow state
    this.playing = false; this.paused = false; this.dead = false; this.backgrounded = false;
    this.pendingEvolve = false; this.choices = []; this.evolveMode = 'normal';   // 'normal' | 'ascend' | 'advance'
    this.kills = 0; this.lastHurt = -99; this.spawnT = 0; this.hudT = 0;

    // stage transitions (crawling ashore)
    this.ascendOffered = false; this.ascendAvailable = false; this.advanceAvailable = false;
    // map edge crossings
    this.transitionCd = 0; this.edgeDwell = 0; this.nearEdge = null; this.visitedMaps = new Set();

    // boss trophies, achievements
    this.perks = { dmgReduce: 0, dodge: 0, webResist: 0, shockAfterglow: 0, list: [] };
    this.bossesDefeated = new Set(); this.achievement = null; this.achT = 0; this.achId = 0;

    // UI-facing bits
    this.showLevels = true;
    this.fantasyEvolution = false;
    this.respawnsEnabled = true;
    this.itemsEnabled = true;
    this.funItems = false;
    this.cheatsEnabled = false; this.invincible = false;

    // talent trees (per-stage; earned by leveling, spent for boosts; reset each run)
    this.talent = freshTalentState();
    this.talentBonus = computeTalentBonus(this.talent.trees);
  }

  resize(width, height, resolution = 1) {
    this.dpr = Math.min(Math.max(Number(resolution) || 1, 1), 2);
    this.vw = Math.max(1, Number(width) || 1); this.vh = Math.max(1, Number(height) || 1);
    this.events.emit(GameEvents.RUNTIME_RESIZED, { width: this.vw, height: this.vh, resolution: this.dpr });
  }

  makePlayer(speciesId) {
    if (this.player && this.player.vehicle) this.componentSystems.exitVehicle(this, this.player, true);
    this.player = new Player(speciesId, this.player, this);
  }

  /* ---------------- run control ---------------- */

  /* Reset flow/progress state shared by every fresh run (start / startAt). */
  resetRun() {
    this.mp = null; this.remotePlayers = [];
    this.vehicles = []; this.vehicleSeq = 0; this.vehicleSpawnT = 0; this.vehicleTarget = 0;
    this.era = 0; this.kills = 0; this.dead = false; this.paused = false;
    this.pendingEvolve = false; this.choices = []; this.evolveMode = 'normal';
    this.perks = { dmgReduce: 0, dodge: 0, webResist: 0, shockAfterglow: 0, list: [] }; this.bossesDefeated = new Set();
    this.achievement = null; this.achT = 0;
    this.ascendOffered = false; this.ascendAvailable = false; this.advanceAvailable = false;
    this.transitionCd = 0; this.edgeDwell = 0; this.nearEdge = null; this.visitedMaps = new Set();
    this.time = 0; this.lastHurt = -99;
    this.inputSuppressed = false;
    this.mouse.x = this.vw / 2; this.mouse.y = this.vh / 2;
    this.talent = freshTalentState();
    this.talentBonus = computeTalentBonus(this.talent.trees);
  }

  start(options = {}) {
    this.resetRun();
    this.fantasyEvolution = !!options.fantasyEvolution;
    this.respawnsEnabled = options.respawns !== false;
    this.itemsEnabled = options.items !== false;
    this.funItems = this.itemsEnabled && !!options.funItems;
    this.cheatsEnabled = !!options.cheats; this.invincible = false;
    this.player = null; this.makePlayer('protocell');
    this.loadMap('sea_shallows');
    this.playing = true; this.sfx.unlock(); this.pushHud(true);
  }

  /* "Skip ahead": begin already in a later stage as one of its tier-1 entrants
     (Devonian pioneer or Carboniferous entrant). You keep the talent points you
     would have banked getting there, so skipping isn't a talent penalty. */
  startAt(speciesId, options = {}) {
    this.resetRun();
    this.fantasyEvolution = !!options.fantasyEvolution;
    this.respawnsEnabled = options.respawns !== false;
    this.itemsEnabled = options.items !== false;
    this.funItems = this.itemsEnabled && !!options.funItems;
    this.cheatsEnabled = !!options.cheats; this.invincible = false;
    const stage = speciesStage(speciesId);
    this.era = stage === 'carboniferous' ? 8 : 4;   // NPCs scale to the skipped-to depth
    this.ascendOffered = true;                       // already ashore — no crawl-ashore prompt
    this.grantSkipTalents(stage);
    this.player = null; this.makePlayer(speciesId);
    this.loadMap(firstMapOf(stage));
    this.playing = true; this.sfx.unlock(); this.pushHud(true);
  }

  /* Bank the talent points a full playthrough of each SKIPPED stage would have
     earned (5 sea forms × 9 = 45; 4 Devonian forms × 9 = 36), unspent, and
     unlock those trees so you can spend them right away. */
  grantSkipTalents(targetStage) {
    const SKIP = { sea: 45, devonian: 36 };
    const targetOrder = STAGES[targetStage] ? STAGES[targetStage].order : 0;
    for (const id in this.talent.trees) {
      const tree = TREE_BY_ID[id]; if (!tree) continue;
      const order = STAGES[tree.stage] ? STAGES[tree.stage].order : 0;
      if (order < targetOrder) { this.talent.trees[id].earned = SKIP[tree.stage] || 0; this.talent.trees[id].unlocked = true; }
    }
    this.talentBonus = computeTalentBonus(this.talent.trees);
  }

  /* Swap the active map. `via` is the edge the player LEFT through (they arrive
     at the opposite edge of the new map); omit it for a fresh/landfall entry
     (player is centered). */
  loadMap(mapId, via) {
    const previousMapId = this.mapId;
    for (const player of this.allPlayers()) if (player.vehicle) this.componentSystems.exitVehicle(this, player, true);
    const m = MAPS[mapId];
    this.mapId = mapId; this.stage = m.stage; this.theme = m.theme; this.W = m.W; this.H = m.H;
    if (this.talent.trees[this.stage]) this.talent.trees[this.stage].unlocked = true;   // entering a stage unlocks its tree
    const p = this.player;
    if (!via) { p.x = this.W / 2; p.y = this.H * 0.5; }
    else if (this.mp && this.mp.role === 'host') {
      const arrive = OPPOSITE_EDGE[via], horizontal = arrive === 'top' || arrive === 'bottom';
      const gate = m.passages && m.passages[arrive];
      const center = (horizontal ? this.W : this.H) * (gate ? gate.center : 0.5);
      const players = this.allPlayers(), spacing = 76;
      players.forEach((player, i) => {
        const offset = (i - (players.length - 1) / 2) * spacing;
        if (arrive === 'right') { player.x = this.W - player.radius - 90; player.y = center + offset; }
        else if (arrive === 'left') { player.x = player.radius + 90; player.y = center + offset; }
        else if (arrive === 'top') { player.x = center + offset; player.y = player.radius + 90; }
        else if (arrive === 'bottom') { player.x = center + offset; player.y = this.H - player.radius - 90; }
        player.x = clamp(player.x, player.radius, this.W - player.radius);
        player.y = clamp(player.y, player.radius, this.H - player.radius);
        player.vx = 0; player.vy = 0;
      });
    } else {
      const arrive = OPPOSITE_EDGE[via];
      if (arrive === 'right') p.x = this.W - p.radius - 90;
      else if (arrive === 'left') p.x = p.radius + 90;
      else if (arrive === 'top') p.y = p.radius + 90;
      else if (arrive === 'bottom') p.y = this.H - p.radius - 90;
      p.x = clamp(p.x, p.radius, this.W - p.radius);
      p.y = clamp(p.y, p.radius, this.H - p.radius);
    }
    p.vx = 0; p.vy = 0;
    this.food.length = 0; this.fx.length = 0; this.floaters.length = 0;
    spawnInitial(this);                 // clears + reseeds creatures/plants/particles/eggs/bubbles + bosses
    this.cam.x = clamp(p.x - this.vw / 2, 0, Math.max(0, this.W - this.vw));
    this.cam.y = clamp(p.y - this.vh / 2, 0, Math.max(0, this.H - this.vh));
    this.transitionCd = 1.2; this.edgeDwell = 0; this.nearEdge = null;
    if (this.mp && this.mp.role === 'host') this.mp.worldDirty = true;
    this.visitedMaps.add(mapId);
    this.captureRenderState();
    this.emitMapChanged(previousMapId, via);
    this.pushHud(true);
  }

  emitMapChanged(previousMapId, via = null) {
    this.events.emit(GameEvents.WORLD_MAP_CHANGED, {
      mapId: this.mapId, previousMapId, via,
      stage: this.stage, theme: this.theme,
    });
  }

  togglePause() { if (this.dead || this.pendingEvolve || !this.playing || this.mp) return; this.paused = !this.paused; this.pushHud(true); }
  /* A hidden multiplayer host still simulates gameplay. Visual effects, sound
     and React snapshots can wait until the tab has a consumer again. */
  setBackgrounded(value) {
    const backgrounded = !!value; if (backgrounded === this.backgrounded) return;
    this.backgrounded = backgrounded; this.sfx.setBackgrounded(backgrounded);
    if (backgrounded) {
      this.particles.length = 0; this.fx.length = 0; this.floaters.length = 0; this.flow.length = 0;
    } else this.pushHud(true);
    this.events.emit(GameEvents.RUNTIME_BACKGROUND_CHANGED, { backgrounded });
  }
  returnToMenu() {
    this.playing = false; this.paused = false; this.pendingEvolve = false;
    this.mp = null; this.remotePlayers = [];
    this.biteHeld = false; this.keys = {}; this.pushHud(true);
    this.notifyScheduleChange();
  }

  /* ---------------- multiplayer entry (delegates to engine/mp.js) ---------------- */
  notifyScheduleChange() { this.events.emit(GameEvents.RUNTIME_SCHEDULE_CHANGED, { engine: this }); }
  startMpHost(opts) { mpStartHost(this, opts); this.notifyScheduleChange(); }
  startMpClient(opts) { mpStartClient(this, opts); this.notifyScheduleChange(); }
  updateReplica(dt) { mpClientUpdate(this, dt); }
  prepareMultiplayerSnapshot() { mpPrepareSnapshot(this); }
  broadcastMultiplayer(dt) { if (this.mp?.role === 'host') mpBroadcast(this, dt); }
  onNetPacket(from, data) { mpOnPacket(this, from, data); }
  queueMpEvolution(player) { mpQueueEvolution(this, player); }
  /* Keep the host's roster fresh so late joiners / colour edits resolve right. */
  mpSetRoster(roster) {
    if (!this.mp) return;
    this.mp.roster = roster || {};
    if (this.mp.role === 'host') {
      const restoreMap = this.mapId;
      for (const rp of this.remotePlayers) if (!(roster && roster[rp.connId])) {
        if (rp.vehicle) {
          if (rp.mapId) mpActivateWorld(this, rp.mapId);
          this.componentSystems.exitVehicle(this, rp, true);
        }
        this.mp.peerProtocols?.delete(String(rp.connId));
        this.mp.inputSequences?.delete(String(rp.connId));
        this.mp.dirtyWorldFor?.delete(rp.connId);
        this.mp.edgePrompts?.delete(rp.connId);
      }
      mpActivateWorld(this, restoreMap);
      this.remotePlayers = this.remotePlayers.filter(rp => roster && roster[rp.connId]);   // drop players who left the room
    }
    for (const rp of this.remotePlayers) { const r = roster && roster[rp.connId]; if (r) { rp.name = r.name; rp.color = r.color; } }
    this.notifyScheduleChange();
  }

  /* Every player in the active map. Multiplayer players in another adjacent
     map remain authoritative, but cannot collide, fight or attract this map's
     NPCs until they return. */
  allPlayers() {
    const players = this.player ? [this.player, ...this.remotePlayers] : this.remotePlayers.slice();
    if (this.mp && this.mp.role === 'host' && this.mp.worlds) return players.filter(player => (player.mapId || this.mapId) === this.mapId);
    return players;
  }
  worldPlayer() { return this._worldFocusPlayer || this.allPlayers()[0] || this.player; }
  visibleRemotePlayers() {
    if (this.mp && this.mp.role === 'host' && this.mp.worlds) return this.remotePlayers.filter(player => (player.mapId || this.mapId) === this.mapId);
    return this.remotePlayers;
  }
  /* Nearest LIVING player to a point (NPCs hunt/flee whoever is closest). */
  nearestPlayer(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.allPlayers()) {
      if (p.deadT > 0) continue;
      const dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /* FFA death: put the victim on a respawn timer, credit the killer, post a feed line. */
  mpPlayerDied(victim, attacker) {
    if (!this.mp || victim.deadT > 0) return;
    this.componentSystems.playerDied(this, victim, attacker, true);
  }
  /* Optional single-player death handling: preserve the run and current form,
     then reuse the same short, protected respawn cycle as multiplayer. */
  singlePlayerDied(victim) {
    if (this.mp || !this.respawnsEnabled || !victim || victim.deadT > 0) return;
    this.componentSystems.playerDied(this, victim, null, false);
  }
  mpNameOf(p) { return p === this.player ? this.mp.selfName : (p.name || 'Player'); }
  mpColorOf(p) { return p === this.player ? this.mp.selfColor : (p.color || '#8affd0'); }
  mpAddFeed(text, color) {
    if (!this.mp) return;
    this.mp.feed.push({ id: ++this.mp.feedId, text, color, t: this.time });
    while (this.mp.feed.length > 6) this.mp.feed.shift();
    this.pushHud(true);
  }
  setPaused(v) { this.paused = v; }
  canWiki() {
    const mpEvolving = !!(this.mp && this.player && this.player.mpEvolveChoices && this.player.mpEvolveChoices.length);
    return this.playing && !this.dead && !this.pendingEvolve && !mpEvolving && !this.paused;
  }
  toggleMute() { this.sfx.muted = !this.sfx.muted; this.pushHud(true); }
  toggleLevels() { this.showLevels = !this.showLevels; this.pushHud(true); }
  toggleInvincible() {
    if (!this.cheatsEnabled) return;
    if (this.mp) { mpUseCheat(this, 'invincible'); return; }
    this.invincible = !this.invincible; this.pushHud(true);
  }
  cheatLevelUp() {
    if (!this.cheatsEnabled || !this.player) return;
    if (this.mp) { mpUseCheat(this, 'level'); return; }
    if (this.pendingEvolve || this.player.level >= MAX_LEVEL) return;
    this.player.addXp(this, xpNeed(this.player.level) / 2); this.pushHud(true);
  }
  useItem(slot) {
    if ((this.mp ? this.mp.items === false : !this.itemsEnabled) || !this.playing || this.dead || this.paused || this.inputSuppressed || this.player.vehicleType || (!this.mp && this.pendingEvolve)) return;
    if (this.mp) mpUseItem(this, slot); else this.componentSystems.useItem(this, this.player, slot);
  }
  dropItem(slot) {
    if ((this.mp ? this.mp.items === false : !this.itemsEnabled) || !this.playing || this.dead || this.paused || this.inputSuppressed || this.player.vehicleType || (!this.mp && this.pendingEvolve)) return;
    if (this.mp) mpDropItem(this, slot); else this.componentSystems.dropItem(this, this.player, slot);
  }
  toggleVehicle() {
    if (!this.playing || this.dead || this.paused || this.inputSuppressed || !this.player) return;
    if (this.mp) mpToggleVehicle(this); else this.componentSystems.toggleVehicle(this, this.player);
  }

  /* ---------------- talents ---------------- */

  nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : this.time * 1000; }
  spentCount(treeId) { const r = this.talent.trees[treeId].ranks; let s = 0; for (const k in r) s += r[k]; return s; }
  talentAvail(treeId) { const t = this.talent.trees[treeId]; return Math.max(0, t.earned - this.spentCount(treeId)); }
  pathPoints(treeId, col) { const tr = this.talent.trees[treeId]; let s = 0; for (const t of TREE_BY_ID[treeId].talents) if (t.col === col) s += (tr.ranks[t.id] || 0); return s; }
  talentUnspent() { let s = 0; for (const tree of TALENT_TREES) { if (this.talent.trees[tree.id].unlocked) s += this.talentAvail(tree.id); } return s; }

  /* Bank one point into the current stage's tree (called on every level-up). */
  gainTalentPoint() { const tr = this.talent.trees[this.stage]; if (tr) tr.earned++; }

  /* Recompute the aggregate bonus and re-apply it to the player's live stats
     (preserving HP fraction) so spending a point is felt immediately. */
  recomputeTalents() {
    this.talentBonus = computeTalentBonus(this.talent.trees);
    const p = this.player;
    if (p) { const frac = p.maxHp > 0 ? p.hp / p.maxHp : 1; p.applyLevelStats(this); p.hp = Math.max(1, Math.min(p.maxHp, Math.round(p.maxHp * frac))); }
    this.events.emit(GameEvents.PROGRESSION_TALENTS_CHANGED, {
      stage: this.stage, available: this.talentUnspent(), bonus: { ...this.talentBonus },
    });
    this.pushHud(true);
  }

  spendTalent(treeId, talentId) {
    const tr = this.talent.trees[treeId], t = TALENT_BY_ID[talentId];
    if (!tr || !t || !tr.unlocked || this.talentAvail(treeId) <= 0) return;
    if ((tr.ranks[talentId] || 0) >= t.max) return;
    if (t.req && (tr.ranks[t.req] || 0) <= 0) return;
    if (t.gate && !this.bossesDefeated.has(t.gate)) return;
    if (t.reqPath && this.pathPoints(treeId, t.col) < t.reqPath) return;   // must opt into the path first
    tr.ranks[talentId] = (tr.ranks[talentId] || 0) + 1;
    (tr.spentAt[talentId] = tr.spentAt[talentId] || []).push(this.nowMs());
    this.recomputeTalents();
  }

  /* Refund a talent's last rank if it's within the 30s misclick window and
     nothing that requires it would break. */
  undoTalent(treeId, talentId) {
    const tr = this.talent.trees[treeId], t = TALENT_BY_ID[talentId];
    if (!tr || !t) return;
    const rank = tr.ranks[talentId] || 0; if (rank <= 0) return;
    const times = tr.spentAt[talentId] || [], last = times[times.length - 1];
    if (last == null || this.nowMs() - last > 30000) return;
    if (rank - 1 <= 0 && TREE_BY_ID[treeId].talents.some(x => x.req === talentId && (tr.ranks[x.id] || 0) > 0)) return;
    tr.ranks[talentId] = rank - 1; times.pop();
    if (tr.ranks[talentId] === 0) delete tr.ranks[talentId];
    this.recomputeTalents();
  }

  /* One free full respec per tree per run. */
  respecTree(treeId) {
    const tr = this.talent.trees[treeId]; if (!tr || tr.respecUsed) return;
    tr.respecUsed = true; tr.ranks = {}; tr.spentAt = {};
    this.recomputeTalents();
  }

  /* Ready-to-render snapshot of every tree for the talent modal. */
  talentInfo() {
    const now = this.nowMs();
    const trees = TALENT_TREES.map(tree => {
      const st = this.talent.trees[tree.id], spent = this.spentCount(tree.id), avail = st.earned - spent;
      const nodes = tree.talents.map(t => {
        const rank = st.ranks[t.id] || 0, maxed = rank >= t.max;
        let locked = false, lockReason = '', lockShort = '';
        if (t.req && (st.ranks[t.req] || 0) <= 0) { locked = true; lockReason = 'Requires ' + TALENT_BY_ID[t.req].name; lockShort = 'needs ' + TALENT_BY_ID[t.req].name; }
        if (t.gate && !this.bossesDefeated.has(t.gate)) { locked = true; lockReason = t.gateLabel || 'Boss-locked'; lockShort = '🔒 ' + (BOSSES[t.gate] ? BOSSES[t.gate].short : 'boss'); }
        if (t.reqPath) { const have = this.pathPoints(tree.id, t.col); if (have < t.reqPath) { locked = true; lockReason = `Invest ${t.reqPath} in this path (${have}/${t.reqPath})`; lockShort = `${have}/${t.reqPath} in path`; } }
        const times = st.spentAt[t.id] || [], last = times[times.length - 1];
        const undoable = rank > 0 && last != null && (now - last) <= 30000;
        const vNow = talentValue(t, rank), vFull = talentValue(t, t.max);
        return {
          id: t.id, name: t.name, icon: t.icon, col: t.col, row: t.row,
          req: t.req || null, gate: t.gate || null, gateLabel: t.gateLabel || '',
          capstone: !!t.capstone, display: t.display || '', perRank: talentValue(t, 1).text,
          valueNow: vNow.text, valueFull: vFull.text, valueLabel: vFull.label,
          rank, max: t.max, locked, lockReason, lockShort, gated: !!t.gate,
          canSpend: st.unlocked && !locked && !maxed && avail > 0,
          undoable, undoIn: undoable ? Math.max(1, Math.ceil((30000 - (now - last)) / 1000)) : 0,
        };
      });
      return {
        id: tree.id, name: tree.name, color: tree.color, stage: tree.stage, paths: tree.paths,
        unlocked: st.unlocked, earned: st.earned, spent, available: avail, respecUsed: st.respecUsed, nodes,
      };
    });
    return { trees, currentStage: this.stage };
  }

  /* ---------------- input (called by ui/input.js) ---------------- */

  setMouse(x, y) { this.mouse.x = x; this.mouse.y = y; }
  setBite(v) { this.biteHeld = v; }
  setKey(k, v) { this.keys[k] = v; }
  releaseInput() { this.keys = {}; this.biteHeld = false; }
  setInputSuppressed(value) { this.inputSuppressed = !!value; if (this.inputSuppressed) this.releaseInput(); }
  useAbility(idx) {
    if (this.player && this.player.vehicleType) return;
    if (this.mp) {
      if (this.player && this.player.mpEvolveChoices && this.player.mpEvolveChoices.length) return;
      if (this.mp.role === 'client') { mpSendPacket(this, PacketKinds.ABILITY, { i: idx }); return; }
      this.componentSystems.activateAbility(this, idx, this.player); return;   // host activates its own power
    }
    this.componentSystems.activateAbility(this, idx);
  }
  webSlowAt(x, y) {
    let slow = 0;
    for (const w of this.webs) { const dx = x - w.x, dy = y - w.y, d = Math.sqrt(dx * dx + dy * dy); if (d < w.r) slow = Math.max(slow, 1 - d / w.r * .35); }
    return slow;
  }

  /* ---------------- sea current ---------------- */

  /* A smooth, meandering flow field (px/s). Only the sea flows; land is still.
     The dominant heading rotates slowly and both heading and strength wave
     across the map, so different areas push you different ways. */
  currentAt(x, y) {
    if (this.stage !== 'sea') return { x: 0, y: 0 };
    const t = this.time;
    const ang = t * 0.04 + Math.sin(x * 0.0011 + y * 0.0009 + t * 0.08) * 0.7;
    const mag = CURRENT_SPEED * (0.7 + 0.3 * Math.sin(x * 0.0015 - y * 0.0012 - t * 0.06));
    return { x: Math.cos(ang) * mag, y: Math.sin(ang) * mag };
  }

  /* Advance the drifting flow streaks (a faint screen-space visual of the
     current), seeding them the first time the sea is on screen. */
  updateFlow(dt) {
    if (this.stage !== 'sea') return;
    if (!this.flow.length && this.vw) for (let i = 0; i < 70; i++) { const x = Math.random() * this.vw, y = Math.random() * this.vh; this.flow.push({ x, y, px: x, py: y }); }
    for (const s of this.flow) {
      const c = this.currentAt(this.cam.x + s.x, this.cam.y + s.y);
      s.px = s.x; s.py = s.y;
      s.x += c.x * dt * 1.8; s.y += c.y * dt * 1.8;
      let wrappedX = false, wrappedY = false;
      if (s.x < -20) { s.x = this.vw + 20; s.px = s.x; wrappedX = true; }
      else if (s.x > this.vw + 20) { s.x = -20; s.px = s.x; wrappedX = true; }
      if (s.y < -20) { s.y = this.vh + 20; s.py = s.y; wrappedY = true; }
      else if (s.y > this.vh + 20) { s.y = -20; s.py = s.y; wrappedY = true; }
      // Screen-edge wrapping is a teleport, not motion. Reset interpolation on
      // the wrapped axis so high-refresh rendering cannot streak it across the
      // entire viewport on the next frame.
      if (wrappedX || wrappedY) {
        const fields = [];
        if (wrappedX) fields.push('x', 'px'); if (wrappedY) fields.push('y', 'py');
        this.events.emit(GameEvents.RENDER_OBJECT_SNAPPED, { object: s, fields });
      }
    }
  }

  updateBubbles(dt, followCurrent = true) {
    for (const b of this.bubbles) {
      b.y -= b.sp * dt; b.x += Math.sin(this.time + b.ph) * 6 * dt;
      if (followCurrent && this.stage === 'sea') {
        const current = this.currentAt(this.cam.x + b.x, this.cam.y + b.y);
        b.x += current.x * dt * 0.5;
      }
      let wrappedX = false, wrappedY = false;
      if (b.y < -4) {
        b.y = this.vh + 4; b.x = Math.random() * this.vw;
        wrappedX = true; wrappedY = true;
      }
      if (b.x < -12) { b.x = this.vw + 12; wrappedX = true; }
      else if (b.x > this.vw + 12) { b.x = -12; wrappedX = true; }
      if (wrappedX || wrappedY) {
        const fields = [];
        if (wrappedX) fields.push('x'); if (wrappedY) fields.push('y');
        this.events.emit(GameEvents.RENDER_OBJECT_SNAPPED, { object: b, fields });
      }
    }
  }

  /* ---------------- evolution ---------------- */

  /* True when the player is a sea apex that can still crawl ashore. */
  isSeaApex() {
    const p = this.player;
    return !!p && this.stage === 'sea' && p.level >= MAX_LEVEL && p.species.evolvesTo.length === 0 && this.availablePioneers().length > 0;
  }

  availablePioneers(fantasy = this.fantasyEvolution) {
    const branch = this.player && this.player.species.branch;
    const fromId = this.player && this.player.speciesId;
    return landPioneers(fantasy).filter(id =>
      (!SPECIES[id].seaBranches || SPECIES[id].seaBranches.includes(branch)) &&
      (!SPECIES[id].seaSpecies || SPECIES[id].seaSpecies.includes(fromId))
    );
  }

  /* A sea apex whose lineage has no *real* land descendant: it could only crawl
     ashore with Fantasy Evolution enabled (e.g. cnidarians, molluscs). Used to
     tell the player they've hit a dead end rather than leaving them puzzled. */
  isLandDeadEnd() {
    const p = this.player;
    if (this.mp || !p || this.stage !== 'sea' || p.species.evolvesTo.length !== 0) return false;
    return this.availablePioneers().length === 0 && this.availablePioneers(true).length > 0;
  }

  /* Would picking sea species `id` doom the lineage to a shore dead end under
     the current Fantasy setting? True when none of the sea apexes reachable
     from `id` has a land pioneer available to it (but Fantasy on would). Used
     by the evolve modal to warn before you commit to a cnidarian/mollusc road. */
  leadsToLandDeadEnd(id) {
    if (this.mp || this.fantasyEvolution || speciesStage(id) !== 'sea') return false;
    // collect reachable sea apexes from this choice
    const apexes = [], seen = new Set(), q = [id];
    while (q.length) {
      const cur = q.pop(); if (seen.has(cur)) continue; seen.add(cur);
      const sp = SPECIES[cur];
      if (sp.evolvesTo.length === 0) apexes.push(cur);
      else for (const t of sp.evolvesTo) if (speciesStage(t) === 'sea') q.push(t);
    }
    const reaches = ax => landPioneers(false).some(pid =>
      (!SPECIES[pid].seaBranches || SPECIES[pid].seaBranches.includes(SPECIES[ax].branch)) &&
      (!SPECIES[pid].seaSpecies || SPECIES[pid].seaSpecies.includes(ax)));
    // dead end only if no real path today, but Fantasy would open one
    return !apexes.some(reaches) && landPioneers(true).length > 0;
  }

  triggerEvolve() {
    this.componentSystems.triggerEvolution(this, false);
  }

  /* Offer the crawl-ashore choice (auto the first time, or re-opened by the
     player after they chose to stay in the sea). */
  triggerAscend() {
    this.componentSystems.triggerEvolution(this, true);
  }
  openAscend() { if (this.playing && !this.dead && !this.pendingEvolve) this.triggerAscend(); }
  isStageAdvance() {
    const p = this.player;
    return !!p && p.species.evolvesTo.length > 0 && p.species.evolvesTo.every(id => speciesStage(id) !== this.stage);
  }
  openAdvance() { if (this.playing && !this.dead && !this.pendingEvolve && this.advanceAvailable && this.isStageAdvance()) this.triggerEvolve(); }

  /* "Stay in the sea for now" — dismiss the crawl-ashore prompt but leave it
     re-openable so you can finish sea bosses first. */
  dismissAscend() {
    this.componentSystems.dismissEvolution(this, 'ascend');
  }

  chooseEvolution(id) {
    if (this.mp) { mpChooseEvolution(this, id); return; }
    this.componentSystems.chooseEvolution(this, id);
  }

  /* ---------------- boss trophies ---------------- */

  grantPerk(id, bossTitle) {
    const perk = PERKS[id]; if (!perk) return;
    if (perk.dmgReduce) this.perks.dmgReduce = Math.min(0.6, this.perks.dmgReduce + perk.dmgReduce);
    if (perk.dodge) this.perks.dodge = Math.min(0.6, this.perks.dodge + perk.dodge);
    if (perk.webResist) this.perks.webResist = Math.min(.85, this.perks.webResist + perk.webResist);
    if (perk.shockAfterglow) this.perks.shockAfterglow = 1;
    if (!this.perks.list.some(x => x.id === id)) this.perks.list.push({ id, name: perk.name, icon: perk.icon, color: perk.color, blurb: perk.blurb });
    this.events.emit(GameEvents.PROGRESSION_PERK_GRANTED, { id, bossTitle, name: perk.name });
    if (this.mp) {
      const text = bossTitle + ' defeated — ' + perk.name + ' gained';
      this.mpAddFeed(text, perk.color);
      mpSendPacket(this, PacketKinds.FEED, { text, color: perk.color }, { broadcast: true });
      this.pushHud(true);
      return;
    }
    this.achId++;
    this.achievement = { id: this.achId, boss: bossTitle, perk: perk.name, blurb: perk.blurb, icon: perk.icon, color: perk.color };
    this.achT = 0; this.paused = true;
    this.pushHud(true);
  }

  dismissAdvance() {
    this.componentSystems.dismissEvolution(this, 'advance');
  }
  dismissAchievement() {
    if (!this.achievement) return;
    this.achievement = null; this.paused = false; this.pushHud(true);
  }

  /* Debug hook (window.__game): damage a creature as if the player did it. */
  debugDamage(c, amt) { c.takeDamage(this, amt, c.x, c.y, true); }

  /* ---------------- simulation step ---------------- */

  /* Cross to a neighboring map when the player dwells against a connected edge.
     Returns true if a transition happened (caller skips the rest of the frame). */
  maybeCrossEdge(dt) {
    return !!this.componentSystems.run(GameplaySystemPhases.MAP_CROSSING, this, dt).mapChanged;
  }

  update(dt) {
    this.time += dt;
    if (!this.player) return;
    if (this.mp && this.mp.role === 'host' && this.mp.mapTransitions) {
      mpUpdateWorlds(this, dt, () => this.updateActiveWorld(dt));
    } else this.updateActiveWorld(dt);
    if (this.mp) {
      if (this.mp.feed.length) this.mp.feed = this.mp.feed.filter(f => this.time - f.t < 5);
    }
    this.pushHud();
  }

  updateActiveWorld(dt) {
    const p = this.worldPlayer(); if (!p) return;
    this.componentSystems.prepare(this);
    this.componentSystems.run(GameplaySystemPhases.PRE_ACTORS, this, dt);

    for (const player of this.allPlayers()) player.update(this, dt);

    if ((!this.mp && p.deadT <= 0 && this.maybeCrossEdge(dt)) || (this.mp && this.mp.role === 'host' && mpMaybeCrossMap(this, dt))) return;

    // creatures (list may shrink mid-loop when something dies)
    this.danger = Math.max(0, this.danger - dt * 0.6);
    for (const c of this.creatures) c.update(this, dt);

    this.componentSystems.run(GameplaySystemPhases.ENVIRONMENT, this, dt);
    this.componentSystems.run(GameplaySystemPhases.ITEMS, this, dt);
    this.componentSystems.run(GameplaySystemPhases.VEHICLES, this, dt);
    this.componentSystems.run(GameplaySystemPhases.STATUS_FACTS, this, dt);
    this.componentSystems.run(GameplaySystemPhases.RESOURCES, this, dt);
    this.componentSystems.run(GameplaySystemPhases.LIFETIMES, this, dt);
    this.componentSystems.run(GameplaySystemPhases.PROGRESSION, this, dt);

    // The host camera follows only the host's own map while other occupied
    // maps continue simulating off-screen.
    if (p === this.player) {
      const camtx = clamp(p.x - this.vw / 2, 0, Math.max(0, this.W - this.vw));
      const camty = clamp(p.y - this.vh / 2, 0, Math.max(0, this.H - this.vh));
      this.cam.x = lerp(this.cam.x, camtx, 1 - Math.exp(-dt * 6));
      this.cam.y = lerp(this.cam.y, camty, 1 - Math.exp(-dt * 6));
      this.shake *= Math.exp(-dt * 8);
    }

    this.componentSystems.run(GameplaySystemPhases.SPAWNING, this, dt);
  }

  /* Compatibility methods used by multiplayer/debug callers. Runtime-owned
     subscribers now capture and render without importing a renderer here. */
  captureRenderState() { this.events.emit(GameEvents.RENDER_CAPTURE_REQUESTED, { engine: this }); }
  render(alpha = 1) { this.events.emit(GameEvents.RENDER_FRAME_REQUESTED, { engine: this, alpha: clamp(alpha, 0, 1) }); }

  /* ---------------- HUD snapshots ---------------- */

  /* Publish a plain-data snapshot for React. Multiplayer uses 10 Hz because
     networking and canvas animation do not need a full React render each tick. */
  pushHud(force) {
    if (this.backgrounded) return;
    if (this.mp && this.mp.role === 'host' && this.mp.worlds && this.player && this.player.mapId && this.mapId !== this.player.mapId) return;
    if (!force) { if (this.time - this.hudT < (this.mp ? 0.1 : 0.05)) return; }
    this.hudT = this.time;
    const p = this.player;
    const mpChoices = this.mp && p && Array.isArray(p.mpEvolveChoices) ? p.mpEvolveChoices : [];
    const pendingEvolution = this.mp ? mpChoices.length > 0 : this.pendingEvolve;
    const abils = p ? p.abilities.map((id, i) => {
      const ab = ABILITIES[id]; const cd = p.acd[id] || 0; const tf = ACTIVE_TIMER[id];
      let active = ab.passive, activeFrac = 0;
      if (tf) { active = p[tf] > 0; activeFrac = ab.dur ? clamp(p[tf] / ab.dur, 0, 1) : 0; }
      let meter = 0, meterLabel = '';
      if (id === 'filter') { meter = (p.filterCombo || 0) / 5; meterLabel = `${p.filterCombo || 0}x`; }
      else if (id === 'camo') { meter = p.camoCharge || 0; meterLabel = meter >= .9 ? 'AMBUSH' : ''; }
      else if (id === 'thickhide') { meter = (p.armorPlates || 0) / 3; meterLabel = `${p.armorPlates || 0}`; }
      else if (id === 'bastion') { meter = p.fortify || 0; meterLabel = meter >= .9 ? 'FORTIFIED' : ''; }
      else if (id === 'sail') { meter = p.sailHeat || 0; meterLabel = meter >= .8 ? 'HOT' : ''; }
      else if (id === 'airbreath') { meter = (p.airStride || 0) / 3; }
      else if (id === 'barbs') { meter = (p.barbCharge || 0) / 3; meterLabel = p.barbCharge ? `${p.barbCharge}` : ''; }
      else if (id === 'ampullae' || id === 'silksense') { meter = 1 - (p.senseCd || 0) / (id === 'silksense' ? 4.5 : 5); meterLabel = meter >= .99 ? 'READY' : ''; }
      else if (id === 'regen') { meter = 1 - (p.regenDelay || 0) / 2.5; meterLabel = meter >= .99 ? 'MENDING' : ''; }
      else if (id === 'rebirth') { meter = p.rebirthUsed ? 0 : 1; meterLabel = p.rebirthUsed ? 'SPENT' : 'READY'; }
      else if (id === 'harden' && active) { meter = clamp((p.hardenStored || 0) / p.maxHp, 0, 1); meterLabel = meter > .08 ? 'CHARGED' : ''; }
      else if (id === 'withdraw' && active) { meter = clamp((p.withdrawStored || 0) / p.maxHp, 0, 1); meterLabel = meter > .08 ? 'RELEASE' : ''; }
      else if (id === 'sprint' && active) { meter = p.sprintMomentum || 0; meterLabel = meter > .72 ? 'TRAMPLE' : ''; }
      return {
        id, name: ab.name, key: i + 1, passive: ab.passive, color: ab.color, desc: ab.desc,
        cd: Math.ceil(cd), cdFrac: ab.cd ? clamp(cd / ab.cd, 0, 1) : 0, ready: cd <= 0, active, activeFrac,
        meter: clamp(meter, 0, 1), meterLabel,
      };
    }) : [];
    const itemsEnabled = this.mp ? this.mp.items !== false : this.itemsEnabled;
    const items = itemsEnabled && p ? ITEM_KEYS.map((key, slot) => {
      const held = p.items && p.items[slot], def = held && ITEMS[held.id];
      if (!def) return { slot, key, empty: true };
      return {
        slot, key, id: held.id, name: def.name, icon: def.icon, color: def.color, desc: def.desc,
        modern: !!def.modern, rare: !!def.rare, uses: held.uses, maxUses: def.uses, cd: held.cd || 0,
        cdFrac: def.cooldown ? clamp((held.cd || 0) / def.cooldown, 0, 1) : 0,
      };
    }) : null;
    const pilotedVehicle = p && (p.vehicle || this.vehicles.find(candidate => candidate.netId === p.vehicleNetId));
    const vehicle = pilotedVehicle && VEHICLES[pilotedVehicle.type] ? {
      type: pilotedVehicle.type, name: VEHICLES[pilotedVehicle.type].name, weapon: VEHICLES[pilotedVehicle.type].weaponName,
      hp: Math.max(0, Math.round(pilotedVehicle.hp)), maxHp: pilotedVehicle.maxHp,
      cdFrac: clamp((pilotedVehicle.weaponCd || 0) / ITEMS[VEHICLES[pilotedVehicle.type].projectile].cooldown, 0, 1),
      time: Math.max(0, Math.ceil(pilotedVehicle.timeLeft || 0)),
      timeFrac: clamp((pilotedVehicle.timeLeft || 0) / VEHICLES[pilotedVehicle.type].duration, 0, 1),
    } : null;
    const snapshot = {
      hp: p ? p.hp : 0, maxHp: p ? p.maxHp : 1,
      level: p ? p.level : 1, xp: p ? Math.round(p.xp) : 0, xpNeed: p ? xpNeed(p.level) : 1,
      canEvolve: p ? (this.mp ? mpChoices.length > 0 : p.species.evolvesTo.length > 0) : false, showLevels: this.showLevels,
      name: p ? p.species.name : '', branch: p ? p.species.branch : '-', tier: p ? p.species.tier : 0, era: this.era,
      kills: this.kills, dead: this.dead, paused: this.paused, pendingEvolve: pendingEvolution, evolveMode: this.mp ? 'normal' : this.evolveMode,
      respawning: !!(!this.mp && p && p.deadT > 0), respawnIn: !this.mp && p ? Math.ceil(p.deadT || 0) : 0,
      choices: this.mp ? mpChoices.slice() : this.choices.slice(), muted: this.sfx.muted,
      abilities: abils, shield: p ? Math.round(p.shield) : 0, shieldMax: p ? p.shieldMax : 0,
      forceFieldTime: p ? Math.max(0, Math.ceil(p.forceFieldT || 0)) : 0,
      items, vehicle, funVehicles: this.mp ? !!this.mp.funItems : !!this.funItems,
      perks: this.perks.list.map(x => ({ id: x.id, name: x.name, icon: x.icon, color: x.color, blurb: x.blurb })),
      achievement: this.achievement,
      // stage / map
      stage: this.stage, stageName: STAGES[this.stage] ? STAGES[this.stage].name : '',
      mapId: this.mapId, mapName: MAPS[this.mapId] ? MAPS[this.mapId].name : '',
      talentUnspent: this.talentUnspent(),
      canAscend: this.isSeaApex(), ascendAvailable: this.ascendAvailable, advanceAvailable: this.advanceAvailable, nearEdge: this.nearEdge,
      landDeadEnd: !!(p && p.level >= MAX_LEVEL && this.isLandDeadEnd()),
      cheatsEnabled: this.cheatsEnabled, invincible: this.mp && p ? !!p.mpInvincible : this.invincible,
      mpRole: this.mp ? this.mp.role : null, mpPlayers: this.mp ? mpRoster(this) : null,
      mpMap: this.mp ? mpMinimap(this) : null,
      mpDead: !!(this.mp && this.player && this.player.deadT > 0), mpRespawnIn: (this.mp && this.player) ? Math.ceil(this.player.deadT || 0) : 0,
      mpFeed: this.mp ? this.mp.feed.map(f => ({ id: f.id, text: f.text, color: f.color })) : null
    };
    this.events.emit(GameEvents.UI_HUD_UPDATED, snapshot);
  }
}

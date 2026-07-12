/* The game engine: owns all world state, advances the simulation (update)
   and draws it (render). The React shell drives it from a rAF loop and
   receives UI state through the onHud callback — plain snapshot objects,
   so the UI never reaches into live entities.

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
import { PERKS } from '../data/bosses.js';
import { MAPS, STAGES, firstMapOf, OPPOSITE_EDGE } from '../data/maps.js';
import { SPECIES, landPioneers, speciesStage } from '../data/species.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { clamp, lerp, hyp } from '../core/math.js';
import { spawnInitial, spawnMaintain, spawnRandomNpc } from './systems/spawning.js';
import { activateAbility } from './systems/abilities.js';
import { burst } from './systems/effects.js';
import { renderWorld } from '../render/renderWorld.js';
import { Sfx } from './audio.js';

const CURRENT_SPEED = 165;   // sea-stage water current — px/s of drift at full strength

export class Engine {
  constructor(canvas, { onHud }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHud = onHud;
    this.sfx = new Sfx();

    // current map / viewport
    this.mapId = 'sea_shallows'; this.stage = 'sea'; this.theme = 'sea';
    this.W = 4400; this.H = 2700;
    this.vw = 0; this.vh = 0; this.dpr = 1;

    // simulation state
    this.time = 0; this.era = 0;
    this.player = null;
    this.creatures = []; this.plants = []; this.food = [];
    this.webs = [];
    this.obstacles = [];   // static land blockers (rocks, logs, stumps…)
    this.flow = [];   // sea-current streak particles (screen-space visual)
    this.particles = []; this.bubbles = []; this.eggs = []; this.fx = []; this.floaters = [];
    this.cam = { x: 0, y: 0 }; this.shake = 0; this.danger = 0;

    // input state (written by ui/input.js)
    this.mouse = { x: 0, y: 0 }; this.worldMouse = { x: 0, y: 0 };
    this.keys = {}; this.biteHeld = false;

    // flow state
    this.playing = false; this.paused = false; this.dead = false;
    this.pendingEvolve = false; this.choices = []; this.evolveMode = 'normal';   // 'normal' | 'ascend' | 'advance'
    this.kills = 0; this.lastHurt = -99; this.spawnT = 0; this.hudT = 0;

    // stage transitions (crawling ashore)
    this.ascendOffered = false; this.ascendAvailable = false; this.advanceAvailable = false;
    // map edge crossings
    this.transitionCd = 0; this.edgeDwell = 0; this.nearEdge = null; this.visitedMaps = new Set();

    // boss trophies, achievements
    this.perks = { dmgReduce: 0, dodge: 0, webResist: 0, list: [] };
    this.bossesDefeated = new Set(); this.achievement = null; this.achT = 0; this.achId = 0;

    // UI-facing bits
    this.showLevels = true;
    this.fantasyEvolution = false;
    this.cheatsEnabled = false; this.invincible = false;
    this.previewCanvas = {};   // evolve-modal preview canvases, keyed by species id
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  makePlayer(speciesId) { this.player = new Player(speciesId, this.player, this); }

  /* ---------------- run control ---------------- */

  /* Reset flow/progress state shared by every fresh run (start / startAt). */
  resetRun() {
    this.era = 0; this.kills = 0; this.dead = false; this.paused = false;
    this.pendingEvolve = false; this.choices = []; this.evolveMode = 'normal';
    this.perks = { dmgReduce: 0, dodge: 0, webResist: 0, list: [] }; this.bossesDefeated = new Set();
    this.achievement = null; this.achT = 0;
    this.ascendOffered = false; this.ascendAvailable = false; this.advanceAvailable = false;
    this.transitionCd = 0; this.edgeDwell = 0; this.nearEdge = null; this.visitedMaps = new Set();
    this.time = 0; this.lastHurt = -99;
    this.mouse.x = this.vw / 2; this.mouse.y = this.vh / 2;
  }

  start(options = {}) {
    this.resetRun();
    this.fantasyEvolution = !!options.fantasyEvolution;
    this.cheatsEnabled = !!options.cheats; this.invincible = false;
    this.player = null; this.makePlayer('protocell');
    this.loadMap('sea_shallows');
    this.playing = true; this.sfx.unlock(); this.pushHud(true);
  }

  /* "Skip to land": begin already ashore as one of the land pioneers. */
  startAt(speciesId, options = {}) {
    this.resetRun();
    this.fantasyEvolution = !!options.fantasyEvolution;
    this.cheatsEnabled = !!options.cheats; this.invincible = false;
    this.era = 4;                       // land NPCs scale to a mid-game difficulty
    this.ascendOffered = true;          // already ashore — no crawl-ashore prompt
    this.player = null; this.makePlayer(speciesId);
    this.loadMap(firstMapOf('devonian'));
    this.playing = true; this.sfx.unlock(); this.pushHud(true);
  }

  /* Swap the active map. `via` is the edge the player LEFT through (they arrive
     at the opposite edge of the new map); omit it for a fresh/landfall entry
     (player is centered). */
  loadMap(mapId, via) {
    const m = MAPS[mapId];
    this.mapId = mapId; this.stage = m.stage; this.theme = m.theme; this.W = m.W; this.H = m.H;
    const p = this.player;
    if (!via) { p.x = this.W / 2; p.y = this.H * 0.5; }
    else {
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
    this.visitedMaps.add(mapId);
    this.pushHud(true);
  }

  togglePause() { if (this.dead || this.pendingEvolve || !this.playing) return; this.paused = !this.paused; this.pushHud(true); }
  returnToMenu() {
    this.playing = false; this.paused = false; this.pendingEvolve = false;
    this.biteHeld = false; this.keys = {}; this.pushHud(true);
  }
  setPaused(v) { this.paused = v; }
  canWiki() { return this.playing && !this.dead && !this.pendingEvolve && !this.paused; }
  toggleMute() { this.sfx.muted = !this.sfx.muted; this.pushHud(true); }
  toggleLevels() { this.showLevels = !this.showLevels; this.pushHud(true); }
  toggleInvincible() { if (this.cheatsEnabled) { this.invincible = !this.invincible; this.pushHud(true); } }
  cheatLevelUp() {
    if (!this.cheatsEnabled || !this.player || this.pendingEvolve || this.player.level >= MAX_LEVEL) return;
    this.player.addXp(this, xpNeed(this.player.level) / 2); this.pushHud(true);
  }

  /* ---------------- input (called by ui/input.js) ---------------- */

  setMouse(x, y) { this.mouse.x = x; this.mouse.y = y; }
  setBite(v) { this.biteHeld = v; }
  setKey(k, v) { this.keys[k] = v; }
  useAbility(idx) { activateAbility(this, idx); }
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

  /* Sweep the player, free creatures and drifting food along with the current.
     Bosses are anchored to their leash spot and shrug it off. */
  applyCurrent(dt) {
    if (this.stage !== 'sea') return;
    const p = this.player, cp = this.currentAt(p.x, p.y);
    p.x = clamp(p.x + cp.x * dt, p.radius, this.W - p.radius);
    p.y = clamp(p.y + cp.y * dt, p.radius, this.H - p.radius);
    for (const c of this.creatures) {
      if (c.boss) continue;
      const cc = this.currentAt(c.x, c.y);
      c.x = clamp(c.x + cc.x * dt, c.radius, this.W - c.radius);
      c.y = clamp(c.y + cc.y * dt, c.radius, this.H - c.radius);
    }
    for (const f of this.food) { const cf = this.currentAt(f.x, f.y); f.x += cf.x * dt * 0.8; f.y += cf.y * dt * 0.8; }
  }

  /* Push the player and creatures out of any land obstacle they overlap, and
     kill the velocity component driving them into it (so they slide along). */
  resolveObstacles() {
    if (!this.obstacles.length) return;
    const push = (e) => {
      for (const o of this.obstacles) {
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.sqrt(dx * dx + dy * dy), min = e.radius + o.r;
        if (d < min) {
          const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0, overlap = min - d;
          e.x += nx * overlap; e.y += ny * overlap;
          const vn = e.vx * nx + e.vy * ny;
          if (vn < 0) { e.vx -= vn * nx; e.vy -= vn * ny; }
        }
      }
    };
    push(this.player);
    for (const c of this.creatures) push(c);
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
      if (s.x < -20) { s.x = this.vw + 20; s.px = s.x; } else if (s.x > this.vw + 20) { s.x = -20; s.px = s.x; }
      if (s.y < -20) { s.y = this.vh + 20; s.py = s.y; } else if (s.y > this.vh + 20) { s.y = -20; s.py = s.y; }
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
    if (!p || this.stage !== 'sea' || p.species.evolvesTo.length !== 0) return false;
    return this.availablePioneers().length === 0 && this.availablePioneers(true).length > 0;
  }

  /* Would picking sea species `id` doom the lineage to a shore dead end under
     the current Fantasy setting? True when none of the sea apexes reachable
     from `id` has a land pioneer available to it (but Fantasy on would). Used
     by the evolve modal to warn before you commit to a cnidarian/mollusc road. */
  leadsToLandDeadEnd(id) {
    if (this.fantasyEvolution || speciesStage(id) !== 'sea') return false;
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
    this.pendingEvolve = true; this.paused = true;
    this.choices = this.player.species.evolvesTo.slice();
    this.evolveMode = this.isStageAdvance() ? 'advance' : 'normal';
    this.eggs.push({ x: this.player.x, y: this.player.y + this.player.radius + 10, t: 0 });
    this.sfx.play('egg'); this.pushHud(true);
  }

  /* Offer the crawl-ashore choice (auto the first time, or re-opened by the
     player after they chose to stay in the sea). */
  triggerAscend() {
    this.pendingEvolve = true; this.paused = true; this.evolveMode = 'ascend';
    this.choices = this.availablePioneers();
    this.eggs.push({ x: this.player.x, y: this.player.y + this.player.radius + 10, t: 0 });
    this.sfx.play('egg'); this.pushHud(true);
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
    this.pendingEvolve = false; this.paused = false; this.evolveMode = 'normal';
    this.eggs.length = 0; this.choices = [];
    this.ascendOffered = true; this.ascendAvailable = true;
    this.pushHud(true);
  }

  chooseEvolution(id) {
    if (!this.pendingEvolve) return;
    const fromStage = this.stage, toStage = speciesStage(id);
    this.makePlayer(id); this.era++;
    this.pendingEvolve = false; this.paused = false; this.eggs.length = 0; this.choices = []; this.evolveMode = 'normal'; this.advanceAvailable = false;
    if (toStage !== fromStage) {
      // crawl ashore — enter the new stage's first map
      this.ascendOffered = true; this.ascendAvailable = false;
      this.loadMap(firstMapOf(toStage));
      burst(this, this.player.x, this.player.y, '#c2e89a', 30, 240); this.shake = 10; this.sfx.play('evolve');
    } else {
      burst(this, this.player.x, this.player.y, '#8affd0', 30, 240); this.shake = 8; this.sfx.play('evolve');
      // the world evolves with you: new species become available + harder population
      for (let i = 0; i < 4; i++) spawnRandomNpc(this);
    }
    this.pushHud(true);
  }

  /* ---------------- boss trophies ---------------- */

  grantPerk(id, bossTitle) {
    const perk = PERKS[id]; if (!perk) return;
    if (perk.dmgReduce) this.perks.dmgReduce = Math.min(0.6, this.perks.dmgReduce + perk.dmgReduce);
    if (perk.dodge) this.perks.dodge = Math.min(0.6, this.perks.dodge + perk.dodge);
    if (perk.webResist) this.perks.webResist = Math.min(.85, this.perks.webResist + perk.webResist);
    if (!this.perks.list.some(x => x.id === id)) this.perks.list.push({ id, name: perk.name, icon: perk.icon, color: perk.color, blurb: perk.blurb });
    this.achId++;
    this.achievement = { id: this.achId, boss: bossTitle, perk: perk.name, blurb: perk.blurb, icon: perk.icon, color: perk.color };
    this.achT = 0; this.paused = true;
    this.pushHud(true);
  }

  dismissAdvance() {
    if (this.evolveMode !== 'advance') return;
    this.pendingEvolve = false; this.paused = false; this.evolveMode = 'normal';
    this.eggs.length = 0; this.choices = []; this.advanceAvailable = true;
    this.pushHud(true);
  }
  dismissAchievement() {
    if (!this.achievement) return;
    this.achievement = null; this.paused = false; this.pushHud(true);
  }

  /* Debug hook (window.__game): damage a creature as if the player did it. */
  debugDamage(c, amt) { c.takeDamage(this, amt, c.x, c.y, true); }

  registerPreview(id, el) { if (el) this.previewCanvas[id] = el; }

  /* ---------------- simulation step ---------------- */

  /* Cross to a neighboring map when the player dwells against a connected edge.
     Returns true if a transition happened (caller skips the rest of the frame). */
  maybeCrossEdge(dt) {
    if (this.transitionCd > 0) this.transitionCd -= dt;
    const nb = MAPS[this.mapId].neighbors, p = this.player;
    let via = null;
    if (nb.left && p.x <= p.radius + 6) via = 'left';
    else if (nb.right && p.x >= this.W - p.radius - 6) via = 'right';
    else if (nb.top && p.y <= p.radius + 6) via = 'top';
    else if (nb.bottom && p.y >= this.H - p.radius - 6) via = 'bottom';
    this.nearEdge = via ? MAPS[nb[via]].name : null;
    if (via && this.transitionCd <= 0) {
      this.edgeDwell += dt;
      if (this.edgeDwell > 0.3) { this.loadMap(nb[via], via); return true; }
    } else this.edgeDwell = 0;
    return false;
  }

  update(dt) {
    this.time += dt;
    const p = this.player; if (!p) return;
    this.worldMouse.x = this.cam.x + this.mouse.x; this.worldMouse.y = this.cam.y + this.mouse.y;

    p.update(this, dt);

    if (this.maybeCrossEdge(dt)) return;   // walked off the map edge — new map loaded this frame

    // creatures (list may shrink mid-loop when something dies)
    this.danger = Math.max(0, this.danger - dt * 0.6);
    for (const c of this.creatures) c.update(this, dt);

    this.applyCurrent(dt);   // sea current sweeps player + free creatures + food
    this.resolveObstacles(); // keep player + creatures out of land blockers

    // food pellets: drift, get pulled toward the player, get eaten
    // (Filter Feed widens the pull and makes each pellet nourish more)
    const filterFeed = p.hasAbility('filter');
    const pullR = filterFeed ? 230 : 130;
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i]; f.life -= dt; f.vx *= Math.exp(-dt * 2); f.vy *= Math.exp(-dt * 2);
      const dx = p.x - f.x, dy = p.y - f.y, d = hyp(dx, dy);
      if (d < pullR) { const pull = (1 - d / pullR) * 520; f.vx += dx / (d || 1) * pull * dt; f.vy += dy / (d || 1) * pull * dt; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (d < p.radius + 6) {
        p.addXp(this, f.value); p.hp = Math.min(p.maxHp, p.hp + (filterFeed ? 6 : 3));
        burst(this, f.x, f.y, f.kind === 'meat' ? '#ff9a8a' : '#8fe89a', 5, 80);
        this.sfx.play('eat'); this.food.splice(i, 1); continue;
      }
      if (f.life <= 0) this.food.splice(i, 1);
    }

    // plants regrow slowly
    for (const pl of this.plants) {
      if (pl.eatCd > 0) pl.eatCd -= dt;
      if (pl.amount < pl.max) { pl.regen -= dt; if (pl.regen <= 0) { pl.amount = Math.min(pl.max, pl.amount + 1); pl.regen = 14; } }
    }

    // cosmetic bits
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i]; q.life -= dt; q.vx *= Math.exp(-dt * 3); q.vy *= Math.exp(-dt * 3);
      q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t += dt; if (this.fx[i].t >= this.fx[i].max) this.fx.splice(i, 1); }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const ft = this.floaters[i]; ft.x += ft.vx * dt; ft.y += ft.vy * dt;
      ft.vy *= Math.exp(-dt * 2.4); ft.vx *= Math.exp(-dt * 3); ft.life -= dt;
      if (ft.life <= 0) this.floaters.splice(i, 1);
    }
    for (const e of this.eggs) e.t += dt;
    for (let i = this.webs.length - 1; i >= 0; i--) { const w = this.webs[i]; if (w.life == null) continue; w.life -= dt; if (w.life <= 0) this.webs.splice(i, 1); }
    this.updateFlow(dt);
    for (const b of this.bubbles) {
      b.y -= b.sp * dt; b.x += Math.sin(this.time + b.ph) * 6 * dt;
      if (this.stage === 'sea') { const c = this.currentAt(this.cam.x + b.x, this.cam.y + b.y); b.x += c.x * dt * 0.5; }
      if (b.y < -4) { b.y = this.vh + 4; b.x = Math.random() * this.vw; }
      if (b.x < -12) b.x = this.vw + 12; else if (b.x > this.vw + 12) b.x = -12;
    }

    // max level: evolve within the stage, or (sea apex) offer to crawl ashore
    if (!this.pendingEvolve && !this.dead && !this.advanceAvailable && p.level >= MAX_LEVEL && p.species.evolvesTo.length) this.triggerEvolve();
    else if (!this.pendingEvolve && !this.dead && !this.ascendOffered && this.isSeaApex()) this.triggerAscend();

    // camera follows with a soft lag
    const camtx = clamp(p.x - this.vw / 2, 0, Math.max(0, this.W - this.vw));
    const camty = clamp(p.y - this.vh / 2, 0, Math.max(0, this.H - this.vh));
    this.cam.x = lerp(this.cam.x, camtx, 1 - Math.exp(-dt * 6));
    this.cam.y = lerp(this.cam.y, camty, 1 - Math.exp(-dt * 6));
    this.shake *= Math.exp(-dt * 8);

    spawnMaintain(this, dt);
    this.pushHud();
  }

  render() { renderWorld(this); }

  /* ---------------- HUD snapshots ---------------- */

  /* Publish a plain-data snapshot for React. Rate-limited to every 0.05s of
     sim time unless forced (state transitions force it). */
  pushHud(force) {
    if (!force) { if (this.time - this.hudT < 0.05) return; }
    this.hudT = this.time;
    const p = this.player;
    const abils = p ? p.abilities.map((id, i) => {
      const ab = ABILITIES[id]; const cd = p.acd[id] || 0; const tf = ACTIVE_TIMER[id];
      let active = ab.passive, activeFrac = 0;
      if (tf) { active = p[tf] > 0; activeFrac = ab.dur ? clamp(p[tf] / ab.dur, 0, 1) : 0; }
      return {
        id, name: ab.name, key: i + 1, passive: ab.passive, color: ab.color, desc: ab.desc,
        cd: Math.ceil(cd), cdFrac: ab.cd ? clamp(cd / ab.cd, 0, 1) : 0, ready: cd <= 0, active, activeFrac
      };
    }) : [];
    this.onHud({
      hp: p ? p.hp : 0, maxHp: p ? p.maxHp : 1,
      level: p ? p.level : 1, xp: p ? Math.round(p.xp) : 0, xpNeed: p ? xpNeed(p.level) : 1,
      canEvolve: p ? p.species.evolvesTo.length > 0 : false, showLevels: this.showLevels,
      name: p ? p.species.name : '', branch: p ? p.species.branch : '-', tier: p ? p.species.tier : 0, era: this.era,
      kills: this.kills, dead: this.dead, paused: this.paused, pendingEvolve: this.pendingEvolve, evolveMode: this.evolveMode,
      choices: this.choices.slice(), muted: this.sfx.muted,
      abilities: abils, shield: p ? Math.round(p.shield) : 0, shieldMax: p ? p.shieldMax : 0,
      perks: this.perks.list.map(x => ({ id: x.id, name: x.name, icon: x.icon, color: x.color, blurb: x.blurb })),
      achievement: this.achievement,
      // stage / map
      stage: this.stage, stageName: STAGES[this.stage] ? STAGES[this.stage].name : '',
      mapId: this.mapId, mapName: MAPS[this.mapId] ? MAPS[this.mapId].name : '',
      canAscend: this.isSeaApex(), ascendAvailable: this.ascendAvailable, advanceAvailable: this.advanceAvailable, nearEdge: this.nearEdge,
      landDeadEnd: !!(p && p.level >= MAX_LEVEL && this.isLandDeadEnd()),
      cheatsEnabled: this.cheatsEnabled, invincible: this.invincible
    });
  }
}

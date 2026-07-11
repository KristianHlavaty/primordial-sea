/* The game engine: owns all world state, advances the simulation (update)
   and draws it (render). The React shell drives it from a rAF loop and
   receives UI state through the onHud callback — plain snapshot objects,
   so the UI never reaches into live entities.

   World structure:
   - player            Player entity (entities/Player.js)
   - creatures         Creature/Boss entities
   - plants            edible flora (plain objects; drawn by render/drawPlant.js)
   - food              meat/plant pellets that drift toward the player
   - particles/fx/floaters/eggs/bubbles   cosmetic bits */
import { Player } from './entities/Player.js';
import { ABILITIES, ACTIVE_TIMER } from '../data/abilities.js';
import { PERKS } from '../data/bosses.js';
import { MAX_LEVEL, xpNeed } from '../data/progression.js';
import { clamp, lerp, hyp } from '../core/math.js';
import { spawnInitial, spawnMaintain, spawnRandomNpc } from './systems/spawning.js';
import { activateAbility } from './systems/abilities.js';
import { burst } from './systems/effects.js';
import { renderWorld } from '../render/renderWorld.js';
import { Sfx } from './audio.js';

export class Engine {
  constructor(canvas, { onHud }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHud = onHud;
    this.sfx = new Sfx();

    // world + viewport
    this.W = 4400; this.H = 2700;
    this.vw = 0; this.vh = 0; this.dpr = 1;

    // simulation state
    this.time = 0; this.era = 0;
    this.player = null;
    this.creatures = []; this.plants = []; this.food = [];
    this.particles = []; this.bubbles = []; this.eggs = []; this.fx = []; this.floaters = [];
    this.cam = { x: 0, y: 0 }; this.shake = 0; this.danger = 0;

    // input state (written by ui/input.js)
    this.mouse = { x: 0, y: 0 }; this.worldMouse = { x: 0, y: 0 };
    this.keys = {}; this.biteHeld = false;

    // flow state
    this.playing = false; this.paused = false; this.dead = false;
    this.pendingEvolve = false; this.choices = [];
    this.kills = 0; this.lastHurt = -99; this.spawnT = 0; this.hudT = 0;

    // ages, boss trophies, achievements
    this.age = 0; this.perks = { dmgReduce: 0, dodge: 0, list: [] };
    this.bossesDefeated = new Set(); this.achievement = null; this.achT = 0; this.achId = 0;

    // UI-facing bits
    this.showLevels = true;
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

  start() {
    this.era = 0; this.kills = 0; this.dead = false; this.paused = false; this.pendingEvolve = false; this.choices = [];
    this.age = 0; this.perks = { dmgReduce: 0, dodge: 0, list: [] }; this.bossesDefeated = new Set(); this.achievement = null; this.achT = 0;
    this.creatures.length = 0; this.food.length = 0; this.particles.length = 0; this.eggs.length = 0; this.fx.length = 0; this.floaters.length = 0;
    this.time = 0; this.lastHurt = -99;
    this.player = null; this.makePlayer('protocell');
    this.cam.x = clamp(this.player.x - this.vw / 2, 0, Math.max(0, this.W - this.vw));
    this.cam.y = clamp(this.player.y - this.vh / 2, 0, Math.max(0, this.H - this.vh));
    this.mouse.x = this.vw / 2; this.mouse.y = this.vh / 2;
    spawnInitial(this);
    this.playing = true;
    this.sfx.unlock();
    this.pushHud(true);
  }

  togglePause() { if (this.dead || this.pendingEvolve || !this.playing) return; this.paused = !this.paused; this.pushHud(true); }
  setPaused(v) { this.paused = v; }
  canWiki() { return this.playing && !this.dead && !this.pendingEvolve && !this.paused; }
  toggleMute() { this.sfx.muted = !this.sfx.muted; this.pushHud(true); }
  toggleLevels() { this.showLevels = !this.showLevels; this.pushHud(true); }

  /* ---------------- input (called by ui/input.js) ---------------- */

  setMouse(x, y) { this.mouse.x = x; this.mouse.y = y; }
  setBite(v) { this.biteHeld = v; }
  setKey(k, v) { this.keys[k] = v; }
  useAbility(idx) { activateAbility(this, idx); }

  /* ---------------- evolution ---------------- */

  triggerEvolve() {
    this.pendingEvolve = true; this.paused = true; this.choices = this.player.species.evolvesTo.slice();
    this.eggs.push({ x: this.player.x, y: this.player.y + this.player.radius + 10, t: 0 });
    this.sfx.play('egg'); this.pushHud(true);
  }

  chooseEvolution(id) {
    if (!this.pendingEvolve) return;
    this.makePlayer(id); this.era++;
    this.pendingEvolve = false; this.paused = false; this.eggs.length = 0; this.choices = [];
    burst(this, this.player.x, this.player.y, '#8affd0', 30, 240); this.shake = 8; this.sfx.play('evolve');
    // the world evolves with you: new species become available + harder population
    for (let i = 0; i < 4; i++) spawnRandomNpc(this);
    this.pushHud(true);
  }

  /* ---------------- boss trophies ---------------- */

  grantPerk(id, bossTitle) {
    const perk = PERKS[id]; if (!perk) return;
    if (perk.dmgReduce) this.perks.dmgReduce = Math.min(0.6, this.perks.dmgReduce + perk.dmgReduce);
    if (perk.dodge) this.perks.dodge = Math.min(0.6, this.perks.dodge + perk.dodge);
    if (!this.perks.list.some(x => x.id === id)) this.perks.list.push({ id, name: perk.name, icon: perk.icon, color: perk.color, blurb: perk.blurb });
    this.achId++;
    this.achievement = { id: this.achId, boss: bossTitle, perk: perk.name, blurb: perk.blurb, icon: perk.icon, color: perk.color };
    this.achT = 6.5;
  }

  /* Debug hook (window.__game): damage a creature as if the player did it. */
  debugDamage(c, amt) { c.takeDamage(this, amt, c.x, c.y, true); }

  registerPreview(id, el) { if (el) this.previewCanvas[id] = el; }

  /* ---------------- simulation step ---------------- */

  update(dt) {
    this.time += dt;
    const p = this.player; if (!p) return;
    this.worldMouse.x = this.cam.x + this.mouse.x; this.worldMouse.y = this.cam.y + this.mouse.y;

    p.update(this, dt);

    // creatures (list may shrink mid-loop when something dies)
    this.danger = Math.max(0, this.danger - dt * 0.6);
    for (const c of this.creatures) c.update(this, dt);

    // food pellets: drift, get pulled toward the player, get eaten
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i]; f.life -= dt; f.vx *= Math.exp(-dt * 2); f.vy *= Math.exp(-dt * 2);
      const dx = p.x - f.x, dy = p.y - f.y, d = hyp(dx, dy);
      if (d < 130) { const pull = (1 - d / 130) * 520; f.vx += dx / (d || 1) * pull * dt; f.vy += dy / (d || 1) * pull * dt; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (d < p.radius + 6) {
        p.addXp(this, f.value); p.hp = Math.min(p.maxHp, p.hp + 3);
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
    for (const b of this.bubbles) { b.y -= b.sp * dt; b.x += Math.sin(this.time + b.ph) * 6 * dt; if (b.y < -4) { b.y = this.vh + 4; b.x = Math.random() * this.vw; } }
    if (this.achT > 0) { this.achT -= dt; if (this.achT <= 0) this.achievement = null; }

    // reached max level with somewhere to go -> lay egg & evolve
    if (!this.pendingEvolve && !this.dead && p.level >= MAX_LEVEL && p.species.evolvesTo.length) this.triggerEvolve();

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
      kills: this.kills, dead: this.dead, paused: this.paused, pendingEvolve: this.pendingEvolve,
      choices: this.choices.slice(), muted: this.sfx.muted,
      abilities: abils, shield: p ? Math.round(p.shield) : 0, shieldMax: p ? p.shieldMax : 0,
      perks: this.perks.list.map(x => ({ id: x.id, name: x.name, icon: x.icon, color: x.color, blurb: x.blurb })),
      achievement: this.achievement
    });
  }
}

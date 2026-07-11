/* The player creature. Steered by mouse/WASD, bites with click/space,
   levels up by eating; at MAX_LEVEL it lays an egg and evolves into the
   next species (see Engine.chooseEvolution). */
import { Entity } from './Entity.js';
import { SPECIES } from '../../data/species.js';
import { ABILITY_SETS } from '../../data/abilities.js';
import { MAX_LEVEL, XP_MULT, xpNeed } from '../../data/progression.js';
import { hyp, rand, angLerp } from '../../core/math.js';
import { withA } from '../../core/color.js';
import { burst, addFloater } from '../systems/effects.js';

export class Player extends Entity {
  /* `prev` (the pre-evolution player) carries position and heading over. */
  constructor(speciesId, prev, world) {
    super(prev ? prev.x : world.W / 2, prev ? prev.y : world.H * 0.5);
    const sp = SPECIES[speciesId]; const st = sp.stats;
    this.speciesId = speciesId; this.species = sp; this.plan = sp.plan;
    this.angle = prev ? prev.angle : 0; this.faceTarget = prev ? prev.angle : 0;
    this.hp = st.hp; this.maxHp = st.hp; this.radius = st.radius; this.maxSpeed = st.maxSpeed;
    this.level = 1; this.xp = 0; this.atkMul = 1; this.spdMul = 1;
    this.biteT = 0; this.cd = 0; this.biteAnim = 0; this.hurt = 0; this.mouth = 0; this.hitSet = null;
    this.animOff = 0;
    this.abilities = (ABILITY_SETS[speciesId] || []).slice(); this.acd = {};   // acd = per-ability cooldowns
    this.shield = 0; this.shieldMax = 0; this.shieldT = 0;
    this.enrollT = 0; this.burstT = 0; this.frenzyT = 0; this.bloomT = 0; this.bloomTick = 0;
    this.applyLevelStats(); this.hp = this.maxHp;
  }

  hasAbility(id) { return this.abilities.includes(id); }

  applyLevelStats() {
    const st = this.species.stats, L = this.level - 1;
    this.maxHp = Math.round(st.hp * (1 + L * 0.08)); this.atkMul = 1 + L * 0.06; this.spdMul = 1 + L * 0.02;
  }

  addXp(game, v) {
    if (game.pendingEvolve || game.dead || this.level >= MAX_LEVEL) return;
    this.xp += v * XP_MULT;
    while (this.level < MAX_LEVEL && this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.levelUp(game); }
    if (this.level >= MAX_LEVEL) { this.xp = 0; if (this.species.evolvesTo.length) game.triggerEvolve(); }
  }

  levelUp(game) {
    const old = this.maxHp; this.applyLevelStats();
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - old) + this.maxHp * 0.15);   // heal the added HP + a bonus
    game.fx.push({ x: this.x, y: this.y, t: 0, max: 0.6, R: this.radius + 42, color: '#ffe27a', dir: 'out', width: 4 });
    game.floaters.push({ x: this.x, y: this.y - this.radius - 12, vx: 0, vy: -34, text: 'LEVEL ' + this.level, life: 1.5, max: 1.5, color: '#ffe27a', size: 16 });
    game.shake = Math.min(10, game.shake + 3); game.sfx.play('power');
  }

  /* Bite = a short lunge with an active hit window (biteT). */
  bite(game) {
    if (this.cd > 0) return;
    const st = this.species.stats;
    this.cd = st.dashCd * (this.frenzyT > 0 ? 0.5 : 1); this.biteT = 0.28; this.biteAnim = 1; this.hitSet = new Set();
    this.vx += Math.cos(this.angle) * st.dashPow; this.vy += Math.sin(this.angle) * st.dashPow;
    game.sfx.play('bite');
    const mx = this.x + Math.cos(this.angle) * this.radius, my = this.y + Math.sin(this.angle) * this.radius;
    burst(game, mx, my, '#bfefff', 5, 90);
  }

  /* While the bite window is open, hit everything in the forward arc once
     (hitSet prevents multi-hits from a single bite). */
  resolveBite(game) {
    if (this.biteT <= 0) return;
    const st = this.species.stats;
    const reach = this.radius + st.reach, dmg = st.dmg * this.atkMul * (this.frenzyT > 0 ? 1.6 : 1);
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    for (const c of game.creatures) {
      if (this.hitSet.has(c)) continue;
      const dx = c.x - this.x, dy = c.y - this.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.25) { this.hitSet.add(c); c.takeDamage(game, dmg, this.x, this.y, true); burst(game, c.x, c.y, '#ffdfe4', 6, 120); }
      }
    }
    for (const pl of game.plants) {
      if (pl.amount <= 0 || pl.eatCd > 0 || this.hitSet.has(pl)) continue;
      const dx = pl.x - this.x, dy = pl.y - this.y, d = hyp(dx, dy);
      if (d < reach + 18) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.1) {
          this.hitSet.add(pl); pl.eatCd = 0.9;
          pl.amount--; this.addXp(game, pl.value); this.hp = Math.min(this.maxHp, this.hp + 1);
          burst(game, pl.x, pl.y - 10, '#7fe08a', 6, 80); game.sfx.play('plant');
          pl.regen = pl.amount <= 0 ? 20 : 14;
        }
      }
    }
  }

  /* Incoming bite: enroll makes us invulnerable, evasion/Reflexes may dodge,
     Barbs/Nettle punish the attacker, Ironhide and the shield soak damage. */
  takeHit(game, dmg, fromx, fromy, attacker) {
    if (this.hp <= 0) return;
    if (this.enrollT > 0) { burst(game, this.x, this.y, '#ffe6b0', 4, 60); return; }
    const dodgeCh = (this.hasAbility('evasion') ? 0.25 : 0) + game.perks.dodge;
    if (dodgeCh > 0 && Math.random() < dodgeCh) {
      for (let i = 0; i < 7; i++) game.particles.push({ x: this.x + rand(-6, 6), y: this.y + rand(-6, 6), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.3, max: 0.3, size: 2.2, color: 'rgba(138,255,208,0.75)' });
      game.sfx.play('dodge'); return;
    }
    game.lastHurt = game.time;
    if (this.hasAbility('barbs') && attacker && attacker.hp > 0) {
      attacker.takeDamage(game, dmg * 0.35, this.x, this.y, true);
      burst(game, attacker.x, attacker.y, '#ffb060', 5, 90);
    }
    if (this.hasAbility('nettle') && attacker && attacker.hp > 0) {
      attacker.takeDamage(game, dmg * 0.2, this.x, this.y, true);
      if (!attacker.boss) attacker.stunT = Math.max(attacker.stunT || 0, 0.5);
      burst(game, attacker.x, attacker.y, '#c79bff', 4, 70);
    }
    if (game.perks.dmgReduce) dmg *= (1 - game.perks.dmgReduce);   // Ironhide trophy
    this.knockbackFrom(fromx, fromy, 130);
    if (this.shield > 0) {
      this.shield -= dmg;
      if (this.shield < 0) { dmg = -this.shield; this.shield = 0; } else dmg = 0;
      burst(game, this.x, this.y, '#9fe6ff', 6, 100); game.sfx.play('shieldhit');
    }
    if (dmg > 0) {
      this.hp -= dmg; this.hurt = 1; game.shake = Math.min(14, game.shake + dmg * 0.4);
      game.sfx.play('hurt'); burst(game, this.x, this.y, '#ff6a7a', 8, 120);
      addFloater(game, { x: this.x + rand(-6, 6), y: this.y - this.radius - 4, vx: rand(-16, 16), vy: -48, text: '' + Math.round(dmg), life: 0.9, max: 0.9, color: '#ff6a7a', size: 15 });
      if (this.hp <= 0) {
        this.hp = 0; game.dead = true; game.paused = true;
        burst(game, this.x, this.y, '#ffd2d2', 26, 220); game.pushHud(true);
      }
    }
  }

  /* Per-frame: cooldowns and power timers, input steering, bite, movement,
     active power effects and out-of-combat regeneration. */
  update(game, dt) {
    const st = this.species.stats;
    for (const id in this.acd) { if (this.acd[id] > 0) this.acd[id] = Math.max(0, this.acd[id] - dt); }
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) { this.shieldT = 0; this.shield = 0; } }
    this.enrollT = Math.max(0, this.enrollT - dt); this.burstT = Math.max(0, this.burstT - dt);
    this.frenzyT = Math.max(0, this.frenzyT - dt); this.bloomT = Math.max(0, this.bloomT - dt);
    const enrolled = this.enrollT > 0;
    const accMul = enrolled ? 0.25 : (this.burstT > 0 ? 1.6 : 1);
    const baseSpd = st.maxSpeed * this.spdMul;
    const spdCap = enrolled ? baseSpd * 0.5 : (this.burstT > 0 ? baseSpd * 1.8 : baseSpd);

    // keyboard wins; otherwise steer toward the mouse (dead zone of 24px)
    let ix = 0, iy = 0;
    if (game.keys.left) ix -= 1; if (game.keys.right) ix += 1; if (game.keys.up) iy -= 1; if (game.keys.down) iy += 1;
    let tx = 0, ty = 0, moving = false;
    if (ix || iy) { const l = hyp(ix, iy); tx = ix / l; ty = iy / l; moving = true; }
    else {
      const dx = game.worldMouse.x - this.x, dy = game.worldMouse.y - this.y, l = hyp(dx, dy);
      if (l > 24) { tx = dx / l; ty = dy / l; moving = true; }
    }
    if (moving) { this.vx += tx * st.accel * accMul * dt; this.vy += ty * st.accel * accMul * dt; this.faceTarget = Math.atan2(ty, tx); }
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * st.turn * (this.burstT > 0 ? 1.3 : 1)));

    if (game.biteHeld && !enrolled) this.bite(game);
    this.cd = Math.max(0, this.cd - dt); this.biteT = Math.max(0, this.biteT - dt);
    this.biteAnim = Math.max(0, this.biteAnim - dt * 3); this.mouth = this.biteAnim; this.hurt = Math.max(0, this.hurt - dt * 3);
    this.integrate(game, dt, enrolled ? 3.4 : 2.4, this.biteT > 0 ? spdCap * 2.4 : spdCap);
    this.resolveBite(game);

    // burst-swim wake
    if (this.burstT > 0 && game.particles.length < 300)
      game.particles.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: this.radius * 0.55, color: withA(this.plan.accent, 0.35) });

    // Tentacle Bloom — periodic AoE sting + shove
    if (this.bloomT > 0) {
      this.bloomTick -= dt;
      if (this.bloomTick <= 0) {
        this.bloomTick = 0.35; const R = this.radius + 52;
        for (const c of game.creatures.slice()) {
          if (c.stunT > 0 && !c.boss) continue;
          const d = hyp(c.x - this.x, c.y - this.y);
          if (d < R + c.radius) {
            c.takeDamage(game, 6, this.x, this.y, true);
            const k = 1 - d / (R + c.radius);
            c.vx += (c.x - this.x) / (d || 1) * 180 * k; c.vy += (c.y - this.y) / (d || 1) * 180 * k;
          }
        }
        burst(game, this.x, this.y, '#c9a0ff', 6, 110);
      }
    }

    // passive regen once out of combat
    if (game.time - game.lastHurt > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
  }
}

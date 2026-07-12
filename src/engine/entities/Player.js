/* The player creature. Steered by mouse/WASD, bites with click/space,
   levels up by eating; at MAX_LEVEL it lays an egg and evolves into the
   next species (see Engine.chooseEvolution). */
import { Entity } from './Entity.js';
import { SPECIES } from '../../data/species.js';
import { ABILITY_SETS } from '../../data/abilities.js';
import { MAX_LEVEL, XP_MULT, xpNeed } from '../../data/progression.js';
import { TAU, hyp, rand, angLerp } from '../../core/math.js';
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
    this.withdrawT = 0; this.stealthT = 0; this.ramT = 0; this.jetT = 0; this.ramHit = null;
    this.vortexT = 0; this.vortexTick = 0;
    this.burrowT = 0; this.sprintT = 0;   // land: Burrow (invuln dig), Sprint (haste)
    this.rebirthUsed = false;   // Colony Rebirth fires once per life
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
    const mx = this.x + Math.cos(this.angle) * this.radius, my = this.y + Math.sin(this.angle) * this.radius;
    burst(game, mx, my, '#bfefff', 5, 90);
  }

  /* While the bite window is open, hit everything in the forward arc once
     (hitSet prevents multi-hits from a single bite). */
  resolveBite(game) {
    if (this.biteT <= 0) return;
    const st = this.species.stats;
    const hooked = this.hasAbility('hookarms');
    const reach = this.radius + st.reach * (hooked ? 1.45 : 1), dmg = st.dmg * this.atkMul * (this.frenzyT > 0 ? 1.6 : 1) * (hooked ? 1.18 : 1);
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const hasBloodscent = this.hasAbility('bloodscent'), strongVenom = this.hasAbility('hypervenom'), hasVenom = this.hasAbility('venom') || strongVenom;
    for (const c of game.creatures) {
      if (this.hitSet.has(c)) continue;
      const dx = c.x - this.x, dy = c.y - this.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.25) {
          this.hitSet.add(c);
          let dmgC = dmg;
          if (hasBloodscent && c.hp < c.maxHp * 0.5) dmgC *= 1.3;   // Blood Scent: heavier bites on the wounded
          c.takeDamage(game, dmgC, this.x, this.y, true);
          if (hasVenom && c.hp > 0) {                               // Venom: the sting keeps burning
            c.poisonT = strongVenom ? 4.5 : 3; c.poisonDps = Math.max(c.poisonDps || 0, dmg * (strongVenom ? .42 : .25));
            burst(game, c.x, c.y, '#b0e05e', 4, 70);
          }
          if (hasBloodscent && c.hp <= 0) this.hp = Math.min(this.maxHp, this.hp + 4);   // kill mends you
          burst(game, c.x, c.y, '#ffdfe4', 6, 120);
        }
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
    if (game.invincible) { burst(game, this.x, this.y, '#ff5d68', 3, 45); return; }
    if (this.enrollT > 0) { burst(game, this.x, this.y, '#ffe6b0', 4, 60); return; }
    if (this.burrowT > 0) { burst(game, this.x, this.y, '#c79a5e', 4, 60); return; }   // underground — untouchable
    const dodgeCh = (this.hasAbility('evasion') ? 0.25 : 0) + (this.hasAbility('ampullae') ? .15 : 0) + (this.hasAbility('silksense') ? .14 : 0) + game.perks.dodge;
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
    if (this.hasAbility('thickhide')) dmg *= 0.85;                 // cornified armored skin
    if (this.hasAbility('bastion')) dmg *= 0.82;
    if (this.withdrawT > 0) dmg *= 0.3;                            // tucked into the shell
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
        if (this.hasAbility('rebirth') && !this.rebirthUsed) {
          // Colony Rebirth: the surviving zooids rebuild you and scatter everything nearby
          this.rebirthUsed = true;
          this.hp = Math.round(this.maxHp * 0.45);
          game.lastHurt = game.time;
          for (const c of game.creatures.slice()) {
            const dx = c.x - this.x, dy = c.y - this.y, d = hyp(dx, dy), rr = this.radius + c.radius + 90;
            if (d < rr) { const k = 1 - d / rr; c.vx += dx / (d || 1) * 520 * k; c.vy += dy / (d || 1) * 520 * k; }
          }
          burst(game, this.x, this.y, '#a0ffd8', 30, 260);
          game.fx.push({ x: this.x, y: this.y, t: 0, max: 0.6, R: this.radius + 90, color: '#a0ffd8', dir: 'out', width: 4 });
          addFloater(game, { x: this.x, y: this.y - this.radius - 12, vx: 0, vy: -34, text: 'REBIRTH', life: 1.5, max: 1.5, color: '#a0ffd8', size: 16 });
          game.shake = Math.min(12, game.shake + 6); game.sfx.play('evolve');
        } else {
          this.hp = 0; game.dead = true; game.paused = true;
          burst(game, this.x, this.y, '#ffd2d2', 26, 220); game.pushHud(true);
        }
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
    this.withdrawT = Math.max(0, this.withdrawT - dt); this.stealthT = Math.max(0, this.stealthT - dt);
    this.ramT = Math.max(0, this.ramT - dt); this.jetT = Math.max(0, this.jetT - dt);
    this.vortexT = Math.max(0, this.vortexT - dt);
    this.burrowT = Math.max(0, this.burrowT - dt); this.sprintT = Math.max(0, this.sprintT - dt);
    const enrolled = this.enrollT > 0, withdrawn = this.withdrawT > 0, burrowed = this.burrowT > 0;
    const hasted = this.burstT > 0 || this.sprintT > 0;   // Burst (aquatic) or Sprint (land)
    const accMul = enrolled ? 0.25 : withdrawn ? 0.35 : burrowed ? 1.5 : (hasted ? 1.6 : 1);
    const baseSpd = st.maxSpeed * this.spdMul;
    const spdCap = enrolled ? baseSpd * 0.5 : withdrawn ? baseSpd * 0.55 : burrowed ? baseSpd * 1.5 : (hasted ? baseSpd * 1.8 : baseSpd);
    const webM = 1 - game.webSlowAt(this.x, this.y) * .55 * (1 - (game.perks.webResist || 0));

    // keyboard wins; otherwise steer toward the mouse (dead zone of 24px)
    let ix = 0, iy = 0;
    if (game.keys.left) ix -= 1; if (game.keys.right) ix += 1; if (game.keys.up) iy -= 1; if (game.keys.down) iy += 1;
    let tx = 0, ty = 0, moving = false;
    if (ix || iy) { const l = hyp(ix, iy); tx = ix / l; ty = iy / l; moving = true; }
    else {
      const dx = game.worldMouse.x - this.x, dy = game.worldMouse.y - this.y, l = hyp(dx, dy);
      if (l > 24) { tx = dx / l; ty = dy / l; moving = true; }
    }
    if (moving) { this.vx += tx * st.accel * accMul * webM * dt; this.vy += ty * st.accel * accMul * webM * dt; this.faceTarget = Math.atan2(ty, tx); }
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * st.turn * (hasted ? 1.3 : 1)));

    if (game.biteHeld && !enrolled && !withdrawn && !burrowed) this.bite(game);
    this.cd = Math.max(0, this.cd - dt); this.biteT = Math.max(0, this.biteT - dt);
    this.biteAnim = Math.max(0, this.biteAnim - dt * 3); this.mouth = this.biteAnim; this.hurt = Math.max(0, this.hurt - dt * 3);
    const lunging = this.biteT > 0 || this.jetT > 0 || this.ramT > 0;   // dash windows lift the speed cap
    this.integrate(game, dt, enrolled ? 3.4 : 2.4, (lunging ? spdCap * 2.4 : spdCap) * webM);
    this.resolveBite(game);

    // Ram — shell-first charge: batter everything hit once per charge
    if (this.ramT > 0) {
      for (const c of game.creatures.slice()) {
        if (this.ramHit && this.ramHit.has(c)) continue;
        const dx = c.x - this.x, dy = c.y - this.y, d = hyp(dx, dy);
        if (d < this.radius + c.radius + 4) {
          if (this.ramHit) this.ramHit.add(c);
          c.takeDamage(game, st.dmg * this.atkMul * 1.5, this.x, this.y, true);
          c.vx += dx / (d || 1) * 380; c.vy += dy / (d || 1) * 380;
          game.shake = Math.min(10, game.shake + 2);
        }
      }
      if (game.particles.length < 300)
        game.particles.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: this.radius * 0.5, color: withA(this.plan.accent, 0.4) });
    }

    // Withdraw — mend inside the shell
    if (withdrawn) this.hp = Math.min(this.maxHp, this.hp + 8 * dt);

    // burst-swim / sprint wake
    if (hasted && game.particles.length < 300)
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

    // Whirlpool — the siphon vortex drags the sea inward and grinds it
    if (this.vortexT > 0) {
      const R = 260;
      for (const c of game.creatures.slice()) {
        const dx = this.x - c.x, dy = this.y - c.y, d = hyp(dx, dy);
        if (d < R + c.radius) {
          const k = 1 - d / (R + c.radius);
          const pull = c.boss ? 500 : 2200;   // minibosses resist most of the drag
          c.vx += dx / (d || 1) * pull * k * dt; c.vy += dy / (d || 1) * pull * k * dt;
        }
      }
      this.vortexTick -= dt;
      if (this.vortexTick <= 0) {
        this.vortexTick = 0.45;
        // damage from the creature's own position -> no knockback fighting the drag
        for (const c of game.creatures.slice()) { const d = hyp(c.x - this.x, c.y - this.y); if (d < R + c.radius) c.takeDamage(game, 9, c.x, c.y, true); }
        game.fx.push({ x: this.x, y: this.y, t: 0, max: 0.5, R, color: '#6fd0e8', dir: 'in', width: 3 });
      }
      if (game.particles.length < 300) {
        const a = rand(0, TAU), rr = rand(R * 0.4, R);
        game.particles.push({ x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr, vx: -Math.sin(a) * 140 - Math.cos(a) * 80, vy: Math.cos(a) * 140 - Math.sin(a) * 80, life: 0.5, max: 0.5, size: rand(1.5, 3), color: 'rgba(140,220,240,0.6)' });
      }
    }

    // passive regen once out of combat
    if (game.time - game.lastHurt > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
    // Regenerate — amphibian regrowth that knits wounds even mid-fight
    if (this.hasAbility('regen') && this.hp < this.maxHp) {
      const inCombat = game.time - game.lastHurt < 3;
      this.hp = Math.min(this.maxHp, this.hp + (inCombat ? 5 : 12) * dt);
    }
    if (this.hasAbility('airbreath') && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 7 * dt);
  }
}

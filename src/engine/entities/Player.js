/* The player creature. Steered by mouse/WASD, bites with click/space,
   levels up by eating; at MAX_LEVEL it lays an egg and evolves into the
   next species (see Engine.chooseEvolution). */
import { Entity } from './Entity.js';
import { SPECIES } from '../../data/species.js';
import { ABILITY_SETS } from '../../data/abilities.js';
import { ITEM_SLOT_COUNT } from '../../data/items.js';
import { MAX_LEVEL, XP_MULT, xpNeed } from '../../data/progression.js';
import { TAU, hyp, rand, angLerp } from '../../core/math.js';
import { withA } from '../../core/color.js';
import { burst, addFloater, shakeForPlayer } from '../systems/effects.js';
import { updatePilotedVehicle, damageOccupiedVehicle } from '../systems/vehicles.js';
import { abilityBody, abilityHit, abilityTargets, afterAbilityBite, biteAbilityMultiplier, notePlayerDamage, releaseShellEnergy, updateAbilityRuntime } from '../systems/abilityRuntime.js';

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
    this.items = prev && Array.isArray(prev.items)
      ? prev.items.map(item => item ? { ...item } : null)
      : Array(ITEM_SLOT_COUNT).fill(null);
    this.shield = 0; this.shieldMax = 0; this.shieldT = 0; this.forceFieldT = 0;
    this.enrollT = 0; this.burstT = 0; this.frenzyT = 0; this.bloomT = 0; this.bloomTick = 0;
    this.withdrawT = 0; this.stealthT = 0; this.ramT = 0; this.jetT = 0; this.ramHit = null; this.ramAngle = 0;
    this.vortexT = 0; this.vortexTick = 0; this.vortexX = 0; this.vortexY = 0; this.vortexActive = 0; this.vortexReleased = 1;
    this.graspT = 0; this.graspX = 0; this.graspY = 0;
    this.castAbility = null; this.castT = 0; this.castSeq = 0; this._castSeen = 0;
    this.cameraShakeSeq = 0; this.cameraShakePower = 0; this._cameraShakeSeen = 0;
    this.shockEchoT = 0; this.shockEchoX = 0; this.shockEchoY = 0;
    this.burrowT = 0; this.sprintT = 0;   // land: Burrow (invuln dig), Sprint (haste)
    this.hardenActive = 0; this.hardenStored = 0; this.withdrawStored = 0; this.burstBreach = 0;
    this.engulfT = 0; this.engulfSwallowT = 0; this.engulfTarget = null; this.shockVisualT = 0; this.shockLinks = [];
    this.inkCloudT = 0; this.inkX = 0; this.inkY = 0; this.decoyX = 0; this.decoyY = 0; this.decoyAngle = 0;
    this.impaleT = 0; this.impaleTarget = null; this.impaleAngle = 0; this.impaleReach = 0; this.crushT = 0; this.crushAngle = 0;
    this.leapT = 0; this.leapMax = 0; this.leapKind = null; this.burrowActive = 0; this.pinT = 0; this.pinnedTarget = null;
    this.stompT = 0; this.stompX = 0; this.stompY = 0; this.stompHit = null; this.tailSweepT = 0; this.webT = 0;
    this.sprintMomentum = 0; this.sprintHit = null; this.hookT = 0; this.hookTarget = null;
    this.senseCd = 0; this.evasionFlashT = 0; this.evasionBoostT = 0; this.regenDelay = 0;
    this.filterCombo = 0; this.filterComboT = 0; this.camoCharge = 0; this.camoFlashT = 0;
    this.armorPlates = this.hasAbility('thickhide') ? 3 : 0; this.plateRegenT = 0; this.fortify = 0;
    this.sailHeat = 0; this.airStride = 0; this.barbCharge = 0; this.rebirthT = 0; this.lastHurtT = -99;
    this.poisonT = 0; this.poisonDps = 0; this.poisonTick = 0; this.poisonOwner = null; this.venomStacks = 0; this.venomMarkT = 0;
    this.stunT = 0; this.slowT = 0; this.armorBreakT = 0; this.vulnerableT = 0;
    this.rebirthUsed = false;   // Colony Rebirth fires once per life
    this.kills = 0; this.deaths = 0; this.deadT = 0; this.spawnProtT = 0;   // multiplayer FFA state
    this.mpInvincible = false;  // per-player testing cheat; authoritative on the multiplayer host
    this.mpEvolveChoices = [];  // host-authoritative same-stage choices, empty during normal play
    this.vehicle = null; this.vehicleType = null; this.vehicleNetId = null; this.vehicleCreatureRadius = null;
    this.applyLevelStats(world); this.hp = this.maxHp;
    const tb = world && world.talentBonus;                 // Carapace talent: each new form starts shielded
    if (tb && tb.startShieldPct > 0) { this.shield = Math.round(this.maxHp * tb.startShieldPct); this.shieldMax = this.shield; this.shieldT = 30; }
  }

  hasAbility(id) { return this.abilities.includes(id); }

  /* Movement intent this frame — {tx,ty,moving}. Base reads keyboard, else
     steers toward the world-space mouse (24px dead zone). RemotePlayer overrides
     this to use input arriving over the network. */
  steer(game) {
    if (game.inputSuppressed) return { tx: 0, ty: 0, moving: false };
    let ix = 0, iy = 0;
    if (game.keys.left) ix -= 1; if (game.keys.right) ix += 1; if (game.keys.up) iy -= 1; if (game.keys.down) iy += 1;
    if (ix || iy) { const l = hyp(ix, iy); return { tx: ix / l, ty: iy / l, moving: true }; }
    const dx = game.worldMouse.x - this.x, dy = game.worldMouse.y - this.y, l = hyp(dx, dy);
    if (l > 24) return { tx: dx / l, ty: dy / l, moving: true };
    return { tx: 0, ty: 0, moving: false };
  }
  wantsBite(game) { return game.biteHeld; }

  /* Multiplayer FFA: pop back in at a random spot with brief spawn immunity. */
  respawn(game) {
    this.hp = this.maxHp; this.shield = 0; this.shieldT = 0; this.forceFieldT = 0; this.vx = 0; this.vy = 0;
    this.biteT = 0; this.cd = 0; this.hitSet = null;
    this.enrollT = this.burstT = this.frenzyT = this.withdrawT = this.stealthT = 0;
    this.ramT = this.jetT = this.bloomT = this.vortexT = this.burrowT = this.sprintT = this.graspT = 0;
    this.engulfT = this.engulfSwallowT = this.shockVisualT = this.inkCloudT = this.impaleT = this.crushT = 0;
    this.leapT = this.stompT = this.tailSweepT = this.webT = this.sprintMomentum = this.rebirthT = 0;
    this.engulfTarget = this.impaleTarget = this.hookTarget = null; this.burrowActive = this.hardenActive = 0;
    this.pinnedTarget = null; this.pinT = 0; this.vortexActive = 0; this.vortexReleased = 1;
    this.hardenStored = this.withdrawStored = this.filterCombo = this.camoCharge = this.fortify = this.sailHeat = this.barbCharge = 0;
    this.armorPlates = this.hasAbility('thickhide') ? 3 : 0; this.poisonT = this.poisonDps = this.poisonTick = this.venomStacks = this.venomMarkT = 0; this.poisonOwner = null;
    this.stunT = this.slowT = this.armorBreakT = this.vulnerableT = 0;
    this.castAbility = null; this.castT = 0; this.ramHit = null;
    this.rebirthUsed = false;
    this.vehicle = null; this.vehicleType = null; this.vehicleNetId = null; this.vehicleCreatureRadius = null;
    this.x = game.W * (0.2 + Math.random() * 0.6);
    this.y = game.H * (0.2 + Math.random() * 0.6);
    this.spawnProtT = 2.5;
    burst(game, this.x, this.y, '#a0ffd8', 20, 200);
  }

  applyLevelStats(game) {
    const st = this.species.stats, L = this.level - 1;
    const b = (game && game.talentBonus) || { hpMul: 1, dmgMul: 1, spdMul: 1 };
    this.maxHp = Math.round(st.hp * (1 + L * 0.08) * b.hpMul);
    this.atkMul = (1 + L * 0.06) * b.dmgMul;
    this.spdMul = (1 + L * 0.02) * b.spdMul;
  }

  addXp(game, v) {
    if (game.pendingEvolve || game.dead || this.level >= MAX_LEVEL) return;
    this.xp += v * XP_MULT * (game.talentBonus ? game.talentBonus.xpMul : 1);
    while (this.level < MAX_LEVEL && this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.levelUp(game); }
    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      if (game.mp && game.mp.role === 'host') game.queueMpEvolution(this);
      else if (this.species.evolvesTo.length && !game.mp) game.triggerEvolve();
    }
  }

  levelUp(game) {
    const old = this.maxHp; this.applyLevelStats(game);
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - old) + this.maxHp * 0.15);   // heal the added HP + a bonus
    if (!game.mp) game.gainTalentPoint();   // a talent point for this stage's tree (single-player only)
    game.fx.push({ x: this.x, y: this.y, t: 0, max: 0.6, R: this.radius + 42, color: '#ffe27a', dir: 'out', width: 4 });
    game.floaters.push({ x: this.x, y: this.y - this.radius - 12, vx: 0, vy: -34, text: 'LEVEL ' + this.level, life: 1.5, max: 1.5, color: '#ffe27a', size: 16 });
    game.shake = Math.min(10, game.shake + 3); game.sfx.play('power');
  }

  /* Bite = a short lunge with an active hit window (biteT). */
  bite(game) {
    if (this.cd > 0) return;
    const st = this.species.stats;
    const frenzy = this.frenzyT > 0;
    this.cd = st.dashCd * (frenzy ? 0.38 : 1) * (this.evasionBoostT > 0 ? .72 : 1) * (game.talentBonus ? game.talentBonus.dashCdMul : 1); this.biteT = 0.28; this.biteAnim = 1; this.hitSet = new Set();
    this.vx += Math.cos(this.angle) * st.dashPow * (frenzy ? 1.18 : 1); this.vy += Math.sin(this.angle) * st.dashPow * (frenzy ? 1.18 : 1);
    const mx = this.x + Math.cos(this.angle) * this.radius, my = this.y + Math.sin(this.angle) * this.radius;
    burst(game, mx, my, '#bfefff', 5, 90);
  }

  /* While the bite window is open, hit everything in the forward arc once
     (hitSet prevents multi-hits from a single bite). */
  resolveBite(game) {
    if (this.biteT <= 0) return;
    const st = this.species.stats;
    const hooked = this.hasAbility('hookarms'), frenzy = this.frenzyT > 0;
    const reach = this.radius * (frenzy ? 1.28 : 1) + st.reach * (hooked ? 1.45 : 1) * (frenzy ? 1.15 : 1);
    const dmg = st.dmg * this.atkMul * (frenzy ? 1.9 : 1) * (hooked ? 1.18 : 1);
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const hasBloodscent = this.hasAbility('bloodscent');
    for (const c of game.creatures) {
      if (this.hitSet.has(c)) continue;
      const dx = c.x - this.x, dy = c.y - this.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.25) {
          this.hitSet.add(c);
          let dmgC = dmg * biteAbilityMultiplier(this, c);
          if (hasBloodscent && c.hp < c.maxHp * 0.5) dmgC *= 1.3;   // Blood Scent: heavier bites on the wounded
          if (this.burstT > 0 && this.burstBreach) { dmgC *= 1.7; this.burstBreach = 0; c.vx += fx * 480; c.vy += fy * 480; }
          c.takeDamage(game, dmgC, this.x, this.y, true);
          afterAbilityBite(game, this, c);
          if (hasBloodscent && c.hp <= 0) this.hp = Math.min(this.maxHp, this.hp + 4);   // kill mends you
          if (c.hp <= 0 && game.talentBonus.killHeal) this.hp = Math.min(this.maxHp, this.hp + game.talentBonus.killHeal);   // Bloodfeast talent
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
    // multiplayer FFA: bites also strike other players (host authoritative)
    if (game.mp && game.mp.role === 'host') {
      for (const other of game.allPlayers()) {
        if (other === this || other.deadT > 0 || this.hitSet.has(other)) continue;
        const dx = other.x - this.x, dy = other.y - this.y, d = hyp(dx, dy);
        if (d < reach + other.radius) {
          const dot = (dx * fx + dy * fy) / (d || 1);
          if (dot > 0.25) {
            this.hitSet.add(other);
            let hitDamage = dmg * biteAbilityMultiplier(this, other);
            if (this.burstT > 0 && this.burstBreach) { hitDamage *= 1.7; this.burstBreach = 0; other.vx += fx * 480; other.vy += fy * 480; }
            other.takeHit(game, hitDamage, this.x, this.y, this); afterAbilityBite(game, this, other);
            if (other.hp <= 0 && this.hasAbility('bloodscent')) this.hp = Math.min(this.maxHp, this.hp + 6);
            burst(game, other.x, other.y, '#ffdfe4', 6, 120);
          }
        }
      }
    }
  }

  /* Incoming bite: enroll makes us invulnerable, evasion/Reflexes may dodge,
     Barbs/Nettle punish the attacker, Ironhide and the shield soak damage. */
  // Creature retaliation calls takeDamage(). Players expose the same small
  // interface so reflected damage is safe in multiplayer PvP without causing
  // another retaliation chain.
  takeDamage(game, dmg, fromx, fromy) { this.takeHit(game, dmg, fromx, fromy, null); }

  takeHit(game, dmg, fromx, fromy, attacker) {
    if (this.hp <= 0 || this.deadT > 0) return;
    if (this.rebirthT > 0) { burst(game, this.x, this.y, '#a0ffd8', 4, 55); return; }
    if (this.spawnProtT > 0 || (this.mpEvolveChoices && this.mpEvolveChoices.length)) { burst(game, this.x, this.y, '#a0ffd8', 3, 45); return; }   // respawning or choosing an evolution
    if (game.mp ? this.mpInvincible : game.invincible) { burst(game, this.x, this.y, '#ff5d68', 3, 45); return; }
    if (this.vehicle && damageOccupiedVehicle(game, this, dmg)) return;
    if (this.enrollT > 0) { burst(game, this.x, this.y, '#ffe6b0', 4, 60); return; }
    if (this.burrowT > 0) { burst(game, this.x, this.y, '#c79a5e', 4, 60); return; }   // underground — untouchable
    const ampReady = this.hasAbility('ampullae') && this.senseCd <= 0, silkReady = this.hasAbility('silksense') && this.senseCd <= 0;
    const dodgeCh = (this.hasAbility('evasion') ? 0.25 : 0) + game.perks.dodge + (game.talentBonus ? game.talentBonus.dodge : 0);
    if (ampReady || silkReady || (dodgeCh > 0 && Math.random() < dodgeCh)) {
      if (ampReady || silkReady) this.senseCd = silkReady ? 4.5 : 5;
      this.evasionFlashT = .5; this.evasionBoostT = 1.15;
      if (silkReady && attacker && !attacker.boss) attacker.slowT = Math.max(attacker.slowT || 0, 1.2);
      for (let i = 0; i < 7; i++) game.particles.push({ x: this.x + rand(-6, 6), y: this.y + rand(-6, 6), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.3, max: 0.3, size: 2.2, color: 'rgba(138,255,208,0.75)' });
      game.sfx.play('dodge'); return;
    }
    game.lastHurt = game.time; this.lastHurtT = game.time;
    if (this.hasAbility('barbs') && attacker && attacker.hp > 0) {
      attacker.takeDamage(game, dmg * 0.35, this.x, this.y, true);
      burst(game, attacker.x, attacker.y, '#ffb060', 5, 90);
    }
    if (this.hasAbility('nettle') && attacker && attacker.hp > 0) {
      attacker.takeDamage(game, dmg * 0.2, this.x, this.y, true);
      if (!attacker.boss) attacker.stunT = Math.max(attacker.stunT || 0, 0.5);
      attacker.vulnerableT = Math.max(attacker.vulnerableT || 0, 3.5);
      burst(game, attacker.x, attacker.y, '#c79bff', 4, 70);
    }
    const dr = Math.min(0.8, (game.perks.dmgReduce || 0) + (game.talentBonus ? game.talentBonus.dmgReduce : 0));   // boss trophy + talents
    if (dr) dmg *= (1 - dr);
    if (this.hasAbility('thickhide')) dmg *= this.armorPlates > 0 ? 0.72 : 0.92;
    if (this.hasAbility('bastion')) dmg *= 1 - .28 * (this.fortify || 0);
    if (this.withdrawT > 0) dmg *= 0.3;                            // tucked into the shell
    if (this.armorBreakT > 0) dmg *= 1.22;
    if (this.vulnerableT > 0) dmg *= 1.15;
    notePlayerDamage(this, dmg);
    this.knockbackFrom(fromx, fromy, 130 * (1 - .72 * (this.fortify || 0)));
    if (this.shield > 0) {
      this.shield -= dmg;
      if (this.shield < 0) { dmg = -this.shield; this.shield = 0; this.forceFieldT = 0; } else dmg = 0;
      if (this.shield <= 0) this.forceFieldT = 0;
      burst(game, this.x, this.y, '#9fe6ff', 6, 100); game.sfx.play('shieldhit');
    }
    if (dmg > 0) {
      this.hp -= dmg; this.hurt = 1; game.shake = Math.min(14, game.shake + dmg * 0.4);
      game.sfx.play('hurt'); burst(game, this.x, this.y, '#ff6a7a', 8, 120);
      addFloater(game, { x: this.x + rand(-6, 6), y: this.y - this.radius - 4, vx: rand(-16, 16), vy: -48, text: '' + Math.round(dmg), life: 0.9, max: 0.9, color: '#ff6a7a', size: 15 });
      if (this.hp <= 0) {
        if (game.mp && !(this.hasAbility('rebirth') && !this.rebirthUsed)) { this.hp = 0; game.mpPlayerDied(this, attacker); return; }   // FFA: respawn instead of ending the run
        if (this.hasAbility('rebirth') && !this.rebirthUsed) {
          // Colony Rebirth: the surviving zooids rebuild you and scatter everything nearby
          this.rebirthUsed = true;
          this.hp = Math.round(this.maxHp * 0.45);
          game.lastHurt = game.time; this.lastHurtT = game.time; this.rebirthT = 1.4;
          for (const target of abilityTargets(game, this)) {
            const body = abilityBody(target), targetR = body.radius || target.radius || 12, dx = body.x - this.x, dy = body.y - this.y, d = hyp(dx, dy), rr = this.radius + targetR + 90;
            if (d < rr) { const k = 1 - d / rr; body.vx += dx / (d || 1) * 520 * k; body.vy += dy / (d || 1) * 520 * k; }
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
  releaseShockAfterglow(game) {
    const bonus = game.talentBonus ? game.talentBonus.shockEchoPower : 0;
    const power = 1 + bonus, R = 330 + bonus * 55, x = this.shockEchoX, y = this.shockEchoY;
    for (const target of abilityTargets(game, this)) {
      const body = abilityBody(target), dx = body.x - x, dy = body.y - y, d = hyp(dx, dy), targetR = body.radius || target.radius || 12;
      if (d >= R + targetR) continue;
      if (target.boss) target.slowT = Math.max(target.slowT || 0, 3.2 + bonus * 2);
      else { target.stunT = Math.max(target.stunT || 0, 1.6 + bonus); abilityHit(game, this, target, 9 * power, x, y); }
      const force = (220 + bonus * 260) * (target.boss ? .25 : 1), falloff = Math.max(.18, 1 - d / (R + targetR));
      body.vx += dx / (d || 1) * force * falloff; body.vy += dy / (d || 1) * force * falloff;
    }
    game.fx.push({ x, y, t: 0, max: .62, R, color: '#82f7ff', dir: 'out', width: 7 });
    game.fx.push({ x, y, t: 0, max: .82, R: R * .78, color: '#e5ffff', dir: 'out', width: 3 });
    burst(game, x, y, '#82f7ff', 24, 240);
    addFloater(game, { x, y: y - this.radius - 18, vx: 0, vy: -34, text: 'AFTERGLOW', life: 1.1, max: 1.1, color: '#a6fbff', size: 14 });
    game.shake = Math.min(16, game.shake + 6); game.sfx.play('power');
  }

  update(game, dt) {
    if (this.deadT > 0) {              // multiplayer: dead & respawning — inert until the timer ends
      this.deadT = Math.max(0, this.deadT - dt);
      if (this.deadT > 0) return;
      this.respawn(game);
    }
    if (this.spawnProtT > 0) this.spawnProtT = Math.max(0, this.spawnProtT - dt);
    const st = this.species.stats;
    for (const id in this.acd) { if (this.acd[id] > 0) this.acd[id] = Math.max(0, this.acd[id] - dt); }
    const wasWithdrawn = this.withdrawT > 0;
    if (this.shieldT > 0) {
      this.shieldT -= dt; this.forceFieldT = Math.min(this.forceFieldT, Math.max(0, this.shieldT));
      if (this.shieldT <= 0) { this.shieldT = 0; this.shield = 0; this.forceFieldT = 0; }
    }
    this.enrollT = Math.max(0, this.enrollT - dt); this.burstT = Math.max(0, this.burstT - dt);
    this.frenzyT = Math.max(0, this.frenzyT - dt); this.bloomT = Math.max(0, this.bloomT - dt);
    this.withdrawT = Math.max(0, this.withdrawT - dt); this.stealthT = Math.max(0, this.stealthT - dt);
    this.ramT = Math.max(0, this.ramT - dt); this.jetT = Math.max(0, this.jetT - dt);
    this.vortexT = Math.max(0, this.vortexT - dt);
    this.graspT = Math.max(0, this.graspT - dt);
    this.castT = Math.max(0, this.castT - dt);
    if (this.shockEchoT > 0) { this.shockEchoT -= dt; if (this.shockEchoT <= 0) { this.shockEchoT = 0; this.releaseShockAfterglow(game); } }
    this.burrowT = Math.max(0, this.burrowT - dt); this.sprintT = Math.max(0, this.sprintT - dt); this.webT = Math.max(0, this.webT - dt);
    this.armorBreakT = Math.max(0, (this.armorBreakT || 0) - dt); this.vulnerableT = Math.max(0, (this.vulnerableT || 0) - dt);
    this.stunT = Math.max(0, (this.stunT || 0) - dt); this.slowT = Math.max(0, (this.slowT || 0) - dt);
    if (wasWithdrawn && this.withdrawT <= 0) releaseShellEnergy(game, this, 'withdraw');
    if (this.vehicle) {
      updatePilotedVehicle(game, this, dt);
      this.cd = Math.max(0, this.cd - dt); this.biteT = Math.max(0, this.biteT - dt);
      return;
    }
    const enrolled = this.enrollT > 0, withdrawn = this.withdrawT > 0, burrowed = this.burrowT > 0, ramming = this.ramT > 0, frenzy = this.frenzyT > 0;
    const hasted = this.burstT > 0 || this.sprintT > 0;   // Burst (aquatic) or Sprint (land)
    const stunned = this.stunT > 0, slowed = this.slowT > 0;
    const accMul = stunned ? .08 : enrolled ? .9 : withdrawn ? 0.35 : burrowed ? 1.5 : (hasted ? 1.6 : 1);
    const baseSpd = st.maxSpeed * this.spdMul * (this.hasAbility('sail') ? 1.08 : 1) * (frenzy ? 1.12 : 1);   // sun-warmed muscles drive harder
    const enrollSpeedCap = Math.max(680, baseSpd * 3.2);
    const spdCap = (enrolled ? enrollSpeedCap : withdrawn ? baseSpd * 0.55 : burrowed ? baseSpd * 1.5 : (hasted ? baseSpd * 1.8 : baseSpd)) * (stunned ? .22 : slowed ? .58 : 1);
    const webRes = Math.min(0.95, (game.perks.webResist || 0) + (game.talentBonus ? game.talentBonus.webResist : 0));
    const webM = 1 - game.webSlowAt(this.x, this.y) * .55 * (1 - webRes);

    // steering intent (local: keyboard/mouse; remote: network input)
    if (ramming) {
      const ramSpeed = Math.max(1500, baseSpd * 5.2);
      this.faceTarget = this.ramAngle; this.angle = angLerp(this.angle, this.ramAngle, 1 - Math.exp(-dt * 24));
      this.vx = Math.cos(this.ramAngle) * ramSpeed; this.vy = Math.sin(this.ramAngle) * ramSpeed;
    } else {
      const mv = this.steer(game);
      if (mv.moving) { this.vx += mv.tx * st.accel * accMul * webM * dt; this.vy += mv.ty * st.accel * accMul * webM * dt; this.faceTarget = Math.atan2(mv.ty, mv.tx); }
      this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * st.turn * (hasted ? 1.3 : 1)));
    }

    if (this.wantsBite(game) && !enrolled && !withdrawn && !burrowed && !ramming && !stunned && !(this.leapT > 0)) this.bite(game);
    this.cd = Math.max(0, this.cd - dt); this.biteT = Math.max(0, this.biteT - dt);
    this.biteAnim = Math.max(0, this.biteAnim - dt * 3); this.mouth = this.biteAnim; this.hurt = Math.max(0, this.hurt - dt * 3);
    if (enrolled && !stunned) {
      const rollSpeed = hyp(this.vx, this.vy), minimumRoll = Math.min(enrollSpeedCap * .78, Math.max(460, baseSpd * 2.2));
      const rollAngle = rollSpeed > 35 ? Math.atan2(this.vy, this.vx) : this.angle;
      if (rollSpeed < minimumRoll) { this.vx = Math.cos(rollAngle) * minimumRoll; this.vy = Math.sin(rollAngle) * minimumRoll; }
    }
    const lunging = this.biteT > 0 || this.jetT > 0 || this.ramT > 0;   // dash windows lift the speed cap
    const ramSpeedCap = Math.max(1550, baseSpd * 5.5);
    this.integrate(game, dt, ramming ? .35 : enrolled ? .42 : 2.4, (ramming ? ramSpeedCap : lunging ? spdCap * 2.4 : spdCap) * webM);
    this.resolveBite(game);

    // Ram — shell-first charge: batter everything hit once per charge
    if (this.ramT > 0) {
      for (const target of abilityTargets(game, this)) {
        if (this.ramHit && this.ramHit.has(target)) continue;
        const body = abilityBody(target), dx = body.x - this.x, dy = body.y - this.y, d = hyp(dx, dy), targetR = body.radius || target.radius || 12;
        if (d < this.radius * 1.25 + targetR + 8) {
          if (this.ramHit) this.ramHit.add(target);
          abilityHit(game, this, target, st.dmg * this.atkMul * (target.boss ? 2 : 2.5), this.x, this.y);
          body.vx += dx / (d || 1) * 780; body.vy += dy / (d || 1) * 780;
          if (!target.boss) target.stunT = Math.max(target.stunT || 0, .8);
          game.fx.push({ x: body.x, y: body.y, t: 0, max: .45, R: this.radius + targetR + 45, color: '#ffb36a', dir: 'out', width: 6 });
          burst(game, body.x, body.y, '#ffe0b8', 28, 330);
          shakeForPlayer(game, this, 12);
          if (!game.mp || this === game.player) game.sfx.play('ram_hit');
        }
      }
      if (game.particles.length < 300) {
        const side = rand(-this.radius * .55, this.radius * .55), ca = Math.cos(this.ramAngle), sa = Math.sin(this.ramAngle);
        game.particles.push({ x: this.x - ca * this.radius + -sa * side, y: this.y - sa * this.radius + ca * side, vx: -ca * rand(180, 360), vy: -sa * rand(180, 360), life: .38, max: .38, size: rand(3, 7), color: 'rgba(255,190,115,.72)' });
      }
    }

    // Withdraw — mend inside the shell
    if (withdrawn) this.hp = Math.min(this.maxHp, this.hp + 14 * dt);

    // burst-swim / sprint wake
    if (hasted && game.particles.length < 300)
      game.particles.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: this.radius * 0.55, color: withA(this.plan.accent, 0.35) });
    if (frenzy && game.particles.length < 300)
      game.particles.push({ x: this.x + rand(-this.radius, this.radius), y: this.y + rand(-this.radius, this.radius), vx: rand(-35, 35), vy: rand(-55, 20), life: .35, max: .35, size: rand(2, 5), color: 'rgba(255,55,75,.72)' });

    // Tentacle Bloom — periodic AoE sting + shove
    if (this.bloomT > 0) {
      this.bloomTick -= dt;
      if (this.bloomTick <= 0) {
        this.bloomTick = 0.35; const R = this.radius + 115;
        const targets = abilityTargets(game, this).map(target => ({ target, body: abilityBody(target), d: hyp(abilityBody(target).x - this.x, abilityBody(target).y - this.y) }))
          .filter(entry => entry.d < R + (entry.body.radius || entry.target.radius || 0)).sort((a, b) => a.d - b.d).slice(0, 4);
        this.bloomPoints = targets.map(entry => ({ x: entry.body.x, y: entry.body.y }));
        for (let i = 0; i < targets.length; i++) {
          const { target, body, d } = targets[i];
          abilityHit(game, this, target, Math.max(7, st.dmg * this.atkMul * .27), this.x, this.y);
          const inward = i === 0 ? -1 : 1, k = Math.max(.12, 1 - d / (R + (body.radius || 0)));
          body.vx += (body.x - this.x) / (d || 1) * 240 * k * inward; body.vy += (body.y - this.y) / (d || 1) * 240 * k * inward;
        }
        burst(game, this.x, this.y, '#c9a0ff', 6, 110);
      }
    }

    // Whirlpool — the siphon vortex drags the sea inward and grinds it
    if (this.vortexT > 0) {
      const R = 260, vx = this.vortexX || this.x, vy = this.vortexY || this.y;
      for (const target of abilityTargets(game, this)) {
        const body = abilityBody(target), dx = vx - body.x, dy = vy - body.y, d = hyp(dx, dy);
        if (d < R + (body.radius || target.radius || 0)) {
          const k = 1 - d / (R + (body.radius || target.radius || 0));
          const pull = target.boss ? 500 : 2200;
          body.vx += dx / (d || 1) * pull * k * dt; body.vy += dy / (d || 1) * pull * k * dt;
        }
      }
      this.vortexTick -= dt;
      if (this.vortexTick <= 0) {
        this.vortexTick = 0.45;
        // damage from the creature's own position -> no knockback fighting the drag
        for (const target of abilityTargets(game, this)) { const body = abilityBody(target), d = hyp(body.x - vx, body.y - vy); if (d < R + (body.radius || target.radius || 0)) abilityHit(game, this, target, Math.max(9, st.dmg * this.atkMul * .18), body.x, body.y); }
        game.fx.push({ x: vx, y: vy, t: 0, max: 0.5, R, color: '#6fd0e8', dir: 'in', width: 3 });
      }
      if (game.particles.length < 300) {
        const a = rand(0, TAU), rr = rand(R * 0.4, R);
        game.particles.push({ x: vx + Math.cos(a) * rr, y: vy + Math.sin(a) * rr, vx: -Math.sin(a) * 140 - Math.cos(a) * 80, vy: Math.cos(a) * 140 - Math.sin(a) * 80, life: 0.5, max: 0.5, size: rand(1.5, 3), color: 'rgba(140,220,240,0.6)' });
      }
    }

    updateAbilityRuntime(game, this, dt);

    // passive regen once out of combat
    if (game.time - this.lastHurtT > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
    // Mending talent — steady regeneration, in and out of combat
    if (game.talentBonus && game.talentBonus.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + game.talentBonus.regen * dt);
    // Regenerate — amphibian regrowth that knits wounds even mid-fight
    if (this.hasAbility('regen') && this.hp < this.maxHp && this.regenDelay <= 0) this.hp = Math.min(this.maxHp, this.hp + 14 * dt);
    // Basking Sail — sun-warmed metabolism mends wounds, faster out of combat
    if (this.hasAbility('sail') && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + (2 + this.sailHeat * 7) * dt);
    }
  }
}

/* An NPC animal. Behavior depends on its role:
   - prey     flees anything bigger (including the player)
   - predator hunts the nearest edible target (player or smaller creature)
   - drifter  floats about and stings on contact (jellies)
   Bosses subclass this and override act()/die(). */
import { Entity } from './Entity.js';
import { NPCS } from '../../data/npcs.js';
import { TAU, clamp, hyp, rand, randInt, angLerp } from '../../core/math.js';
import { jitter, withA } from '../../core/color.js';
import { burst, addFloater } from '../systems/effects.js';

export class Creature extends Entity {
  constructor(x, y) {
    super(x, y);
    this.boss = false;
    this.stunT = 0; this.slowT = 0; this.hardenT = 0;   // status timers (Shock/Engulf stun, boss slow/harden)
    this.mouth = 0; this.hurt = 0; this.hpBarT = 0;
  }

  /* Build an NPC of the given species; stats scale with era so higher-era
     seas hold higher-level animals. */
  static spawn(key, x, y, era) {
    const s = NPCS[key]; const scale = rand(0.82, 1.18);
    const level = clamp(1 + randInt(0, 2) + era, 1, 10); const lvS = 1 + (level - 1) * 0.14;
    const plan = Object.assign({}, s.plan);
    plan.body = jitter(s.plan.body, 14); plan.accent = jitter(s.plan.accent, 10);
    const c = new Creature(x, y);
    Object.assign(c, {
      key, kind: s.plan.kind, plan, role: s.role,
      angle: rand(0, TAU), faceTarget: rand(0, TAU),
      radius: s.radius * scale, scale, maxHp: s.hp * lvS * scale, hp: s.hp * lvS * scale, dmg: s.dmg * lvS,
      accel: s.accel, maxSpeed: s.maxSpeed * (1 + (level - 1) * 0.03), sense: s.sense, aggro: !!s.aggro, floaty: s.floaty || 0,
      meat: s.meat, value: s.value, biteCd: rand(0, 1), wanderT: 0, wx: rand(-1, 1), wy: rand(-1, 1),
      level, animOff: rand(0, 100),
    });
    return c;
  }

  takeDamage(game, dmg, fromx, fromy, byPlayer) {
    if (this.hardenT > 0) dmg *= 0.3;                    // hardened boss shell soaks most of it
    this.hp -= dmg; this.hurt = 1; this.hpBarT = 3;
    if (byPlayer) {
      const big = dmg >= 24;
      addFloater(game, { x: this.x + rand(-6, 6), y: this.y - this.radius - 4, vx: rand(-16, 16), vy: -48, text: '' + Math.round(dmg), life: 0.9, max: 0.9, color: big ? '#ffb14e' : '#ffffff', size: big ? 18 : 14 });
    }
    this.knockbackFrom(fromx, fromy, 140);
    if (this.hp <= 0) this.die(game, byPlayer);
  }

  die(game, byPlayer) {
    burst(game, this.x, this.y, withA(this.plan.body, 1), 12, 160);
    this.dropMeat(game);
    const idx = game.creatures.indexOf(this); if (idx >= 0) game.creatures.splice(idx, 1);
    if (byPlayer) { game.kills++; game.sfx.play('kill'); }
  }

  /* Scatter this creature's worth as meat pellets. */
  dropMeat(game) {
    const chunks = Math.max(1, Math.min(5, this.radius / 6 | 0)); const per = this.value / chunks;
    for (let i = 0; i < chunks; i++) {
      const a = rand(0, TAU), s = rand(20, 80);
      game.food.push({ x: this.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value: per, kind: 'meat', life: 16, r: rand(3, 5) });
    }
  }

  update(game, dt) {
    this.hurt = Math.max(0, this.hurt - dt * 3); this.mouth = Math.max(0, this.mouth - dt * 3);
    this.biteCd = Math.max(0, this.biteCd - dt); this.wanderT -= dt;
    if (this.hpBarT > 0) this.hpBarT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    // player Venom — burns on after the bite
    if ((this.poisonT || 0) > 0) {
      this.poisonT -= dt; this.hp -= (this.poisonDps || 0) * dt; this.hpBarT = Math.max(this.hpBarT, 1.2);
      if (game.particles.length < 300 && Math.random() < dt * 6)
        game.particles.push({ x: this.x + rand(-6, 6), y: this.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-30, -6), life: 0.5, max: 0.5, size: 2, color: 'rgba(176,224,94,0.7)' });
      if (this.hp <= 0) { this.die(game, true); return; }
    }
    if (this.stunT > 0 && !this.boss) { this.integrate(game, dt, 5); return; }   // paralyzed by Shock/Engulf — frozen
    if (this.wanderT <= 0) { this.wanderT = rand(0.7, 2.0); this.wx = rand(-1, 1); this.wy = rand(-1, 1) - this.floaty; }
    this.act(game, dt);
  }

  /* Role AI — steering, target selection and biting. */
  act(game, dt) {
    const p = game.player;
    let ax = this.wx, ay = this.wy, sc = 0.4;
    const pdx = p.x - this.x, pdy = p.y - this.y, pd = hyp(pdx, pdy);
    // Chromatophores halve how far others notice the player; Ink hides them completely
    const senseVsPlayer = p.hasAbility('camo') ? this.sense * 0.5 : this.sense;
    const playerHidden = p.stealthT > 0;
    if (this.role === 'predator' && this.aggro) {
      // hunt nearest edible (player or smaller creature)
      let tgt = null, td = this.sense;
      if (pd < senseVsPlayer && p.radius <= this.radius * 1.3 && !playerHidden) { tgt = 'player'; td = pd; }
      for (const o of game.creatures) {
        if (o === this) continue; if (o.radius > this.radius * 1.05) continue;
        const d = hyp(o.x - this.x, o.y - this.y); if (d < td) { td = d; tgt = o; }
      }
      if (tgt) {
        const t = tgt === 'player' ? p : tgt; const dx = t.x - this.x, dy = t.y - this.y, d = hyp(dx, dy) || 1; ax = dx / d; ay = dy / d; sc = 1;
        this.faceTarget = Math.atan2(ay, ax);
        if (d < this.radius + t.radius + 8 && this.biteCd <= 0) {
          this.biteCd = 0.8; this.mouth = 1;
          if (tgt === 'player') { p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1; }
          else t.takeDamage(game, this.dmg, this.x, this.y, false);
        }
      }
    } else if (this.role === 'prey') {
      // flee threats
      let fx = 0, fy = 0, threat = false;
      if (pd < senseVsPlayer && p.radius >= this.radius * 0.85 && !playerHidden) { fx -= pdx / (pd || 1); fy -= pdy / (pd || 1); threat = true; }
      for (const o of game.creatures) {
        if (o === this || o.radius < this.radius * 1.05) continue;
        const dx = o.x - this.x, dy = o.y - this.y, d = hyp(dx, dy);
        if (d < this.sense) { fx -= dx / (d || 1); fy -= dy / (d || 1); threat = true; }
      }
      if (threat) { const l = hyp(fx, fy) || 1; ax = fx / l; ay = fy / l; sc = 1; this.faceTarget = Math.atan2(ay, ax); }
      else this.faceTarget = Math.atan2(this.wy, this.wx);
    } else { // drifter
      ay -= this.floaty; this.faceTarget = Math.atan2(this.vy, this.vx || 0.001);
      if (pd < this.radius + p.radius + 4 && this.biteCd <= 0) { this.biteCd = 0.6; p.takeHit(game, this.dmg, this.x, this.y, this); }
    }
    this.vx += ax * this.accel * sc * dt; this.vy += ay * this.accel * sc * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 8));
    this.integrate(game, dt, 2.2);
  }
}

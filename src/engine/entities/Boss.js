/* A miniboss: a leashed guardian anchored to its home spot. Uses a signature
   power on a cycle, heals when you disengage, and on death explodes into a
   meat payout and grants a permanent perk trophy. */
import { Creature } from './Creature.js';
import { BOSSES } from '../../data/bosses.js';
import { hyp, rand, angLerp } from '../../core/math.js';
import { burst } from '../systems/effects.js';

export class Boss extends Creature {
  constructor(kind, world) {
    const b = BOSSES[kind];
    super(world.W * b.at.x, world.H * b.at.y);
    this.boss = true;
    Object.assign(this, {
      bossKind: kind, title: b.title, short: b.short, perk: b.perk, meatBiomass: b.meat,
      key: kind, kind: b.kind, plan: Object.assign({}, b.plan), role: 'predator',
      home: { x: this.x, y: this.y }, leash: b.leash,
      radius: b.radius, scale: 1,
      maxHp: b.hp, hp: b.hp, dmg: b.dmg, accel: b.accel, maxSpeed: b.maxSpeed, sense: b.sense, aggro: true, floaty: 0,
      meat: 6, value: 8, biteCd: 0, abilT: rand(2.5, 4.5), dashT: 0, engaged: false, level: 10,
      wanderT: 1e9, wx: 0, wy: 0, animOff: rand(0, 10),
    });
  }

  act(game, dt) {
    const p = game.player;
    this.abilT -= dt;
    if (this.hardenT > 0) this.hardenT -= dt;
    if (this.dashT > 0) this.dashT -= dt;
    const home = this.home, dh = hyp(this.x - home.x, this.y - home.y);
    const bdx = p.x - this.x, bdy = p.y - this.y, bd = hyp(bdx, bdy);
    const aggro = (bd < this.sense || this.engaged) && dh < this.leash && p.hp > 0;
    let bx = 0, by = 0, bs = 0;
    if (aggro) {
      this.engaged = true; bx = bdx / (bd || 1); by = bdy / (bd || 1); bs = 1; this.faceTarget = Math.atan2(by, bx);
      if (this.bossKind === 'bulwark') {
        // Kolossos periodically hardens its shell and delivers slow, heavy bites
        if (this.abilT <= 0) { this.abilT = 6.5; this.hardenT = 3.2; burst(game, this.x, this.y, '#bfeaff', 26, 180); }
        if (bd < this.radius + p.radius + 14 && this.biteCd <= 0) {
          this.biteCd = 1.2; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this);
          game.danger = 1; game.shake = Math.min(16, game.shake + 5);
        }
      } else {
        // Xiphos lunges on a cycle and bites fast
        if (this.abilT <= 0) { this.abilT = 4.6; this.dashT = 0.45; this.vx += Math.cos(this.angle) * 660; this.vy += Math.sin(this.angle) * 660; burst(game, this.x, this.y, '#ff8a7a', 20, 220); }
        if (bd < this.radius + p.radius + 16 && this.biteCd <= 0) {
          this.biteCd = 0.7; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1;
        }
      }
    } else {
      this.engaged = false;
      if (dh > 28) { bx = (home.x - this.x) / (dh || 1); by = (home.y - this.y) / (dh || 1); bs = 0.5; this.faceTarget = Math.atan2(by, bx); }
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06 * dt);   // heals back if you disengage
    }
    const slowM = this.slowT > 0 ? 0.4 : 1;   // Shock only slows bosses
    this.vx += bx * this.accel * bs * slowM * dt; this.vy += by * this.accel * bs * slowM * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 6 * slowM));
    this.integrate(game, dt, 2.0, (this.dashT > 0 ? this.maxSpeed * 3 : this.maxSpeed) * slowM);
  }

  die(game, byPlayer) {
    const n = 18, per = this.meatBiomass / n;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(30, 150);
      game.food.push({ x: this.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value: per, kind: 'meat', life: 24, r: rand(4, 7) });
    }
    burst(game, this.x, this.y, this.plan.accent, 64, 340); burst(game, this.x, this.y, '#ffffff', 30, 260); game.shake = 16;
    game.grantPerk(this.perk, this.title); game.bossesDefeated.add(this.bossKind);
    const bi = game.creatures.indexOf(this); if (bi >= 0) game.creatures.splice(bi, 1);
    if (byPlayer) game.kills++;
    game.sfx.play('evolve'); game.pushHud(true);
  }
}

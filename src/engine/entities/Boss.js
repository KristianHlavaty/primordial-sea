/* A miniboss: a leashed guardian anchored to its home spot. Uses a signature
   power on a cycle, heals when you disengage, and on death explodes into a
   meat payout and grants a permanent perk trophy. */
import { Creature } from './Creature.js';
import { BOSSES } from '../../data/bosses.js';
import { hyp, rand, angLerp } from '../../core/math.js';
import { burst } from '../systems/effects.js';

/* A cocoon is a real damageable combat target. If ignored, it hatches into a
   short-lived pack which relentlessly chases the player regardless of size. */
class SpiderCocoon extends Creature {
  constructor(x, y, owner) {
    super(x, y);
    Object.assign(this, {
      cocoon: true, summoned: true, owner, radius: 30, maxHp: 175, hp: 175,
      hatchT: 7, hpBarT: 99, role: 'hazard', level: 0,
      plan: { kind: 'shell', len: 34, wid: 25, body: '#d9d4c8', accent: '#e08b9f', segments: 6, eyes: 0 },
    });
  }

  update(game, dt) {
    this.hatchT -= dt; this.hurt = Math.max(0, this.hurt - dt * 3);
    if (this.hatchT <= 0) this.hatch(game);
  }

  hatch(game) {
    const idx = game.creatures.indexOf(this); if (idx >= 0) game.creatures.splice(idx, 1);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + rand(-.2, .2), r = rand(15, 34);
      game.creatures.push(new Spiderling(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, a, this.owner));
    }
    burst(game, this.x, this.y, '#e8d9df', 34, 260); game.shake = Math.min(14, game.shake + 7); game.sfx.play('power');
  }

  die(game) {
    burst(game, this.x, this.y, '#f4eee8', 22, 190);
    game.floaters.push({ x: this.x, y: this.y - 38, vx: 0, vy: -38, text: 'COCOON DESTROYED', life: 1.2, max: 1.2, color: '#a8ffd4', size: 14 });
    if (this.owner && this.owner.hp > 0) this.owner.abilT = Math.max(this.owner.abilT, 2.5);
    const idx = game.creatures.indexOf(this); if (idx >= 0) game.creatures.splice(idx, 1);
    game.sfx.play('kill');
  }
}

class Spiderling extends Creature {
  constructor(x, y, angle, owner) {
    super(x, y);
    Object.assign(this, {
      summoned: true, owner, key: 'boss_spiderling', kind: 'arachnid', role: 'predator', angle, faceTarget: angle,
      radius: 13, scale: .72, maxHp: 58, hp: 58, dmg: 11, accel: 1550, maxSpeed: 315, sense: 9999,
      biteCd: rand(.1, .8), wanderT: 99, wx: 0, wy: 0, level: 6, lifeT: 16, animOff: rand(0, 10),
      plan: { kind: 'arachnid', len: 27, wid: 14, body: '#3a2d31', accent: '#e08b9f', legs: 8, eyes: 8, abdomen: 1.1, pedipalps: .9, spinnerets: 2, abdomenMarks: 3 },
    });
  }

  update(game, dt) {
    this.lifeT -= dt;
    if (this.lifeT <= 0) { const i = game.creatures.indexOf(this); if (i >= 0) game.creatures.splice(i, 1); return; }
    super.update(game, dt);
  }

  act(game, dt) {
    const p = game.player, dx = p.x - this.x, dy = p.y - this.y, d = hyp(dx, dy) || 1;
    this.faceTarget = Math.atan2(dy, dx); this.vx += dx / d * this.accel * dt; this.vy += dy / d * this.accel * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 10));
    if (d < this.radius + p.radius + 7 && this.biteCd <= 0) { this.biteCd = 1; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1; }
    this.integrate(game, dt, 2.8, this.maxSpeed);
  }

  die(game) {
    burst(game, this.x, this.y, '#e08b9f', 8, 120);
    const idx = game.creatures.indexOf(this); if (idx >= 0) game.creatures.splice(idx, 1);
  }
}

/* Lumenara releases these living sparks in a radial constellation. They bend
   toward the player, but remain fragile enough to pop with a well-timed bite. */
class LumenOrb extends Creature {
  constructor(x, y, angle, owner) {
    super(x, y);
    Object.assign(this, {
      lumenOrb: true, summoned: true, owner, radius: 11, maxHp: 22, hp: 22, hpBarT: 0,
      angle, faceTarget: angle, lifeT: 6, speed: 205, turn: rand(1.7, 2.5), role: 'hazard', level: 0, animOff: rand(0, 10),
      plan: { kind: 'microbe', len: 8, wid: 8, body: '#49eaff', accent: '#e5ffff', eyes: 0 },
    });
    this.vx = Math.cos(angle) * 150; this.vy = Math.sin(angle) * 150;
  }

  update(game, dt) {
    this.lifeT -= dt; this.hurt = Math.max(0, this.hurt - dt * 3);
    const p = game.player, dx = p.x - this.x, dy = p.y - this.y, d = hyp(dx, dy) || 1;
    this.vx += dx / d * this.speed * this.turn * dt; this.vy += dy / d * this.speed * this.turn * dt;
    this.angle = Math.atan2(this.vy, this.vx); this.integrate(game, dt, .7, this.speed);
    if (d < this.radius + p.radius + 3) {
      p.takeHit(game, this.owner.dmg * .62, this.x, this.y, this.owner); game.danger = 1; this.expire(game, true);
    } else if (this.lifeT <= 0) this.expire(game, false);
  }

  expire(game, impact) {
    burst(game, this.x, this.y, impact ? '#e5ffff' : '#49eaff', impact ? 14 : 7, impact ? 170 : 80);
    const idx = game.creatures.indexOf(this); if (idx >= 0) game.creatures.splice(idx, 1);
  }

  die(game) { this.expire(game, false); }
}

export class Boss extends Creature {
  constructor(kind, world) {
    const b = BOSSES[kind];
    super(world.W * b.at.x, world.H * b.at.y);
    this.boss = true;
    Object.assign(this, {
      bossKind: kind, title: b.title, short: b.short, perk: b.perk, meatBiomass: b.meat,
      key: kind, kind: b.kind, plan: Object.assign({}, b.plan), role: 'predator',
      home: { x: this.x, y: this.y }, leash: b.leash,
      radius: b.radius, scale: b.scale || 1,
      maxHp: b.hp, hp: b.hp, dmg: b.dmg, accel: b.accel, maxSpeed: b.maxSpeed, sense: b.sense, aggro: true, floaty: 0,
      meat: 6, value: 8, biteCd: 0, abilT: rand(2.5, 4.5), dashT: 0, engaged: false, level: 10,
      telegraph: null, specialCount: 0,
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
      if (this.telegraph) {
        this.telegraph.t -= dt; this.faceTarget = this.telegraph.angle; bs = 0.12; // the wind-up is a deliberate opening for the player
        if (this.telegraph.t <= 0) this.resolveSpecial(game);
      } else if (this.abilT <= 0) this.beginSpecial(game);
      const biteRate = this.bossKind === 'bulwark' ? 1.2 : this.bossKind === 'lumenara' ? 1.1 : this.bossKind === 'gilboa_matriarch' ? .85 : .7;
      if (!this.telegraph && bd < this.radius + p.radius + 16 && this.biteCd <= 0) {
        this.biteCd = biteRate; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1;
      }
    } else {
      this.engaged = false; this.telegraph = null;
      if (dh > 28) { bx = (home.x - this.x) / (dh || 1); by = (home.y - this.y) / (dh || 1); bs = 0.5; this.faceTarget = Math.atan2(by, bx); }
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06 * dt);   // heals back if you disengage
    }
    const slowM = (this.slowT > 0 ? 0.4 : 1) * (1 - game.webSlowAt(this.x, this.y) * .45);
    this.vx += bx * this.accel * bs * slowM * dt; this.vy += by * this.accel * bs * slowM * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 6 * slowM));
    this.integrate(game, dt, 2.0, (this.dashT > 0 ? this.maxSpeed * 3 : this.maxSpeed) * slowM);
  }

  beginSpecial(game) {
    const p = game.player, a = Math.atan2(p.y - this.y, p.x - this.x);
    const common = { t: 1.25, max: 1.25, x: p.x, y: p.y, ox: this.x, oy: this.y, angle: a, color: this.plan.accent };
    const alt = this.specialCount % 2 === 1;
    if (this.bossKind === 'lumenara') {
      const move = this.specialCount % 3;
      if (move === 0) this.telegraph = { ...common, special: 'radiantNova', shape: 'ring', x: this.x, y: this.y, inner: 105, outer: 345, t: 1.55, max: 1.55 };
      else if (move === 1) this.telegraph = { ...common, special: 'starMotes', shape: 'circle', x: this.x, y: this.y, r: 155, t: 1.4, max: 1.4 };
      else this.telegraph = { ...common, special: 'abyssBeam', shape: 'lane', length: 720, width: 125, t: 1.3, max: 1.3 };
    } else if (this.bossKind === 'bulwark') this.telegraph = alt
      ? { ...common, special: 'shellRush', shape: 'lane', length: 500, width: 135, t: 1.25, max: 1.25 }
      : { ...common, special: 'quake', shape: 'circle', x: this.x, y: this.y, r: 235, t: 1.45, max: 1.45 };
    else if (this.bossKind === 'render') this.telegraph = alt
      ? { ...common, special: 'tailFan', shape: 'cone', length: 285, spread: .78, t: .9, max: .9 }
      : { ...common, special: 'charge', shape: 'lane', length: 570, width: 105, t: 1.0, max: 1.0 };
    else if (this.bossKind === 'tidewarden') this.telegraph = alt
      ? { ...common, special: 'undertow', shape: 'circle', r: 190, t: 1.25, max: 1.25 }
      : { ...common, special: 'tidalSweep', shape: 'cone', length: 340, spread: .62, t: 1.35, max: 1.35 };
    else if (this.bossKind === 'sovereign') this.telegraph = alt
      ? { ...common, special: 'fissure', shape: 'lane', length: 520, width: 125, t: 1.2, max: 1.2 }
      : { ...common, special: 'stomp', shape: 'circle', r: 165, t: 1.15, max: 1.15 };
    else if (this.bossKind === 'gilboa_matriarch') {
      const cocoonAlive = game.creatures.some(c => c.cocoon);
      this.telegraph = alt && !cocoonAlive
        ? { ...common, special: 'cocoon', shape: 'circle', x: this.x + Math.cos(a) * 105, y: this.y + Math.sin(a) * 105, r: 58, t: 1.5, max: 1.5 }
        : { ...common, special: 'webBurst', shape: 'circle', r: 150, t: 1.35, max: 1.35 };
    } else this.telegraph = alt
      ? { ...common, special: 'tongueLash', shape: 'cone', length: 330, spread: .48, t: 1.05, max: 1.05 }
      : { ...common, special: 'mire', shape: 'circle', r: 185, t: 1.3, max: 1.3 };
    this.faceTarget = a; this.specialCount++;
  }

  resolveSpecial(game) {
    const q = this.telegraph, p = game.player; if (!q) return;
    let hit = false;
    if (q.shape === 'circle') hit = hyp(p.x - q.x, p.y - q.y) < q.r + p.radius;
    else if (q.shape === 'ring') { const d = hyp(p.x - q.x, p.y - q.y); hit = d > q.inner - p.radius && d < q.outer + p.radius; }
    else if (q.shape === 'lane') {
      const dx = p.x - q.ox, dy = p.y - q.oy, along = dx * Math.cos(q.angle) + dy * Math.sin(q.angle), side = Math.abs(-dx * Math.sin(q.angle) + dy * Math.cos(q.angle));
      hit = along > 0 && along < q.length && side < q.width / 2 + p.radius;
    } else {
      const dx = p.x - q.ox, dy = p.y - q.oy, d = hyp(dx, dy), da = Math.atan2(Math.sin(Math.atan2(dy, dx) - q.angle), Math.cos(Math.atan2(dy, dx) - q.angle));
      hit = d < q.length + p.radius && Math.abs(da) < q.spread;
    }
    if (q.special === 'cocoon' || q.special === 'starMotes') hit = false;
    const heavy = q.special === 'charge' || q.special === 'shellRush' || q.special === 'abyssBeam';
    const damage = this.dmg * (heavy ? 1.5 : 1.2);
    if (hit) {
      p.takeHit(game, damage, q.ox, q.oy, this); game.danger = 1;
      if (q.special === 'undertow') { const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1; p.vx += dx / d * 440; p.vy += dy / d * 440; }
      if (q.special === 'tailFan') { p.vx += Math.cos(q.angle) * 420; p.vy += Math.sin(q.angle) * 420; }
      if (q.special === 'tidalSweep') { p.vx += Math.cos(q.angle) * 520; p.vy += Math.sin(q.angle) * 520; }
      if (q.special === 'fissure') { p.vx += -Math.sin(q.angle) * 360; p.vy += Math.cos(q.angle) * 360; }
      if (q.special === 'tongueLash') { const dx = q.ox - p.x, dy = q.oy - p.y, d = hyp(dx, dy) || 1; p.vx += dx / d * 620; p.vy += dy / d * 620; }
      if (q.special === 'radiantNova') { const dx = p.x - q.x, dy = p.y - q.y, d = hyp(dx, dy) || 1; p.vx += dx / d * 560; p.vy += dy / d * 560; }
      if (q.special === 'abyssBeam') { p.vx += -Math.sin(q.angle) * 460; p.vy += Math.cos(q.angle) * 460; }
    }
    if (q.special === 'quake') { this.hardenT = 3.2; this.vx *= .2; this.vy *= .2; }
    if (q.special === 'charge' || q.special === 'shellRush') { this.dashT = .6; this.vx += Math.cos(q.angle) * 850; this.vy += Math.sin(q.angle) * 850; }
    if (q.special === 'stomp') game.fx.push({ x: q.x, y: q.y, t: 0, max: .55, R: q.r, color: q.color, dir: 'out', width: 8 });
    if (q.special === 'webBurst') game.webs.push({ x: q.x, y: q.y, r: q.r, angle: game.time, life: 8 });
    if (q.special === 'cocoon') game.creatures.push(new SpiderCocoon(q.x, q.y, this));
    if (q.special === 'mire') game.webs.push({ x: q.x, y: q.y, r: q.r * .85, angle: game.time, life: 5 });
    if (q.special === 'starMotes') for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + this.specialCount * .17;
      game.creatures.push(new LumenOrb(this.x + Math.cos(a) * 85, this.y + Math.sin(a) * 85, a, this));
    }
    if (q.special === 'radiantNova') {
      game.fx.push({ x: q.x, y: q.y, t: 0, max: .65, R: 180, color: '#e5ffff', dir: 'out', width: 7 });
      game.fx.push({ x: q.x, y: q.y, t: 0, max: .8, R: 270, color: '#82f7ff', dir: 'out', width: 6 });
      game.fx.push({ x: q.x, y: q.y, t: 0, max: .95, R: q.outer, color: '#3abbdc', dir: 'out', width: 5 });
    }
    const impactR = q.shape === 'circle' ? q.r : q.shape === 'ring' ? q.outer : 180;
    burst(game, q.x, q.y, q.color, 30, 250); game.fx.push({ x: q.x, y: q.y, t: 0, max: .45, R: impactR, color: q.color, dir: 'out', width: 6 });
    game.shake = Math.min(18, game.shake + 9); game.sfx.play('power');
    this.telegraph = null;
    const enraged = this.hp < this.maxHp * .45;
    this.abilT = (this.bossKind === 'lumenara' ? 4.8 : this.bossKind === 'render' ? 4.6 : this.bossKind === 'gilboa_matriarch' ? 5.4 : 5.8) * (enraged ? .72 : 1);
  }

  die(game, byPlayer) {
    const n = 18, per = this.meatBiomass / n;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(30, 150);
      game.food.push({ x: this.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value: per, kind: 'meat', life: 24, r: rand(4, 7) });
    }
    burst(game, this.x, this.y, this.plan.accent, 64, 340); burst(game, this.x, this.y, '#ffffff', 30, 260); game.shake = 16;
    game.creatures = game.creatures.filter(c => c.owner !== this); // dismiss this boss's encounter adds
    game.grantPerk(this.perk, this.title); game.bossesDefeated.add(this.bossKind);
    const bi = game.creatures.indexOf(this); if (bi >= 0) game.creatures.splice(bi, 1);
    if (byPlayer) game.kills++;
    game.sfx.play('evolve'); game.pushHud(true);
  }
}

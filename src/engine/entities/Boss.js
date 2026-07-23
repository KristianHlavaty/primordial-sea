/* A miniboss: a leashed guardian anchored to its home spot. Uses a signature
   power on a cycle, heals when you disengage, and on death explodes into a
   meat payout and grants a permanent perk trophy. */
import { Creature } from './Creature.js';
import { BOSSES } from '../../data/bosses.js';
import { MAPS } from '../../data/maps.js';
import { hyp, rand, angLerp } from '../../core/math.js';
import { burst } from '../systems/effects.js';

const livingPlayers = game => (game.mp ? game.allPlayers() : [game.player]).filter(p => p && p.hp > 0 && p.deadT <= 0);

function sweptCircleT(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy; if (a < .0001) return null;
  const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

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

  _dieEncounter(game) {
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
    const p = (game.mp && game.nearestPlayer(this.x, this.y)) || (game.worldPlayer ? game.worldPlayer() : game.player);
    if (!p) return;
    const dx = p.x - this.x, dy = p.y - this.y, d = hyp(dx, dy) || 1;
    this.faceTarget = Math.atan2(dy, dx); this.vx += dx / d * this.accel * dt; this.vy += dy / d * this.accel * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 10));
    if (d < this.radius + p.radius + 7 && this.biteCd <= 0) { this.biteCd = 1; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1; }
    this.integrate(game, dt, 2.8, this.maxSpeed);
  }

  _dieEncounter(game) {
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
    const p = (game.mp && game.nearestPlayer(this.x, this.y)) || (game.worldPlayer ? game.worldPlayer() : game.player);
    if (!p) { this.expire(game, false); return; }
    const dx = p.x - this.x, dy = p.y - this.y, d = hyp(dx, dy) || 1;
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

  _dieEncounter(game) { this.expire(game, false); }
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
    if (kind === 'panderodus') Object.assign(this, {
      panderodusMode: 'hunt', stateT: 0, passIndex: 0, passDirection: 1, passY: this.y, passPauseT: 0, passHitSet: new Set(),
      chargeAngle: 0, latchTarget: null, latchConn: 0, latchT: 0, drainTick: 0,
      screamT: 0, tailSlapCd: 3, tailSlapT: 0, impactT: 0, impactX: 0, impactY: 0, impactAngle: 0, impactSeq: 0,
    });
  }

  update(game, dt) { return game.componentSystems.updateBoss(this, game, dt); }

  canFightTarget(target, targetDistance, homeDistance) {
    if (!target || target.hp <= 0 || target.deadT > 0) return false;
    // Once a wind-up starts it is committed. Previously, momentum could carry
    // the boss a pixel beyond its leash, cancel the telegraph, then select the
    // next special as soon as it drifted back inside.
    if (this.telegraph) return true;
    // Give a disengaged boss room to travel home before it can aggro again so
    // the leash boundary cannot become a per-frame engage/disengage switch.
    const reengageInset = Math.min(110, this.leash * .12);
    const leashLimit = this.engaged ? this.leash : this.leash - reengageInset;
    return (targetDistance < this.sense || this.engaged) && homeDistance < leashLimit;
  }

  cancelTelegraph() {
    if (!this.telegraph) return;
    this.telegraph = null;
    // Cancellation is reserved for an invalid/dead target. Do not leave an
    // already-expired timer that can immediately choose another special.
    this.abilT = Math.max(this.abilT, .8);
  }

  _actBoss(game, dt) {
    const p = (game.mp && game.nearestPlayer(this.x, this.y)) || (game.worldPlayer ? game.worldPlayer() : game.player);
    if (!p) return;
    if (this.bossKind === 'panderodus') { this.actPanderodus(game, dt, p); return; }
    this.abilT -= dt;
    if (this.hardenT > 0) this.hardenT -= dt;
    if (this.dashT > 0) this.dashT -= dt;
    const home = this.home, dh = hyp(this.x - home.x, this.y - home.y);
    const bdx = p.x - this.x, bdy = p.y - this.y, bd = hyp(bdx, bdy);
    const aggro = this.canFightTarget(p, bd, dh);
    let bx = 0, by = 0, bs = 0;
    if (aggro) {
      this.engaged = true; bx = bdx / (bd || 1); by = bdy / (bd || 1); bs = 1; this.faceTarget = Math.atan2(by, bx);
      if (this.telegraph) {
        this.telegraph.t -= dt; this.faceTarget = this.telegraph.angle; bs = 0.12; // the wind-up is a deliberate opening for the player
        if (this.telegraph.t <= 0) game.componentSystems.resolveBossSpecial(game, this);
      } else if (this.abilT <= 0) game.componentSystems.beginBossSpecial(game, this, p);
      const biteRate = this.bossKind === 'bulwark' ? 1.2 : this.bossKind === 'lumenara' ? 1.1 : this.bossKind === 'gilboa_matriarch' ? .85 : .7;
      if (!this.telegraph && bd < this.radius + p.radius + 16 && this.biteCd <= 0) {
        this.biteCd = biteRate; this.mouth = 1; p.takeHit(game, this.dmg, this.x, this.y, this); game.danger = 1;
      }
    } else {
      this.engaged = false; this.cancelTelegraph();
      if (dh > 28) { bx = (home.x - this.x) / (dh || 1); by = (home.y - this.y) / (dh || 1); bs = 0.5; this.faceTarget = Math.atan2(by, bx); }
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06 * dt);   // heals back if you disengage
    }
    const slowM = (this.slowT > 0 ? 0.4 : 1) * (1 - game.webSlowAt(this.x, this.y) * .45);
    this.vx += bx * this.accel * bs * slowM * dt; this.vy += by * this.accel * bs * slowM * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 6 * slowM));
    this.integrate(game, dt, 2.0, (this.dashT > 0 ? this.maxSpeed * 3 : this.maxSpeed) * slowM);
  }

  actPanderodus(game, dt, p) {
    this.abilT -= dt;
    this.tailSlapCd = Math.max(0, this.tailSlapCd - dt);
    this.tailSlapT = Math.max(0, this.tailSlapT - dt);
    this.impactT = Math.max(0, this.impactT - dt);
    if (this.hardenT > 0) this.hardenT -= dt;
    if (this.panderodusMode === 'pass') { this.updatePanderodusPass(game, dt); return; }
    if (this.panderodusMode === 'charge') { this.updatePanderodusCharge(game, dt); return; }
    if (this.panderodusMode === 'latched') { this.updatePanderodusLatch(game, dt); return; }
    if (this.panderodusMode === 'stunned') {
      this.stateT -= dt; this.vx = 0; this.vy = 0; this.mouth = Math.max(this.mouth, .45);
      if (this.stateT <= 0) { this.panderodusMode = 'hunt'; this.abilT = this.panderodusCooldown(); }
      return;
    }

    const home = this.home, dh = hyp(this.x - home.x, this.y - home.y);
    const dx = p.x - this.x, dy = p.y - this.y, distance = hyp(dx, dy);
    const aggro = this.canFightTarget(p, distance, dh);
    if (!aggro) {
      this.engaged = false; this.cancelTelegraph(); this.screamT = 0;
      if (dh > 28) {
        this.faceTarget = Math.atan2(home.y - this.y, home.x - this.x);
        this.vx += Math.cos(this.faceTarget) * this.accel * .5 * dt;
        this.vy += Math.sin(this.faceTarget) * this.accel * .5 * dt;
      }
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .045 * dt);
      this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 4));
      this.integrate(game, dt, 2, this.maxSpeed * .7); return;
    }

    this.engaged = true;
    if (this.telegraph) {
      this.telegraph.t -= dt; this.faceTarget = this.telegraph.angle;
      this.vx *= Math.exp(-dt * 5); this.vy *= Math.exp(-dt * 5);
      if (this.telegraph.special === 'fangCharge') {
        this.screamT = Math.max(0, this.telegraph.t);
        this.mouth = .58 + .42 * Math.sin(game.time * 18) ** 2;
      } else this.screamT = 0;
      this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 8));
      if (this.telegraph.t <= 0) game.componentSystems.resolveBossSpecial(game, this);
      return;
    }

    this.screamT = 0;
    if (this.tailSlapCd <= 0 && distance < this.radius + p.radius + 190) {
      game.componentSystems.beginBossTail(game, this); return;
    }
    if (this.abilT <= 0) { game.componentSystems.beginBossSpecial(game, this, p); return; }

    this.faceTarget = Math.atan2(dy, dx);
    const slowM = this.slowT > 0 ? .45 : 1;
    this.vx += dx / (distance || 1) * this.accel * .72 * slowM * dt;
    this.vy += dy / (distance || 1) * this.accel * .72 * slowM * dt;
    this.angle = angLerp(this.angle, this.faceTarget, 1 - Math.exp(-dt * 4.5 * slowM));
    this.integrate(game, dt, 2, this.maxSpeed * slowM);
    if (distance < this.radius + p.radius + 18 && this.biteCd <= 0) {
      this.biteCd = .95; this.mouth = 1; p.takeHit(game, this.dmg * .8, this.x, this.y, this); game.danger = 1;
    }
  }

  panderodusCooldown() { return (this.hp < this.maxHp * .45 ? 4.2 : 5.8); }

  _beginPanderodusSpecial(game, target) {
    const color = this.hp < this.maxHp * .45 ? '#ff5362' : this.plan.glow;
    if (this.specialCount % 2 === 0) {
      const lanes = MAPS[game.mapId].bossLanes || [.28, .5, .72];
      let lane = lanes[0];
      for (const candidate of lanes) if (Math.abs(target.y - game.H * candidate) < Math.abs(target.y - game.H * lane)) lane = candidate;
      const y = game.H * lane;
      this.telegraph = {
        special: 'edgePass', shape: 'lane', x: game.W * .5, y, ox: 0, oy: y, angle: 0,
        length: game.W, width: this.radius * 2.15, passes: 3, t: 1.65, max: 1.65, color,
      };
    } else {
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const tx = ca > 0 ? (game.W - this.x) / ca : ca < 0 ? -this.x / ca : Infinity;
      const ty = sa > 0 ? (game.H - this.y) / sa : sa < 0 ? -this.y / sa : Infinity;
      const length = Math.max(800, Math.min(tx, ty));
      this.telegraph = {
        special: 'fangCharge', shape: 'lane', x: target.x, y: target.y, ox: this.x, oy: this.y, angle,
        length, width: this.radius * 1.35, t: 1.75, max: 1.75, color,
      };
      this.screamT = 1.75; game.sfx.play('panderodus_scream');
    }
    this.faceTarget = this.telegraph.angle; this.specialCount++;
  }

  _beginPanderodusTail(game) {
    const color = this.hp < this.maxHp * .45 ? '#ff5362' : this.plan.glow;
    this.telegraph = {
      special: 'panderTail', shape: 'circle', x: this.x, y: this.y, ox: this.x, oy: this.y,
      angle: this.angle, r: 275, t: .62, max: .62, color,
    };
    this.tailSlapCd = this.hp < this.maxHp * .45 ? 2.7 : 3.8;
  }

  _resolvePanderodusSpecial(game) {
    const q = this.telegraph; if (!q) return;
    this.telegraph = null; this.screamT = 0;
    if (q.special === 'edgePass') {
      this.panderodusMode = 'pass'; this.passIndex = 0; this.passDirection = 1; this.passY = q.y;
      this.passPauseT = .32; this.passHitSet = new Set(); this.x = -this.radius * 1.8; this.y = q.y;
      this.vx = 0; this.vy = 0; this.angle = 0; game.sfx.play('panderodus_pass'); return;
    }
    if (q.special === 'fangCharge') {
      this.panderodusMode = 'charge'; this.chargeAngle = q.angle; this.stateT = 3.4;
      this.angle = q.angle; this.vx = 0; this.vy = 0; this.mouth = .35; return;
    }
    if (q.special === 'panderTail') {
      for (const player of livingPlayers(game)) {
        const dx = player.x - this.x, dy = player.y - this.y, d = hyp(dx, dy);
        if (d > q.r + player.radius) continue;
        player.takeHit(game, this.dmg * .95, this.x, this.y, this);
        player.vx += dx / (d || 1) * 760; player.vy += dy / (d || 1) * 760; game.danger = 1;
      }
      this.tailSlapT = .55;
      burst(game, this.x - Math.cos(this.angle) * this.radius, this.y - Math.sin(this.angle) * this.radius, q.color, 32, 330);
      game.fx.push({ x: this.x, y: this.y, t: 0, max: .55, R: q.r, color: q.color, dir: 'out', width: 8 });
      game.shake = Math.min(18, game.shake + 10); game.sfx.play('swing');
    }
  }

  updatePanderodusPass(game, dt) {
    this.engaged = true; this.y = this.passY; this.faceTarget = this.passDirection > 0 ? 0 : Math.PI; this.angle = this.faceTarget;
    if (this.passPauseT > 0) { this.passPauseT -= dt; this.vx = 0; this.vy = 0; return; }
    const speed = this.hp < this.maxHp * .45 ? 2200 : 1850;
    this.vx = this.passDirection * speed; this.vy = 0; this.x += this.vx * dt;
    const targets = livingPlayers(game).concat(game.creatures.filter(c => c !== this && !c.boss && c.hp > 0));
    for (const target of targets) {
      if (this.passHitSet.has(target) || hyp(target.x - this.x, target.y - this.y) > this.radius + target.radius) continue;
      this.passHitSet.add(target);
      if (target.speciesId) {
        target.takeHit(game, this.dmg * 1.55, this.x - this.passDirection * this.radius, this.y, this);
        target.vx += this.passDirection * 920; target.vy += (target.y < this.y ? -1 : 1) * 240; game.danger = 1;
      } else target.takeDamage(game, this.dmg * 1.9, this.x - this.passDirection * this.radius, this.y, false);
    }
    const crossed = this.passDirection > 0 ? this.x > game.W + this.radius * 1.8 : this.x < -this.radius * 1.8;
    if (!crossed) return;
    this.passIndex++;
    if (this.passIndex >= 3) {
      this.panderodusMode = 'hunt'; this.x = game.W - this.radius - 4; this.y = this.passY;
      this.vx = this.maxSpeed * .35; this.vy = 0; this.passHitSet.clear(); this.abilT = this.panderodusCooldown(); return;
    }
    this.passDirection *= -1; this.passPauseT = .55; this.passHitSet = new Set();
    game.sfx.play('panderodus_pass');
  }

  updatePanderodusCharge(game, dt) {
    this.engaged = true; this.stateT -= dt; this.faceTarget = this.chargeAngle; this.angle = this.chargeAngle;
    const speed = this.hp < this.maxHp * .45 ? 1500 : 1250, dx = Math.cos(this.chargeAngle), dy = Math.sin(this.chargeAngle);
    const nx = this.x + dx * speed * dt, ny = this.y + dy * speed * dt;
    const headOffset = this.radius * .72;
    const hx1 = this.x + dx * headOffset, hy1 = this.y + dy * headOffset;
    const hx2 = nx + dx * headOffset, hy2 = ny + dy * headOffset;
    let firstT = 2, hitObstacle = null, hitPlayer = null;
    for (const obstacle of game.obstacles) {
      const t = sweptCircleT(hx1, hy1, hx2, hy2, obstacle.x, obstacle.y, obstacle.r + this.radius * .44);
      if (t != null && t < firstT) { firstT = t; hitObstacle = obstacle; hitPlayer = null; }
    }
    for (const player of livingPlayers(game)) {
      const t = sweptCircleT(hx1, hy1, hx2, hy2, player.x, player.y, player.radius + this.radius * .48);
      if (t != null && t < firstT) { firstT = t; hitPlayer = player; hitObstacle = null; }
    }
    this.x += (nx - this.x) * Math.min(firstT, 1); this.y += (ny - this.y) * Math.min(firstT, 1);
    this.vx = dx * speed; this.vy = dy * speed;
    if (hitObstacle) { this.crashPanderodusIntoRock(game, hitObstacle); return; }
    if (hitPlayer) { this.latchPanderodusOnto(game, hitPlayer); return; }
    if (this.stateT <= 0 || this.x < this.radius || this.x > game.W - this.radius || this.y < this.radius || this.y > game.H - this.radius) {
      this.x = Math.max(this.radius, Math.min(game.W - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(game.H - this.radius, this.y));
      this.panderodusMode = 'hunt'; this.vx *= .2; this.vy *= .2; this.abilT = this.panderodusCooldown();
    }
  }

  crashPanderodusIntoRock(game, obstacle) {
    const dx = Math.cos(this.chargeAngle), dy = Math.sin(this.chargeAngle);
    this.panderodusMode = 'stunned'; this.stateT = 1.45; this.vx = 0; this.vy = 0; this.mouth = 1;
    this.impactT = .9; this.impactX = this.x + dx * this.radius * .9; this.impactY = this.y + dy * this.radius * .9;
    this.impactAngle = this.chargeAngle; this.impactSeq++; this.vulnerableT = Math.max(this.vulnerableT || 0, 2.8);
    for (let i = 0; i < 11; i++) {
      const a = this.chargeAngle + Math.PI + rand(-1.15, 1.15), force = rand(190, 520);
      game.particles.push({
        shape: 'tooth', x: this.impactX + rand(-10, 10), y: this.impactY + rand(-10, 10),
        vx: Math.cos(a) * force, vy: Math.sin(a) * force, life: 1.15, max: 1.15,
        size: rand(6, 11), color: '#f4ead3', angle: rand(0, Math.PI * 2), spin: rand(-10, 10),
      });
    }
    burst(game, this.impactX, this.impactY, '#d8e7de', 34, 360);
    burst(game, obstacle.x, obstacle.y, '#56777a', 26, 260);
    game.fx.push({ x: this.impactX, y: this.impactY, t: 0, max: .6, R: 190, color: '#f4ead3', dir: 'out', width: 8 });
    game.floaters.push({ x: this.impactX, y: this.impactY - 55, vx: 0, vy: -34, text: 'FANGS SHATTERED', life: 1.3, max: 1.3, color: '#f4ead3', size: 16 });
    game.shake = Math.min(22, game.shake + 18); game.sfx.play('panderodus_crash');
  }

  latchPanderodusOnto(game, player) {
    this.panderodusMode = 'latched'; this.latchTarget = player; this.latchT = 2.65; this.drainTick = .08;
    this.latchConn = game.mp ? (player === game.player ? game.mp.self : player.connId) : 1;
    this.vx = 0; this.vy = 0; this.mouth = 1; game.sfx.play('panderodus_latch');
  }

  updatePanderodusLatch(game, dt) {
    const player = this.latchTarget;
    if (!player || player.hp <= 0 || player.deadT > 0) { this.releasePanderodusLatch(); return; }
    this.engaged = true; this.latchT -= dt; this.drainTick -= dt; this.mouth = .78 + .22 * Math.sin(game.time * 20) ** 2;
    const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
    player.x = this.x + dx * this.radius * .9; player.y = this.y + dy * this.radius * .9;
    player.vx = 0; player.vy = 0; player.stunT = Math.max(player.stunT || 0, .22);
    if (this.drainTick <= 0) {
      this.drainTick += .42;
      const damage = Math.max(28, this.dmg * .62);
      player.takeHit(game, damage, this.x, this.y, this); game.danger = 1;
      if (this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + damage * .24);
      burst(game, player.x, player.y, '#ff5f6c', 12, 145); game.sfx.play('panderodus_drain');
    }
    if (this.latchT <= 0 || player.hp <= 0 || this.hp <= 0) this.releasePanderodusLatch();
  }

  releasePanderodusLatch() {
    const player = this.latchTarget;
    if (player && player.hp > 0) {
      player.vx += Math.cos(this.angle) * 620; player.vy += Math.sin(this.angle) * 620;
    }
    this.latchTarget = null; this.latchConn = 0; this.latchT = 0;
    this.panderodusMode = 'hunt'; this.mouth = .2; this.abilT = this.panderodusCooldown();
  }

  _beginSpecial(game, target) {
    const p = target || (game.worldPlayer ? game.worldPlayer() : game.player), a = Math.atan2(p.y - this.y, p.x - this.x);
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

  _resolveSpecial(game) {
    const q = this.telegraph; if (!q) return;
    const targets = game.mp ? game.allPlayers().filter(p => p && p.deadT <= 0) : [game.player];
    const heavy = q.special === 'charge' || q.special === 'shellRush' || q.special === 'abyssBeam';
    const damage = this.dmg * (heavy ? 1.5 : 1.2);
    for (const p of targets) {
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
      if (!hit) continue;
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

  _dieBoss(game, byPlayer) {
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
    game.componentSystems.bossDefeated(game, this);
  }
}

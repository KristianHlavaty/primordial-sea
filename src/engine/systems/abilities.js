/* Active-power effects. The catalogue (cooldowns, colors, text) lives in
   data/abilities.js; this is what actually happens when a power fires.
   Passives live where they hook in: Player (barbs/nettle/evasion/bloodscent/
   venom/rebirth), Creature (camo/ink senses), Engine (filter feeding). */
import { ABILITIES } from '../../data/abilities.js';
import { clamp, hyp, rand } from '../../core/math.js';
import { burst, shakeForPlayer } from './effects.js';
import {
  abilityTargets, abilityBody, abilityHit, applyVenomStacks, beginLeap,
  emergeBurrow, releaseShellEnergy,
} from './abilityRuntime.js';

export function activateAbility(game, idx, actor) {
  const p = actor || game.player;
  if (!p || p.deadT > 0 || p.stunT > 0 || p.vehicle || game.paused || game.dead || game.pendingEvolve || !game.playing) return;
  const id = p.abilities[idx]; if (!id) return;
  const ab = ABILITIES[id]; if (!ab || ab.passive) return;
  if (id === 'withdraw' && p.withdrawT > 0) {
    p.withdrawT = 0; releaseShellEnergy(game, p, 'withdraw'); game.pushHud(true); return;
  }
  if (id === 'burrow' && p.burrowActive) {
    emergeBurrow(game, p); game.pushHud(true); return;
  }
  if ((p.acd[id] || 0) > 0) return;
  p.castAbility = id; p.castT = 0.75; p.castSeq = (p.castSeq || 0) + 1;

  if (id === 'harden') {
    p.shieldMax = Math.round(p.maxHp * 0.85); p.shield = p.shieldMax; p.shieldT = ab.dur; p.forceFieldT = 0;
    p.hardenActive = 1; p.hardenStored = 0;
    const R = p.radius + 85;
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), targetR = body.radius || target.radius || 12, dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      if (d >= R + targetR) continue;
      const k = 1 - d / (R + targetR);
      body.vx += dx / (d || 1) * 460 * k; body.vy += dy / (d || 1) * 460 * k;
      abilityHit(game, p, target, p.species.stats.dmg * p.atkMul * .35, p.x, p.y);
    }
    burst(game, p.x, p.y, '#bfeaff', 26, 230);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .48, R, color: '#7fd8ff', dir: 'out', width: 5 });
    shakeForPlayer(game, p, 3);
  }
  else if (id === 'enroll') {
    p.enrollT = ab.dur; p.enrollHit = new Set();
    p.vx += Math.cos(p.angle) * 720; p.vy += Math.sin(p.angle) * 720;
    // shove and nick everything close by
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), targetR = body.radius || target.radius || 12, dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy), rr = p.radius + targetR + 60;
      if (d < rr) {
        const k = 1 - d / rr;
        p.enrollHit.add(target); body.vx += dx / (d || 1) * 620 * k; body.vy += dy / (d || 1) * 620 * k;
        abilityHit(game, p, target, p.species.stats.dmg * p.atkMul * 1.25, p.x, p.y);
        const nx = dx / (d || 1), ny = dy / (d || 1), intoTarget = Math.max(0, p.vx * nx + p.vy * ny);
        if (intoTarget > 0) { p.vx -= nx * intoTarget * 1.38; p.vy -= ny * intoTarget * 1.38; }
      }
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .5, R: p.radius + 90, color: '#ffcf6a', dir: 'out', width: 6 });
    burst(game, p.x, p.y, '#ffe6b0', 30, 300); shakeForPlayer(game, p, 5);
  }
  else if (id === 'burst') {
    p.burstT = ab.dur; p.burstBreach = 1;
    p.vx += Math.cos(p.angle) * 460; p.vy += Math.sin(p.angle) * 460;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .42, R: p.radius + 75, color: '#5ee0f2', dir: 'out', width: 4 });
    burst(game, p.x, p.y, '#9bf4ff', 20, 250);
  }
  else if (id === 'frenzy') {
    p.frenzyT = ab.dur; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .06);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .52, R: p.radius + 95, color: '#f03852', dir: 'out', width: 6 });
    burst(game, p.x, p.y, '#ff4058', 28, 270); shakeForPlayer(game, p, 2);
  }
  else if (id === 'engulf') {
    const R = 330, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    p.engulfT = .78; p.engulfAngle = p.angle;
    // suck in food pellets...
    for (const f of game.food) {
      const d = hyp(f.x - p.x, f.y - p.y);
      if (d < R) { const k = 1 - d / R; f.vx += (p.x - f.x) / (d || 1) * 900 * k; f.vy += (p.y - f.y) / (d || 1) * 900 * k; }
    }
    // A directed vacuum cone swallows the nearest small victim, then spits it out.
    let swallow = null, swallowD = Infinity;
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      const dot = (dx * fx + dy * fy) / (d || 1);
      if (d >= 260 + (body.radius || target.radius || 0) || dot < .18) continue;
      const k = 1 - d / 260;
      body.vx += (p.x - body.x) / (d || 1) * 1150 * k; body.vy += (p.y - body.y) / (d || 1) * 1150 * k;
      if (!target.boss) target.stunT = Math.max(target.stunT || 0, .7);
      abilityHit(game, p, target, p.species.stats.dmg * p.atkMul * .32, body.x, body.y);
      if (!target.boss && !target.speciesId && (body.radius || target.radius) < p.radius * 1.15 && d < swallowD) { swallow = target; swallowD = d; }
    }
    if (swallow) { p.engulfTarget = swallow; p.engulfSwallowT = .72; }
    p.hp = Math.min(p.maxHp, p.hp + Math.max(10, p.maxHp * .08));
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.55, R, color: '#8fe6c8', dir: 'in', width: 5 });
    burst(game, p.x, p.y, '#b5ffe8', 18, 170);
  }
  else if (id === 'bloom') {
    p.bloomT = ab.dur; p.bloomTick = 0; p.bloomGrab = null;
    burst(game, p.x, p.y, '#e0b8ff', 24, 220);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .48, R: p.radius + 95, color: '#c79bff', dir: 'out', width: 4 });
  }
  else if (id === 'jet') {
    // violent siphon blast forward; jetT briefly lifts the speed cap
    p.jetT = 0.5;
    p.vx += Math.cos(p.angle) * 1250; p.vy += Math.sin(p.angle) * 1250;
    const bx = p.x - Math.cos(p.angle) * p.radius, by = p.y - Math.sin(p.angle) * p.radius;
    for (let i = 0; i < 22; i++)
      game.particles.push({ x: bx, y: by, vx: -Math.cos(p.angle) * rand(120, 360) + rand(-65, 65), vy: -Math.sin(p.angle) * rand(120, 360) + rand(-65, 65), life: 0.55, max: 0.55, size: rand(2, 5), color: 'rgba(160,240,255,0.72)' });
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      const rear = (-dx * Math.cos(p.angle) - dy * Math.sin(p.angle)) / (d || 1);
      if (d > 175 + (body.radius || target.radius || 0) || rear < .2) continue;
      abilityHit(game, p, target, p.species.stats.dmg * p.atkMul * .55, bx, by);
      body.vx -= Math.cos(p.angle) * (target.boss ? 260 : 720); body.vy -= Math.sin(p.angle) * (target.boss ? 260 : 720);
    }
    game.fx.push({ x: bx, y: by, t: 0, max: .38, R: p.radius + 65, color: '#7fe6d8', dir: 'out', width: 4 });
    shakeForPlayer(game, p, 2);
  }
  else if (id === 'withdraw') {
    p.withdrawT = ab.dur; p.withdrawStored = 0; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .08);
    burst(game, p.x, p.y, '#e8c98a', 18, 180);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .45, R: p.radius + 55, color: '#e8c98a', dir: 'in', width: 5 });
  }
  else if (id === 'whirlpool') {
    p.vortexT = ab.dur; p.vortexTick = 0; p.vortexActive = 1; p.vortexReleased = 0;
    p.vortexX = clamp(p.x + Math.cos(p.angle) * 145, 80, game.W - 80);
    p.vortexY = clamp(p.y + Math.sin(p.angle) * 145, 80, game.H - 80);
    game.fx.push({ x: p.vortexX, y: p.vortexY, t: 0, max: 0.5, R: 260, color: '#6fd0e8', dir: 'in', width: 4 });
    shakeForPlayer(game, p, 3);
  }
  else if (id === 'ink') {
    p.stealthT = .35; p.inkCloudT = 6; p.inkX = p.x; p.inkY = p.y;
    p.decoyX = p.x; p.decoyY = p.y; p.decoyAngle = p.angle;
    for (let i = 0; i < 26; i++) {
      if (game.particles.length > 320) game.particles.shift();
      game.particles.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), vx: rand(-50, 50), vy: rand(-50, 50), life: rand(1.2, 2.4), max: 2.4, size: rand(8, 20), color: 'rgba(20,26,44,0.55)' });
    }
  }
  else if (id === 'grasp') {
    // Fire a long, generously aimed tentacle. In multiplayer the host also
    // considers rival players in this map, keeping damage and movement authoritative.
    const reach = 500 + p.radius, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    const candidates = game.creatures.slice();
    if (game.mp && game.mp.role === 'host') {
      for (const other of game.allPlayers()) {
        if (other !== p && other.deadT <= 0 && other.spawnProtT <= 0 && !other.mpInvincible && !(other.mpEvolveChoices && other.mpEvolveChoices.length)) candidates.push(other);
      }
    }
    let best = null, bd = reach, bestScore = Infinity;
    for (const target of candidates) {
      if (!target || target.hp <= 0) continue;
      const body = target.vehicle || target, dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      if (d > reach + (body.radius || target.radius || 0)) continue;
      const dot = (dx * fx + dy * fy) / (d || 1);
      if (dot < .08) continue;
      const side = Math.abs(-dx * fy + dy * fx), score = d + side * .7;
      if (score < bestScore) { bestScore = score; bd = d; best = target; }
    }
    const targetBody = best && (best.vehicle || best);
    p.graspT = .62;
    p.graspX = targetBody ? targetBody.x : p.x + fx * reach;
    p.graspY = targetBody ? targetBody.y : p.y + fy * reach;
    if (best) {
      const body = targetBody, dx = body.x - p.x, dy = body.y - p.y, d = bd || 1;
      const damage = p.species.stats.dmg * p.atkMul * (best.boss ? 1.35 : 1.65);
      if (best.speciesId) best.takeHit(game, damage, p.x, p.y, p);
      else best.takeDamage(game, damage, p.x, p.y, true);
      if (best.hp > 0) {
        if (best.boss) {
          // Huge bosses keep their ground: the arm only makes them flinch inward.
          // Creature.takeDamage applies a small outward flinch of its own;
          // this slightly stronger inward impulse leaves only a gentle tug.
          body.vx += (p.x - body.x) / d * 185; body.vy += (p.y - body.y) / d * 185;
        } else {
          // Place ordinary prey at the mouth rather than merely adding an impulse
          // that its AI or player steering could immediately cancel.
          const stop = p.radius + (body.radius || best.radius || 12) + 12;
          body.x = clamp(p.x + dx / d * stop, body.radius || 0, game.W - (body.radius || 0));
          body.y = clamp(p.y + dy / d * stop, body.radius || 0, game.H - (body.radius || 0));
          body.vx = (p.x - body.x) / (stop || 1) * 180; body.vy = (p.y - body.y) / (stop || 1) * 180;
          if (body !== best) { best.x = body.x; best.y = body.y; best.vx = body.vx; best.vy = body.vy; }
          if (!best.speciesId) best.stunT = Math.max(best.stunT || 0, 1.15);
        }
      }
      burst(game, p.graspX, p.graspY, p.plan.accent || '#e4a6f2', 18, 210);
    }
    game.fx.push({ x: p.graspX, y: p.graspY, t: 0, max: .42, R: best ? 55 : 28, color: p.plan.accent || '#c98ae0', dir: 'in', width: 4 });
  }
  else if (id === 'ram') {
    p.ramT = ab.dur; p.ramHit = new Set(); p.ramAngle = p.angle;
    p.vx = Math.cos(p.ramAngle) * 1500; p.vy = Math.sin(p.ramAngle) * 1500;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .35, R: p.radius + 65, color: '#ffb36a', dir: 'out', width: 6 });
    burst(game, p.x, p.y, '#ffd39d', 24, 280);
  }
  else if (id === 'impale') {
    const st = p.species.stats;
    p.jetT = 0.25; p.vx += Math.cos(p.angle) * 560; p.vy += Math.sin(p.angle) * 560;
    const reach = p.radius + st.reach * 1.8, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    p.impaleT = .72; p.impaleAngle = p.angle; p.impaleReach = reach;
    let carried = null, carriedD = Infinity;
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      if (d < reach + (body.radius || target.radius || 0)) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.4) {
          abilityHit(game, p, target, st.dmg * p.atkMul * 2, p.x, p.y);
          if (!target.boss) { target.stunT = Math.max(target.stunT || 0, .8); if (d < carriedD) { carried = target; carriedD = d; } }
          burst(game, body.x, body.y, '#ffd27a', 8, 140);
        }
      }
    }
    if (carried) p.impaleTarget = carried;
    shakeForPlayer(game, p, 3);
  }
  else if (id === 'crush') {
    p.crushT = .44; p.crushAngle = p.angle;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .44, R: p.radius + 80, color: '#ff8a5e', dir: 'in', width: 5 });
  }
  else if (id === 'shock') {
    const remaining = abilityTargets(game, p).filter(target => hyp(abilityBody(target).x - p.x, abilityBody(target).y - p.y) < 300);
    const links = [{ x: p.x, y: p.y }]; let x = p.x, y = p.y;
    for (let i = 0; i < 6 && remaining.length; i++) {
      remaining.sort((a, b) => hyp(abilityBody(a).x - x, abilityBody(a).y - y) - hyp(abilityBody(b).x - x, abilityBody(b).y - y));
      const target = remaining.shift(), body = abilityBody(target), d = hyp(body.x - x, body.y - y);
      if (i > 0 && d > 210) break;
      links.push({ x: body.x, y: body.y });
      abilityHit(game, p, target, Math.max(8, p.species.stats.dmg * p.atkMul * (.58 - i * .055)), x, y);
      if (target.boss) target.slowT = Math.max(target.slowT || 0, 2.8);
      else target.stunT = Math.max(target.stunT || 0, 1.7 + i * .12);
      target.conductiveT = Math.max(target.conductiveT || 0, 4); x = body.x; y = body.y;
    }
    p.shockLinks = links; p.shockVisualT = .65;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.55, R: 290, color: '#9fdcff', dir: 'out', width: 4 });
    if (game.perks.shockAfterglow) {
      p.shockEchoT = .72; p.shockEchoX = p.x; p.shockEchoY = p.y;
      game.fx.push({ x: p.x, y: p.y, t: 0, max: .72, R: 70, color: '#e5ffff', dir: 'in', width: 3 });
    }
    shakeForPlayer(game, p, 4);
  }
  else if (id === 'websnare') {
    const R = p.radius + 150;
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), d = hyp(body.x - p.x, body.y - p.y);
      if (d >= R + (body.radius || target.radius || 0)) continue;
      if (target.boss) target.slowT = Math.max(target.slowT || 0, 4);
      else { target.stunT = Math.max(target.stunT || 0, 2.4); body.vx *= .15; body.vy *= .15; }
      burst(game, body.x, body.y, '#d9e6df', 6, 65);
    }
    game.webs.push({ x: p.x + Math.cos(p.angle) * 70, y: p.y + Math.sin(p.angle) * 70, r: R, angle: p.angle, life: 7, abilityWeb: true, owner: p });
    p.webT = 7;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .55, R, color: '#d9e6df', dir: 'out', width: 2 });
  }
  else if (id === 'pounce') {
    beginLeap(game, p, 'pounce', 300 + p.radius * 2, .58); p.jetT = .58;
  }
  else if (id === 'burrow') { p.burrowT = ab.dur; p.burrowActive = 1; burst(game, p.x, p.y, '#6a4e2c', 24, 220); game.fx.push({ x: p.x, y: p.y, t: 0, max: .42, R: p.radius + 70, color: '#c79a5e', dir: 'out', width: 4 }); shakeForPlayer(game, p, 2); }
  else if (id === 'stomp') {
    p.stompT = 1.05; p.stompX = p.x; p.stompY = p.y; p.stompHit = new Set(); p.stompHit2 = new Set();
    burst(game, p.x, p.y, '#f2c080', 20, 230); shakeForPlayer(game, p, 4);
  }
  else if (id === 'tailsweep') {
    p.tailSweepT = .72; p.tailSweepAngle = p.angle;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .72, R: p.radius + 90, color: '#9fd0a0', dir: 'out', width: 4 });
  }
  else if (id === 'sprint') {
    p.sprintT = ab.dur; p.sprintMomentum = 0; p.sprintHit = new Set(); p.vx += Math.cos(p.angle) * 360; p.vy += Math.sin(p.angle) * 360;
    burst(game, p.x, p.y, '#c7ffd0', 18, 220);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .4, R: p.radius + 65, color: '#9ce0a0', dir: 'out', width: 4 });
  }
  else if (id === 'dive') {
    beginLeap(game, p, 'dive', 390 + p.radius * 2, .7); p.jetT = .7;
  }
  else if (id === 'venomsting') {
    // stinger into a single target ahead: deep damage + potent lingering venom
    const st = p.species.stats, reach = p.radius + st.reach * 1.6, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    let best = null, bd = 1e9;
    for (const target of abilityTargets(game, p)) {
      const body = abilityBody(target), dx = body.x - p.x, dy = body.y - p.y, d = hyp(dx, dy);
      if (d < reach + (body.radius || target.radius || 0)) { const dot = (dx * fx + dy * fy) / (d || 1); if (dot > 0.2 && d < bd) { bd = d; best = target; } }
    }
    if (best) {
      abilityHit(game, p, best, st.dmg * p.atkMul * 2.4, p.x, p.y);
      applyVenomStacks(game, p, best, 1.8);
      if (!best.boss) best.stunT = Math.max(best.stunT || 0, 0.5);
      burst(game, best.x, best.y, '#b6e05a', 12, 160);
    }
    shakeForPlayer(game, p, 3);
  }

  p.acd[id] = ab.cd * (game.talentBonus ? game.talentBonus.powerCdMul : 1);
  if (!game.mp || p === game.player) game.sfx.play(id === 'frenzy' ? 'frenzy' : id === 'ram' ? 'ram' : 'power');
  game.pushHud(true);
}

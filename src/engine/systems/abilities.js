/* Active-power effects. The catalogue (cooldowns, colors, text) lives in
   data/abilities.js; this is what actually happens when a power fires.
   Passives live where they hook in: Player (barbs/nettle/evasion/bloodscent/
   venom/rebirth), Creature (camo/ink senses), Engine (filter feeding). */
import { ABILITIES } from '../../data/abilities.js';
import { hyp, rand } from '../../core/math.js';
import { burst } from './effects.js';

export function activateAbility(game, idx) {
  const p = game.player;
  if (!p || game.paused || game.dead || game.pendingEvolve || !game.playing) return;
  const id = p.abilities[idx]; if (!id) return;
  const ab = ABILITIES[id]; if (!ab || ab.passive) return;
  if ((p.acd[id] || 0) > 0) return;

  if (id === 'harden') {
    p.shieldMax = Math.round(p.maxHp * 0.6); p.shield = p.shieldMax; p.shieldT = ab.dur;
    burst(game, p.x, p.y, '#bfeaff', 12, 120);
  }
  else if (id === 'enroll') {
    p.enrollT = ab.dur;
    // shove and nick everything close by
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy), rr = p.radius + c.radius + 60;
      if (d < rr) {
        const k = 1 - d / rr;
        c.vx += dx / (d || 1) * 430 * k; c.vy += dy / (d || 1) * 430 * k;
        c.takeDamage(game, p.species.stats.dmg * p.atkMul, p.x, p.y, true);
      }
    }
    burst(game, p.x, p.y, '#ffe6b0', 22, 230); game.shake = 6;
  }
  else if (id === 'burst') { p.burstT = ab.dur; }
  else if (id === 'frenzy') { p.frenzyT = ab.dur; burst(game, p.x, p.y, '#ff8a9a', 10, 150); }
  else if (id === 'engulf') {
    const R = 240;
    // suck in food pellets...
    for (const f of game.food) {
      const d = hyp(f.x - p.x, f.y - p.y);
      if (d < R) { const k = 1 - d / R; f.vx += (p.x - f.x) / (d || 1) * 900 * k; f.vy += (p.y - f.y) / (d || 1) * 900 * k; }
    }
    // ...and briefly stun + drag smaller creatures
    for (const c of game.creatures.slice()) {
      if (c.boss || c.radius >= p.radius) continue;
      const d = hyp(c.x - p.x, c.y - p.y);
      if (d < 170) {
        const k = 1 - d / 170;
        c.vx += (p.x - c.x) / (d || 1) * 520 * k; c.vy += (p.y - c.y) / (d || 1) * 520 * k;
        c.stunT = Math.max(c.stunT || 0, 0.4);
      }
    }
    p.hp = Math.min(p.maxHp, p.hp + 4);
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.45, R, color: '#8fe6c8', dir: 'in', width: 3 });
  }
  else if (id === 'bloom') { p.bloomT = ab.dur; p.bloomTick = 0; burst(game, p.x, p.y, '#c9a0ff', 10, 120); }
  else if (id === 'jet') {
    // violent siphon blast forward; jetT briefly lifts the speed cap
    p.jetT = 0.4;
    p.vx += Math.cos(p.angle) * 900; p.vy += Math.sin(p.angle) * 900;
    const bx = p.x - Math.cos(p.angle) * p.radius, by = p.y - Math.sin(p.angle) * p.radius;
    for (let i = 0; i < 10; i++)
      game.particles.push({ x: bx, y: by, vx: -Math.cos(p.angle) * rand(60, 160) + rand(-40, 40), vy: -Math.sin(p.angle) * rand(60, 160) + rand(-40, 40), life: 0.4, max: 0.4, size: rand(2, 4), color: 'rgba(160,240,255,0.6)' });
  }
  else if (id === 'withdraw') { p.withdrawT = ab.dur; burst(game, p.x, p.y, '#e8c98a', 10, 110); }
  else if (id === 'whirlpool') {
    p.vortexT = ab.dur; p.vortexTick = 0;
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.5, R: 260, color: '#6fd0e8', dir: 'in', width: 4 });
    game.shake = Math.min(10, game.shake + 3);
  }
  else if (id === 'ink') {
    p.stealthT = ab.dur;
    for (let i = 0; i < 26; i++) {
      if (game.particles.length > 320) game.particles.shift();
      game.particles.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), vx: rand(-50, 50), vy: rand(-50, 50), life: rand(1.2, 2.4), max: 2.4, size: rand(8, 20), color: 'rgba(20,26,44,0.55)' });
    }
  }
  else if (id === 'grasp') {
    // seize the nearest animal: drag it in, crush it, leave it reeling
    let best = null, bd = 150 + p.radius;
    for (const c of game.creatures) { if (c.boss) continue; const d = hyp(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    if (best) {
      const d = bd || 1;
      best.vx += (p.x - best.x) / d * 760; best.vy += (p.y - best.y) / d * 760;
      best.stunT = Math.max(best.stunT || 0, 1.5);
      best.takeDamage(game, p.species.stats.dmg * p.atkMul * 1.2, p.x, p.y, true);
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.4, R: 150 + p.radius, color: '#c98ae0', dir: 'in', width: 3 });
  }
  else if (id === 'ram') {
    p.ramT = ab.dur; p.ramHit = new Set();
    p.vx += Math.cos(p.angle) * 700; p.vy += Math.sin(p.angle) * 700;
    burst(game, p.x, p.y, '#ffb36a', 10, 140);
  }
  else if (id === 'impale') {
    // skewering claw lunge — heavy cone damage in front
    const st = p.species.stats;
    p.jetT = 0.25; p.vx += Math.cos(p.angle) * 560; p.vy += Math.sin(p.angle) * 560;
    const reach = p.radius + st.reach * 1.8, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.4) {
          c.takeDamage(game, st.dmg * p.atkMul * 2, p.x, p.y, true);
          if (!c.boss) c.stunT = Math.max(c.stunT || 0, 0.8);
          burst(game, c.x, c.y, '#ffd27a', 8, 140);
        }
      }
    }
    game.shake = Math.min(12, game.shake + 3);
  }
  else if (id === 'crush') {
    // the guillotine bite — one devastating shear in front
    const st = p.species.stats;
    const reach = p.radius + st.reach + 30, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.2) {
          c.takeDamage(game, st.dmg * p.atkMul * 3, p.x, p.y, true);
          c.vx += dx / (d || 1) * 250; c.vy += dy / (d || 1) * 250;
          burst(game, c.x, c.y, '#ff8a5e', 10, 160);
        }
      }
    }
    game.fx.push({ x: p.x + fx * p.radius, y: p.y + fy * p.radius, t: 0, max: 0.4, R: reach, color: '#ff8a5e', dir: 'out', width: 4 });
    game.shake = Math.min(16, game.shake + 6);
  }
  else if (id === 'shock') {
    const R = 270;
    for (const c of game.creatures.slice()) {
      const d = hyp(c.x - p.x, c.y - p.y);
      if (d < R + c.radius) {
        if (c.boss) { c.slowT = Math.max(c.slowT || 0, 2.8); }
        else { c.stunT = Math.max(c.stunT || 0, 2.8); c.takeDamage(game, 5, p.x, p.y, true); }
      }
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.55, R, color: '#9fdcff', dir: 'out', width: 4 });
    game.shake = Math.min(16, game.shake + 4);
  }
  else if (id === 'websnare') {
    const R = p.radius + 150;
    for (const c of game.creatures.slice()) {
      const d = hyp(c.x - p.x, c.y - p.y);
      if (d >= R + c.radius) continue;
      if (c.boss) c.slowT = Math.max(c.slowT || 0, 4);
      else { c.stunT = Math.max(c.stunT || 0, 2.4); c.vx *= .15; c.vy *= .15; }
      burst(game, c.x, c.y, '#d9e6df', 6, 65);
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: .55, R, color: '#d9e6df', dir: 'out', width: 2 });
  }
  else if (id === 'pounce') {
    // leap onto prey ahead: lunge forward, then a heavy landing that wounds + knocks down
    const st = p.species.stats;
    p.jetT = 0.32; p.vx += Math.cos(p.angle) * 820; p.vy += Math.sin(p.angle) * 820;
    const reach = p.radius + st.reach * 2, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0.1) {
          c.takeDamage(game, st.dmg * p.atkMul * 1.8, p.x, p.y, true);
          if (!c.boss) c.stunT = Math.max(c.stunT || 0, 1);
          c.vx += dx / (d || 1) * 220; c.vy += dy / (d || 1) * 220;
          burst(game, c.x, c.y, '#ffb04e', 8, 150);
        }
      }
    }
    game.shake = Math.min(12, game.shake + 4);
  }
  else if (id === 'burrow') { p.burrowT = ab.dur; burst(game, p.x, p.y, '#6a4e2c', 16, 150); game.shake = Math.min(8, game.shake + 2); }
  else if (id === 'stomp') {
    // ground slam: shockwave that damages, staggers and hurls everything back
    const R = p.radius + 90;
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < R + c.radius) {
        const k = 1 - d / (R + c.radius);
        c.takeDamage(game, 14, p.x, p.y, true);
        if (!c.boss) c.stunT = Math.max(c.stunT || 0, 1.2);
        c.vx += dx / (d || 1) * 520 * k; c.vy += dy / (d || 1) * 520 * k;
      }
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.5, R, color: '#e0a060', dir: 'out', width: 5 });
    game.shake = Math.min(16, game.shake + 6);
  }
  else if (id === 'tailsweep') {
    // full-circle tail whip: knock every nearby animal off its feet
    const R = p.radius + 70;
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < R + c.radius) {
        c.takeDamage(game, 8, p.x, p.y, true);
        c.vx += dx / (d || 1) * 360; c.vy += dy / (d || 1) * 360;
      }
    }
    game.fx.push({ x: p.x, y: p.y, t: 0, max: 0.4, R, color: '#9fd0a0', dir: 'out', width: 4 });
    burst(game, p.x, p.y, '#9fd0a0', 10, 150);
  }
  else if (id === 'sprint') { p.sprintT = ab.dur; burst(game, p.x, p.y, '#9ce0a0', 8, 130); }
  else if (id === 'dive') {
    // aerial dive-bomb: a long fast plunge that slams down on prey ahead
    const st = p.species.stats;
    p.jetT = 0.34; p.vx += Math.cos(p.angle) * 900; p.vy += Math.sin(p.angle) * 900;
    const reach = p.radius + st.reach * 1.9, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const c of game.creatures.slice()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < reach + c.radius) {
        const dot = (dx * fx + dy * fy) / (d || 1);
        if (dot > 0) {
          c.takeDamage(game, st.dmg * p.atkMul * 1.9, p.x, p.y, true);
          if (!c.boss) c.stunT = Math.max(c.stunT || 0, 0.7);
          c.vx += dx / (d || 1) * 200; c.vy += dy / (d || 1) * 200;
          burst(game, c.x, c.y, '#ffd27a', 8, 150);
        }
      }
    }
    game.shake = Math.min(12, game.shake + 4);
  }
  else if (id === 'venomsting') {
    // stinger into a single target ahead: deep damage + potent lingering venom
    const st = p.species.stats, reach = p.radius + st.reach * 1.6, fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    let best = null, bd = 1e9;
    for (const c of game.creatures) {
      const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy);
      if (d < reach + c.radius) { const dot = (dx * fx + dy * fy) / (d || 1); if (dot > 0.2 && d < bd) { bd = d; best = c; } }
    }
    if (best) {
      best.takeDamage(game, st.dmg * p.atkMul * 2.4, p.x, p.y, true);
      best.poisonT = 5; best.poisonDps = Math.max(best.poisonDps || 0, st.dmg * p.atkMul * 0.4);
      if (!best.boss) best.stunT = Math.max(best.stunT || 0, 0.5);
      burst(game, best.x, best.y, '#b6e05a', 12, 160);
    }
    game.shake = Math.min(10, game.shake + 3);
  }

  p.acd[id] = ab.cd * (game.talentBonus ? game.talentBonus.powerCdMul : 1); game.sfx.play('power'); game.pushHud(true);
}

/* Active-power effects. The catalogue (cooldowns, colors, text) lives in
   data/abilities.js; this is what actually happens when a power fires. */
import { ABILITIES } from '../../data/abilities.js';
import { hyp } from '../../core/math.js';
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

  p.acd[id] = ab.cd; game.sfx.play('power'); game.pushHud(true);
}

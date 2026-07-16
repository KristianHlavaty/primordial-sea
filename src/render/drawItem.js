/* Shared vector art for collectible item icons, ground pickups and their attack
   visuals. HUD and world rendering use the same recognizable silhouettes. */
import { ITEMS } from '../data/items.js';
import { TAU, clamp } from '../core/math.js';
import { withA } from '../core/color.js';

export function drawItemIcon(ctx, id, size) {
  const def = ITEMS[id]; if (!def) return;
  const r = size * 0.3, color = def.color;
  ctx.save(); ctx.translate(size / 2, size / 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.fillStyle = withA(color, 0.24); ctx.lineWidth = Math.max(2, size * 0.07);
  if (id === 'bone_club') {
    ctx.rotate(-0.55); ctx.beginPath(); ctx.moveTo(-r * .8, r * .75); ctx.lineTo(r * .55, -r * .55); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r * .62, -r * .62, r * .38, r * .58, -.75, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (id === 'fossil_spear') {
    ctx.rotate(-0.55); ctx.beginPath(); ctx.moveTo(-r, r * .25); ctx.lineTo(r * .65, -r * .25); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(r * 1.05, -r * .38); ctx.lineTo(r * .52, -r * .6); ctx.lineTo(r * .68, 0); ctx.closePath(); ctx.fill();
  } else if (id === 'venom_pod') {
    ctx.beginPath(); ctx.ellipse(0, r * .12, r * .72, r * .9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .48, r * .12 + Math.sin(a) * r * .62, r * .1, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-r * .18, -r * .8); ctx.lineTo(0, -r * 1.1); ctx.lineTo(r * .22, -r * .78); ctx.stroke();
  } else if (id === 'shock_pearl') {
    ctx.beginPath(); ctx.arc(0, 0, r * .72, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(r * .12, -r * .62); ctx.lineTo(-r * .28, r * .02); ctx.lineTo(r * .02, r * .02); ctx.lineTo(-r * .12, r * .62); ctx.lineTo(r * .4, -r * .12); ctx.lineTo(r * .1, -r * .12); ctx.closePath(); ctx.fill();
  } else if (id === 'ak47' || id === 'shotgun') {
    ctx.rotate(-.18); ctx.fillStyle = color; ctx.fillRect(-r * .85, -r * .18, r * 1.55, r * .36); ctx.fillRect(r * .65, -r * .09, r * .45, r * .18);
    if (id === 'ak47') { ctx.beginPath(); ctx.moveTo(-r * .1, r * .12); ctx.lineTo(r * .18, r * .82); ctx.lineTo(r * .48, r * .72); ctx.lineTo(r * .35, r * .12); ctx.fill(); }
    else { ctx.fillRect(-r * .9, r * .15, r * .35, r * .4); ctx.beginPath(); ctx.moveTo(-r * .35, r * .12); ctx.lineTo(-r * .05, r * .72); ctx.lineTo(r * .18, r * .65); ctx.lineTo(r * .08, r * .12); ctx.fill(); }
  } else if (id === 'grenade') {
    ctx.beginPath(); ctx.roundRect(-r * .6, -r * .45, r * 1.2, r * 1.25, r * .3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-r * .22, -r * .78, r * .44, r * .34); ctx.beginPath(); ctx.arc(r * .35, -r * .78, r * .28, -Math.PI * .8, Math.PI * .65); ctx.stroke();
  } else if (id === 'rocket_launcher') {
    ctx.rotate(-.35); ctx.beginPath(); ctx.roundRect(-r, -r * .3, r * 1.65, r * .6, r * .18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r * .6, -r * .45); ctx.lineTo(r * .6, r * .45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * .62, -r * .48); ctx.lineTo(-r * .62, r * .48); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawWorldItem(E, item) {
  const def = ITEMS[item.type]; if (!def) return;
  const ctx = E.ctx, x = item.x - E.cam.x, y = item.y - E.cam.y + Math.sin(E.time * 2.6 + (item.bob || 0)) * 4;
  if (x < -50 || y < -50 || x > E.vw + 50 || y > E.vh + 50) return;
  const pulse = .55 + .45 * Math.sin(E.time * 3 + (item.bob || 0));
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 31); glow.addColorStop(0, withA(def.color, .26 + pulse * .13)); glow.addColorStop(1, withA(def.color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 31, 0, TAU); ctx.fill();
  ctx.translate(x - 19, y - 19); drawItemIcon(ctx, item.type, 38); ctx.restore();
  if (E.player && Math.hypot(item.x - E.player.x, item.y - E.player.y) < 180) {
    ctx.font = '800 10px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    ctx.strokeStyle = '#03101ad9'; ctx.strokeText(def.name, x, y - 27); ctx.fillStyle = def.color; ctx.fillText(def.name, x, y - 27); ctx.textAlign = 'left';
  }
}

export function drawItemProjectile(E, projectile) {
  const ctx = E.ctx, def = ITEMS[projectile.type], color = projectile.color || (def && def.color) || '#fff';
  const x = projectile.x - E.cam.x, y = projectile.y - E.cam.y;
  const frac = projectile.maxLife ? clamp(projectile.life / projectile.maxLife, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = Math.max(.12, frac);
  if (projectile.visual === 'tracer') {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(projectile.angle) * projectile.length, y + Math.sin(projectile.angle) * projectile.length); ctx.stroke();
  } else if (projectile.visual === 'swing') {
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, projectile.radius, projectile.angle - (projectile.spread || .8), projectile.angle + (projectile.spread || .8)); ctx.stroke();
  } else if (projectile.visual === 'pulse' || projectile.visual === 'blast') {
    const progress = 1 - frac, radius = Math.max(8, projectile.radius * (.2 + progress * .8));
    ctx.strokeStyle = color; ctx.fillStyle = withA(color, .12 * frac); ctx.lineWidth = 6 * frac + 1; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (projectile.visual === 'projectile' && def) {
    ctx.translate(x, y); ctx.rotate(projectile.angle || 0); ctx.translate(-14, -14); drawItemIcon(ctx, projectile.type, 28);
  }
  ctx.restore();
}

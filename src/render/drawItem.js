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
  } else if (id === 'laser_pointer') {
    ctx.rotate(-.3); ctx.fillStyle = '#352d36'; ctx.beginPath(); ctx.roundRect(-r * .82, -r * .3, r * 1.45, r * .6, r * .25); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-r * .65, -r * .28, r * .34, r * .56);
    ctx.fillStyle = '#b8b4bb'; ctx.fillRect(r * .52, -r * .22, r * .3, r * .44);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = withA(color, .72); ctx.lineWidth = Math.max(1.2, size * .035); ctx.shadowColor = color; ctx.shadowBlur = r * .55;
    ctx.beginPath(); ctx.moveTo(r * .82, 0); ctx.lineTo(r * 1.26, 0); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 1.32, 0, r * .11, 0, TAU); ctx.fill();
  } else if (id === 'orbital_strike') {
    ctx.beginPath(); ctx.arc(0, r * .18, r * .78, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, r * .18, r * .36, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, r * .18); ctx.lineTo(-r * .46, r * .18); ctx.moveTo(r * .46, r * .18); ctx.lineTo(r, r * .18); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-r * .18, -r * 1.05); ctx.lineTo(r * .18, -r * 1.05); ctx.lineTo(r * .34, r * .08); ctx.lineTo(0, r * .48); ctx.lineTo(-r * .34, r * .08); ctx.closePath(); ctx.fill();
  } else if (id === 'shield_generator') {
    ctx.fillStyle = withA(color, .12); ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, size * .045);
    for (let ring = 0; ring < 2; ring++) {
      const rr = r * (.48 + ring * .4); ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = i / 6 * TAU - Math.PI / 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = '#e9fdff'; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, TAU); ctx.fill();
  } else if (id === 'black_hole_generator') {
    ctx.fillStyle = '#06020d'; ctx.beginPath(); ctx.arc(0, 0, r * .48, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = r * .7;
    ctx.beginPath(); ctx.ellipse(0, 0, r * .92, r * .42, -.35, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#f1dcff'; ctx.lineWidth = Math.max(1.2, size * .035);
    ctx.beginPath(); ctx.arc(0, 0, r * .62, .2, Math.PI * 1.22); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .78, Math.sin(a) * r * .42, r * .1, 0, TAU); ctx.fill(); }
  } else if (id === 'underwater_mine') {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.8, size * .055);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, inner = r * .52, outer = r * 1.02;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(Math.cos(a) * outer, Math.sin(a) * outer, r * .09, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#123e4a'; ctx.shadowColor = color; ctx.shadowBlur = r * .55;
    ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#d9fcff'; ctx.beginPath(); ctx.arc(-r * .18, -r * .2, r * .13, 0, TAU); ctx.fill();
  } else if (id === 'vehicle_torpedo') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(r, 0); ctx.quadraticCurveTo(r * .58, -r * .42, -r * .58, -r * .36); ctx.lineTo(-r * .9, 0); ctx.lineTo(-r * .58, r * .36); ctx.quadraticCurveTo(r * .58, r * .42, r, 0); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * .52, -r * .25); ctx.lineTo(-r * .92, -r * .65); ctx.lineTo(-r * .8, -.05); ctx.lineTo(-r * .92, r * .65); ctx.lineTo(-r * .52, r * .25); ctx.fill();
  } else if (id === 'vehicle_missile') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(r * 1.05, 0); ctx.lineTo(r * .55, -r * .3); ctx.lineTo(-r * .7, -r * .3); ctx.lineTo(-r, 0); ctx.lineTo(-r * .7, r * .3); ctx.lineTo(r * .55, r * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * .52, -r * .22); ctx.lineTo(-r * .9, -r * .62); ctx.lineTo(-r * .76, 0); ctx.lineTo(-r * .9, r * .62); ctx.lineTo(-r * .52, r * .22); ctx.fill();
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

const seeded = (seed, n) => {
  const value = Math.sin((seed || 1) * 12.9898 + n * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function drawTracer(ctx, x, y, projectile, color, frac) {
  const ex = x + Math.cos(projectile.angle) * projectile.length;
  const ey = y + Math.sin(projectile.angle) * projectile.length;
  const gradient = ctx.createLinearGradient(x, y, ex, ey);
  gradient.addColorStop(0, withA(color, 0)); gradient.addColorStop(.05, '#fff');
  gradient.addColorStop(.22, withA(color, .95)); gradient.addColorStop(1, withA(color, 0));
  ctx.save(); ctx.globalAlpha = Math.min(1, frac * 1.8); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = withA(color, .22); ctx.lineWidth = projectile.type === 'shotgun' ? 9 : 6; ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = gradient; ctx.lineWidth = projectile.type === 'shotgun' ? 3.2 : 2.2; ctx.shadowBlur = 5; ctx.stroke();
  ctx.restore();
}

function drawMuzzle(ctx, x, y, projectile, color, frac) {
  const R = projectile.radius || 38, seed = projectile.seed || 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(projectile.angle || 0); ctx.globalAlpha = Math.min(1, frac * 2.2); ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  glow.addColorStop(0, '#fff'); glow.addColorStop(.18, '#fff3b0'); glow.addColorStop(.48, withA(color, .72)); glow.addColorStop(1, withA(color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const offset = (seeded(seed, i) - .5) * R * .32, length = R * (1.1 + seeded(seed, i + 9) * .8), half = R * (.1 + seeded(seed, i + 15) * .13);
    ctx.fillStyle = i < 2 ? '#fff7cf' : withA(color, .8);
    ctx.beginPath(); ctx.moveTo(-R * .1, offset - half); ctx.lineTo(length, offset); ctx.lineTo(-R * .1, offset + half); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawImpact(ctx, x, y, projectile, color, frac) {
  const progress = 1 - frac, seed = projectile.seed || 1, R = projectile.radius || 18;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, R * (1 + progress));
  glow.addColorStop(0, withA('#ffffff', frac)); glow.addColorStop(.25, withA(color, frac * .8)); glow.addColorStop(1, withA(color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * (1 + progress), 0, TAU); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = seeded(seed, i) * TAU, inner = R * .18, outer = R * (.45 + progress * (1.2 + seeded(seed, i + 20)));
    ctx.strokeStyle = i % 3 ? withA(color, frac * .85) : withA('#ffffff', frac); ctx.lineWidth = i % 3 ? 1.8 : 2.6;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.restore();
}

function drawPulse(ctx, x, y, projectile, color, frac) {
  const progress = 1 - frac, eased = 1 - (1 - progress) ** 3, R = projectile.radius, radius = Math.max(12, R * (.08 + eased * .92));
  const seed = projectile.seed || 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, withA('#ffffff', frac * .4)); glow.addColorStop(.28, withA(color, frac * .28)); glow.addColorStop(1, withA(color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = withA('#eaffff', frac * .9); ctx.lineWidth = 2 + frac * 5; ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA(color, frac * .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius * .82, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + seeded(seed, i) * .28;
    ctx.strokeStyle = i % 3 ? withA(color, frac * .75) : withA('#ffffff', frac * .82); ctx.lineWidth = i % 3 ? 1.6 : 2.4;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * radius * .12, y + Math.sin(a) * radius * .12);
    for (let step = 1; step <= 4; step++) {
      const rr = radius * (.12 + step * .2), jitter = (seeded(seed, i * 7 + step) - .5) * radius * .12;
      ctx.lineTo(x + Math.cos(a) * rr - Math.sin(a) * jitter, y + Math.sin(a) * rr + Math.cos(a) * jitter);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawUnderwaterMine(E, ctx, x, y, projectile, color) {
  const R = projectile.radius || 18;
  const armProgress = projectile.armed ? 1 : clamp(1 - (projectile.armT || 0) / (projectile.armMax || 1), 0, 1);
  const blink = projectile.armed ? Math.sin(E.time * 10) ** 2 : .25 + armProgress * .55;
  const ringR = projectile.triggerRadius || 125;
  ctx.save();

  if (projectile.armed) {
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = withA(color, .08 + blink * .14);
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 10]); ctx.lineDashOffset = -E.time * 18;
    ctx.beginPath(); ctx.arc(x, y, ringR * (.94 + blink * .06), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const sonar = ctx.createRadialGradient(x, y, R, x, y, R * (2.6 + blink));
    sonar.addColorStop(0, withA(color, .2 + blink * .13)); sonar.addColorStop(1, withA(color, 0));
    ctx.fillStyle = sonar; ctx.beginPath(); ctx.arc(x, y, R * (2.6 + blink), 0, TAU); ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
  // A short chain and anchor make the deployed object read as a moored naval mine.
  ctx.strokeStyle = 'rgba(105,171,181,.62)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + R * .72); ctx.quadraticCurveTo(x + 5, y + R * 1.2, x, y + R * 1.72); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,125,137,.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y + R * 1.55); ctx.lineTo(x, y + R * 1.95); ctx.moveTo(x - 8, y + R * 1.82); ctx.quadraticCurveTo(x, y + R * 2.12, x + 8, y + R * 1.82); ctx.stroke();

  ctx.translate(x, y); ctx.rotate((projectile.seed || 1) * .001);
  ctx.strokeStyle = withA(color, .75); ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = projectile.armed ? 10 + blink * 8 : 4;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU, inner = R * .58, outer = R * 1.18;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke();
    ctx.fillStyle = i % 2 ? '#75bac5' : color; ctx.beginPath(); ctx.arc(Math.cos(a) * outer, Math.sin(a) * outer, 2.2, 0, TAU); ctx.fill();
  }
  const shell = ctx.createRadialGradient(-R * .28, -R * .35, 1, 0, 0, R);
  shell.addColorStop(0, '#badde1'); shell.addColorStop(.2, '#4f8790'); shell.addColorStop(.68, '#173f49'); shell.addColorStop(1, '#071c24');
  ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(0, 0, R * .72, 0, TAU); ctx.fill();
  ctx.strokeStyle = withA(color, .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * .72, 0, TAU); ctx.stroke();

  const lightColor = projectile.armed ? '#ff566c' : '#ffd96a';
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = withA(lightColor, .45 + blink * .55);
  ctx.shadowColor = lightColor; ctx.shadowBlur = 6 + blink * 12;
  ctx.beginPath(); ctx.arc(-R * .17, -R * .2, 2.7 + blink * 1.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawBoneClubShape(ctx, reach, alpha = 1) {
  const start = reach * .12, end = reach * .86, shaft = Math.max(5, reach * .038);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineJoin = 'round';

  const bone = ctx.createLinearGradient(start, -shaft, end, shaft);
  bone.addColorStop(0, '#9f8053'); bone.addColorStop(.14, '#d8bc83');
  bone.addColorStop(.48, '#f1dca7'); bone.addColorStop(.78, '#c8a66e'); bone.addColorStop(1, '#7b5d3e');
  ctx.fillStyle = bone; ctx.strokeStyle = '#5c432f'; ctx.lineWidth = Math.max(2, reach * .018);
  ctx.beginPath();
  ctx.moveTo(start + 11, -shaft);
  ctx.lineTo(end - 15, -shaft * 1.15);
  ctx.bezierCurveTo(end - 6, -shaft * 1.3, end - 8, -shaft * 3.2, end + 2, -shaft * 3.45);
  ctx.bezierCurveTo(end + 13, -shaft * 3.7, end + 18, -shaft * 1.7, end + 9, -shaft * .35);
  ctx.bezierCurveTo(end + 19, shaft * 1.25, end + 13, shaft * 3.45, end + 2, shaft * 3.35);
  ctx.bezierCurveTo(end - 8, shaft * 3.15, end - 6, shaft * 1.3, end - 15, shaft * 1.15);
  ctx.lineTo(start + 11, shaft);
  ctx.bezierCurveTo(start + 5, shaft * .9, start + 5, shaft * 2.15, start - 2, shaft * 2.35);
  ctx.bezierCurveTo(start - 10, shaft * 2.55, start - 13, shaft * .8, start - 7, 0);
  ctx.bezierCurveTo(start - 13, -shaft * .85, start - 9, -shaft * 2.45, start - 2, -shaft * 2.35);
  ctx.bezierCurveTo(start + 5, -shaft * 2.15, start + 5, -shaft * .9, start + 11, -shaft);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Highlight, pores and small cracks keep the swinging silhouette visibly bone-like.
  ctx.strokeStyle = `rgba(255,245,210,${.58 * alpha})`; ctx.lineWidth = Math.max(1.2, reach * .011);
  ctx.beginPath(); ctx.moveTo(start + 15, -shaft * .35); ctx.quadraticCurveTo(reach * .48, -shaft * .75, end - 17, -shaft * .45); ctx.stroke();
  ctx.fillStyle = `rgba(91,62,38,${.48 * alpha})`;
  for (const spot of [[.55, -.22, .018], [.7, .28, .014], [.3, .18, .012]]) {
    ctx.beginPath(); ctx.ellipse(reach * spot[0], shaft * spot[1], reach * spot[2], reach * spot[2] * .55, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = `rgba(92,60,36,${.58 * alpha})`; ctx.lineWidth = Math.max(1, reach * .009);
  ctx.beginPath(); ctx.moveTo(end - 12, -shaft * .7); ctx.lineTo(end - 22, 0); ctx.lineTo(end - 15, shaft * .55); ctx.stroke();
  ctx.restore();
}

function drawBoneClubSwing(ctx, x, y, projectile, frac) {
  const progress = 1 - frac, eased = progress * progress * (3 - 2 * progress);
  const spread = projectile.spread || .8, reach = projectile.radius || 150;
  const angle = projectile.angle - spread + eased * spread * 2;
  const visibility = clamp(progress * 9, 0, 1) * clamp(frac * 5, 0, 1);
  ctx.save(); ctx.translate(x, y);

  // Translucent copies follow the club itself, making the fast rotation readable
  // without falling back to the old detached neon arc.
  for (let i = 3; i >= 1; i--) {
    ctx.save(); ctx.rotate(angle - spread * .085 * i); ctx.globalAlpha = visibility * (.045 + (3 - i) * .035);
    drawBoneClubShape(ctx, reach, .72); ctx.restore();
  }
  ctx.rotate(angle); ctx.globalAlpha = visibility;
  ctx.shadowColor = 'rgba(255,220,150,.48)'; ctx.shadowBlur = 8;
  drawBoneClubShape(ctx, reach);
  ctx.restore();
}

function drawExplosion(ctx, x, y, projectile, def, color, frac) {
  const progress = 1 - frac, eased = 1 - (1 - progress) ** 3;
  const shockR = projectile.radius || (def && def.shockRadius) || 220;
  const blastR = (def && def.blast) || shockR * .72;
  const conventional = projectile.type === 'grenade' || projectile.type === 'rocket_launcher' || projectile.type === 'vehicle_missile';
  const aquatic = projectile.type === 'vehicle_torpedo' || projectile.type === 'underwater_mine';
  const seed = projectile.seed || 1, fireAlpha = clamp(1 - progress / .78, 0, 1);
  ctx.save();

  // Pressure wave: a bright compressed-air front followed by a wider dust ring.
  const ringR = shockR * (.06 + eased * .94);
  ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = conventional ? '#ff9a45' : color; ctx.shadowBlur = 18;
  ctx.strokeStyle = withA('#ffffff', frac * .72); ctx.lineWidth = 2 + frac * 8;
  ctx.beginPath(); ctx.arc(x, y, ringR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA(conventional ? '#ff9a45' : color, frac * .62); ctx.lineWidth = 4 + frac * 12;
  ctx.beginPath(); ctx.arc(x, y, ringR * .94, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;

  // Billowing smoke lobes expand at different speeds but remain stable frame-to-frame.
  const smokeT = clamp((progress - .06) / .94, 0, 1), smokeFade = Math.sin(smokeT * Math.PI) * (conventional ? .72 : .48);
  for (let i = 0; i < (conventional ? 16 : 11); i++) {
    const a = seeded(seed, i) * TAU, drift = blastR * smokeT * (.12 + seeded(seed, i + 18) * .48);
    const sx = x + Math.cos(a) * drift, sy = y + Math.sin(a) * drift - blastR * smokeT * seeded(seed, i + 40) * .13;
    const lobe = blastR * (.08 + seeded(seed, i + 30) * .12) * (.35 + smokeT * 1.05);
    const smoke = ctx.createRadialGradient(sx - lobe * .18, sy - lobe * .2, lobe * .08, sx, sy, lobe);
    if (conventional) {
      smoke.addColorStop(0, `rgba(105,91,82,${smokeFade * .76})`); smoke.addColorStop(.55, `rgba(55,48,48,${smokeFade * .64})`); smoke.addColorStop(1, 'rgba(20,18,22,0)');
    } else {
      smoke.addColorStop(0, withA(aquatic ? '#efffff' : '#dfff86', smokeFade * .5)); smoke.addColorStop(.5, withA(color, smokeFade * .42)); smoke.addColorStop(1, withA(color, 0));
    }
    ctx.fillStyle = smoke; ctx.beginPath(); ctx.arc(sx, sy, lobe, 0, TAU); ctx.fill();
  }

  // Hot core and rolling fireballs sit in front of the smoke during the first half-second.
  if (fireAlpha > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const coreR = blastR * (.18 + eased * .72), core = ctx.createRadialGradient(x - coreR * .12, y - coreR * .16, 0, x, y, coreR);
    if (conventional) {
      core.addColorStop(0, withA('#ffffff', fireAlpha)); core.addColorStop(.13, withA('#fff3a6', fireAlpha)); core.addColorStop(.38, withA('#ffad32', fireAlpha * .95)); core.addColorStop(.7, withA('#ed4b18', fireAlpha * .7)); core.addColorStop(1, withA('#8f160b', 0));
    } else {
      core.addColorStop(0, withA(aquatic ? '#ffffff' : '#f7ffd4', fireAlpha)); core.addColorStop(.25, withA(aquatic ? '#bff7ff' : '#d9ff6e', fireAlpha * .9)); core.addColorStop(.65, withA(color, fireAlpha * .65)); core.addColorStop(1, withA(color, 0));
    }
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, coreR, 0, TAU); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = seeded(seed, i + 70) * TAU, rr = blastR * eased * (.08 + seeded(seed, i + 80) * .48), r = blastR * (.045 + seeded(seed, i + 90) * .07) * fireAlpha;
      ctx.fillStyle = i % 3 ? withA(conventional ? '#ff7a24' : color, fireAlpha * .78) : withA('#fff0a0', fireAlpha * .9);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(2, r), 0, TAU); ctx.fill();
    }
  }

  // Fast sparks and darker debris sell the scale beyond the central fireball.
  ctx.lineCap = 'round';
  for (let i = 0; i < (conventional ? 24 : 14); i++) {
    const a = seeded(seed, i + 110) * TAU, speed = .36 + seeded(seed, i + 140) * .64;
    const outer = shockR * progress * speed, inner = Math.max(4, outer - shockR * (.035 + seeded(seed, i + 160) * .08));
    ctx.globalCompositeOperation = i % 4 ? 'lighter' : 'source-over';
    ctx.strokeStyle = i % 4 ? withA(conventional ? '#ffb13b' : color, frac * .86) : withA('#302b2b', frac * .72);
    ctx.lineWidth = i % 4 ? 1.4 + seeded(seed, i + 180) * 2 : 3;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.restore();
}

function drawOrbitalMarker(E, ctx, x, y, projectile, def, color, frac) {
  const R = (def && def.blast) || projectile.radius || 320;
  const shockR = (def && def.shockRadius) || R * 1.45;
  const lock = 1 - frac, pulse = .5 + .5 * Math.sin(E.time * (8 + lock * 10));
  const top = -120;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';

  const ground = ctx.createRadialGradient(x, y, 0, x, y, R);
  ground.addColorStop(0, withA('#ffffff', .08 + lock * .12));
  ground.addColorStop(.28, withA(color, .1 + pulse * .08)); ground.addColorStop(1, withA(color, 0));
  ctx.fillStyle = ground; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();

  // A thin acquisition ray makes it clear that the threat is coming from above.
  const guide = ctx.createLinearGradient(x, top, x, y);
  guide.addColorStop(0, withA(color, 0)); guide.addColorStop(.55, withA(color, .12 + lock * .18)); guide.addColorStop(1, withA('#ffffff', .45 + lock * .45));
  ctx.strokeStyle = guide; ctx.lineWidth = 2 + lock * 4; ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.setLineDash([8, 11]); ctx.lineDashOffset = -E.time * (34 + lock * 45);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);

  ctx.strokeStyle = withA(color, .24 + lock * .5); ctx.lineWidth = 2.5; ctx.setLineDash([12, 9]); ctx.lineDashOffset = E.time * 28;
  ctx.beginPath(); ctx.arc(x, y, shockR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = withA('#fff4ff', .45 + pulse * .45); ctx.lineWidth = 3 + lock * 4; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA(color, .65 + pulse * .25); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R * .55, 0, TAU); ctx.stroke();

  ctx.translate(x, y); ctx.rotate(E.time * (1.5 + lock * 2));
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2); ctx.strokeStyle = withA(i % 2 ? '#ffffff' : color, .65 + lock * .3); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R * .78, -.5, .5); ctx.stroke();
  }
  ctx.rotate(-E.time * (1.5 + lock * 2));
  ctx.strokeStyle = withA('#ffffff', .72 + lock * .25); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-R * 1.05, 0); ctx.lineTo(-R * .68, 0); ctx.moveTo(R * .68, 0); ctx.lineTo(R * 1.05, 0);
  ctx.moveTo(0, -R * 1.05); ctx.lineTo(0, -R * .68); ctx.moveTo(0, R * .68); ctx.lineTo(0, R * 1.05); ctx.stroke();
  ctx.fillStyle = withA('#ffffff', .75 + pulse * .25); ctx.beginPath(); ctx.arc(0, 0, 6 + pulse * 5, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 12px "Segoe UI",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,0,18,.85)';
  const text = `ORBITAL LOCK  ${Math.max(0, projectile.life).toFixed(1)}s`;
  ctx.strokeText(text, x, y - R - 18); ctx.fillStyle = color; ctx.fillText(text, x, y - R - 18); ctx.restore();
}

function drawOrbitalBeam(E, ctx, x, y, projectile, def, color, frac) {
  const progress = 1 - frac, eased = 1 - (1 - progress) ** 3;
  const shockR = projectile.radius || (def && def.shockRadius) || 500;
  const blastR = (def && def.blast) || shockR * .66;
  const alpha = Math.pow(frac, .48), top = -180, seed = projectile.seed || 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';

  // Wide atmospheric bloom surrounding an intensely white laser core.
  const cone = ctx.createLinearGradient(x, top, x, y);
  cone.addColorStop(0, withA(color, 0)); cone.addColorStop(.35, withA(color, alpha * .18));
  cone.addColorStop(.78, withA(color, alpha * .5)); cone.addColorStop(1, withA('#ffffff', alpha * .82));
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(x - 24, top); ctx.lineTo(x + 24, top); ctx.lineTo(x + 82, y); ctx.lineTo(x - 82, y); ctx.closePath(); ctx.fill();

  const beam = ctx.createLinearGradient(x - 90, y, x + 90, y);
  beam.addColorStop(0, withA(color, 0)); beam.addColorStop(.22, withA(color, alpha * .5));
  beam.addColorStop(.43, withA('#ffffff', alpha * .96)); beam.addColorStop(.57, withA('#ffffff', alpha * .96));
  beam.addColorStop(.78, withA(color, alpha * .5)); beam.addColorStop(1, withA(color, 0));
  ctx.strokeStyle = beam; ctx.lineWidth = 112; ctx.shadowColor = color; ctx.shadowBlur = 42;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke();
  ctx.strokeStyle = withA('#ffffff', alpha); ctx.lineWidth = 18 + frac * 10; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke();

  // Satellite-energy filaments corkscrew around the main column.
  for (let i = 0; i < 9; i++) {
    const offset = (seeded(seed, i) - .5) * 150, sway = Math.sin(E.time * 18 + i * 2.3) * 18;
    ctx.strokeStyle = withA(i % 3 ? color : '#ffffff', alpha * (.28 + seeded(seed, i + 20) * .35));
    ctx.lineWidth = 1.5 + seeded(seed, i + 30) * 2.5; ctx.beginPath(); ctx.moveTo(x + offset * .2, top);
    ctx.quadraticCurveTo(x + offset + sway, (top + y) * .52, x + offset * .28, y); ctx.stroke();
  }

  const impactR = blastR * (.35 + eased * .85), impact = ctx.createRadialGradient(x, y, 0, x, y, impactR);
  impact.addColorStop(0, withA('#ffffff', alpha)); impact.addColorStop(.12, withA('#fff0ff', alpha * .96));
  impact.addColorStop(.42, withA(color, alpha * .7)); impact.addColorStop(1, withA(color, 0));
  ctx.fillStyle = impact; ctx.beginPath(); ctx.arc(x, y, impactR, 0, TAU); ctx.fill();

  const ringR = shockR * (.06 + eased * .94);
  ctx.strokeStyle = withA('#ffffff', frac * .78); ctx.lineWidth = 3 + frac * 12; ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(x, y, ringR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA(color, frac * .72); ctx.lineWidth = 8 + frac * 18;
  ctx.beginPath(); ctx.arc(x, y, ringR * .94, 0, TAU); ctx.stroke();

  // Radial ionized fragments race along the ground after impact.
  ctx.lineCap = 'round';
  for (let i = 0; i < 28; i++) {
    const a = seeded(seed, i + 60) * TAU, outer = shockR * progress * (.3 + seeded(seed, i + 90) * .7);
    const inner = Math.max(4, outer - 24 - seeded(seed, i + 120) * 54);
    ctx.strokeStyle = withA(i % 4 ? color : '#ffffff', frac * (.45 + seeded(seed, i + 150) * .5));
    ctx.lineWidth = i % 4 ? 2 : 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.restore();
}

function drawBlackHole(E, ctx, x, y, projectile, def, color, frac) {
  const R = projectile.radius || (def && def.field) || 400;
  const progress = 1 - frac, grow = clamp(progress * 7, 0, 1), fade = clamp(frac * 6, 0, 1);
  const alpha = grow * fade, coreR = Math.max(22, R * .085), seed = projectile.seed || 1;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;

  const distortion = ctx.createRadialGradient(0, 0, coreR * .4, 0, 0, R);
  distortion.addColorStop(0, 'rgba(0,0,0,.98)'); distortion.addColorStop(.1, withA('#30105c', .72));
  distortion.addColorStop(.32, withA(color, .19)); distortion.addColorStop(.72, withA(color, .055)); distortion.addColorStop(1, withA(color, 0));
  ctx.fillStyle = distortion; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();

  // Curved accretion streams make the surrounding space visibly flow inward.
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 24; i++) {
    const lane = seeded(seed, i), radius = coreR * 1.25 + (R - coreR) * lane;
    const a = seeded(seed, i + 35) * TAU - E.time * (1.1 + (1 - lane) * 3.4);
    const arc = .12 + (1 - lane) * .5;
    ctx.strokeStyle = withA(i % 5 ? color : '#f5e8ff', (.1 + (1 - lane) * .5) * alpha);
    ctx.lineWidth = 1 + (1 - lane) * 3.2; ctx.beginPath(); ctx.arc(0, 0, radius, a, a + arc); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const rr = coreR * (1.25 + i * .34), squash = .34 + i * .025;
    ctx.save(); ctx.rotate(-.28 + E.time * (i % 2 ? -.16 : .12));
    ctx.strokeStyle = withA(i % 2 ? '#ffffff' : color, alpha * (.26 + (5 - i) * .07)); ctx.lineWidth = 2 + (5 - i) * .45;
    ctx.beginPath(); ctx.ellipse(0, 0, rr * 1.7, rr * squash, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }

  // Event horizon: completely dark center with a hot, asymmetric photon ring.
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = color; ctx.shadowBlur = 26;
  ctx.fillStyle = '#010004'; ctx.beginPath(); ctx.arc(0, 0, coreR, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = withA('#f7eaff', alpha * .95); ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(0, 0, coreR * 1.05, -.55, Math.PI * .9); ctx.stroke();
  ctx.strokeStyle = withA(color, alpha * .8); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, coreR * 1.18, Math.PI * .82, TAU - .35); ctx.stroke();
  ctx.restore();
}

function drawLaserPointer(ctx, x, y, projectile, color, frac) {
  const length = projectile.length || 0, ex = x + Math.cos(projectile.angle) * length, ey = y + Math.sin(projectile.angle) * length;
  const targetR = projectile.radius || 12, progress = 1 - frac, pulse = .5 + .5 * Math.sin(progress * 52 + (projectile.seed || 1));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.strokeStyle = withA(color, frac * .24); ctx.lineWidth = 7; ctx.shadowColor = color; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = withA('#fff3f5', frac * .96); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  const dot = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10 + pulse * 5);
  dot.addColorStop(0, '#ffffff'); dot.addColorStop(.18, color); dot.addColorStop(1, withA(color, 0));
  ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(ex, ey, 10 + pulse * 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = withA(color, frac * (.45 + pulse * .35)); ctx.lineWidth = 1.8; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(ex, ey, targetR + 8 + progress * 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawCatAttack(E, ctx, x, y, projectile, frac) {
  const progress = 1 - frac, targetR = Math.max(18, projectile.radius || 18);
  const size = clamp(35 + targetR * .22, 39, 66), seed = projectile.seed || 1;
  const appear = clamp(progress * 8, 0, 1) * clamp(frac * 7, 0, 1);
  const swipe = Math.sin(progress * TAU * 5.7), gait = Math.sin(progress * TAU * 8.5);
  const bodyX = -targetR - size * 1.02, headX = -targetR - size * .36;
  ctx.save(); ctx.translate(x, y); ctx.rotate(projectile.angle || 0); ctx.globalAlpha = appear;

  // Cartoon smoke makes the cat visibly pop into existence and vanish again.
  const poof = Math.max(clamp(1 - progress * 5.2, 0, 1), clamp((.2 - frac) * 5, 0, 1));
  if (poof > 0) {
    ctx.fillStyle = withA('#fff8e8', poof * .72); ctx.strokeStyle = withA('#ffb8c5', poof * .55); ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + seeded(seed, i) * .3, distance = size * (.25 + (1 - poof) * .8);
      ctx.beginPath(); ctx.arc(bodyX + Math.cos(a) * distance, Math.sin(a) * distance, size * (.2 + seeded(seed, i + 20) * .14) * poof, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }

  const scale = .72 + appear * .28; ctx.scale(scale, scale); ctx.translate(0, Math.sin(progress * TAU * 7) * size * .045); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(bodyX + size * .18, size * .58, size * 1.05, size * .24, 0, 0, TAU); ctx.fill();

  // Two animated hind legs scramble for purchase while the front pair scratch.
  // Drawing them before the torso keeps the joints readable without looking
  // detached from the body.
  const hindLegs = [
    { x: bodyX - size * .43, phase: gait, color: '#d86232' },
    { x: bodyX + size * .03, phase: -gait, color: '#f39a48' },
  ];
  for (const leg of hindLegs) {
    const kneeX = leg.x - size * (.08 + leg.phase * .1), kneeY = size * (.5 - Math.abs(leg.phase) * .08);
    const footX = leg.x + leg.phase * size * .34, footY = size * (.77 + Math.abs(leg.phase) * .04);
    ctx.strokeStyle = '#713326'; ctx.lineWidth = size * .27;
    ctx.beginPath(); ctx.moveTo(leg.x, size * .2); ctx.quadraticCurveTo(kneeX, kneeY, footX, footY); ctx.stroke();
    ctx.strokeStyle = leg.color; ctx.lineWidth = size * .19; ctx.stroke();
    ctx.fillStyle = '#ffd18a'; ctx.strokeStyle = '#713326'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(footX + size * .09, footY, size * .19, size * .11, leg.phase * .12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8b4932'; ctx.lineWidth = 1;
    for (let toe = -1; toe <= 1; toe++) { ctx.beginPath(); ctx.moveTo(footX + size * .13, footY + toe * size * .045); ctx.lineTo(footX + size * .23, footY + toe * size * .05); ctx.stroke(); }
  }

  // Tail, body and striped orange coat.
  ctx.strokeStyle = '#a94d27'; ctx.lineWidth = size * .22;
  ctx.beginPath(); ctx.moveTo(bodyX - size * .7, size * .03); ctx.bezierCurveTo(bodyX - size * 1.55, -size * (.5 + swipe * .08), bodyX - size * 1.2, -size * (1.18 - swipe * .08), bodyX - size * .52, -size * .82); ctx.stroke();
  ctx.strokeStyle = '#f39445'; ctx.lineWidth = size * .14; ctx.stroke();
  const fur = ctx.createLinearGradient(bodyX, -size, headX, size);
  fur.addColorStop(0, '#ffd076'); fur.addColorStop(.5, '#f28a3f'); fur.addColorStop(1, '#bd4f2d');
  ctx.shadowColor = 'rgba(255,183,93,.5)'; ctx.shadowBlur = 9; ctx.fillStyle = fur; ctx.strokeStyle = '#4e251f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(bodyX, 0, size * .9, size * .58, -.08, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f59a48'; ctx.beginPath(); ctx.arc(headX, -size * .08, size * .48, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX - size * .36, -size * .35); ctx.lineTo(headX - size * .22, -size * .82); ctx.lineTo(headX + size * .02, -size * .43); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(headX + size * .12, -size * .43); ctx.lineTo(headX + size * .37, -size * .78); ctx.lineTo(headX + size * .4, -size * .27); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffbdba';
  ctx.beginPath(); ctx.moveTo(headX - size * .25, -size * .46); ctx.lineTo(headX - size * .2, -size * .69); ctx.lineTo(headX - size * .05, -size * .45); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(headX + size * .17, -size * .45); ctx.lineTo(headX + size * .34, -size * .66); ctx.lineTo(headX + size * .34, -size * .34); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8c3d29'; ctx.lineWidth = 2.5;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(bodyX - size * .1 + i * size * .3, -size * .48); ctx.lineTo(bodyX + i * size * .3, -size * .14); ctx.stroke(); }

  // Furious face, whiskers and two alternating scratching paws.
  ctx.fillStyle = '#f4e86d'; ctx.strokeStyle = '#41231f'; ctx.lineWidth = 1.7;
  for (const ey of [-1, 1]) {
    const eyeY = -size * .18 + ey * size * .11;
    ctx.beginPath(); ctx.ellipse(headX + size * .27, eyeY, size * .1, size * .065, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#141018'; ctx.beginPath(); ctx.moveTo(headX + size * .27, eyeY - size * .055); ctx.lineTo(headX + size * .27, eyeY + size * .055); ctx.stroke(); ctx.strokeStyle = '#41231f';
  }
  ctx.fillStyle = '#ffe0b0'; ctx.beginPath(); ctx.ellipse(headX + size * .33, size * .02, size * .23, size * .18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8ca3'; ctx.beginPath(); ctx.moveTo(headX + size * .49, -size * .08); ctx.lineTo(headX + size * .34, -size * .15); ctx.lineTo(headX + size * .36, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#55251f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(headX + size * .38, size * .06, size * .15, -.45, .65); ctx.stroke();
  ctx.fillStyle = '#fff7e5';
  ctx.beginPath(); ctx.moveTo(headX + size * .42, size * .13); ctx.lineTo(headX + size * .48, size * .31); ctx.lineTo(headX + size * .52, size * .12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff2dc'; ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i += 2) { const wy = i * size * .12; ctx.beginPath(); ctx.moveTo(headX + size * .38, -size * .06 + wy); ctx.lineTo(headX + size * .82, -size * .1 + wy * 1.35); ctx.stroke(); }

  const pawEnd = -targetR * .18, pawStart = headX - size * .04;
  for (let i = -1; i <= 1; i += 2) {
    const lift = i * size * (.18 + swipe * .13), endY = i * size * .16 - swipe * i * size * .28;
    ctx.strokeStyle = '#713326'; ctx.lineWidth = size * .28;
    ctx.beginPath(); ctx.moveTo(pawStart, lift); ctx.quadraticCurveTo(-targetR - size * .05, lift * .45, pawEnd, endY); ctx.stroke();
    ctx.strokeStyle = i > 0 ? '#d86232' : '#f6a250'; ctx.lineWidth = size * .19;
    ctx.beginPath(); ctx.moveTo(pawStart, lift); ctx.quadraticCurveTo(-targetR - size * .05, lift * .45, pawEnd, endY); ctx.stroke();
    ctx.fillStyle = '#ffd18a'; ctx.strokeStyle = '#713326'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(pawEnd, endY, size * .18, size * .13, i * .2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff7e9'; ctx.lineWidth = 1.5;
    for (let claw = -1; claw <= 1; claw++) { ctx.beginPath(); ctx.moveTo(pawEnd, endY + claw * 3); ctx.lineTo(pawEnd + size * .2, endY + claw * 3 + i * 2); ctx.stroke(); }
  }
  ctx.restore();
}

function drawCatSlash(ctx, x, y, projectile, color, frac) {
  const progress = 1 - frac, reach = projectile.radius || 55, sweep = 1 - (1 - progress) ** 3;
  ctx.save(); ctx.translate(x, y); ctx.rotate((projectile.angle || 0) - .72); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const offset = i * reach * .18;
    ctx.strokeStyle = i ? withA(color, frac * .82) : withA('#fff9dc', frac);
    ctx.lineWidth = i ? 3.5 : 5; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(-reach * .55, offset - reach * .25); ctx.quadraticCurveTo(0, offset + reach * (.5 - sweep * .25), reach * .58, offset + reach * .2); ctx.stroke();
  }
  ctx.restore();
}

export function drawItemProjectile(E, projectile) {
  const ctx = E.ctx, def = ITEMS[projectile.type], color = projectile.color || (def && def.color) || '#fff';
  const x = projectile.x - E.cam.x, y = projectile.y - E.cam.y;
  const frac = projectile.maxLife ? clamp(projectile.life / projectile.maxLife, 0, 1) : 1;
  if (projectile.visual === 'orbital_marker') {
    drawOrbitalMarker(E, ctx, x, y, projectile, def, color, frac);
  } else if (projectile.visual === 'orbital_beam') {
    drawOrbitalBeam(E, ctx, x, y, projectile, def, color, frac);
  } else if (projectile.visual === 'black_hole') {
    drawBlackHole(E, ctx, x, y, projectile, def, color, frac);
  } else if (projectile.visual === 'mine') {
    drawUnderwaterMine(E, ctx, x, y, projectile, color);
  } else if (projectile.visual === 'laser_pointer') {
    drawLaserPointer(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'cat_attack') {
    drawCatAttack(E, ctx, x, y, projectile, frac);
  } else if (projectile.visual === 'cat_slash') {
    drawCatSlash(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'tracer') {
    drawTracer(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'muzzle') {
    drawMuzzle(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'impact') {
    drawImpact(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'swing') {
    if (projectile.type === 'bone_club') drawBoneClubSwing(ctx, x, y, projectile, frac);
    else {
      ctx.save(); ctx.globalAlpha = Math.min(1, frac * 1.7); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, projectile.radius, projectile.angle - (projectile.spread || .8), projectile.angle + (projectile.spread || .8)); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .7); ctx.lineWidth = 2.2; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.arc(x, y, projectile.radius * .94, projectile.angle - (projectile.spread || .8), projectile.angle + (projectile.spread || .8)); ctx.stroke(); ctx.restore();
    }
  } else if (projectile.visual === 'pulse' || projectile.visual === 'mine_ping') {
    drawPulse(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'force_field_burst') {
    drawPulse(ctx, x, y, projectile, color, frac);
  } else if (projectile.visual === 'blast') {
    drawExplosion(ctx, x, y, projectile, def, color, frac);
  } else if (projectile.visual === 'projectile' && def) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(projectile.angle || 0);
    if (projectile.type === 'rocket_launcher' || projectile.type === 'vehicle_missile') {
      ctx.globalCompositeOperation = 'lighter';
      const flame = ctx.createLinearGradient(-44, 0, -4, 0); flame.addColorStop(0, 'rgba(255,65,20,0)'); flame.addColorStop(.45, '#ff7b24'); flame.addColorStop(.78, '#ffe36e'); flame.addColorStop(1, '#fff');
      ctx.fillStyle = flame; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(-9, -8); ctx.lineTo(-4, 0); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (projectile.type === 'vehicle_torpedo') {
      ctx.globalCompositeOperation = 'lighter';
      const wake = ctx.createLinearGradient(-58, 0, -5, 0); wake.addColorStop(0, withA(color, 0)); wake.addColorStop(.55, withA(color, .35)); wake.addColorStop(1, '#e9ffff');
      ctx.strokeStyle = wake; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(-7, 0); ctx.stroke();
      ctx.fillStyle = withA('#e9ffff', .65);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-23 - i * 9, Math.sin(E.time * 12 + i) * 5, 1.5 + i * .35, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (projectile.type === 'fossil_spear') {
      ctx.strokeStyle = withA(color, .62); ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-8, 0); ctx.stroke();
    } else if (projectile.type === 'venom_pod') {
      ctx.fillStyle = withA(color, .18); ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
    } else if (projectile.type === 'black_hole_generator') {
      const pulse = .55 + .45 * Math.sin(E.time * 14);
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = withA(color, .45 + pulse * .45); ctx.lineWidth = 2.5;
      ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, 21 + pulse * 5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .35 + pulse * .5); ctx.setLineDash([4, 5]); ctx.lineDashOffset = -E.time * 22;
      ctx.beginPath(); ctx.arc(0, 0, 29, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.translate(-14, -14); drawItemIcon(ctx, projectile.type, 28);
    if (projectile.type === 'grenade') {
      const blink = .45 + .55 * Math.sin(E.time * 22) ** 2; ctx.fillStyle = `rgba(255,220,110,${blink})`; ctx.beginPath(); ctx.arc(21, 5, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

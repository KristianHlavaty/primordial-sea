/* Draws one full frame from engine state E. Order matters:
   background → (camera shake) sea floor → plants → food → eggs → creatures
   → boss decorations → player + power visuals → bite arc → particles
   → ability rings → floating text → bubbles → danger vignette
   → off-screen boss markers → evolve-modal previews. */
import { TAU, clamp, hyp } from '../core/math.js';
import { shade, withA } from '../core/color.js';
import { drawCreature } from './drawCreature.js';
import { drawPlant } from './drawPlant.js';
import { drawObstacle } from './drawObstacle.js';
import { drawWorldItem, drawItemProjectile } from './drawItem.js';
import { drawVehicle } from './drawVehicle.js';
import { SPECIES } from '../data/species.js';
import { ABILITIES } from '../data/abilities.js';
import { MAPS } from '../data/maps.js';

/* Ground palettes for the land themes (top-down dirt/moss). */
const LAND_THEMES = {
  coast: { ground: '#9c8452', patch: '#7a6238', pebble: '#b8a06a', mote: 'rgba(240,228,180,0.16)' },
  swamp: { ground: '#33482a', patch: '#22331b', pebble: '#4a6238', mote: 'rgba(180,220,150,0.14)' },
  marsh: { ground: '#425138', patch: '#283524', pebble: '#627052', mote: 'rgba(205,225,165,0.16)' },
  webgrove: { ground: '#3f4239', patch: '#252b27', pebble: '#6e6d61', mote: 'rgba(225,225,205,0.13)' },
};

const SPECIAL_NAMES = {
  quake: 'SEISMIC QUAKE', shellRush: 'SHELL RUSH', charge: 'RENDING CHARGE', tailFan: 'TAIL FAN',
  tidalSweep: 'TIDAL SWEEP', undertow: 'UNDERTOW', stomp: 'CRUSHING STOMP', fissure: 'EARTH FISSURE',
  webBurst: 'SILK PRISON', cocoon: 'BROOD COCOON', mire: 'MIASMA POOL', tongueLash: 'TONGUE LASH',
  radiantNova: 'RADIANT NOVA', starMotes: 'LIVING CONSTELLATION', abyssBeam: 'ABYSSAL BEAM',
};

function drawWebFields(E) {
  const ctx = E.ctx;
  for (const w of E.webs || []) {
    const x = w.x - E.cam.x, y = w.y - E.cam.y;
    if (x < -w.r || x > E.vw + w.r || y < -w.r || y > E.vh + w.r) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(w.angle || 0);
    const fade = w.life == null ? 1 : Math.min(1, w.life / 1.5);
    const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, w.r); gg.addColorStop(0, `rgba(235,240,232,${.12 * fade})`); gg.addColorStop(1, 'rgba(225,235,228,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, w.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(225,232,226,${.48 * fade})`; ctx.lineWidth = 1.2;
    const spokes = 10;
    for (let i = 0; i < spokes; i++) { const a = i / spokes * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w.r, Math.sin(a) * w.r); ctx.stroke(); }
    for (let ring = 1; ring <= 4; ring++) {
      const rr = w.r * ring / 4; ctx.beginPath();
      for (let i = 0; i <= spokes; i++) { const a = i / spokes * TAU, warp = 1 + Math.sin(i * 2.3 + ring) * .05; const px = Math.cos(a) * rr * warp, py = Math.sin(a) * rr * warp; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = `rgba(245,248,240,${.65 * fade})`; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.restore();
  }
}

/* Boss attacks are painted under the action during their wind-up. The fill is
   intentionally faint; the bright, closing edge communicates when to dodge. */
function drawBossTelegraphs(E) {
  const ctx = E.ctx;
  for (const b of E.creatures) {
    const q = b.boss && b.telegraph; if (!q) continue;
    const pulse = .65 + .35 * Math.sin(E.time * 13), progress = 1 - q.t / q.max;
    const ox = q.ox - E.cam.x, oy = q.oy - E.cam.y, x = q.x - E.cam.x, y = q.y - E.cam.y;
    ctx.save(); ctx.fillStyle = withA(q.color, .10 + progress * .12); ctx.strokeStyle = withA(q.color, .55 + .35 * pulse); ctx.lineWidth = 2.5 + progress * 2;
    if (q.shape === 'circle') {
      ctx.beginPath(); ctx.arc(x, y, q.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .35 + .35 * pulse); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, Math.max(8, q.r * (1 - progress)), 0, TAU); ctx.stroke();
      if (q.special === 'starMotes') {
        ctx.strokeStyle = withA('#a6fbff', .28 + pulse * .35); ctx.beginPath();
        for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU + E.time * .5, px = x + Math.cos(a) * q.r * .68, py = y + Math.sin(a) * q.r * .68; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke(); ctx.fillStyle = withA('#e5ffff', .6 + pulse * .35);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + E.time * .5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * q.r * .68, y + Math.sin(a) * q.r * .68, 3.5, 0, TAU); ctx.fill(); }
      }
    } else if (q.shape === 'ring') {
      ctx.beginPath(); ctx.arc(x, y, q.outer, 0, TAU); ctx.arc(x, y, q.inner, 0, TAU, true); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, q.outer, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, q.inner, 0, TAU); ctx.stroke();
      const sweep = q.inner + (q.outer - q.inner) * progress;
      ctx.strokeStyle = withA('#ffffff', .45 + .4 * pulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, sweep, 0, TAU); ctx.stroke();
    } else if (q.shape === 'lane') {
      ctx.translate(ox, oy); ctx.rotate(q.angle); ctx.beginPath(); ctx.rect(0, -q.width / 2, q.length, q.width); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .25 + .3 * pulse); ctx.beginPath(); ctx.moveTo(q.length * progress, -q.width / 2); ctx.lineTo(q.length * progress, q.width / 2); ctx.stroke();
      if (q.special === 'abyssBeam') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -E.time * 45;
        ctx.strokeStyle = withA('#a6fbff', .35 + pulse * .45); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q.length, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }
    } else if (q.shape === 'cone') {
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, q.length, q.angle - q.spread, q.angle + q.spread); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .3 + .3 * pulse); ctx.beginPath(); ctx.arc(ox, oy, q.length * progress, q.angle - q.spread, q.angle + q.spread); ctx.stroke();
    }
    const labelX = q.shape === 'lane' ? q.length * .5 : q.shape === 'cone' ? ox + Math.cos(q.angle) * q.length * .58 : x;
    const labelY = q.shape === 'lane' ? 0 : q.shape === 'cone' ? oy + Math.sin(q.angle) * q.length * .58 : y;
    ctx.font = '900 11px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(SPECIAL_NAMES[q.special] || 'SPECIAL ATTACK', labelX, labelY);
    ctx.fillStyle = withA('#ffffff', .78 + .2 * pulse); ctx.fillText(SPECIAL_NAMES[q.special] || 'SPECIAL ATTACK', labelX, labelY); ctx.textAlign = 'left';
    ctx.restore();
  }
}

function drawCocoon(E, c, sx, sy) {
  const ctx = E.ctx, pulse = .5 + .5 * Math.sin(E.time * 7), urgency = 1 - c.hatchT / 7;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.sin(E.time * 2) * .035);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52); glow.addColorStop(0, withA('#e08b9f', .18 + urgency * .22)); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 52, 0, TAU); ctx.fill();
  ctx.strokeStyle = withA('#eee9df', .3); ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + E.time * .08; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 17); ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); ctx.stroke(); }
  const body = ctx.createLinearGradient(-18, -25, 18, 25); body.addColorStop(0, '#f0eee7'); body.addColorStop(.55, '#bdb7ae'); body.addColorStop(1, '#766d6e');
  ctx.fillStyle = body; ctx.strokeStyle = withA('#e08b9f', .6 + pulse * .3); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 23 + pulse * 2, 31 + pulse, -.16, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,75,78,.42)'; ctx.lineWidth = 1.3;
  for (let y = -20; y <= 20; y += 8) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.quadraticCurveTo(0, y + 7, 20, y - 1); ctx.stroke(); }
  ctx.restore();
}

function drawLumenOrb(E, c, sx, sy) {
  const ctx = E.ctx, pulse = .55 + .45 * Math.sin(E.time * 9 + c.animOff);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = withA('#49eaff', .22 + pulse * .22); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - c.vx * .16, sy - c.vy * .16); ctx.stroke();
  const gg = ctx.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 28); gg.addColorStop(0, '#ffffff'); gg.addColorStop(.2, withA('#a6fbff', .95)); gg.addColorStop(.48, withA('#49eaff', .5 + pulse * .2)); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx, sy, 28, 0, TAU); ctx.fill(); ctx.restore();
}

function drawBossGlow(E, c, sx, sy) {
  if (!c.plan.glow) return;
  const ctx = E.ctx, pulse = .5 + .5 * Math.sin(E.time * 2.6), R = c.radius * (3.1 + pulse * .35);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createRadialGradient(sx, sy, c.radius * .25, sx, sy, R); gg.addColorStop(0, withA(c.plan.glow, .28 + pulse * .12)); gg.addColorStop(.38, withA(c.plan.glow, .12)); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + E.time * (i % 2 ? .16 : -.12), rr = c.radius * (1.45 + (i % 3) * .25); ctx.fillStyle = withA(i % 2 ? '#a6fbff' : c.plan.glow, .32 + pulse * .3); ctx.beginPath(); ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 2 + i % 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawBackground(E) {
  if (E.stage !== 'sea') { drawLandBackground(E); return; }
  const ctx = E.ctx;
  const abyss = E.theme === 'abyss';
  const g = ctx.createLinearGradient(0, 0, 0, E.vh);
  const topDepth = clamp(E.cam.y / E.H, 0, 1);
  g.addColorStop(0, abyss ? '#061126' : shade('#1c6a92', -topDepth * 0.55));
  g.addColorStop(0.5, abyss ? '#020718' : shade('#0b3350', -topDepth * 0.3));
  g.addColorStop(1, abyss ? '#00030c' : '#04121e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.vw, E.vh);
  // light rays from the surface
  if (!abyss && E.cam.y < E.vh) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + E.time * 0.01) % 1) * E.vw * 1.3 - E.vw * 0.15; const w = 60 + i * 18;
      const lg = ctx.createLinearGradient(x, 0, x + 80, E.vh);
      lg.addColorStop(0, 'rgba(150,220,255,0.06)'); lg.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + 120, E.vh); ctx.lineTo(x + 80, E.vh); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (abyss) drawAbyssAmbience(E);
}

function drawAbyssAmbience(E) {
  const ctx = E.ctx;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 42; i++) {
    const wx = (i * 811 + 170) % E.W, wy = (i * 577 + 90) % E.H;
    const x = wx - E.cam.x, y = wy - E.cam.y; if (x < -50 || x > E.vw + 50 || y < -50 || y > E.vh + 50) continue;
    const pulse = .35 + .3 * Math.sin(E.time * (1.1 + i % 4 * .13) + i), r = 1.2 + i % 3;
    ctx.fillStyle = i % 3 ? `rgba(73,234,255,${pulse})` : `rgba(142,111,255,${pulse * .75})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const wx = (i * 617 + 360) % E.W, wy = (i * 941 + 420) % E.H, x = wx - E.cam.x, y = wy - E.cam.y;
    const gg = ctx.createRadialGradient(x, y, 1, x, y, 85); gg.addColorStop(0, 'rgba(48,176,207,.065)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 85, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* Top-down terrain: a ground gradient plus world-anchored dirt patches and
   pebbles (positions derived from index so they don't flicker frame to frame). */
function drawLandBackground(E) {
  const ctx = E.ctx; const T = LAND_THEMES[E.theme] || LAND_THEMES.coast;
  const g = ctx.createLinearGradient(0, 0, 0, E.vh);
  g.addColorStop(0, shade(T.ground, 0.10)); g.addColorStop(1, shade(T.ground, -0.16));
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.vw, E.vh);
  // dirt patches
  ctx.fillStyle = withA(T.patch, 0.55);
  for (let i = 0; i < 46; i++) {
    const wx = (i * 613.0) % E.W, wy = (i * 971.0) % E.H;
    const sx = wx - E.cam.x, sy = wy - E.cam.y;
    if (sx < -160 || sx > E.vw + 160 || sy < -120 || sy > E.vh + 120) continue;
    const rw = 60 + (i % 5) * 24, rh = rw * 0.55;
    ctx.beginPath(); ctx.ellipse(sx, sy, rw, rh, (i % 7) * 0.4, 0, TAU); ctx.fill();
  }
  // scattered pebbles
  ctx.fillStyle = withA(T.pebble, 0.5);
  for (let i = 0; i < 60; i++) {
    const wx = (i * 271.0 + 90) % E.W, wy = (i * 457.0 + 40) % E.H;
    const sx = wx - E.cam.x, sy = wy - E.cam.y;
    if (sx < -20 || sx > E.vw + 20 || sy < -20 || sy > E.vh + 20) continue;
    ctx.beginPath(); ctx.arc(sx, sy, 2 + (i % 3), 0, TAU); ctx.fill();
  }
}

/* Faint streaks flowing with the sea current — screen-space water texture. */
function drawCurrent(E) {
  if (E.stage !== 'sea' || !E.flow || !E.flow.length) return;
  const ctx = E.ctx;
  ctx.strokeStyle = 'rgba(170,220,255,0.09)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (const s of E.flow) { ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke(); }
}

function drawBubbles(E) {
  if (E.stage !== 'sea') return;   // bubbles are an underwater effect — none on land
  const ctx = E.ctx;
  ctx.fillStyle = 'rgba(200,235,255,0.18)';
  for (const b of E.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
}

function drawSeaFloor(E) {
  const ctx = E.ctx, floorScreenY = E.H - 120 - E.cam.y;
  if (floorScreenY >= E.vh) return;
  const map = MAPS[E.mapId], passage = map.passages && map.passages.bottom;
  let gapL = -1, gapR = -1;
  if (passage) {
    const center = E.W * passage.center - E.cam.x; gapL = center - passage.width * .5; gapR = center + passage.width * .5;
    const gg = ctx.createLinearGradient(0, floorScreenY - 75, 0, E.vh);
    gg.addColorStop(0, 'rgba(60,225,246,0)'); gg.addColorStop(.48, 'rgba(43,185,218,.11)'); gg.addColorStop(1, 'rgba(12,62,105,.32)');
    ctx.fillStyle = gg; ctx.fillRect(gapL, floorScreenY - 75, passage.width, E.vh - floorScreenY + 75);
  }
  ctx.fillStyle = E.theme === 'abyss' ? '#020611' : '#071a13';
  if (passage) {
    const leftEnd = clamp(gapL, 0, E.vw), rightStart = clamp(gapR, 0, E.vw);
    ctx.fillRect(0, floorScreenY + 60, leftEnd, E.vh); ctx.fillRect(rightStart, floorScreenY + 60, E.vw - rightStart, E.vh);
  }
  else ctx.fillRect(0, floorScreenY + 60, E.vw, E.vh);
  ctx.fillStyle = E.theme === 'abyss' ? '#070c1b' : '#0c2a1e';
  for (let i = 0; i < 8; i++) {
    const x = (i * .14 + .03) * E.W - E.cam.x;
    if (passage && x > gapL - 110 && x < gapR + 110) continue;
    ctx.beginPath(); ctx.ellipse(x, floorScreenY + 70, 120, 40, 0, 0, TAU); ctx.fill();
  }
  if (passage && gapR > 0 && gapL < E.vw) {
    const center = (gapL + gapR) * .5, pulse = .5 + .5 * Math.sin(E.time * 3.4);
    ctx.strokeStyle = withA('#60efff', .4 + pulse * .35); ctx.lineWidth = 3;
    for (const edge of [gapL, gapR]) { ctx.beginPath(); ctx.moveTo(edge, floorScreenY + 20); ctx.quadraticCurveTo(edge + (edge === gapL ? -34 : 34), floorScreenY + 68, edge + (edge === gapL ? -52 : 52), E.vh); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.font = '900 11px "Segoe UI",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('DESCEND  ·  THE STARLESS BLOOM', center, floorScreenY + 16); ctx.fillStyle = withA('#b7fbff', .76 + pulse * .22); ctx.fillText('DESCEND  ·  THE STARLESS BLOOM', center, floorScreenY + 16);
    ctx.font = '900 22px "Segoe UI",sans-serif';
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = .3 + .22 * ((i + E.time * 2) % 3); ctx.fillText('▼', center, floorScreenY + 43 + i * 21); }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
}

function drawTopSeaPassage(E) {
  const passage = MAPS[E.mapId].passages && MAPS[E.mapId].passages.top;
  if (!passage || E.cam.y > 150) return;
  const ctx = E.ctx, center = E.W * passage.center - E.cam.x, pulse = .5 + .5 * Math.sin(E.time * 3.2);
  const gg = ctx.createRadialGradient(center, 0, 8, center, 0, passage.width * .46); gg.addColorStop(0, withA('#78f2ff', .18 + pulse * .08)); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(center, 0, passage.width * .46, 0, TAU); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = '900 11px "Segoe UI",sans-serif'; ctx.fillStyle = withA('#c9fcff', .75 + pulse * .2);
  ctx.fillText('▲  ASCEND TO THE PRIMORDIAL SEA  ▲', center, 28); ctx.textAlign = 'left';
}

function drawEnrolled(E, player, sx, sy, radius) {
  const ctx = E.ctx, body = player.plan.body, accent = player.plan.accent, speed = hyp(player.vx || 0, player.vy || 0);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(E.time * (5.2 + Math.min(4, speed / 170))); const r = radius * 1.12;
  const glow = ctx.createRadialGradient(0, 0, r * .55, 0, 0, r * 1.65); glow.addColorStop(0, withA(accent, .16)); glow.addColorStop(1, withA(accent, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 1.65, 0, TAU); ctx.fill();
  const bg = ctx.createRadialGradient(-r * .3, -r * .3, 1, 0, 0, r * 1.2); bg.addColorStop(0, shade(body, .35)); bg.addColorStop(1, shade(body, -.32));
  ctx.fillStyle = bg; ctx.strokeStyle = shade(body, -.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = withA(shade(body, -.45), .75); ctx.lineWidth = 1.6;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * i / 4, .3, Math.PI - .3); ctx.stroke(); }
  ctx.fillStyle = shade(accent, -.05);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); ctx.lineTo(Math.cos(a + .22) * r, Math.sin(a + .22) * r); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

/* Draw a creature/player at its world position (screen-space transform,
   flip vertically when facing left so it never renders upside-down). */
function drawEntity(E, e) {
  const ctx = E.ctx;
  ctx.save(); ctx.translate(e.x - E.cam.x, e.y - E.cam.y); ctx.rotate(e.angle);
  if (Math.cos(e.angle) < 0) ctx.scale(1, -1);
  const frenzy = e.frenzyT > 0, ramming = e.ramT > 0;
  const leapProgress = e.leapT > 0 && e.leapMax ? 1 - e.leapT / e.leapMax : 0;
  const airborneScale = e.leapT > 0 ? 1 + Math.sin(leapProgress * Math.PI) * .34 : 1;
  const sc = (e.scale || 1) * (frenzy ? 1.28 : 1) * airborneScale;
  ctx.scale(sc * (ramming ? 1.16 : 1), sc * (ramming ? .84 : 1));
  if (e.stealthT > 0) ctx.globalAlpha *= .45;
  if (e.camoCharge > 0) ctx.globalAlpha *= 1 - e.camoCharge * .38;
  const speed = hyp(e.vx, e.vy);
  const plan = frenzy ? { ...e.plan, body: '#b32238', accent: '#ff665c', glow: '#ff3048' } : e.plan;
  drawCreature(ctx, Object.assign({ t: E.time * (2 + speed / 120) + e.animOff, mouth: e.mouth, hurt: e.hurt }, plan));
  ctx.restore();
}

function drawPlayerPowerState(E, player, sx, sy, radius) {
  const ctx = E.ctx, pulse = .5 + .5 * Math.sin(E.time * 12);
  ctx.save();
  if (player.inkCloudT > 0) {
    const x = player.inkX - E.cam.x, y = player.inkY - E.cam.y, fade = clamp(player.inkCloudT / 1.2, 0, 1);
    const cloud = ctx.createRadialGradient(x, y, 12, x, y, 180); cloud.addColorStop(0, `rgba(15,18,35,${.5 * fade})`); cloud.addColorStop(.58, `rgba(25,31,58,${.32 * fade})`); cloud.addColorStop(1, 'rgba(18,22,43,0)');
    ctx.fillStyle = cloud; ctx.beginPath(); ctx.arc(x, y, 180, 0, TAU); ctx.fill();
    const dx = player.decoyX - E.cam.x, dy = player.decoyY - E.cam.y;
    ctx.save(); ctx.globalAlpha = .28 + pulse * .18; ctx.translate(dx, dy); ctx.rotate(player.decoyAngle || 0); ctx.scale(.82, .82);
    drawCreature(ctx, Object.assign({ t: E.time * 3 + (player.animOff || 0), mouth: 0, hurt: 0 }, player.plan)); ctx.restore();
  }
  if (player.vortexT > 0) {
    const x = (player.vortexX || player.x) - E.cam.x, y = (player.vortexY || player.y) - E.cam.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-E.time * 3.2);
    const vortex = ctx.createRadialGradient(0, 0, 4, 0, 0, 260); vortex.addColorStop(0, withA('#d9fbff', .34)); vortex.addColorStop(.42, withA('#3ca6ca', .13)); vortex.addColorStop(1, withA('#166b91', 0));
    ctx.fillStyle = vortex; ctx.beginPath(); ctx.arc(0, 0, 260, 0, TAU); ctx.fill(); ctx.strokeStyle = withA('#8deaff', .35 + pulse * .22); ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const rr = 34 + i * 43; ctx.beginPath(); ctx.arc(0, 0, rr, i * 1.15, i * 1.15 + TAU * .67); ctx.stroke(); }
    ctx.restore();
  }
  if (player.stompT > 0) {
    const progress = clamp(1 - player.stompT / 1.05, 0, 1), x = player.stompX - E.cam.x, y = player.stompY - E.cam.y;
    ctx.strokeStyle = withA('#f2c080', .8 - progress * .45); ctx.lineWidth = 5 - progress * 2;
    ctx.beginPath(); ctx.arc(x, y, 35 + progress * 210, 0, TAU); ctx.stroke();
    ctx.strokeStyle = withA('#9c6739', .6 - progress * .35); ctx.beginPath(); ctx.arc(x, y, 20 + ((progress + .45) % 1) * 180, 0, TAU); ctx.stroke();
  }
  if (player.leapT > 0 && Number.isFinite(player.leapX)) {
    const x = player.leapX - E.cam.x, y = player.leapY - E.cam.y, progress = clamp(1 - player.leapT / (player.leapMax || 1), 0, 1);
    ctx.fillStyle = `rgba(15,18,16,${.14 + progress * .28})`; ctx.beginPath(); ctx.ellipse(x, y, radius * (1.25 - progress * .2), radius * .55, 0, 0, TAU); ctx.fill();
    ctx.setLineDash([7, 7]); ctx.strokeStyle = withA(player.leapKind === 'dive' ? '#ffd27a' : '#ffb04e', .45); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
  }
  if (player.engulfT > 0) {
    const life = clamp(player.engulfT / .78, 0, 1), a = player.engulfAngle || player.angle;
    ctx.fillStyle = withA('#8fe6c8', .08 + life * .12); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, 285, a - .72, a + .72); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#b5ffe8', .35 + life * .45); ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) { const aa = a + i * .23, inner = radius + 25 + (1 - life) * 90; ctx.beginPath(); ctx.moveTo(sx + Math.cos(aa) * 260, sy + Math.sin(aa) * 260); ctx.lineTo(sx + Math.cos(aa) * inner, sy + Math.sin(aa) * inner); ctx.stroke(); }
  }
  if (player.shockVisualT > 0 && player.shockLinks && player.shockLinks.length > 1) {
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? withA('#efffff', .85) : withA('#62cfff', .55); ctx.lineWidth = pass ? 1.5 : 6; ctx.beginPath();
      for (let i = 0; i < player.shockLinks.length; i++) {
        const link = player.shockLinks[i], x = link.x - E.cam.x, y = link.y - E.cam.y;
        if (!i) ctx.moveTo(x, y); else { const prev = player.shockLinks[i - 1], mx = (prev.x + link.x) * .5 - E.cam.x, my = (prev.y + link.y) * .5 - E.cam.y; ctx.lineTo(mx + Math.sin(E.time * 35 + i) * 12, my + Math.cos(E.time * 31 + i) * 12); ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }
  }
  if (player.bloomT > 0) {
    const points = player.bloomPoints && player.bloomPoints.length ? player.bloomPoints : Array.from({ length: 7 }, (_, i) => ({ x: player.x + Math.cos(i / 7 * TAU + E.time) * (radius + 70), y: player.y + Math.sin(i / 7 * TAU + E.time) * (radius + 70) }));
    ctx.strokeStyle = withA('#d7b5ff', .58 + pulse * .22); ctx.lineWidth = Math.max(2.5, radius * .1); ctx.lineCap = 'round';
    for (let i = 0; i < points.length; i++) { const x = points[i].x - E.cam.x, y = points[i].y - E.cam.y, mx = (sx + x) * .5 + Math.sin(E.time * 7 + i) * 18, my = (sy + y) * .5 + Math.cos(E.time * 6 + i) * 18; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, x, y); ctx.stroke(); ctx.fillStyle = withA('#f1ddff', .8); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); }
  }
  if (player.crushT > 0) {
    const a = player.crushAngle || player.angle, close = 1 - player.crushT / .44, x = sx + Math.cos(a) * (radius + 25), y = sy + Math.sin(a) * (radius + 25);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = withA('#ff8a5e', .55 + pulse * .35); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, radius + 35, -1.15 + close * .55, -.08); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, radius + 35, .08, 1.15 - close * .55); ctx.stroke(); ctx.restore();
  }
  if (player.impaleT > 0) {
    const life = clamp(player.impaleT / .72, 0, 1), progress = 1 - life;
    const extend = 1 - (1 - clamp(progress / .24, 0, 1)) ** 3, retract = clamp((progress - .62) / .38, 0, 1) ** 2;
    const reachP = extend * (1 - retract), maxReach = Math.max(radius * 2.7, player.impaleReach || 0), length = radius * .55 + maxReach * reachP;
    const body = player.plan.body || '#9b6c45', accent = player.plan.accent || '#ffd27a', bend = Math.sin(progress * Math.PI) * radius * .16;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Number.isFinite(player.impaleAngle) ? player.impaleAngle : player.angle); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Faint snapshots make the thrust read as a fast, living sting rather than a static spear.
    for (let trail = 2; trail >= 1; trail--) {
      const trailLength = Math.max(radius * .7, length - trail * radius * .34);
      ctx.strokeStyle = withA(accent, .1 + life * .07); ctx.lineWidth = Math.max(2, radius * .09);
      ctx.beginPath(); ctx.moveTo(radius * .45, trail * radius * .08); ctx.quadraticCurveTo(trailLength * .52, bend + trail * radius * .1, trailLength, trail * radius * .04); ctx.stroke();
    }
    ctx.shadowColor = withA(accent, .8); ctx.shadowBlur = 9;
    ctx.strokeStyle = withA(shade(body, -.2), .92); ctx.lineWidth = Math.max(6, radius * .25);
    ctx.beginPath(); ctx.moveTo(radius * .45, 0); ctx.quadraticCurveTo(length * .5, bend, length, 0); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = withA(accent, .9); ctx.lineWidth = Math.max(2, radius * .075);
    ctx.beginPath(); ctx.moveTo(radius * .48, -radius * .04); ctx.quadraticCurveTo(length * .52, bend - radius * .04, length, 0); ctx.stroke();
    // Point and backward-facing barbs at the end of the extending appendage.
    const tip = Math.max(7, radius * .32); ctx.fillStyle = withA(shade(accent, .18), .96);
    ctx.beginPath(); ctx.moveTo(length + tip, 0); ctx.lineTo(length - tip * .42, -tip * .46); ctx.lineTo(length - tip * .12, 0); ctx.lineTo(length - tip * .42, tip * .46); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#fff4cf', .55 + pulse * .3); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(length - tip * .2, -tip * .12); ctx.lineTo(length + tip * .78, 0); ctx.lineTo(length - tip * .2, tip * .12); ctx.stroke();
    ctx.restore();
  }
  if (player.tailSweepT > 0) {
    const progress = 1 - player.tailSweepT / .72, start = (player.tailSweepAngle || player.angle) + progress * TAU;
    ctx.strokeStyle = withA('#bce8ba', .45 + pulse * .4); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(sx, sy, radius + 78, start - 1.3, start + .35); ctx.stroke();
  }
  if (player.evasionFlashT > 0) {
    ctx.globalAlpha = player.evasionFlashT * .7; for (let i = 1; i <= 3; i++) { ctx.save(); ctx.translate(-Math.cos(player.angle) * i * 14, -Math.sin(player.angle) * i * 14); ctx.strokeStyle = withA('#8affd0', .55 / i); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, radius + i * 2, 0, TAU); ctx.stroke(); ctx.restore(); } ctx.globalAlpha = 1;
  }
  if (player.armorPlates > 0) {
    ctx.strokeStyle = withA('#e0bd83', .62); ctx.lineWidth = 3;
    for (let i = 0; i < player.armorPlates; i++) { const a = -Math.PI / 2 + (i - (player.armorPlates - 1) / 2) * .55; ctx.beginPath(); ctx.arc(sx, sy, radius + 11, a - .19, a + .19); ctx.stroke(); }
  }
  if (player.barbCharge > 0) {
    ctx.fillStyle = withA('#ffb060', .72 + pulse * .2); const count = 4 + player.barbCharge * 2;
    for (let i = 0; i < count; i++) { const a = i / count * TAU, r0 = radius + 5, r1 = radius + 10 + player.barbCharge * 3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a - .1) * r0, sy + Math.sin(a - .1) * r0); ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1); ctx.lineTo(sx + Math.cos(a + .1) * r0, sy + Math.sin(a + .1) * r0); ctx.closePath(); ctx.fill(); }
  }
  if (player.filterCombo > 0) {
    ctx.fillStyle = withA('#9fe0b0', .5 + pulse * .25);
    for (let i = 0; i < player.filterCombo; i++) { const a = i / player.filterCombo * TAU - E.time * 1.8, rr = radius + 17; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 2.4, 0, TAU); ctx.fill(); }
  }
  if (player.abilities && player.abilities.includes('regen') && player.regenDelay <= 0 && player.hp < player.maxHp) { ctx.strokeStyle = withA('#8affb0', .18 + pulse * .2); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, radius + 9 + pulse * 4, 0, TAU); ctx.stroke(); }
  if (player.abilities && player.abilities.includes('airbreath') && player.airStride > 0) { ctx.strokeStyle = withA('#b8f0ca', .35); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, radius + 10 + player.airStride * 2, -Math.PI, 0); ctx.stroke(); }
  if (player.fortify > .05) { ctx.strokeStyle = withA('#d6ad67', player.fortify * .75); ctx.lineWidth = 2 + player.fortify * 4; ctx.beginPath(); ctx.arc(sx, sy, radius + 13, 0, TAU); ctx.stroke(); }
  if (player.sailHeat > .1) { const heat = ctx.createRadialGradient(sx, sy, radius, sx, sy, radius * 2.2); heat.addColorStop(0, withA('#ff9f6a', player.sailHeat * .18)); heat.addColorStop(1, withA('#ff5b39', 0)); ctx.fillStyle = heat; ctx.beginPath(); ctx.arc(sx, sy, radius * 2.2, 0, TAU); ctx.fill(); }
  if (player.rebirthT > 0) { ctx.fillStyle = withA('#a0ffd8', .45 + pulse * .4); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + E.time * 2.5, rr = radius * (1.2 + .4 * Math.sin(E.time * 4 + i)); ctx.beginPath(); ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 3 + i % 3, 0, TAU); ctx.fill(); } }
  if (player.withdrawT > 0 && player.withdrawStored > 0) { const charge = clamp(player.withdrawStored / (player.maxHp || 1), 0, 1); ctx.strokeStyle = withA('#ffe2a8', .35 + charge * .55); ctx.lineWidth = 2 + charge * 6; ctx.beginPath(); ctx.arc(sx, sy, radius + 18 + pulse * charge * 7, 0, TAU); ctx.stroke(); }
  if (player.burstT > 0 && player.burstBreach) { const x = sx + Math.cos(player.angle) * (radius + 13), y = sy + Math.sin(player.angle) * (radius + 13); ctx.fillStyle = withA('#d9fdff', .55 + pulse * .4); ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 3, 0, TAU); ctx.fill(); }
  if (player.stunT > 0 || player.slowT > 0) { ctx.strokeStyle = withA('#bfe6ff', .75); ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = E.time * 9 + i / 3 * TAU; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * (radius + 8), sy + Math.sin(a) * (radius + 8), 2.5, 0, TAU); ctx.stroke(); } }
  if (player.armorBreakT > 0 || player.vulnerableT > 0) { ctx.strokeStyle = withA(player.armorBreakT > 0 ? '#ff9d6c' : '#cf9dff', .75); ctx.lineWidth = 3; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(sx, sy, radius + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (player.venomStacks > 0 && player.venomMarkT > 0) { ctx.fillStyle = withA('#7bf08a', .82); ctx.font = '900 9px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${player.venomStacks}/3`, sx, sy + radius + 17); ctx.textAlign = 'left'; }
  if (player.graspT > 0 && Number.isFinite(player.graspX) && Number.isFinite(player.graspY)) {
    // The arm rapidly grows to the captured point, coils around it, then
    // retracts. Body and highlight colours come directly from this species.
    const life = clamp(player.graspT / .62, 0, 1), progress = 1 - life;
    const extendP = clamp(progress / .28, 0, 1), retractP = clamp((progress - .38) / .62, 0, 1);
    const reachP = (1 - (1 - extendP) ** 3) * (1 - retractP ** 2);
    const dx = (player.graspX - player.x) * reachP, dy = (player.graspY - player.y) * reachP;
    const length = hyp(dx, dy) || 1, nx = -dy / length, ny = dx / length;
    const body = player.plan.body || '#9b5db0', accent = player.plan.accent || '#e4a6f2';
    const waves = Math.min(15, radius * .32 + length * .018), phase = E.time * 20 + (player.animOff || 0);
    const point = t => {
      const curl = Math.sin(t * Math.PI) * Math.sin(t * TAU * 2.2 + phase) * waves;
      return { x: sx + dx * t + nx * curl, y: sy + dy * t + ny * curl };
    };
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const q = point(i / 20); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = withA(accent, .75); ctx.shadowBlur = 10;
    ctx.strokeStyle = withA(shade(body, -.12), .45 + life * .5); ctx.lineWidth = Math.max(7, radius * .34); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = withA(accent, .62 + life * .3); ctx.lineWidth = Math.max(2.2, radius * .1); ctx.stroke();
    // Bright suckers travel along the outer half of the arm and a gripping
    // loop at the tip makes the captured target unambiguous.
    ctx.fillStyle = withA(shade(accent, .35), .55 + life * .4);
    for (let i = 8; i <= 18; i += 2) { const q = point(i / 20); ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.6, radius * .07), 0, TAU); ctx.fill(); }
    const tip = point(1), tipAngle = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(tipAngle);
    ctx.strokeStyle = withA(accent, .72 + pulse * .25); ctx.lineWidth = Math.max(3, radius * .12);
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(9, radius * .42), Math.max(6, radius * .27), 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (player.castT > 0 && player.castAbility && ABILITIES[player.castAbility]) {
    const color = ABILITIES[player.castAbility].color, life = clamp(player.castT / .75, 0, 1);
    ctx.strokeStyle = withA(color, .25 + life * .65); ctx.lineWidth = 2 + life * 4;
    ctx.beginPath(); ctx.arc(sx, sy, radius + (1 - life) * 70, 0, TAU); ctx.stroke();
    ctx.strokeStyle = withA('#ffffff', life * .48); ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + E.time * 2, inner = radius + 8, outer = inner + 18 + (1 - life) * 25;
      ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * inner, sy + Math.sin(a) * inner); ctx.lineTo(sx + Math.cos(a) * outer, sy + Math.sin(a) * outer); ctx.stroke();
    }
  }
  if (player.frenzyT > 0) {
    const glow = ctx.createRadialGradient(sx, sy, radius * .35, sx, sy, radius * 2.1);
    glow.addColorStop(0, withA('#ff253f', .22 + pulse * .12)); glow.addColorStop(.58, withA('#d80f2d', .12)); glow.addColorStop(1, withA('#b00020', 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, radius * 2.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = withA('#ff4058', .48 + pulse * .4); ctx.lineWidth = 3.5;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU - E.time * .8, inner = radius + 7, outer = inner + 7 + pulse * 9;
      ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * inner, sy + Math.sin(a) * inner); ctx.lineTo(sx + Math.cos(a) * outer, sy + Math.sin(a) * outer); ctx.stroke();
    }
  }
  if (player.ramT > 0) {
    ctx.translate(sx, sy); ctx.rotate(player.angle);
    const trail = ctx.createLinearGradient(-radius * 4.8, 0, radius, 0);
    trail.addColorStop(0, withA('#ff8a3d', 0)); trail.addColorStop(.58, withA('#ffb36a', .16 + pulse * .12)); trail.addColorStop(1, withA('#fff0ce', .58));
    ctx.fillStyle = trail; ctx.beginPath(); ctx.moveTo(radius * .65, 0); ctx.lineTo(-radius * 4.8, -radius * 1.25); ctx.lineTo(-radius * 3.6, 0); ctx.lineTo(-radius * 4.8, radius * 1.25); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#ffe0aa', .55 + pulse * .4); ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-radius * 1.1, i * radius * .55); ctx.lineTo(-radius * (3.1 + pulse), i * radius * .9); ctx.stroke(); }
    ctx.strokeStyle = withA('#fff7e5', .72 + pulse * .25); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(radius * 1.05, 0, radius * (.72 + pulse * .08), -1.25, 1.25); ctx.stroke();
  } else if (player.burstT > 0 || player.sprintT > 0) {
    ctx.translate(sx, sy); ctx.rotate(player.angle);
    const color = player.sprintT > 0 ? '#9ce0a0' : '#5ee0f2';
    ctx.strokeStyle = withA(color, .3 + pulse * .35); ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(-radius * 1.1, i * radius * .32); ctx.lineTo(-radius * (2.1 + pulse * .8), i * radius * .48); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlayerShield(E, player, sx, sy, creatureRadius) {
  if (!(player.shield > 0)) return;
  const ctx = E.ctx, frac = clamp(player.shield / (player.shieldMax || 1), 0, 1);
  const pulse = .5 + .5 * Math.sin(E.time * 5), forceField = player.forceFieldT > 0;
  const R = creatureRadius + (forceField ? 18 : 7);
  ctx.save(); ctx.translate(sx, sy);
  if (forceField) {
    const glow = ctx.createRadialGradient(-R * .28, -R * .35, R * .08, 0, 0, R * 1.24);
    glow.addColorStop(0, withA('#eaffff', .16 + pulse * .06));
    glow.addColorStop(.48, withA('#55ccff', .1 + frac * .08)); glow.addColorStop(1, withA('#1678ff', 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 1.24, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#56dcff'; ctx.shadowBlur = 14;
    for (let ring = 0; ring < 2; ring++) {
      const rr = R * (ring ? .68 : 1), sides = ring ? 6 : 12;
      ctx.strokeStyle = withA(ring ? '#d9fbff' : '#4fc9ff', (.22 + pulse * .24) * (0.55 + frac * .45));
      ctx.lineWidth = ring ? 1.3 : 2.4; ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU - Math.PI / 2 + (ring ? E.time * .16 : 0);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    // Short bright panel seams suggest the hexagonal facets of a sci-fi dome.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + E.time * .08, inner = R * .71, outer = R * .96;
      ctx.strokeStyle = withA(i % 3 ? '#54d7ff' : '#f0ffff', .22 + pulse * .28); ctx.lineWidth = i % 3 ? 1.1 : 1.8;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke();
    }
    ctx.strokeStyle = withA('#f4ffff', .9); ctx.lineWidth = 3.2; ctx.beginPath();
    ctx.arc(0, 0, R + 4, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  } else {
    ctx.strokeStyle = withA('#7fd8ff', 0.35 + 0.3 * pulse); ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = i / 6 * TAU - Math.PI / 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = withA('#e6feff', 0.85); ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(0, 0, R + 3, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  }
  ctx.restore();
}

/* Other players (multiplayer): the creature plus a dashed presence ring in the
   player's chosen colour. Their bite arc shows when they lunge. */
function drawRemotePlayers(E) {
  const ctx = E.ctx;
  const remotes = E.visibleRemotePlayers ? E.visibleRemotePlayers() : E.remotePlayers;
  for (const rp of remotes) {
    if (rp.deadT > 0) continue;   // dead & respawning — not drawn
    const sx = rp.x - E.cam.x, sy = rp.y - E.cam.y;
    if (sx < -90 || sx > E.vw + 90 || sy < -90 || sy > E.vh + 90) continue;
    const r = (rp.radius || 16) * (rp.frenzyT > 0 ? 1.28 : 1);
    drawPlayerPowerState(E, rp, sx, sy, r);
    ctx.strokeStyle = withA(rp.color || '#8affd0', 0.55); ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]); ctx.lineDashOffset = -E.time * 12;
    ctx.beginPath(); ctx.arc(sx, sy, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (!rp.vehicleType) { if (rp.enrollT > 0) drawEnrolled(E, rp, sx, sy, r); else drawEntity(E, rp); }
    if (!rp.vehicleType) drawPlayerShield(E, rp, sx, sy, r);
    if ((rp.biteAnim || 0) > 0) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rp.angle);
      ctx.strokeStyle = withA('#e6ffff', rp.biteAnim * 2.2); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 10, -0.7, 0.7); ctx.stroke(); ctx.restore();
    }
  }
}

/* Name tags above every player, in their colour (multiplayer only). */
function drawPlayerTags(E) {
  const ctx = E.ctx;
  ctx.textAlign = 'center'; ctx.font = '800 12px "Segoe UI",sans-serif';
  const tag = (pl, name, color) => {
    const vehicle = E.vehicles && E.vehicles.find(candidate => candidate.netId === pl.vehicleNetId);
    const radius = vehicle ? vehicle.radius : (pl.radius || 16) * (pl.frenzyT > 0 ? 1.28 : 1);
    const sx = pl.x - E.cam.x, sy = pl.y - E.cam.y - radius - 16;
    if (sx < -80 || sx > E.vw + 80 || sy < -20 || sy > E.vh + 20) return;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(name, sx, sy);
    ctx.fillStyle = color || '#eaf4ff'; ctx.fillText(name, sx, sy);
  };
  const remotes = E.visibleRemotePlayers ? E.visibleRemotePlayers() : E.remotePlayers;
  for (const rp of remotes) { if (rp.deadT > 0) continue; tag(rp, rp.name || 'Player', rp.color); }
  if (E.player && !(E.player.deadT > 0)) tag(E.player, (E.mp && E.mp.selfName) || 'You', (E.mp && E.mp.selfColor) || '#8affd0');
  ctx.textAlign = 'left';
}

/* Animate the evolve-modal choice canvases (registered by the modal). */
function drawPreviews(E) {
  const choices = E.mp && E.player && E.player.mpEvolveChoices
    ? E.player.mpEvolveChoices
    : E.choices;
  for (const id of choices) {
    const cv = E.previewCanvas[id]; if (!cv) continue;
    const c2 = cv.getContext('2d'); const w = cv.width, h = cv.height;
    c2.clearRect(0, 0, w, h); const sp = SPECIES[id];
    c2.save(); c2.translate(w / 2, h / 2); const scale = Math.min(w, h) / (sp.plan.len * 3.4);
    c2.scale(scale, scale); const ang = Math.sin(E.time * 1.2) * 0.15; c2.rotate(ang);
    drawCreature(c2, Object.assign({ t: E.time * 2.5, mouth: 0, hurt: 0 }, sp.plan)); c2.restore();
  }
}

export function renderWorld(E) {
  const ctx = E.ctx;
  if (!E.vw) E.resize();
  ctx.clearRect(0, 0, E.vw, E.vh);
  drawBackground(E);
  drawCurrent(E);
  if (!E.player) return;
  const shX = (Math.random() * 2 - 1) * E.shake, shY = (Math.random() * 2 - 1) * E.shake;
  ctx.save(); ctx.translate(shX, shY);

  // sea floor and the marked passages between connected ocean maps
  if (E.stage === 'sea') { drawSeaFloor(E); drawTopSeaPassage(E); }

  drawWebFields(E);
  drawBossTelegraphs(E);

  // plants
  for (const pl of E.plants) {
    const sx = pl.x - E.cam.x, sy = pl.y - E.cam.y; if (sx < -160 || sx > E.vw + 160) continue;
    ctx.save(); ctx.translate(sx, sy); drawPlant(ctx, pl, E.time); ctx.restore();
  }

  // land obstacles (rocks, logs, stumps…) — drawn behind creatures
  for (const o of E.obstacles) {
    const sx = o.x - E.cam.x, sy = o.y - E.cam.y; if (sx < -120 || sx > E.vw + 120 || sy < -120 || sy > E.vh + 120) continue;
    ctx.save(); ctx.translate(sx, sy); drawObstacle(ctx, o, E.time); ctx.restore();
  }

  // food pellets
  for (const f of E.food) {
    const sx = f.x - E.cam.x, sy = f.y - E.cam.y; if (sx < -20 || sx > E.vw + 20) continue;
    const g = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, f.r + 2);
    if (f.kind === 'meat') { g.addColorStop(0, '#ffb0a0'); g.addColorStop(1, '#c8524a'); } else { g.addColorStop(0, '#b8f0bf'); g.addColorStop(1, '#4fa860'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, TAU); ctx.fill();
  }

  // collectible items and their shared/authoritative attack visuals
  for (const item of E.worldItems) drawWorldItem(E, item);
  for (const vehicle of E.vehicles) drawVehicle(E, vehicle);
  for (const projectile of E.itemProjectiles) drawItemProjectile(E, projectile);

  // eggs (laid when an evolution is pending)
  for (const e of E.eggs) {
    const sx = e.x - E.cam.x, sy = e.y - E.cam.y; const pulse = 0.5 + 0.5 * Math.sin(e.t * 4);
    const gg = ctx.createRadialGradient(sx, sy, 1, sx, sy, 26); gg.addColorStop(0, withA('#8affd0', 0.4 * pulse)); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(sx - 4, sy - 6, 1, sx, sy, 16); g.addColorStop(0, '#f4fff8'); g.addColorStop(1, '#bfe6d2');
    ctx.fillStyle = g; ctx.strokeStyle = '#8fbfa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 13, 17, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a7cbb8cc';
    for (let i = 0; i < 4; i++) { const a = e.t + i * 1.7; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 6, sy + Math.sin(a * 1.3) * 8, 2, 0, TAU); ctx.fill(); }
  }

  // creatures (with stun ring, hp bar and level label)
  for (const c of E.creatures) {
    const sx = c.x - E.cam.x, sy = c.y - E.cam.y;
    if (sx < -90 || sx > E.vw + 90 || sy < -90 || sy > E.vh + 90) continue;
    if (c.boss) drawBossGlow(E, c, sx, sy);
    if (c.cocoon) drawCocoon(E, c, sx, sy); else if (c.lumenOrb) drawLumenOrb(E, c, sx, sy); else drawEntity(E, c);
    if (c.stunT > 0 || c.slowT > 0) {
      ctx.strokeStyle = withA('#bfe6ff', 0.85); ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = E.time * 9 + i / 3 * TAU; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * (c.radius + 7), sy + Math.sin(a) * (c.radius + 7), 2.4, 0, TAU); ctx.stroke(); }
    }
    if (c.venomStacks > 0 && c.venomMarkT > 0) {
      ctx.fillStyle = withA('#7bf08a', .72); ctx.font = '900 10px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VENOM ' + c.venomStacks + '/3', sx, sy + c.radius + 15); ctx.textAlign = 'left';
      ctx.strokeStyle = withA('#75e784', .42 + .25 * Math.sin(E.time * 8) ** 2); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, c.radius + 6, 0, TAU); ctx.stroke();
    }
    if (c.armorBreakT > 0 || c.vulnerableT > 0) {
      const color = c.armorBreakT > 0 ? '#ff9d6c' : '#cf9dff'; ctx.strokeStyle = withA(color, .72); ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + E.time * .4, inner = c.radius + 5, outer = inner + 8; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a - .12) * inner, sy + Math.sin(a - .12) * inner); ctx.lineTo(sx + Math.cos(a) * outer, sy + Math.sin(a) * outer); ctx.lineTo(sx + Math.cos(a + .12) * inner, sy + Math.sin(a + .12) * inner); ctx.stroke(); }
    }
    if (!c.boss) {
      let topY = sy - c.radius - 9;
      if (c.hpBarT > 0) {
        const fade = Math.min(1, c.hpBarT / 0.6), w = Math.max(26, c.radius * 2.1), bx = sx - w / 2, by = topY;
        ctx.globalAlpha = fade; ctx.fillStyle = 'rgba(4,18,30,0.8)'; ctx.fillRect(bx, by, w, 5);
        ctx.fillStyle = '#ff5468'; ctx.fillRect(bx + 0.5, by + 0.5, (w - 1) * clamp(c.hp / c.maxHp, 0, 1), 4); ctx.globalAlpha = 1; topY = by - 3;
      }
      if (E.showLevels && c.level) {
        ctx.font = '700 10px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = (E.player && c.level > E.player.level) ? '#ff9a9a' : 'rgba(200,220,235,0.85)';
        ctx.fillText('Lv ' + c.level, sx, topY); ctx.textAlign = 'left';
      }
      if (c.cocoon) {
        const urgency = clamp(1 - c.hatchT / 7, 0, 1); ctx.textAlign = 'center'; ctx.font = '900 12px "Segoe UI",sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText('COCOON  ' + c.hatchT.toFixed(1) + 's', sx, sy - 45);
        ctx.fillStyle = urgency > .65 ? '#ff697a' : '#f4eee8'; ctx.fillText('COCOON  ' + c.hatchT.toFixed(1) + 's', sx, sy - 45); ctx.textAlign = 'left';
      }
    }
  }

  // miniboss decorations: aura, hardened shell, name + health bar
  for (const c of E.creatures) {
    if (!c.boss) continue;
    const sx = c.x - E.cam.x, sy = c.y - E.cam.y;
    if (sx < -260 || sx > E.vw + 260 || sy < -260 || sy > E.vh + 260) continue;
    const bpulse = 0.5 + 0.5 * Math.sin(E.time * 3);
    const auraColor = c.plan.glow || '#ff2a3a';
    ctx.strokeStyle = withA(auraColor, c.plan.glow ? .4 + .3 * bpulse : .12 + .1 * bpulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, c.radius + 12, 0, TAU); ctx.stroke();
    if (c.hp < c.maxHp * .45) {
      ctx.strokeStyle = withA('#ff4055', .38 + .4 * Math.sin(E.time * 9) ** 2); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sx, sy, c.radius + 18 + bpulse * 5, 0, TAU); ctx.stroke();
    }
    if (c.hardenT > 0) {
      const R = c.radius + 11; ctx.strokeStyle = withA('#7fd8ff', 0.5 + 0.35 * bpulse); ctx.lineWidth = 3.5; ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU - Math.PI / 2; const x = sx + Math.cos(a) * R, y = sy + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
    }
    const barW = Math.max(150, c.radius * 3.2), bx = sx - barW / 2, by = sy - c.radius - 36;
    ctx.textAlign = 'center'; ctx.font = '700 13px "Segoe UI",sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(c.title, sx + 1, by - 5); ctx.fillStyle = withA(c.plan.accent, 0.97); ctx.fillText(c.title, sx, by - 6);
    if (E.showLevels) { ctx.font = '800 10px "Segoe UI",sans-serif'; ctx.fillStyle = withA('#ff9a9a', 0.95); ctx.fillText('★ Lv 10 ELITE', sx, by - 22); ctx.font = '700 13px "Segoe UI",sans-serif'; }
    if (c.engaged || c.hp < c.maxHp) {
      ctx.fillStyle = 'rgba(4,18,30,0.82)'; ctx.fillRect(bx, by, barW, 8);
      ctx.fillStyle = '#ff5468'; ctx.fillRect(bx + 1, by + 1, (barW - 2) * clamp(c.hp / c.maxHp, 0, 1), 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, barW, 8);
    }
    if (c.hp < c.maxHp * .45) { ctx.font = '900 10px "Segoe UI",sans-serif'; ctx.fillStyle = '#ff697a'; ctx.fillText('ENRAGED', sx, by + 21); }
    ctx.textAlign = 'left';
  }

  // other players (multiplayer) — drawn beneath the local player's highlight
  if (E.mp) drawRemotePlayers(E);

  // player indicator + power visuals (hidden while dead/respawning in multiplayer)
  if (!(E.player.deadT > 0)) {
    const PL = E.player, gx = PL.x - E.cam.x, gy = PL.y - E.cam.y, pr = PL.radius * (PL.frenzyT > 0 ? 1.28 : 1), pc = PL.plan.body, pa = PL.plan.accent, pulse = 0.5 + 0.5 * Math.sin(E.time * 3);
    const gg = ctx.createRadialGradient(gx, gy, pr * 0.7, gx, gy, pr * 2.6);
    gg.addColorStop(0, 'rgba(126,255,224,0)'); gg.addColorStop(0.72, withA('#7affe0', 0.10 + 0.06 * pulse)); gg.addColorStop(1, 'rgba(126,255,224,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, pr * 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = withA('#aefff0', 0.4 + 0.15 * pulse); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -E.time * 12;
    ctx.beginPath(); ctx.arc(gx, gy, pr + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    drawPlayerPowerState(E, PL, gx, gy, pr);
    if (PL.frenzyT > 0) { const fp = 0.5 + 0.5 * Math.sin(E.time * 12); ctx.strokeStyle = withA('#ff6a7a', 0.25 + 0.4 * fp); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gx, gy, pr + 11, 0, TAU); ctx.stroke(); }
    if (PL.burrowT > 0) {
      // underground: only a dirt mound and dust show where you are
      ctx.save(); ctx.translate(gx, gy);
      const mg = ctx.createRadialGradient(-pr * 0.3, -pr * 0.3, 1, 0, 0, pr * 1.3);
      mg.addColorStop(0, '#9c7a4a'); mg.addColorStop(1, '#5a4126');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(0, pr * 0.2, pr * 1.15, pr * 0.75, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = withA('#c79a5e', 0.5); ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, pr + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = withA('#6a4e2c', 0.8);
      for (let i = 0; i < 5; i++) { const a = E.time * 3 + i * 1.3; ctx.beginPath(); ctx.arc(Math.cos(a) * pr * 0.7, Math.sin(a) * pr * 0.5 - pr * 0.4, 2.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    } else if (PL.enrollT > 0) {
      // rolled into an armored ball — replaces the creature entirely
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(E.time * (5.2 + Math.min(4, hyp(PL.vx, PL.vy) / 170))); const r = pr * 1.12;
      const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2); bg.addColorStop(0, shade(pc, 0.35)); bg.addColorStop(1, shade(pc, -0.32));
      ctx.fillStyle = bg; ctx.strokeStyle = shade(pc, -0.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA(shade(pc, -0.45), 0.75); ctx.lineWidth = 1.6;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * i / 4, 0.3, Math.PI - 0.3); ctx.stroke(); }
      ctx.fillStyle = shade(pa, -0.05);
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); ctx.lineTo(Math.cos(a + 0.22) * r, Math.sin(a + 0.22) * r); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    } else if (!PL.vehicleType) drawEntity(E, PL);
    ctx.globalAlpha = 1;
    if (PL.withdrawT > 0) {
      // shell plates closing around the body
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(E.time * 0.8);
      ctx.strokeStyle = withA('#e8c98a', 0.75); ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const rr = pr * (1.15 - 0.22 * i); ctx.beginPath(); ctx.arc(0, 0, rr, i * 0.8, i * 0.8 + TAU * 0.75); ctx.stroke(); }
      ctx.restore();
    }
    if (!PL.vehicleType) drawPlayerShield(E, PL, gx, gy, pr);
  }

  // player bite arc
  const p = E.player;
  if (p.biteT > 0 && !p.vehicleType) {
    const r = p.radius * (p.frenzyT > 0 ? 1.28 : 1) + p.species.stats.reach * (p.frenzyT > 0 ? 1.15 : 1);
    ctx.save(); ctx.translate(p.x - E.cam.x, p.y - E.cam.y); ctx.rotate(p.angle);
    ctx.strokeStyle = withA('#e6ffff', p.biteT * 2.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 4, -0.7, 0.7); ctx.stroke(); ctx.restore();
  }

  // particles
  for (const q of E.particles) {
    const a = clamp(q.life / q.max, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x - E.cam.x, q.y - E.cam.y, q.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ability effect rings (shock / engulf / bloom pulses)
  for (const fo of E.fx) {
    const pr2 = fo.t / fo.max, rad = Math.max(1, fo.dir === 'in' ? fo.R * (1 - pr2) : fo.R * pr2);
    ctx.strokeStyle = withA(fo.color, (1 - pr2) * 0.85); ctx.lineWidth = Math.max(1, fo.width * (1 - pr2 * 0.4));
    ctx.beginPath(); ctx.arc(fo.x - E.cam.x, fo.y - E.cam.y, rad, 0, TAU); ctx.stroke();
  }

  // floating damage / level text
  for (const ft of E.floaters) {
    const a = clamp(ft.life / ft.max, 0, 1); ctx.globalAlpha = a; ctx.font = '800 ' + ft.size + 'px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
    const X = ft.x - E.cam.x, Y = ft.y - E.cam.y;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(ft.text, X, Y); ctx.fillStyle = ft.color; ctx.fillText(ft.text, X, Y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  if (E.mp) drawPlayerTags(E);
  ctx.restore();

  drawBubbles(E);

  // danger vignette
  if (E.danger > 0) {
    ctx.save();
    const vg = ctx.createRadialGradient(E.vw / 2, E.vh / 2, E.vh * 0.4, E.vw / 2, E.vh / 2, E.vh * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, withA('#ff2a3a', E.danger * 0.28));
    ctx.fillStyle = vg; ctx.fillRect(0, 0, E.vw, E.vh); ctx.restore();
  }

  // off-screen miniboss markers at the viewport edge
  for (const c of E.creatures) {
    if (!c.boss) continue;
    const sx = c.x - E.cam.x, sy = c.y - E.cam.y;
    if (sx > -30 && sx < E.vw + 30 && sy > -30 && sy < E.vh + 30) continue;
    const cx = E.vw / 2, cy = E.vh / 2, ang = Math.atan2(sy - cy, sx - cx), dirx = Math.cos(ang), diry = Math.sin(ang), m = 42;
    let t = 1e6;
    if (dirx > 0) t = Math.min(t, (E.vw - m - cx) / dirx); else if (dirx < 0) t = Math.min(t, (m - cx) / dirx);
    if (diry > 0) t = Math.min(t, (E.vh - m - cy) / diry); else if (diry < 0) t = Math.min(t, (m - cy) / diry);
    const mx = cx + dirx * t, my = cy + diry * t;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    ctx.fillStyle = withA(c.plan.accent, 0.85); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -9); ctx.lineTo(-2, 0); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = withA(c.plan.accent, 0.85); ctx.textAlign = 'center'; ctx.font = '800 10px "Segoe UI",sans-serif';
    ctx.fillText('☠ ' + c.short.toUpperCase(), clamp(mx, 50, E.vw - 50), clamp(my - 15, 12, E.vh - 6)); ctx.textAlign = 'left';
  }

  if (E.pendingEvolve || (E.mp && E.player && E.player.mpEvolveChoices && E.player.mpEvolveChoices.length)) drawPreviews(E);
}

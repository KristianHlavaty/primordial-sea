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
import { SPECIES } from '../data/species.js';

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
    } else if (q.shape === 'lane') {
      ctx.translate(ox, oy); ctx.rotate(q.angle); ctx.beginPath(); ctx.rect(0, -q.width / 2, q.length, q.width); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA('#ffffff', .25 + .3 * pulse); ctx.beginPath(); ctx.moveTo(q.length * progress, -q.width / 2); ctx.lineTo(q.length * progress, q.width / 2); ctx.stroke();
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

function drawBackground(E) {
  if (E.stage !== 'sea') { drawLandBackground(E); return; }
  const ctx = E.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, E.vh);
  const topDepth = clamp(E.cam.y / E.H, 0, 1);
  g.addColorStop(0, shade('#1c6a92', -topDepth * 0.55));
  g.addColorStop(0.5, shade('#0b3350', -topDepth * 0.3));
  g.addColorStop(1, '#04121e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.vw, E.vh);
  // light rays from the surface
  if (E.cam.y < E.vh) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + E.time * 0.01) % 1) * E.vw * 1.3 - E.vw * 0.15; const w = 60 + i * 18;
      const lg = ctx.createLinearGradient(x, 0, x + 80, E.vh);
      lg.addColorStop(0, 'rgba(150,220,255,0.06)'); lg.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + 120, E.vh); ctx.lineTo(x + 80, E.vh); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
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

/* Draw a creature/player at its world position (screen-space transform,
   flip vertically when facing left so it never renders upside-down). */
function drawEntity(E, e) {
  const ctx = E.ctx;
  ctx.save(); ctx.translate(e.x - E.cam.x, e.y - E.cam.y); ctx.rotate(e.angle);
  if (Math.cos(e.angle) < 0) ctx.scale(1, -1);
  const sc = e.scale || 1; ctx.scale(sc, sc);
  const speed = hyp(e.vx, e.vy);
  drawCreature(ctx, Object.assign({ t: E.time * (2 + speed / 120) + e.animOff, mouth: e.mouth, hurt: e.hurt }, e.plan));
  ctx.restore();
}

/* Animate the evolve-modal choice canvases (registered by the modal). */
function drawPreviews(E) {
  for (const id of E.choices) {
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

  // sea floor (sea stage only; land terrain is the whole background)
  if (E.stage === 'sea') {
    const floorScreenY = E.H - 120 - E.cam.y;
    if (floorScreenY < E.vh) {
      ctx.fillStyle = '#071a13'; ctx.fillRect(0, floorScreenY + 60, E.vw, E.vh);
      ctx.fillStyle = '#0c2a1e';
      for (let i = 0; i < 8; i++) { const x = ((i * 0.14 + 0.03) * E.W - E.cam.x); ctx.beginPath(); ctx.ellipse(x, floorScreenY + 70, 120, 40, 0, 0, TAU); ctx.fill(); }
    }
  }

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
    if (c.cocoon) drawCocoon(E, c, sx, sy); else drawEntity(E, c);
    if (c.stunT > 0 || c.slowT > 0) {
      ctx.strokeStyle = withA('#bfe6ff', 0.85); ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = E.time * 9 + i / 3 * TAU; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * (c.radius + 7), sy + Math.sin(a) * (c.radius + 7), 2.4, 0, TAU); ctx.stroke(); }
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
    ctx.strokeStyle = withA('#ff2a3a', 0.12 + 0.1 * bpulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, c.radius + 12, 0, TAU); ctx.stroke();
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

  // player indicator + power visuals
  {
    const PL = E.player, gx = PL.x - E.cam.x, gy = PL.y - E.cam.y, pr = PL.radius, pc = PL.plan.body, pa = PL.plan.accent, pulse = 0.5 + 0.5 * Math.sin(E.time * 3);
    const gg = ctx.createRadialGradient(gx, gy, pr * 0.7, gx, gy, pr * 2.6);
    gg.addColorStop(0, 'rgba(126,255,224,0)'); gg.addColorStop(0.72, withA('#7affe0', 0.10 + 0.06 * pulse)); gg.addColorStop(1, 'rgba(126,255,224,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, pr * 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = withA('#aefff0', 0.4 + 0.15 * pulse); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -E.time * 12;
    ctx.beginPath(); ctx.arc(gx, gy, pr + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (PL.frenzyT > 0) { const fp = 0.5 + 0.5 * Math.sin(E.time * 12); ctx.strokeStyle = withA('#ff6a7a', 0.25 + 0.4 * fp); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gx, gy, pr + 11, 0, TAU); ctx.stroke(); }
    if (PL.stealthT > 0) ctx.globalAlpha = 0.45;   // half-vanished in the ink cloud
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
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(E.time * 1.2); const r = pr * 1.12;
      const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2); bg.addColorStop(0, shade(pc, 0.35)); bg.addColorStop(1, shade(pc, -0.32));
      ctx.fillStyle = bg; ctx.strokeStyle = shade(pc, -0.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA(shade(pc, -0.45), 0.75); ctx.lineWidth = 1.6;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * i / 4, 0.3, Math.PI - 0.3); ctx.stroke(); }
      ctx.fillStyle = shade(pa, -0.05);
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); ctx.lineTo(Math.cos(a + 0.22) * r, Math.sin(a + 0.22) * r); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    } else drawEntity(E, PL);
    ctx.globalAlpha = 1;
    if (PL.withdrawT > 0) {
      // shell plates closing around the body
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(E.time * 0.8);
      ctx.strokeStyle = withA('#e8c98a', 0.75); ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const rr = pr * (1.15 - 0.22 * i); ctx.beginPath(); ctx.arc(0, 0, rr, i * 0.8, i * 0.8 + TAU * 0.75); ctx.stroke(); }
      ctx.restore();
    }
    if (PL.vortexT > 0) {
      // whirlpool arms sweeping the water inward
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(-E.time * 3);
      ctx.strokeStyle = withA('#6fd0e8', 0.5); ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { const rr = 60 + i * 65; ctx.beginPath(); ctx.arc(0, 0, rr, i * 1.4, i * 1.4 + TAU * 0.6); ctx.stroke(); }
      ctx.restore();
    }
    if (PL.bloomT > 0) {
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(E.time * 2); ctx.strokeStyle = withA('#c79bff', 0.55); ctx.lineWidth = 2.5; const RR = pr + 50, n = 8;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * pr, Math.sin(a) * pr); ctx.quadraticCurveTo(Math.cos(a + 0.3) * RR * 0.7, Math.sin(a + 0.3) * RR * 0.7, Math.cos(a) * RR, Math.sin(a) * RR); ctx.stroke(); }
      ctx.restore();
    }
    if (PL.shield > 0) {
      const frac = clamp(PL.shield / (PL.shieldMax || 1), 0, 1), sp2 = 0.5 + 0.5 * Math.sin(E.time * 4); const R = pr + 7;
      ctx.save(); ctx.translate(gx, gy);
      ctx.strokeStyle = withA('#7fd8ff', 0.35 + 0.3 * sp2); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU - Math.PI / 2; const x = Math.cos(a) * R, y = Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = withA('#e6feff', 0.85); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R + 3, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
      ctx.restore();
    }
  }

  // player bite arc
  const p = E.player;
  if (p.biteT > 0) {
    const r = p.radius + p.species.stats.reach;
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

  if (E.pendingEvolve) drawPreviews(E);
}

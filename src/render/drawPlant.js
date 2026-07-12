/* Edible flora. Three silhouettes, chosen per kind so each biome reads right:
   - cluster : low rounded clumps (sea algae, land mosses)
   - frond   : swaying blades rising from a base (kelp, Devonian ferns)
   - tree    : a tall scaly-trunked club-moss with a leafy crown (Carboniferous
               lycopsids — the giants of the coal forest)
   Fullness (amount/max) shrinks and desaturates a grazed-down plant. */
import { TAU } from '../core/math.js';
import { shade, withA } from '../core/color.js';

const FLORA = {
  // --- sea ---
  algae:       { shape: 'cluster', lush: '#4fbf72', bare: '#3a6a4a', base: '#5a4632' },
  kelp:        { shape: 'frond',   lush: '#2f8f5a', bare: '#3a5a48', base: '#6b4a32' },
  // --- Devonian (small, primitive land plants) ---
  moss:        { shape: 'cluster', lush: '#6aa84f', bare: '#47593a', base: '#4a3d28' },
  fern:        { shape: 'frond',   lush: '#4a9a48', bare: '#46583a', base: '#5a4326' },
  // --- Carboniferous (lush coal forest) ---
  carbon_moss: { shape: 'cluster', lush: '#86a24a', bare: '#4a5535', base: '#3f3826' },
  lycopsid:    { shape: 'tree',    lush: '#3f7d47', bare: '#3a4a38', base: '#4a3826', bark: '#6a5030' },
};

export function drawPlant(ctx, p, time) {
  const full = p.amount / p.max;
  const sway = Math.sin(time * 0.8 + p.sway);
  const f = FLORA[p.kind] || FLORA.algae;
  if (f.shape === 'tree') drawTree(ctx, p, full, sway, f);
  else if (f.shape === 'frond') drawFrond(ctx, p, full, sway, time, f);
  else drawCluster(ctx, p, full, sway, f);
}

function drawFrond(ctx, p, full, swayBase, time, f) {
  const fronds = 4;
  for (let i = 0; i < fronds; i++) {
    const bx = (i - (fronds - 1) / 2) * 10; const hh = p.h * (0.7 + 0.3 * (i % 2)) * (0.5 + 0.5 * full);
    const col = full > 0.05 ? shade(f.lush, (i % 2) * 0.1) : f.bare;
    ctx.strokeStyle = col; ctx.lineWidth = 6 * (0.6 + 0.4 * full); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, 0);
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      const sf = s / segs; const sway = swayBase * 22 * sf + Math.sin(time * 1.3 + i + s) * 4 * sf;
      ctx.lineTo(bx + sway, -hh * sf);
    }
    ctx.stroke();
  }
  ctx.fillStyle = f.base; ctx.beginPath(); ctx.ellipse(0, 4, 16, 8, 0, 0, TAU); ctx.fill();
}

function drawCluster(ctx, p, full, swayBase, f) {
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU; const r = 13 * (0.5 + 0.5 * full); const x = Math.cos(a) * r, y = -6 - Math.sin(a) * r * 0.6 + swayBase * 2;
    const col = full > 0.05 ? f.lush : f.bare;
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8); g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6 * (0.6 + 0.4 * full), 0, TAU); ctx.fill();
  }
  ctx.fillStyle = f.base; ctx.beginPath(); ctx.ellipse(0, 2, 10, 5, 0, 0, TAU); ctx.fill();
}

/* A lycopsid tree (Lepidodendron): a tapering trunk with diamond leaf-scars and
   a crown of narrow microphyll leaves. */
function drawTree(ctx, p, full, swayBase, f) {
  const hh = p.h * (0.55 + 0.45 * full);
  const lean = swayBase * 5;
  const bw = 6 * (0.7 + 0.3 * full), tw = 2.4;
  const topX = lean, topY = -hh;
  // trunk (a tapering column that leans with the sway)
  ctx.fillStyle = full > 0.05 ? f.bark : f.bare;
  ctx.beginPath();
  ctx.moveTo(-bw, 0);
  ctx.quadraticCurveTo(-bw * 0.4 + lean * 0.5, -hh * 0.5, topX - tw, topY);
  ctx.lineTo(topX + tw, topY);
  ctx.quadraticCurveTo(bw * 0.4 + lean * 0.5, -hh * 0.5, bw, 0);
  ctx.closePath(); ctx.fill();
  // diamond leaf-scars up the trunk
  ctx.fillStyle = withA(shade(f.bark || f.bare, -0.32), 0.7);
  for (let s = 1; s <= 4; s++) {
    const sf = s / 5, x = lean * sf, y = -hh * sf, r = 2.4 * (1 - sf * 0.4);
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
  }
  // crown of narrow leaves
  const col = full > 0.05 ? f.lush : f.bare;
  ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.28;
    const len = hh * (0.3 + 0.12 * full);
    const wob = Math.sin(swayBase * 3 + i) * 3;
    ctx.beginPath(); ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.5, topX + Math.cos(a) * len + wob, topY + Math.sin(a) * len);
    ctx.stroke();
  }
  // root buttress
  ctx.fillStyle = f.base; ctx.beginPath(); ctx.ellipse(0, 3, 14, 7, 0, 0, TAU); ctx.fill();
}

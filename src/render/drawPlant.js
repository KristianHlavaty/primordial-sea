/* Edible flora. Two shapes: tall fronds (kelp, fern) and low clusters
   (algae, moss). Fullness (amount/max) shrinks and desaturates a grazed-down
   plant. Palette is chosen per kind so sea and land plants read differently. */
import { TAU } from '../core/math.js';
import { shade } from '../core/color.js';

// kind -> { lush blade color, grazed color, stem/base color, frond? }
const FLORA = {
  kelp: { lush: '#2f8f5a', bare: '#3a5a48', base: '#6b4a32', frond: true },
  fern: { lush: '#3f8f42', bare: '#4a5a3a', base: '#5a4326', frond: true },
  algae: { lush: '#4fbf72', bare: '#3a6a4a', base: '#5a4632', frond: false },
  moss: { lush: '#6aa84f', bare: '#47593a', base: '#4a3d28', frond: false },
};

export function drawPlant(ctx, p, time) {
  const full = p.amount / p.max;
  const swayBase = Math.sin(time * 0.8 + p.sway);
  const f = FLORA[p.kind] || FLORA.algae;
  if (f.frond) {
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
  } else { // low cluster
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU; const r = 13 * (0.5 + 0.5 * full); const x = Math.cos(a) * r, y = -6 - Math.sin(a) * r * 0.6 + swayBase * 2;
      const col = full > 0.05 ? f.lush : f.bare;
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8); g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, col);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6 * (0.6 + 0.4 * full), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = f.base; ctx.beginPath(); ctx.ellipse(0, 2, 10, 5, 0, 0, TAU); ctx.fill();
  }
}

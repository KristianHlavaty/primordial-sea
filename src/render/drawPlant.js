/* Edible plants (algae clusters and kelp fronds). Drawn at the plant's base;
   fullness (amount/max) shrinks and desaturates a grazed-down plant. */
import { TAU } from '../core/math.js';
import { shade } from '../core/color.js';

export function drawPlant(ctx, p, time) {
  const full = p.amount / p.max;
  const swayBase = Math.sin(time * 0.8 + p.sway);
  if (p.kind === 'kelp') {
    const fronds = 4;
    for (let f = 0; f < fronds; f++) {
      const bx = (f - (fronds - 1) / 2) * 10; const hh = p.h * (0.7 + 0.3 * (f % 2)) * (0.5 + 0.5 * full);
      const col = full > 0.05 ? shade('#2f8f5a', (f % 2) * 0.1) : '#3a5a48';
      ctx.strokeStyle = col; ctx.lineWidth = 6 * (0.6 + 0.4 * full); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, 0);
      const segs = 6;
      for (let s = 1; s <= segs; s++) {
        const sf = s / segs; const sway = swayBase * 22 * sf + Math.sin(time * 1.3 + f + s) * 4 * sf;
        ctx.lineTo(bx + sway, -hh * sf);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#6b4a32'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 8, 0, 0, TAU); ctx.fill();
  } else { // algae cluster
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU; const r = 13 * (0.5 + 0.5 * full); const x = Math.cos(a) * r, y = -6 - Math.sin(a) * r * 0.6 + swayBase * 2;
      const col = full > 0.05 ? '#4fbf72' : '#3a6a4a';
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8); g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, col);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6 * (0.6 + 0.4 * full), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#5a4632'; ctx.beginPath(); ctx.ellipse(0, 2, 10, 5, 0, 0, TAU); ctx.fill();
  }
}

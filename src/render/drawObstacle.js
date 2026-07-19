/* Renders one land obstacle at the origin (the caller translates to screen).
   `o` carries { kind, r (collision radius), angle, seed }. */
import { TAU } from '../core/math.js';
import { shade } from '../core/color.js';

function diamond(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }

export function drawObstacle(ctx, o, time) {
  const r = o.r;
  // soft contact shadow under everything
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath(); ctx.ellipse(4, 6, r, r * 0.78, 0, 0, TAU); ctx.fill();

  switch (o.kind) {
    case 'sea_rock': {
      // Ancient, algae-streaked submarine formations used as solid cover in
      // the Fangwall arena. The pale facets stay readable in the abyss.
      ctx.save(); ctx.rotate(o.angle);
      const g = ctx.createRadialGradient(-r * .32, -r * .38, r * .08, 0, 0, r * 1.12);
      g.addColorStop(0, '#688a88'); g.addColorStop(.42, '#365d62'); g.addColorStop(1, '#142f3a');
      ctx.fillStyle = g; ctx.strokeStyle = '#0a202b'; ctx.lineWidth = 3;
      ctx.beginPath();
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const a = i / n * TAU, rr = r * (.8 + .2 * Math.sin(o.seed + i * 2.13));
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .88;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(130,213,201,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * .58, -r * .1); ctx.lineTo(-r * .12, r * .28); ctx.lineTo(r * .15, r * .08);
      ctx.moveTo(r * .05, -r * .5); ctx.lineTo(r * .35, -r * .08); ctx.lineTo(r * .62, r * .12); ctx.stroke();
      ctx.fillStyle = 'rgba(110,206,174,.28)';
      for (let i = 0; i < 7; i++) {
        const a = o.seed + i * 1.37, rr = r * (.35 + (i % 3) * .18);
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * .78, 2 + i % 2, 0, TAU); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'lyco_log': {
      // a fallen lycopsid trunk — green photosynthetic bark, diamond leaf-scars
      ctx.save(); ctx.rotate(o.angle);
      const L = r * 1.7, W = r * 0.72;
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, '#6f7d47'); g.addColorStop(0.5, '#54612f'); g.addColorStop(1, '#333d1c');
      ctx.fillStyle = g; ctx.strokeStyle = '#2a3216'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-L + W, -W); ctx.lineTo(L - W, -W); ctx.arc(L - W, 0, W, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-L + W, W); ctx.arc(-L + W, 0, W, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      // diamond leaf-scars in staggered rows (the lycopsid signature)
      ctx.fillStyle = 'rgba(34,44,20,0.6)';
      for (let row = -1; row <= 1; row++) {
        const yy = row * W * 0.5, off = (row & 1) * W * 0.34;
        for (let xx = -L + W * 1.3 + off; xx < L - W * 0.9; xx += W * 0.72) diamond(ctx, xx, yy, W * 0.17);
      }
      // pale sawn end with rings
      ctx.fillStyle = '#c7c199'; ctx.beginPath(); ctx.ellipse(L - W * 0.55, 0, W * 0.6, W * 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8b855e'; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(L - W * 0.55, 0, W * 0.6 * k / 3.5, W * 0.9 * k / 3.5, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'prototaxites': {
      // a giant Devonian fungus — a pale, mottled trunk cross-section
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 1, 0, 0, r);
      g.addColorStop(0, '#dccca2'); g.addColorStop(1, '#9c8b62');
      ctx.fillStyle = g; ctx.strokeStyle = '#6c5c3b'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(108,92,59,0.45)'; ctx.lineWidth = 1.1;
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(0, 0, r * k / 4.5, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = 'rgba(92,78,48,0.4)';
      for (let i = 0; i < 12; i++) { const a = o.seed + i * 0.9, rr = r * (0.15 + 0.7 * ((i * 0.37) % 1)); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.7, 0, TAU); ctx.fill(); }
      break;
    }
    case 'stump': {
      // lycopsid trunk base — green photosynthetic bark ringed with diamond
      // leaf-scars, sawn inner heartwood (pale brown) exposed on top
      ctx.fillStyle = '#556134'; ctx.strokeStyle = '#2c3719'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7c8a4e';
      const n = 12; for (let i = 0; i < n; i++) { const a = i / n * TAU + o.seed; diamond(ctx, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 3); }
      // sawn top with rings (exposed heartwood — pale brown)
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 1, 0, 0, r * 0.64);
      g.addColorStop(0, '#a98a52'); g.addColorStop(1, '#7d6136');
      ctx.fillStyle = g; ctx.strokeStyle = '#4f3c1e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.64, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(79,60,30,0.7)'; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(0, 0, r * 0.64 * k / 3.4, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'silk_bundle': {
      // pale silk-wrapped mound (matches the Silken Grove's spiders)
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
      g.addColorStop(0, '#dcd6dc'); g.addColorStop(1, '#948e9a');
      ctx.fillStyle = g; ctx.strokeStyle = '#78727e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.85, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // crisscrossing silk strands
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const a = o.seed + i * 0.9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.85); ctx.lineTo(Math.cos(a + Math.PI) * r, Math.sin(a + Math.PI) * r * 0.85); ctx.stroke(); }
      // a dark shape cocooned within
      ctx.fillStyle = 'rgba(40,34,44,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 0.3, o.angle, 0, TAU); ctx.fill();
      break;
    }
    case 'fungus': {
      // clustered caps on a mossy mound (Carboniferous marsh)
      ctx.fillStyle = '#465232'; ctx.strokeStyle = '#2c3620'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, r * 0.32, r, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      const caps = [[-r * 0.4, r * 0.02, r * 0.5, '#a86c48'], [r * 0.34, r * 0.14, r * 0.42, '#94582f'], [0, -r * 0.3, r * 0.62, '#bd7c52']];
      for (const [cx, cy, cr, col] of caps) {
        ctx.fillStyle = '#d8cbb0'; ctx.fillRect(cx - cr * 0.14, cy, cr * 0.28, cr * 0.62);   // stalk
        const g = ctx.createRadialGradient(cx - cr * 0.25, cy - cr * 0.3, 1, cx, cy, cr);
        g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, col);
        ctx.fillStyle = g; ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(cx, cy, cr, cr * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,244,222,0.5)';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i * 2.1 + o.seed) * cr * 0.42, cy + Math.sin(i * 2.1) * cr * 0.28, 1.5, 0, TAU); ctx.fill(); }
      }
      break;
    }
    default: { // boulder
      ctx.save(); ctx.rotate(o.angle);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.1);
      g.addColorStop(0, '#8f887b'); g.addColorStop(1, '#585144');
      ctx.fillStyle = g; ctx.strokeStyle = '#3d382e'; ctx.lineWidth = 2;
      ctx.beginPath();
      const n = 8; for (let i = 0; i <= n; i++) { const a = i / n * TAU; const rr = r * (0.82 + 0.18 * Math.sin(o.seed + i * 1.7)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.92; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // a couple of facet cracks
      ctx.strokeStyle = 'rgba(58,52,42,0.55)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.35); ctx.moveTo(r * 0.35, -r * 0.4); ctx.lineTo(0, 0.05); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

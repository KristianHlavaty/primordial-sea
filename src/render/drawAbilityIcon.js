/* Vector icons for the powers — drawn on small canvases in the HUD,
   evolve cards, tree wiki, perk badges and achievement toasts. */
import { TAU } from '../core/math.js';
import { withA } from '../core/color.js';

export function drawAbilityIcon(ctx, id, size, color) {
  const r = size * 0.30, col = color || '#bcd'; ctx.save(); ctx.translate(size / 2, size / 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.fillStyle = withA(col, 0.18); ctx.lineWidth = size * 0.06;
  if (id === 'harden') {         // double hexagon shell
    for (const rr of [r, r * 0.55]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU - Math.PI / 2; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); if (rr === r) ctx.fill(); ctx.stroke();
    }
  } else if (id === 'enroll') {  // inward spiral
    ctx.beginPath(); let first = true;
    for (let a = 0; a < TAU * 2.3; a += 0.18) { const rr = r * a / (TAU * 2.3); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y); }
    ctx.stroke();
  } else if (id === 'barbs') {   // spiked disc
    ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = col;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58); ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); ctx.lineTo(Math.cos(a + 0.26) * r * 0.58, Math.sin(a + 0.26) * r * 0.58); ctx.closePath(); ctx.fill(); }
  } else if (id === 'burst') {   // speed chevrons
    ctx.lineWidth = size * 0.085;
    for (let i = 0; i < 3; i++) { const x = -r * 0.55 + i * r * 0.5; ctx.beginPath(); ctx.moveTo(x - r * 0.15, -r * 0.55); ctx.lineTo(x + r * 0.35, 0); ctx.lineTo(x - r * 0.15, r * 0.55); ctx.stroke(); }
  } else if (id === 'frenzy') {  // gnashing jaws
    ctx.fillStyle = col;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-r, s * r * 0.62);
      for (let i = 0; i < 4; i++) { const x = -r + i * r * 0.55; ctx.lineTo(x + r * 0.27, s * r * 0.12); ctx.lineTo(x + r * 0.55, s * r * 0.62); }
      ctx.closePath(); ctx.fill();
    }
  } else if (id === 'evasion') { // after-image blur
    ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.5, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(-r * 0.38, 0, r * 0.5, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  } else if (id === 'engulf') {  // inward suction arrows
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU; const ox = Math.cos(a), oy = Math.sin(a); ctx.beginPath();
      ctx.moveTo(ox * r * 1.05, oy * r * 1.05); ctx.lineTo(ox * r * 0.62, oy * r * 0.62); ctx.moveTo(ox * r * 0.62, oy * r * 0.62); ctx.lineTo(ox * r * 0.62 - oy * r * 0.22, oy * r * 0.62 + ox * r * 0.22); ctx.moveTo(ox * r * 0.62, oy * r * 0.62); ctx.lineTo(ox * r * 0.62 + oy * r * 0.22, oy * r * 0.62 - ox * r * 0.22); ctx.stroke();
    }
  } else if (id === 'bloom') {   // radiating stinging tentacles
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 0.8, Math.sin(a + 0.3) * r * 0.8, Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); ctx.stroke();
    }
  } else if (id === 'shock') {   // lightning bolt
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(r * 0.15, -r); ctx.lineTo(-r * 0.45, r * 0.15); ctx.lineTo(-r * 0.05, r * 0.15); ctx.lineTo(-r * 0.2, r); ctx.lineTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 0.08, -r * 0.2); ctx.closePath(); ctx.fill();
  } else if (id === 'nettle') {  // venom drop with spines
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.7, r * 0.2, 0, r); ctx.quadraticCurveTo(-r * 0.7, r * 0.2, 0, -r); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col;
    for (let i = 0; i < 3; i++) { const a = -0.5 + i * 0.5; ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.2); ctx.lineTo(Math.sin(a) * r * 0.95, Math.cos(a) * r * 0.2 - r * 0.35); ctx.stroke(); }
  }
  ctx.restore();
}

/* Vector icons for talents. A few are talent-specific (drawn here); anything
   else falls back to the shared power icons in drawAbilityIcon.js so trophies
   and reused symbols stay visually consistent. */
import { TAU } from '../core/math.js';
import { withA } from '../core/color.js';
import { drawAbilityIcon } from './drawAbilityIcon.js';

export function drawTalentIcon(ctx, id, size, color) {
  const r = size * 0.30, col = color || '#bcd';
  ctx.save(); ctx.translate(size / 2, size / 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.fillStyle = withA(col, 0.18); ctx.lineWidth = size * 0.06;

  if (id === 'fang') {                 // a single curved tooth with a highlight
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.9); ctx.lineTo(r * 0.55, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.35, r * 0.5, 0, r); ctx.quadraticCurveTo(-r * 0.35, r * 0.5, -r * 0.55, -r * 0.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#ffffff', 0.5); ctx.lineWidth = size * 0.04;
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.6); ctx.quadraticCurveTo(-r * 0.28, r * 0.1, -r * 0.08, r * 0.55); ctx.stroke();
  } else if (id === 'quick') {         // two fast chevrons + a spark
    ctx.lineWidth = size * 0.09;
    for (let i = 0; i < 2; i++) { const x = -r * 0.35 + i * r * 0.62; ctx.beginPath(); ctx.moveTo(x - r * 0.15, -r * 0.6); ctx.lineTo(x + r * 0.4, 0); ctx.lineTo(x - r * 0.15, r * 0.6); ctx.stroke(); }
    ctx.strokeStyle = withA(col, 0.6); ctx.lineWidth = size * 0.05;
    for (let i = 0; i < 2; i++) { const y = (i - 0.5) * r * 0.7; ctx.beginPath(); ctx.moveTo(-r * 1.05, y); ctx.lineTo(-r * 0.65, y); ctx.stroke(); }
  } else if (id === 'toughhp') {        // a plump heart (vitality)
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.25, -r * 0.1, -r * 0.5, -r * 1.05, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.25, -r * 0.1, 0, r * 0.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#ffffff', 0.45); ctx.lineWidth = size * 0.045;
    ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.35, r * 0.28, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
  } else if (id === 'metabolism') {     // a leaf being drawn upward into energy
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, r); ctx.quadraticCurveTo(r * 0.95, r * 0.2, r * 0.15, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.05, 0, r); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withA('#04121e', 0.5); ctx.lineWidth = size * 0.04;
    ctx.beginPath(); ctx.moveTo(0, r * 0.85); ctx.quadraticCurveTo(r * 0.2, r * 0.1, r * 0.12, -r * 0.45); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = size * 0.08;                 // rising arrow
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.35); ctx.lineTo(-r * 0.55, -r * 1.02); ctx.moveTo(-r * 0.8, -r * 0.72); ctx.lineTo(-r * 0.55, -r * 1.05); ctx.lineTo(-r * 0.3, -r * 0.72); ctx.stroke();
  } else if (id === 'adrenal') {        // energized disc with a fast bolt (power recharge)
    ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.stroke();
    ctx.strokeStyle = withA(col, 0.5); ctx.lineWidth = size * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.95, -Math.PI * 0.9, -Math.PI * 0.1); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.7); ctx.lineTo(-r * 0.35, r * 0.12); ctx.lineTo(-r * 0.02, r * 0.12); ctx.lineTo(-r * 0.15, r * 0.72); ctx.lineTo(r * 0.4, -r * 0.15); ctx.lineTo(r * 0.05, -r * 0.15); ctx.closePath(); ctx.fill();
  } else {
    ctx.restore();
    drawAbilityIcon(ctx, id, size, color);   // shared symbol (harden/regen/evasion/thickhide/websnare/sprint/burst/bloodscent…)
    return;
  }
  ctx.restore();
}

/* Vector icons for the powers — drawn on small canvases in the HUD,
   evolve cards, tree wiki, perk badges and achievement toasts. */
import { TAU } from '../core/math.js';
import { withA } from '../core/color.js';

export function drawAbilityIcon(ctx, id, size, color) {
  const r = size * 0.30, col = color || '#bcd'; ctx.save(); ctx.translate(size / 2, size / 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.fillStyle = withA(col, 0.18); ctx.lineWidth = size * 0.06;
  if (id === 'harden' || id === 'bastion') {         // double hexagon shell
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
  } else if (id === 'evasion' || id === 'ampullae' || id === 'silksense') { // after-image blur / heightened senses
    ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.5, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(-r * 0.38, 0, r * 0.5, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  } else if (id === 'engulf') {  // inward suction arrows
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU; const ox = Math.cos(a), oy = Math.sin(a); ctx.beginPath();
      ctx.moveTo(ox * r * 1.05, oy * r * 1.05); ctx.lineTo(ox * r * 0.62, oy * r * 0.62); ctx.moveTo(ox * r * 0.62, oy * r * 0.62); ctx.lineTo(ox * r * 0.62 - oy * r * 0.22, oy * r * 0.62 + ox * r * 0.22); ctx.moveTo(ox * r * 0.62, oy * r * 0.62); ctx.lineTo(ox * r * 0.62 + oy * r * 0.22, oy * r * 0.62 - ox * r * 0.22); ctx.stroke();
    }
  } else if (id === 'bloom' || id === 'websnare') {   // radiating tentacles / silk web
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
  } else if (id === 'jet') {     // siphon nozzle with thrust lines
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.5); ctx.lineTo(r * 0.9, 0); ctx.lineTo(-r * 0.2, r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { const y = (i - 1) * r * 0.4; ctx.beginPath(); ctx.moveTo(-r * 1.05, y); ctx.lineTo(-r * (0.45 - i % 2 * 0.12), y); ctx.stroke(); }
  } else if (id === 'withdraw') { // shell cross-section, arcs closing inward
    for (let i = 0; i < 3; i++) { const rr = r * (1 - i * 0.3); ctx.beginPath(); ctx.arc(0, 0, rr, 0.45 + i * 0.5, 0.45 + i * 0.5 + TAU * 0.78); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (id === 'ink') {     // billowing ink cloud
    ctx.fillStyle = col;
    for (const [x, y, rr] of [[-r * 0.4, r * 0.15, 0.5], [r * 0.3, r * 0.25, 0.42], [0, -r * 0.35, 0.55], [r * 0.55, -r * 0.3, 0.3]])
      { ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, r * rr, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.05, r * 0.3, 0, TAU); ctx.fill();
  } else if (id === 'grasp' || id === 'hookarms') {   // curling arm seizing a small prey dot
    ctx.lineWidth = size * 0.085; ctx.beginPath(); ctx.moveTo(-r, r * 0.7);
    ctx.quadraticCurveTo(r * 0.3, r * 0.6, r * 0.55, -r * 0.1); ctx.quadraticCurveTo(r * 0.6, -r * 0.7, 0, -r * 0.55); ctx.quadraticCurveTo(-r * 0.35, -r * 0.45, -r * 0.2, -r * 0.1); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.15, r * 0.2, 0, TAU); ctx.fill();
  } else if (id === 'ram') {     // charging cone with impact arcs
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.5, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(r * 0.55, 0, r * (0.55 + i * 0.32), -0.8, 0.8); ctx.stroke(); }
  } else if (id === 'filter') {  // funnel with inflowing streams
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.7); ctx.lineTo(r, -r * 0.7); ctx.lineTo(r * 0.22, r * 0.15); ctx.lineTo(r * 0.22, r); ctx.lineTo(-r * 0.22, r); ctx.lineTo(-r * 0.22, r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { const x = (i - 1) * r * 0.55; ctx.beginPath(); ctx.moveTo(x, -r * 1.05); ctx.lineTo(x * 0.7, -r * 0.75); ctx.stroke(); }
  } else if (id === 'impale') {  // two converging claw spikes
    ctx.fillStyle = col;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r, s * r * 0.75); ctx.quadraticCurveTo(r * 0.2, s * r * 0.55, r, s * r * 0.08); ctx.quadraticCurveTo(r * 0.1, s * r * 0.25, -r * 0.6, s * r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (id === 'crush') {   // guillotine jaw plates meeting
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r * 0.9, -r * 0.55); ctx.lineTo(r * 0.1, -r * 0.15); ctx.lineTo(-r * 0.5, -r * 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(r * 0.9, r * 0.55); ctx.lineTo(r * 0.1, r * 0.15); ctx.lineTo(-r * 0.5, r * 0.3); ctx.closePath(); ctx.fill();
  } else if (id === 'rebirth') { // colony ring regrowing its missing link
    for (let i = 0; i < 6; i++) { const a = i / 7 * TAU + 0.5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.2, 0, TAU); ctx.fill(); ctx.stroke(); }
    const a2 = 6.35 / 7 * TAU + 0.5; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(Math.cos(a2) * r * 0.72, Math.sin(a2) * r * 0.72, r * 0.12, 0, TAU); ctx.fill();
  } else if (id === 'bloodscent') { // blood drop with scent ripples
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.8); ctx.quadraticCurveTo(r * 0.15, -r * 0.05, -r * 0.35, r * 0.25); ctx.quadraticCurveTo(-r * 0.85, -r * 0.05, -r * 0.35, -r * 0.8); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.1, r * (0.5 + i * 0.28), -0.7, 0.7); ctx.stroke(); }
  } else if (id === 'venom' || id === 'hypervenom') {   // fangs with a falling drip
    ctx.fillStyle = col;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.55 - s * r * 0.25, -r); ctx.lineTo(s * r * 0.55, r * 0.15); ctx.lineTo(s * r * 0.55 + s * r * 0.25, -r); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(0, r * 0.25); ctx.quadraticCurveTo(r * 0.3, r * 0.7, 0, r); ctx.quadraticCurveTo(-r * 0.3, r * 0.7, 0, r * 0.25); ctx.closePath(); ctx.fill();
  } else if (id === 'camo') {    // creature outline fading into dashes
    ctx.beginPath(); ctx.ellipse(-r * 0.25, 0, r * 0.55, r * 0.38, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); ctx.stroke();
    ctx.setLineDash([size * 0.06, size * 0.07]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.38, 0, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    ctx.setLineDash([]);
  } else if (id === 'whirlpool') { // vortex arms spiraling into the center
    ctx.lineWidth = size * 0.07;
    for (let i = 0; i < 3; i++) {
      const off = i / 3 * TAU; ctx.beginPath();
      for (let a = 0; a < 2.4; a += 0.2) { const rr = r * (1.05 - a * 0.36); const x = Math.cos(a + off) * rr, y = Math.sin(a + off) * rr; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  } else if (id === 'pounce') {   // arced leap onto a target
    ctx.setLineDash([size * 0.05, size * 0.05]); ctx.lineWidth = size * 0.06;
    ctx.beginPath(); ctx.moveTo(-r, r * 0.7); ctx.quadraticCurveTo(0, -r * 1.3, r * 0.6, r * 0.1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r * 0.6, r * 0.45, r * 0.26, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r, r * 0.7); ctx.lineTo(-r * 0.55, r * 0.55); ctx.lineTo(-r * 0.78, r); ctx.closePath(); ctx.fill();
  } else if (id === 'burrow') {   // arrow diving under a ground line
    ctx.lineWidth = size * 0.07;
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.55); ctx.lineTo(r, -r * 0.55); ctx.stroke();       // ground
    ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, r * 0.65); ctx.stroke();          // shaft down
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(-r * 0.32, r * 0.5); ctx.lineTo(r * 0.32, r * 0.5); ctx.closePath(); ctx.fill();
  } else if (id === 'stomp') {    // impact star with radiating cracks
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.28, 0, TAU); ctx.fill();
    ctx.lineWidth = size * 0.06;
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.35, r * 0.2 + Math.sin(a) * r * 0.35); ctx.lineTo(Math.cos(a) * r * 1.02, r * 0.2 + Math.sin(a) * r * 0.7); ctx.stroke(); }
  } else if (id === 'tailsweep') { // sweeping circular arc with a tail tip
    ctx.lineWidth = size * 0.08; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, -0.4, Math.PI + 0.4); ctx.stroke();
    ctx.fillStyle = col; const ex = Math.cos(Math.PI + 0.4) * r * 0.85, ey = Math.sin(Math.PI + 0.4) * r * 0.85;
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.2, 0, TAU); ctx.fill();
  } else if (id === 'sprint') {   // running legs / motion streaks
    ctx.lineWidth = size * 0.09;
    for (let i = 0; i < 3; i++) { const y = (i - 1) * r * 0.55; ctx.beginPath(); ctx.moveTo(-r * 1.0 + i * r * 0.15, y); ctx.lineTo(r * 0.2 + i * r * 0.15, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.6); ctx.lineTo(r * 0.95, 0); ctx.lineTo(r * 0.2, r * 0.6); ctx.stroke();
  } else if (id === 'regen' || id === 'airbreath') {    // regeneration / efficient breathing
    ctx.fillStyle = col;
    ctx.fillRect(-r * 0.22, -r * 0.75, r * 0.44, r * 1.5);
    ctx.fillRect(-r * 0.75, -r * 0.22, r * 1.5, r * 0.44);
    ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = size * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  } else if (id === 'thickhide') { // layered plates / scute shield
    for (let i = 0; i < 3; i++) {
      const rr = r * (1 - i * 0.28);
      ctx.beginPath(); ctx.moveTo(-rr, r * 0.4 - i * r * 0.28);
      ctx.quadraticCurveTo(0, -rr - i * r * 0.1, rr, r * 0.4 - i * r * 0.28);
      i === 0 ? ctx.fill() : null; ctx.stroke();
    }
  }
  ctx.restore();
}

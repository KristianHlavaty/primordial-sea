/* The single parametric creature renderer — every species in the game
   (player, NPCs, bosses, previews) is drawn from a "plan" (data/plans.js).
   Everything is drawn facing +X around the origin; the caller sets transform.
   `o` is the plan spread together with per-frame fields: t (anim time),
   mouth (0..1 bite), hurt (0..1 red flash). */
import { TAU, lerp } from '../core/math.js';
import { shade, withA } from '../core/color.js';

export function eye(ctx, x, y, r, dark) {
  ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = dark || '#10202c'; ctx.beginPath(); ctx.arc(x + r * 0.2, y, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.28, 0, TAU); ctx.fill();
}

export function drawCreature(ctx, o) {
  const t = o.t || 0, L = o.len, W = o.wid, body = o.body, acc = o.accent;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (o.kind) {
    case 'microbe': {
      ctx.strokeStyle = withA(acc, 0.75); ctx.lineWidth = 1.5;
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU; const bx = Math.cos(a) * L, by = Math.sin(a) * W;
        const beat = Math.sin(t * 3 + i * 0.7) * 2.4;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * (3 + beat), by + Math.sin(a) * (3 + beat)); ctx.stroke();
      }
      const g = ctx.createRadialGradient(-L * 0.25, -W * 0.25, 1, 0, 0, L * 1.35);
      g.addColorStop(0, withA(acc, 0.92)); g.addColorStop(.55, withA(body, 0.82)); g.addColorStop(1, withA(body, 0.5));
      ctx.fillStyle = g; ctx.strokeStyle = withA(shade(body, -0.25), 0.85); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, L, W, Math.sin(t * 1.6) * 0.12, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = withA(shade(body, -0.35), 0.55); ctx.beginPath(); ctx.ellipse(-L * 0.12, W * 0.12, L * 0.32, W * 0.32, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = withA(shade(body, -0.1), 0.5);
      for (let i = 0; i < 3; i++) { const a = t * 0.5 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * L * 0.4, Math.sin(a) * W * 0.4, W * 0.14, 0, TAU); ctx.fill(); }
      eye(ctx, L * 0.5, -W * 0.15, Math.max(2.4, W * 0.3), '#0c2a2a'); break;
    }
    case 'worm': {
      const seg = o.segments || 8;
      ctx.strokeStyle = withA(shade(body, -0.2), 0.9);
      for (let i = seg; i >= 0; i--) {
        const f = i / seg; const x = lerp(L, -L, f); const y = Math.sin(t * 3 - f * 3.4) * W * 1.7 * f;
        const r = W * (1.05 - 0.5 * f) + (i === 0 ? W * 0.4 : 0);
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.4);
        g.addColorStop(0, shade(body, 0.25)); g.addColorStop(1, body);
        ctx.fillStyle = g; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      }
      const hx0 = L, hy0 = Math.sin(t * 3) * 0; eye(ctx, hx0 - W * 0.2, hy0 - W * 0.5, W * 0.42); eye(ctx, hx0 - W * 0.2, hy0 + W * 0.5, W * 0.42); break;
    }
    case 'jelly': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2); const bw = W * (1 + pulse * 0.12), bh = W * (0.95 - pulse * 0.15);
      const nt = o.tentacles || 6;
      ctx.strokeStyle = withA(acc, 0.5); ctx.lineWidth = 2.2;
      for (let i = 0; i < nt; i++) {
        const off = (i / (nt - 1) - 0.5); const ox = -L * 0.2 + off * W * 0.2;
        ctx.beginPath(); ctx.moveTo(ox, off * W * 0.7);
        for (let s = 1; s <= 4; s++) { const ss = s / 4; ctx.lineTo(ox - bw * 0.9 * ss - (1 - pulse) * 8 * ss, off * W * 0.7 + Math.sin(t * 2.5 + i + s) * 4 * ss); }
        ctx.stroke();
      }
      if (o.glow) {
        const gg = ctx.createRadialGradient(0, 0, 1, 0, 0, bw * 1.8); gg.addColorStop(0, withA(o.glow, 0.28)); gg.addColorStop(1, withA(o.glow, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, bw * 1.8, 0, TAU); ctx.fill();
      }
      const g = ctx.createRadialGradient(0, -bh * 0.3, 1, 0, 0, bw * 1.3);
      g.addColorStop(0, withA(acc, 0.85)); g.addColorStop(1, withA(body, 0.55));
      ctx.fillStyle = g; ctx.strokeStyle = withA(shade(body, 0.1), 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, bw, bh, 0, -Math.PI, 0); ctx.lineTo(bw, W * 0.15); ctx.quadraticCurveTo(0, W * 0.5, -bw, W * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'shell': {
      // orthocone: opening (head) at +X, cone tapering to -X
      const op = W;
      const g = ctx.createLinearGradient(0, -op, 0, op); g.addColorStop(0, shade(body, 0.25)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -0.3));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L * 0.3, -op); ctx.lineTo(-L, -op * 0.12); ctx.lineTo(-L, op * 0.12); ctx.lineTo(L * 0.3, op); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = withA(shade(body, -0.3), 0.6); ctx.lineWidth = 1.4;
      for (let i = 1; i < 6; i++) { const x = lerp(L * 0.3, -L, i / 6); const s = lerp(op, op * 0.12, i / 6); ctx.beginPath(); ctx.moveTo(x, -s); ctx.lineTo(x, s); ctx.stroke(); }
      // tentacles from opening
      ctx.strokeStyle = withA(acc, 0.9); ctx.lineWidth = 2.4;
      const nt = o.tentacles || 6;
      for (let i = 0; i < nt; i++) {
        const off = (i / (nt - 1) - 0.5) * 1.8; ctx.beginPath(); ctx.moveTo(L * 0.3, off * op * 0.5);
        ctx.quadraticCurveTo(L * 0.7, off * op * 0.5 + Math.sin(t * 3 + i) * 4, L * 0.95 + Math.sin(t * 3 + i) * 3, off * op * 0.6); ctx.stroke();
      }
      ctx.fillStyle = withA(shade(body, 0.1), 0.9); ctx.beginPath(); ctx.ellipse(L * 0.34, 0, op * 0.5, op * 0.85, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
      eye(ctx, L * 0.4, -op * 0.4, op * 0.22); break;
    }
    case 'arthro': {
      const seg = o.segments || 6, sway = Math.sin(t * 2.5) * 0.05;
      ctx.rotate(sway);
      // legs
      if (o.legs) {
        ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
        const pairs = o.legs / 2 | 0;
        for (let i = 0; i < pairs; i++) {
          const x = lerp(L * 0.4, -L * 0.7, i / (pairs - 1 || 1)); const beat = Math.sin(t * 6 + i) * 0.4;
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, s * W * 0.6); ctx.lineTo(x + beat * 4, s * (W * 1.15)); ctx.stroke(); }
        }
      }
      // head shield
      const hg = ctx.createRadialGradient(L * 0.5, -W * 0.2, 1, L * 0.4, 0, W * 1.5);
      hg.addColorStop(0, shade(body, 0.35)); hg.addColorStop(1, body);
      ctx.fillStyle = hg; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(L * 0.55, 0, L * 0.5, W * 1.05, 0, -Math.PI / 2, Math.PI / 2); ctx.lineTo(L * 0.55, W); ctx.closePath(); ctx.fill(); ctx.stroke();
      // thorax segments
      for (let i = 0; i < seg; i++) {
        const f = i / seg; const x = lerp(L * 0.4, -L, f); const w = W * (1.05 - 0.55 * f);
        const g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, shade(body, 0.28)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -0.28));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 0, L * 0.16, w, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = withA(acc, 0.35); ctx.beginPath(); ctx.ellipse(x, 0, L * 0.1, w * 0.4, 0, 0, TAU); ctx.fill();
        if (o.spikes && i < o.spikes) {
          ctx.fillStyle = shade(body, -0.15);
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, s * w); ctx.lineTo(x - L * 0.1, s * (w + L * 0.35)); ctx.lineTo(x + L * 0.1, s * w); ctx.closePath(); ctx.fill(); }
        }
      }
      // eyes / stalks
      if (o.eyes) {
        const ey = W * 0.5;
        if (o.stalks) {
          ctx.strokeStyle = shade(body, -0.2); ctx.lineWidth = 2.4;
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * 0.6, s * ey * 0.5); ctx.lineTo(L * 0.75, s * ey); ctx.stroke(); eye(ctx, L * 0.78, s * ey, W * 0.24); }
        }
        else for (const s of [-1, 1]) eye(ctx, L * 0.7, s * ey, W * 0.26);
      }
      break;
    }
    case 'scorpion': {
      const seg = o.segments || 8, m = o.mouth || 0;
      // walking legs
      ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
      const pairs = (o.legs || 8) / 2 | 0;
      for (let i = 0; i < pairs; i++) {
        const x = lerp(L * 0.3, -L * 0.1, i / (pairs - 1 || 1)); const beat = Math.sin(t * 7 + i) * 0.5;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, s * W * 0.5); ctx.quadraticCurveTo(x + beat * 5, s * W * 1.1, x + beat * 8, s * W * 1.5); ctx.stroke(); }
      }
      // tail to stinger (back)
      ctx.strokeStyle = body; ctx.lineWidth = W * 0.7; ctx.beginPath(); ctx.moveTo(-L * 0.2, 0);
      const ty = Math.sin(t * 2) * W * 0.6; ctx.quadraticCurveTo(-L * 0.8, ty, -L * 1.15, ty - W * 0.6); ctx.stroke();
      ctx.fillStyle = shade(body, -0.2); ctx.beginPath(); ctx.arc(-L * 1.15, ty - W * 0.6, W * 0.35, 0, TAU); ctx.fill();
      // body segments
      for (let i = 0; i < seg; i++) {
        const f = i / seg; const x = lerp(L * 0.45, -L * 0.25, f); const w = W * (1 - 0.4 * f);
        const g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, shade(body, 0.3)); g.addColorStop(1, shade(body, -0.28));
        ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, 0, L * 0.14, w, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
      // head + claws
      ctx.fillStyle = shade(body, 0.1); ctx.strokeStyle = shade(body, -0.35);
      ctx.beginPath(); ctx.ellipse(L * 0.55, 0, L * 0.22, W * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) {
        const bx = L * 0.72, by = s * W * 0.7; const open = 0.3 + m * 0.5;
        ctx.strokeStyle = body; ctx.lineWidth = W * 0.35; ctx.beginPath(); ctx.moveTo(L * 0.6, s * W * 0.5); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = shade(body, 0.05);
        ctx.beginPath(); ctx.ellipse(bx + L * 0.14, by, L * 0.2, W * 0.4, s * open, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(bx + L * 0.14, by, L * 0.2, W * 0.4, -s * open, 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (o.eyes) for (const s of [-1, 1]) eye(ctx, L * 0.62, s * W * 0.35, W * 0.2);
      break;
    }
    case 'anomalo': {
      // Anomalocaris: oval body, rippling side flaps, fan tail, two grasping appendages, stalk eyes
      const m = o.mouth || 0;
      ctx.fillStyle = withA(acc, 0.55); ctx.strokeStyle = withA(shade(body, -0.2), 0.7); ctx.lineWidth = 1.6;
      const flaps = 6;
      for (let i = 0; i < flaps; i++) {
        const f = i / (flaps - 1); const x = lerp(L * 0.5, -L * 0.7, f); const w = W * (1.4 - 0.5 * Math.abs(f - 0.4));
        const ph = Math.sin(t * 4 - f * 3) * 0.5;
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(x, s * W * 0.4);
          ctx.quadraticCurveTo(x - 3, s * (W + w * 0.5), x - 6, s * (W + w) * (1 + ph * 0.1)); ctx.quadraticCurveTo(x - 8, s * (W + w * 0.4), x - 10, s * W * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade(body, 0.3)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -0.3));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.75, W, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // tail fan
      ctx.fillStyle = withA(acc, 0.6); ctx.beginPath(); ctx.moveTo(-L * 0.7, 0);
      for (let k = -2; k <= 2; k++) { ctx.lineTo(-L * 1.1, k * W * 0.35 + Math.sin(t * 3 + k) * 3); ctx.lineTo(-L * 0.7, 0); } ctx.fill();
      // grasping appendages
      ctx.strokeStyle = body; ctx.lineWidth = W * 0.28;
      for (const s of [-1, 1]) {
        const cur = 0.4 + m * 0.4; ctx.beginPath(); ctx.moveTo(L * 0.65, s * W * 0.3);
        ctx.quadraticCurveTo(L * 1.0, s * W * 0.2, L * 1.05, s * W * 0.2 - cur * W * (s > 0 ? 1 : 1)); ctx.stroke();
      }
      if (o.eyes) for (const s of [-1, 1]) { ctx.strokeStyle = shade(body, -0.2); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(L * 0.55, s * W * 0.4); ctx.lineTo(L * 0.7, s * W * 0.85); ctx.stroke(); eye(ctx, L * 0.72, s * W * 0.85, W * 0.24); }
      break;
    }
    default: { // fish
      const wag = Math.sin(t * 2.4), ty = wag * W * 0.5, m = o.mouth || 0;
      // tail fin
      const tf = (o.tail || 1);
      ctx.fillStyle = withA(acc, 0.55); ctx.strokeStyle = withA(shade(body, -0.2), 0.6); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-L * 0.85, ty * 0.7);
      ctx.lineTo(-L * (0.9 + 0.6 * tf), ty * 0.7 - W * 1.4 * tf); ctx.lineTo(-L * (0.7 + 0.4 * tf), ty * 0.7);
      ctx.lineTo(-L * (0.9 + 0.6 * tf), ty * 0.7 + W * 1.4 * tf); ctx.closePath(); ctx.fill(); ctx.stroke();
      // dorsal fin
      ctx.fillStyle = withA(acc, 0.5); ctx.beginPath(); ctx.moveTo(L * 0.05, -W * 0.85); ctx.lineTo(-L * 0.35, -W * (1.1 + 0.3 * tf)); ctx.lineTo(-L * 0.45, -W * 0.4); ctx.closePath(); ctx.fill();
      // pectoral fin
      const pf = Math.sin(t * 5) * 0.3;
      ctx.fillStyle = withA(acc, 0.55); ctx.save(); ctx.translate(L * 0.2, W * 0.55); ctx.rotate(0.5 + pf);
      ctx.beginPath(); ctx.ellipse(0, W * 0.4, W * 0.3, W * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore();
      // body
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade(body, 0.3)); g.addColorStop(.45, body); g.addColorStop(1, shade(body, -0.32));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L, 0);
      ctx.quadraticCurveTo(L * 0.4, -W, -L * 0.5, -W * 0.62 + ty * 0.3);
      ctx.quadraticCurveTo(-L * 0.85, -W * 0.2 + ty * 0.6, -L * 0.85, ty * 0.7);
      ctx.quadraticCurveTo(-L * 0.85, W * 0.2 + ty * 0.6, -L * 0.5, W * 0.62 + ty * 0.3);
      ctx.quadraticCurveTo(L * 0.4, W, L, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // belly sheen
      ctx.fillStyle = withA(acc, 0.25); ctx.beginPath(); ctx.ellipse(L * 0.15, W * 0.2, L * 0.4, W * 0.35, 0, 0, TAU); ctx.fill();
      // mouth / teeth
      ctx.strokeStyle = shade(body, -0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.72, W * 0.22 + m * W * 0.3); ctx.stroke();
      if (o.teeth) {
        ctx.fillStyle = '#f6fbff';
        for (let i = 0; i < 3; i++) { const x = lerp(L * 0.98, L * 0.75, i / 2); ctx.beginPath(); ctx.moveTo(x, W * 0.05); ctx.lineTo(x - 2, W * 0.28 + m * W * 0.3); ctx.lineTo(x + 2, W * 0.05); ctx.closePath(); ctx.fill(); }
      }
      eye(ctx, L * 0.6, -W * 0.32, Math.max(2.6, W * 0.3));
      break;
    }
  }
  if (o.hurt > 0) { ctx.globalAlpha = o.hurt * 0.6; ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.ellipse(0, 0, L * 1.05, W * 1.35, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
}

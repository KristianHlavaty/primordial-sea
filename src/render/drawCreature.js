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
      if (o.landForm) {
        // Terrestrial medusae plant their appendages around the whole bell.
        // Alternating radial reach reads as an octopus-like crawling gait.
        ctx.lineWidth = Math.max(2.4, W * .12);
        for (let i = 0; i < nt; i++) {
          const baseA = i / nt * TAU, gait = Math.sin(t * 5 + i * Math.PI) * .14;
          const a = baseA + gait, reach = bw * (1.35 + .16 * Math.sin(t * 5 + i * Math.PI));
          const sx = Math.cos(baseA) * bw * .62, sy = Math.sin(baseA) * bh * .55;
          const kx = Math.cos(a + (i % 2 ? .2 : -.2)) * reach * .92;
          const ky = Math.sin(a + (i % 2 ? .2 : -.2)) * reach * .72;
          const ex = Math.cos(a) * reach * 1.35, ey = Math.sin(a) * reach;
          ctx.strokeStyle = withA(acc, .72); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(kx, ky, ex, ey); ctx.stroke();
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
          ctx.fillStyle = withA(acc, .9); ctx.beginPath(); ctx.ellipse(0, 0, 4 + (o.footPads || 0), 2.5 + (o.footPads || 0) * .25, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = withA(body, .75); ctx.beginPath(); ctx.arc(1.5, 0, 1.2, 0, TAU); ctx.fill(); ctx.restore();
        }
      } else {
        // Aquatic medusae keep the original trailing, current-driven tentacles.
        for (let i = 0; i < nt; i++) {
          const off = (i / (nt - 1) - 0.5); const ox = -L * 0.2 + off * W * 0.2;
          ctx.beginPath(); ctx.moveTo(ox, off * W * 0.7);
          for (let s = 1; s <= 4; s++) { const ss = s / 4; ctx.lineTo(ox - bw * 0.9 * ss - (1 - pulse) * 8 * ss, off * W * 0.7 + Math.sin(t * 2.5 + i + s) * 4 * ss); }
          ctx.stroke();
        }
      }
      if (o.glow) {
        const gg = ctx.createRadialGradient(0, 0, 1, 0, 0, bw * 1.8); gg.addColorStop(0, withA(o.glow, 0.28)); gg.addColorStop(1, withA(o.glow, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, bw * 1.8, 0, TAU); ctx.fill();
      }
      const g = ctx.createRadialGradient(0, -bh * 0.3, 1, 0, 0, bw * 1.3);
      g.addColorStop(0, withA(acc, 0.85)); g.addColorStop(1, withA(body, 0.55));
      ctx.fillStyle = g; ctx.strokeStyle = withA(shade(body, 0.1), 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, bw, bh, 0, -Math.PI, 0); ctx.lineTo(bw, W * 0.15); ctx.quadraticCurveTo(0, W * 0.5, -bw, W * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (o.crown) {
        ctx.fillStyle = withA(acc, 0.8);
        for (let i = 0; i < o.crown; i++) { const x = lerp(-bw * .72, bw * .72, i / Math.max(1, o.crown - 1)); ctx.beginPath(); ctx.moveTo(x - 3, -bh * .72); ctx.lineTo(x, -bh * (1.1 + (i % 2) * .18)); ctx.lineTo(x + 3, -bh * .72); ctx.closePath(); ctx.fill(); }
      }
      if (o.colonyNodes) {
        ctx.fillStyle = withA(acc, .72);
        for (let i = 0; i < o.colonyNodes; i++) { const a = i / o.colonyNodes * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * bw * .58, Math.sin(a) * bh * .4, Math.max(2, W * .09), 0, TAU); ctx.fill(); }
      }
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
      if (o.armorRidges) {
        ctx.strokeStyle = withA(acc, .7); ctx.lineWidth = 1.6;
        for (let i = 0; i < o.armorRidges; i++) { const x = lerp(L * .35, -L * .8, i / Math.max(1, o.armorRidges - 1)); ctx.beginPath(); ctx.moveTo(x, -W * .7); ctx.lineTo(x, W * .7); ctx.stroke(); }
      }
      if (o.horns) {
        ctx.fillStyle = acc;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * .72, s * W * .5); ctx.lineTo(L * (1 + o.horns * .08), s * W * .8); ctx.lineTo(L * .62, s * W * .68); ctx.closePath(); ctx.fill(); }
      }
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
    case 'arachnid': {
      const legN = Math.max(4, (o.legs || 8) / 2), stride = Math.sin(t * 7), abdomen = o.abdomen || 1;
      // Eight jointed walking legs sit behind the body masses.
      ctx.strokeStyle = shade(body, -.38); ctx.lineWidth = Math.max(2, W * .14);
      for (let i = 0; i < legN; i++) {
        const x = lerp(L * .28, -L * .35, i / Math.max(1, legN - 1));
        for (const s of [-1, 1]) {
          const step = stride * (i % 2 ? -1 : 1) * 4, kneeX = x + (i < 2 ? L * .16 : -L * .08), kneeY = s * W * 1.2;
          const footX = x + step + (i < 2 ? L * .18 : -L * .14), footY = s * W * (1.65 + i * .06);
          ctx.beginPath(); ctx.moveTo(x, s * W * .45); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
        }
      }
      // Abdomen, narrow waist, and cephalothorax.
      let ag = ctx.createRadialGradient(-L * .3, -W * .3, 1, -L * .3, 0, W * 1.5);
      ag.addColorStop(0, shade(body, .3)); ag.addColorStop(1, shade(body, -.18));
      ctx.fillStyle = ag; ctx.strokeStyle = shade(body, -.45); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-L * .28, 0, L * .42 * abdomen, W * .82 * abdomen, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(body, -.2); ctx.beginPath(); ctx.ellipse(L * .08, 0, L * .12, W * .32, 0, 0, TAU); ctx.fill();
      ag = ctx.createRadialGradient(L * .32, -W * .25, 1, L * .3, 0, W * 1.2); ag.addColorStop(0, shade(body, .28)); ag.addColorStop(1, body);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(L * .34, 0, L * .3, W * .72, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (o.abdomenMarks) {
        ctx.fillStyle = withA(acc, .55);
        for (let i = 0; i < o.abdomenMarks; i++) { const x = lerp(-L * .55, -L * .08, i / Math.max(1, o.abdomenMarks - 1)); ctx.beginPath(); ctx.ellipse(x, 0, L * .035, W * .52, 0, 0, TAU); ctx.fill(); }
      }
      if (o.armorRidges) {
        ctx.strokeStyle = withA(acc, .65); ctx.lineWidth = 1.4;
        for (let i = 0; i < o.armorRidges; i++) { const x = lerp(-L * .55, -L * .08, i / Math.max(1, o.armorRidges - 1)); ctx.beginPath(); ctx.moveTo(x, -W * .62); ctx.lineTo(x, W * .62); ctx.stroke(); }
      }
      // Grasping pedipalps distinguish it from the millipede route.
      ctx.strokeStyle = body; ctx.lineWidth = W * .22;
      for (const s of [-1, 1]) { const p = o.pedipalps || .7; ctx.beginPath(); ctx.moveTo(L * .5, s * W * .35); ctx.quadraticCurveTo(L * (.72 + p * .12), s * W * .72, L * (.72 + p * .22), s * W * (.45 + p * .2)); ctx.stroke(); }
      if (o.silkPlates || o.spinnerets) {
        const n = o.silkPlates || o.spinnerets; ctx.fillStyle = acc;
        for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * W * .18; ctx.beginPath(); ctx.ellipse(-L * (.7 + abdomen * .05), y, L * .08, W * .08, 0, 0, TAU); ctx.fill(); }
      }
      const eyeN = Math.min(8, o.eyes || 6);
      for (let i = 0; i < eyeN; i++) { const row = i < Math.ceil(eyeN / 2) ? -1 : 1, j = i % Math.ceil(eyeN / 2); eye(ctx, L * (.47 + j * .045), row * W * (.16 + j * .1), Math.max(1.5, W * .105)); }
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
    case 'ammonite': {
      // coiled chambered shell at the back, head and arm fan reaching +X
      const nt = o.tentacles || 6;
      ctx.strokeStyle = withA(acc, 0.9); ctx.lineWidth = 2.2;
      for (let i = 0; i < nt; i++) {
        const off = (i / (nt - 1) - 0.5) * 1.6;
        ctx.beginPath(); ctx.moveTo(L * 0.25, off * W * 0.35);
        ctx.quadraticCurveTo(L * 0.6, off * W * 0.5 + Math.sin(t * 3 + i) * 3, L * 0.9 + Math.sin(t * 2.6 + i) * 4, off * W * 0.55); ctx.stroke();
      }
      // soft head between shell and arms
      ctx.fillStyle = withA(shade(body, 0.1), 0.95);
      ctx.beginPath(); ctx.ellipse(L * 0.25, 0, L * 0.18, W * 0.45, 0, 0, TAU); ctx.fill();
      // the coil
      const cx = -L * 0.25, R = W * 1.05;
      const g = ctx.createRadialGradient(cx - R * 0.3, -R * 0.3, 1, cx, 0, R * 1.2);
      g.addColorStop(0, shade(body, 0.35)); g.addColorStop(1, shade(body, -0.15));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, 0, R, 0, TAU); ctx.fill(); ctx.stroke();
      // spiral whorls
      ctx.strokeStyle = withA(shade(body, -0.3), 0.8); ctx.lineWidth = 1.6;
      ctx.beginPath(); let first = true;
      for (let a = 0; a < TAU * 2.2; a += 0.12) {
        const rr = R * (1 - a / (TAU * 2.6)); const x = cx + Math.cos(a) * rr, y = Math.sin(a) * rr;
        first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // rib lines on the outer whorl
      for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.35; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72); ctx.lineTo(cx + Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
      eye(ctx, L * 0.32, -W * 0.25, Math.max(2.2, W * 0.16));
      break;
    }
    case 'squid': {
      // streamlined mantle tapering to -X, tail fins, arm cluster reaching +X
      const m = o.mouth || 0; const nt = o.tentacles || 8;
      ctx.strokeStyle = withA(acc, 0.8); ctx.lineWidth = 2.2;
      for (let i = 0; i < nt; i++) {
        const off = (i / (nt - 1) - 0.5) * 1.4; const wob = Math.sin(t * 4 + i) * 3;
        ctx.beginPath(); ctx.moveTo(L * 0.35, off * W * 0.35);
        ctx.quadraticCurveTo(L * 0.75, off * W * 0.7 + wob, L * (0.95 + m * 0.15) + wob * 0.5, off * W * (0.8 + m * 0.3)); ctx.stroke();
      }
      // tail fins (lost in the speculative terrestrial forms)
      if (o.fins !== false) {
        ctx.fillStyle = withA(acc, 0.5);
        ctx.beginPath(); ctx.moveTo(-L * 0.55, 0); ctx.lineTo(-L * 0.85, -W * 1.3); ctx.lineTo(-L * 1.02, 0); ctx.lineTo(-L * 0.85, W * 1.3); ctx.closePath(); ctx.fill();
      }
      // mantle
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade(body, 0.3)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -0.3));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-L, 0);
      ctx.quadraticCurveTo(-L * 0.2, -W, L * 0.42, -W * 0.5);
      ctx.quadraticCurveTo(L * 0.55, 0, L * 0.42, W * 0.5);
      ctx.quadraticCurveTo(-L * 0.2, W, -L, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (o.mantleSpots) {
        ctx.fillStyle = withA(acc, .55);
        for (let i = 0; i < o.mantleSpots; i++) { const f = i / Math.max(1, o.mantleSpots - 1); ctx.beginPath(); ctx.arc(lerp(-L * .72, L * .2, f), (i % 2 ? 1 : -1) * W * .32, Math.max(1.8, W * .12), 0, TAU); ctx.fill(); }
      }
      if (o.landForm) {
        ctx.strokeStyle = withA(acc, .85); ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++) { const x = lerp(-L * .65, L * .12, i / 4); ctx.beginPath(); ctx.moveTo(x, -W * .72); ctx.lineTo(x + 2, W * .72); ctx.stroke(); }
      }
      // head bulge + eye
      ctx.fillStyle = shade(body, 0.1); ctx.beginPath(); ctx.ellipse(L * 0.42, 0, L * 0.14, W * 0.6, 0, 0, TAU); ctx.fill();
      eye(ctx, L * 0.45, -W * 0.35, Math.max(2.6, W * 0.3));
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
      if (o.filterCrown) {
        ctx.strokeStyle = withA(acc, .9); ctx.lineWidth = 1.5;
        for (let i = 0; i < 9; i++) { const y = (i / 8 - .5) * W * 1.5; ctx.beginPath(); ctx.moveTo(L * .62, y * .35); ctx.lineTo(L * 1.18, y); ctx.stroke(); }
        ctx.strokeStyle = shade(body, -.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(L * .7, 0, W * .4, 0, TAU); ctx.stroke();
      }
      if (o.eyes) for (const s of [-1, 1]) { ctx.strokeStyle = shade(body, -0.2); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(L * 0.55, s * W * 0.4); ctx.lineTo(L * 0.7, s * W * 0.85); ctx.stroke(); eye(ctx, L * 0.72, s * W * 0.85, W * 0.24); }
      break;
    }
    case 'fishwalker': {
      const u = o.upright || 0, limb = o.limb || 1, wag = Math.sin(t * 4) * W * .3;
      // Tail and reduced swimming fin recede as the lineage becomes more terrestrial.
      ctx.strokeStyle = shade(body, -.18); ctx.lineWidth = W * (.62 - u * .18); ctx.beginPath(); ctx.moveTo(-L * .35, 0); ctx.quadraticCurveTo(-L * .75, wag, -L * (1 + (o.tail || 1) * .28), wag); ctx.stroke();
      ctx.fillStyle = withA(acc, .58); ctx.beginPath(); ctx.moveTo(-L * .92, wag); ctx.lineTo(-L * (1.16 + (o.tail || 1) * .22), wag - W * (.9 - u * .35)); ctx.lineTo(-L * (1.08 + (o.tail || 1) * .2), wag); ctx.lineTo(-L * (1.16 + (o.tail || 1) * .22), wag + W * (.9 - u * .35)); ctx.closePath(); ctx.fill();
      // Two webbed limb pairs; later forms have long rear legs and grasping forelimbs.
      ctx.strokeStyle = shade(body, -.32); ctx.lineWidth = W * .25;
      for (const [x, rear] of [[L * .28, false], [-L * .15, true]]) for (const s of [-1, 1]) {
        const step = Math.sin(t * 6 + (rear ? Math.PI : 0) + (s > 0 ? 0 : Math.PI)) * 5;
        const reach = W * limb * (rear ? 1.65 : 1.25);
        const ex = x - (rear ? W * .35 : -W * .12) + step, ey = s * (W * .55 + reach);
        ctx.beginPath(); ctx.moveTo(x, s * W * .52); ctx.quadraticCurveTo(x + step * .4, s * W * (1 + limb * .25), ex, ey); ctx.stroke();
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(s * .18);
        ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(5 + u * 3, -4); ctx.lineTo(3, 0); ctx.lineTo(5 + u * 3, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Fish-like torso and broad head.
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade(body, .3)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -.3));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -.42); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, L * (.68 - u * .06), W * (1 + u * .08), 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(body, .08); ctx.beginPath(); ctx.ellipse(L * .62, 0, L * (.27 + u * .04), W * (1.02 + u * .08), 0, 0, TAU); ctx.fill(); ctx.stroke();
      // Gill fans remain visible behind the skull.
      ctx.strokeStyle = withA(acc, .85); ctx.lineWidth = 1.7;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = L * (.38 - i * .05); ctx.beginPath(); ctx.moveTo(x, s * W * .42); ctx.lineTo(x - L * .08, s * W * (.72 + i * .12)); ctx.stroke(); }
      // Body stripes and a crown that grows with each terrestrial tier.
      ctx.strokeStyle = withA(acc, .48); ctx.lineWidth = 2;
      for (let i = 0; i < (o.stripes || 0); i++) { const x = lerp(-L * .45, L * .25, i / Math.max(1, o.stripes - 1)); ctx.beginPath(); ctx.moveTo(x, -W * .65); ctx.lineTo(x - L * .04, W * .65); ctx.stroke(); }
      ctx.fillStyle = acc;
      for (let i = 0; i < (o.crest || 0); i++) {
        const x = lerp(-L * .3, L * .32, i / Math.max(1, o.crest - 1));
        ctx.beginPath(); ctx.moveTo(x - 3, W * .1); ctx.lineTo(x, -W * (.38 + u * .12)); ctx.lineTo(x + 3, W * .1); ctx.closePath(); ctx.fill();
      }
      // Vertical mouth seam at the forward snout and widely set eyes.
      const mx = L * .91; ctx.strokeStyle = shade(body, -.58); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, -W * .38); ctx.quadraticCurveTo(mx + (o.mouth || 0) * W * .35, 0, mx, W * .38); ctx.stroke();
      for (const s of [-1, 1]) eye(ctx, L * .68, s * W * .48, Math.max(2.5, W * .23));
      break;
    }
    case 'tetrapod': {
      // salamander-like body facing +X: tail (-X) -> body -> rounded head (+X),
      // two pairs of splayed walking legs, optional teeth.
      const m = o.mouth || 0; const tf = (o.tail || 1), limb = o.limb || 1, hs = o.headScale || 1, snout = o.snout || 1;
      const step = Math.sin(t * 6);
      // tail
      ctx.strokeStyle = shade(body, -0.15); ctx.lineWidth = W * 0.7;
      const ty = Math.sin(t * 3) * W * 0.5;
      ctx.beginPath(); ctx.moveTo(-L * 0.3, 0); ctx.quadraticCurveTo(-L * 0.8, ty * 0.6, -L * (0.95 + 0.4 * tf), ty); ctx.stroke();
      if (o.tailFin) {
        ctx.fillStyle = withA(acc, .65); ctx.beginPath(); ctx.moveTo(-L * .35, 0); ctx.quadraticCurveTo(-L * .8, -W * o.tailFin, -L * (1.12 + .25 * tf), ty); ctx.quadraticCurveTo(-L * .8, W * o.tailFin, -L * .35, 0); ctx.fill();
      }
      // legs (front pair near head, rear pair near hips), alternating gait
      ctx.strokeStyle = shade(body, -0.3); ctx.lineWidth = W * 0.28; ctx.lineCap = 'round';
      const legAt = (lx, phase) => {
        for (const s of [-1, 1]) {
          const beat = Math.sin(t * 6 + phase + (s > 0 ? 0 : Math.PI)) * 0.4;
          const ex = lx - W * .3 + beat * 8, ey = s * W * (1.2 + .5 * limb);
          ctx.beginPath(); ctx.moveTo(lx, s * W * 0.6);
          ctx.quadraticCurveTo(lx + beat * 6, s * W * (1.05 + .2 * limb), ex, ey); ctx.stroke();
          if (o.digits) { ctx.strokeStyle = withA(acc, .85); ctx.lineWidth = 1.4; for (let d = 0; d < o.digits; d++) { const off = (d - (o.digits - 1) / 2) * .18; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + W * .28, ey + s * W * off); ctx.stroke(); } ctx.strokeStyle = shade(body, -.3); ctx.lineWidth = W * .28; }
        }
      };
      legAt(L * 0.42, 0); legAt(-L * 0.12, Math.PI);
      // body
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade(body, 0.28)); g.addColorStop(.5, body); g.addColorStop(1, shade(body, -0.3));
      ctx.fillStyle = g; ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L * 0.85, 0);
      ctx.quadraticCurveTo(L * 0.5, -W, -L * 0.1, -W * 0.85);
      ctx.quadraticCurveTo(-L * 0.4, -W * 0.5, -L * 0.3, 0);
      ctx.quadraticCurveTo(-L * 0.4, W * 0.5, -L * 0.1, W * 0.85);
      ctx.quadraticCurveTo(L * 0.5, W, L * 0.85, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // dorsal sail (synapsids) — a spined membrane rising from the back
      if (o.sail) {
        const sh = W * (1.6 + 1.4 * o.sail);
        const g2 = ctx.createLinearGradient(0, -W, 0, -sh); g2.addColorStop(0, withA(body, .9)); g2.addColorStop(1, withA(acc, .5));
        ctx.fillStyle = g2; ctx.strokeStyle = shade(body, -0.35); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(L * 0.45, -W * 0.55);
        ctx.quadraticCurveTo(L * 0.1, -sh, -L * 0.05, -sh * 0.95);
        ctx.quadraticCurveTo(-L * 0.3, -sh * 0.7, -L * 0.4, -W * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
        for (let i = 0; i <= 5; i++) { const t2 = i / 5; const x = lerp(L * 0.45, -L * 0.4, t2); const top = -sh * (0.55 + 0.45 * Math.sin(t2 * Math.PI)); ctx.beginPath(); ctx.moveTo(x, -W * 0.5); ctx.lineTo(x, top); ctx.stroke(); }
      }
      // species-specific back pattern
      ctx.fillStyle = withA(o.patternColor || shade(body, -0.2), 0.55);
      const marks = o.marks === undefined ? 4 : o.marks;
      for (let i = 0; i < marks; i++) { const x = lerp(L * 0.5, -L * 0.2, i / Math.max(1, marks - 1)); ctx.beginPath(); if (o.stripes) ctx.ellipse(x, 0, W * .12, W * .72, 0, 0, TAU); else ctx.ellipse(x, (i % 2 ? 1 : -1) * W * .3, W * .22, W * .16, 0, 0, TAU); ctx.fill(); }
      if (o.gillFrills) {
        ctx.strokeStyle = withA(acc, .85); ctx.lineWidth = 1.8;
        for (const s of [-1, 1]) for (let i = 0; i < o.gillFrills; i++) { const x = L * (.45 - i * .06); ctx.beginPath(); ctx.moveTo(x, s * W * .55); ctx.lineTo(x - L * .08, s * W * (1 + i * .12)); ctx.stroke(); }
      }
      if (o.dorsalRidge) {
        ctx.fillStyle = withA(acc, .78);
        for (let i = 0; i < o.dorsalRidge; i++) { const x = lerp(-L * .2, L * .42, i / Math.max(1, o.dorsalRidge - 1)); ctx.beginPath(); ctx.moveTo(x - 3, W * .08); ctx.lineTo(x, -W * .42); ctx.lineTo(x + 3, W * .08); ctx.closePath(); ctx.fill(); }
      }
      // broad head
      const hg = ctx.createRadialGradient(L * 0.85, -W * 0.2, 1, L * 0.8, 0, W * 1.4);
      hg.addColorStop(0, shade(body, 0.32)); hg.addColorStop(1, body);
      ctx.fillStyle = hg; ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(L * (0.82 + .08 * snout), 0, L * 0.28 * snout, W * 0.85 * hs, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // Top-down snout: the mouth is a vertical seam between the two eyes.
      // During a bite the seam bows forward (+X) instead of opening sideways.
      ctx.strokeStyle = shade(body, -0.5); ctx.lineWidth = 2;
      const tipX = L * (1.12 + .08 * snout), jawBack = m * W * .16, jawFront = m * W * .32;
      ctx.beginPath(); ctx.moveTo(tipX - jawBack, -W * .34); ctx.quadraticCurveTo(tipX + jawFront, 0, tipX - jawBack, W * .34); ctx.stroke();
      ctx.fillStyle = shade(body, -.62);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(tipX - L * .055, s * W * .13, Math.max(1, W * .055), 0, TAU); ctx.fill(); }
      if (o.teeth) {
        ctx.fillStyle = '#f6fbff';
        for (let i = 0; i < 4; i++) { const y = lerp(-W * .27, W * .27, i / 3); ctx.beginPath(); ctx.moveTo(tipX - jawBack, y - 1.7); ctx.lineTo(tipX - jawBack - W * .14, y); ctx.lineTo(tipX - jawBack, y + 1.7); ctx.closePath(); ctx.fill(); }
      }
      // bulging eyes set high on the skull
      for (const s of [-1, 1]) eye(ctx, L * (0.84 + .03 * snout), s * W * 0.42 * hs, Math.max(2.1, W * 0.24 * (o.eyeScale || 1)));
      break;
    }
    case 'winged': {
      // griffinfly / early winged insect: slender segmented abdomen (-X), thorax,
      // head with big compound eyes (+X), and two pairs of long translucent wings.
      const seg = o.segments || 8; const beat = Math.sin(t * 9) * 0.22;
      // wings first (behind the body) — a fore and hind pair per side
      for (const s of [-1, 1]) for (const [wx, wl, base] of [[L * 0.22, L * 1.05, 0.5], [L * 0.02, L * 0.92, 0.92]]) {
        ctx.save(); ctx.translate(wx, s * W * 0.3); ctx.rotate(s * (base + beat));
        const wg = ctx.createLinearGradient(0, 0, 0, s * wl); wg.addColorStop(0, withA(acc, 0.32)); wg.addColorStop(1, withA(acc, 0.12));
        ctx.fillStyle = wg; ctx.strokeStyle = withA(body, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, s * wl * 0.5, W * 0.55, wl * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = withA(body, 0.45); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * wl * 0.95); ctx.stroke();
        ctx.restore();
      }
      // abdomen — tapering segmented tail
      for (let i = seg; i >= 0; i--) {
        const f = i / seg; const x = lerp(-L * 0.1, -L * 1.05, f); const w = W * (0.62 - 0.4 * f);
        ctx.fillStyle = i % 2 ? shade(body, 0.12) : body; ctx.strokeStyle = shade(body, -0.3); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(x, 0, W * 0.3, w, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
      // thorax
      const tg = ctx.createRadialGradient(L * 0.15, -W * 0.25, 1, L * 0.1, 0, W * 1.3);
      tg.addColorStop(0, shade(body, 0.32)); tg.addColorStop(1, shade(body, -0.15));
      ctx.fillStyle = tg; ctx.strokeStyle = shade(body, -0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(L * 0.15, 0, L * 0.34, W, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // head + big compound eyes
      ctx.fillStyle = shade(body, 0.06); ctx.strokeStyle = shade(body, -0.4);
      ctx.beginPath(); ctx.arc(L * 0.52, 0, W * 0.66, 0, TAU); ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) { ctx.fillStyle = withA(acc, 0.92); ctx.beginPath(); ctx.arc(L * 0.58, s * W * 0.42, W * 0.36, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(L * 0.62, s * W * 0.42 - W * 0.12, W * 0.1, 0, TAU); ctx.fill(); }
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
      if (o.dorsalSpike) {
        ctx.fillStyle = withA(acc, .85); ctx.strokeStyle = shade(body, -.35); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(L * .45, -W * .72); ctx.lineTo(L * .2, -W * (1.35 + o.dorsalSpike)); ctx.lineTo(-L * .05, -W * .68); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
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
      if (o.bodyStripes) {
        ctx.strokeStyle = withA(acc, .5); ctx.lineWidth = Math.max(1.5, L * .035);
        for (let i = 0; i < o.bodyStripes; i++) { const x = lerp(-L * .58, L * .34, i / Math.max(1, o.bodyStripes - 1)); ctx.beginPath(); ctx.moveTo(x, -W * .58); ctx.lineTo(x - L * .04, W * .58); ctx.stroke(); }
      }
      if (o.wingFins) {
        ctx.fillStyle = withA(acc, .55);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * .05, s * W * .65); ctx.lineTo(-L * .18, s * W * 1.65); ctx.lineTo(L * .34, s * W * .72); ctx.closePath(); ctx.fill(); }
      }
      // belly sheen
      ctx.fillStyle = withA(acc, 0.25); ctx.beginPath(); ctx.ellipse(L * 0.15, W * 0.2, L * 0.4, W * 0.35, 0, 0, TAU); ctx.fill();
      // placoderm head armor: pale bony shield with a jagged rear seam (Dunkleosteus)
      if (o.headPlate) {
        const pg = ctx.createLinearGradient(0, -W, 0, W);
        pg.addColorStop(0, '#cdd8e6'); pg.addColorStop(0.5, '#9dadc0'); pg.addColorStop(1, '#71879c');
        ctx.fillStyle = pg; ctx.strokeStyle = '#39485a'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(L, 0);
        ctx.quadraticCurveTo(L * 0.5, -W * 0.92, L * 0.1, -W * 0.8);
        ctx.lineTo(L * 0.24, -W * 0.35); ctx.lineTo(L * 0.06, 0); ctx.lineTo(L * 0.24, W * 0.35); ctx.lineTo(L * 0.1, W * 0.8);
        ctx.quadraticCurveTo(L * 0.5, W * 0.92, L, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // plate suture running down the cheek
        ctx.strokeStyle = 'rgba(42,54,68,0.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(L * 0.62, -W * 0.72); ctx.quadraticCurveTo(L * 0.48, 0, L * 0.62, W * 0.72); ctx.stroke();
      }
      // mouth / teeth
      ctx.strokeStyle = shade(body, -0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.72, W * 0.22 + m * W * 0.3); ctx.stroke();
      if (o.teeth) {
        ctx.fillStyle = '#f6fbff';
        for (let i = 0; i < 3; i++) { const x = lerp(L * 0.98, L * 0.75, i / 2); ctx.beginPath(); ctx.moveTo(x, W * 0.05); ctx.lineTo(x - 2, W * 0.28 + m * W * 0.3); ctx.lineTo(x + 2, W * 0.05); ctx.closePath(); ctx.fill(); }
      }
      // self-sharpening bone shears instead of teeth (Dunkleosteus)
      if (o.boneShears) {
        ctx.fillStyle = '#eef3f8'; ctx.strokeStyle = '#8fa0b2'; ctx.lineWidth = 1.2;
        // upper blade stabbing down from the skull plate
        ctx.beginPath(); ctx.moveTo(L * 1.02, -W * 0.05);
        ctx.lineTo(L * 0.6, -W * 0.28);
        ctx.lineTo(L * 0.68, W * (0.3 + m * 0.35));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // lower counter-blade rising to meet it
        ctx.beginPath(); ctx.moveTo(L * 0.92, W * (0.42 + m * 0.4));
        ctx.lineTo(L * 0.58, W * (0.5 + m * 0.4));
        ctx.lineTo(L * 0.72, W * (0.16 + m * 0.2));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      eye(ctx, L * 0.6, -W * 0.32, Math.max(2.6, W * 0.3));
      // armored orbital ring around the eye
      if (o.headPlate) { ctx.strokeStyle = '#39485a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(L * 0.6, -W * 0.32, Math.max(2.6, W * 0.3) + 2.5, 0, TAU); ctx.stroke(); }
      break;
    }
  }
  if (o.hurt > 0) { ctx.globalAlpha = o.hurt * 0.6; ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.ellipse(0, 0, L * 1.05, W * 1.35, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
}

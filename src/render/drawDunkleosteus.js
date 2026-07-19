/* Side-profile placoderm renderer for the Dunkleosteus model study.
   Facing remains +X like every game creature, but Y is now dorsal/ventral:
   one visible eye, one cheek, a hinged lower jaw and readable vertical fins. */
import { TAU, lerp } from '../core/math.js';
import { shade, withA } from '../core/color.js';

function drawEye(ctx, x, y, radius, iris, blind = false) {
  ctx.fillStyle = blind ? '#24282b' : '#edf4ee'; ctx.strokeStyle = '#152127'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); ctx.stroke();
  if (!blind) {
    ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(x + radius * .22, y, radius * .58, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - radius * .22, radius * .2, 0, TAU); ctx.fill();
  }
}

function drawTail(ctx, o, L, W, rootX, rootY, wag) {
  const reach = L * (.38 + (o.tailLength || 1) * .34), tipX = rootX - reach;
  const style = o.tailStyle || 'heterocercal';
  ctx.save(); ctx.translate(rootX, rootY); ctx.rotate(wag * .065);
  ctx.fillStyle = withA(o.accent, .74); ctx.strokeStyle = shade(o.body, -.42); ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (style === 'heterocercal') {
    ctx.moveTo(0, -W * .2); ctx.quadraticCurveTo(-reach * .5, -W * .68, -reach, -W * 1.72);
    ctx.quadraticCurveTo(-reach * .82, -W * .36, -reach * .68, 0);
    ctx.quadraticCurveTo(-reach * .78, W * .72, -reach * .61, W * 1.02);
    ctx.quadraticCurveTo(-reach * .36, W * .45, 0, W * .2);
  } else if (style === 'paddle') {
    ctx.moveTo(0, -W * .2); ctx.bezierCurveTo(-reach * .38, -W * .92, -reach, -W * .72, -reach, 0);
    ctx.bezierCurveTo(-reach, W * .72, -reach * .38, W * .92, 0, W * .2);
  } else if (style === 'spear') {
    ctx.moveTo(0, -W * .18); ctx.lineTo(-reach * .72, -W * .54); ctx.lineTo(-reach, 0);
    ctx.lineTo(-reach * .72, W * .54); ctx.lineTo(0, W * .18);
  } else if (style === 'diamond') {
    ctx.moveTo(0, -W * .2); ctx.lineTo(-reach * .72, -W * 1.28); ctx.lineTo(-reach, 0);
    ctx.lineTo(-reach * .72, W * 1.28); ctx.lineTo(0, W * .2);
  } else if (style === 'crescent') {
    ctx.moveTo(0, -W * .18); ctx.quadraticCurveTo(-reach * .45, -W * .58, -reach, -W * 1.52);
    ctx.quadraticCurveTo(-reach * .75, -W * .22, -reach * .7, 0);
    ctx.quadraticCurveTo(-reach * .75, W * .22, -reach, W * 1.52);
    ctx.quadraticCurveTo(-reach * .45, W * .58, 0, W * .18);
  } else if (style === 'lance') {
    ctx.moveTo(0, -W * .18); ctx.lineTo(-reach * .76, -W * .72); ctx.lineTo(-reach, 0);
    ctx.lineTo(-reach * .76, W * .72); ctx.lineTo(0, W * .18);
  } else if (style === 'fan') {
    ctx.moveTo(0, -W * .2); ctx.quadraticCurveTo(-reach * .48, -W * 1.22, -reach, -W * .96);
    ctx.quadraticCurveTo(-reach * 1.12, 0, -reach, W * .96);
    ctx.quadraticCurveTo(-reach * .48, W * 1.22, 0, W * .2);
  } else if (style === 'lyre') {
    ctx.moveTo(0, -W * .18); ctx.bezierCurveTo(-reach * .4, -W * .52, -reach * .76, -W * 1.42, -reach, -W * 1.66);
    ctx.quadraticCurveTo(-reach * .77, -W * .18, -reach * .67, 0);
    ctx.quadraticCurveTo(-reach * .77, W * .22, -reach, W * 1.36);
    ctx.bezierCurveTo(-reach * .65, W * 1.05, -reach * .35, W * .44, 0, W * .18);
  } else if (style === 'ragged') {
    ctx.moveTo(0, -W * .18); ctx.lineTo(-reach * .66, -W * .58); ctx.lineTo(-reach * .86, -W * 1.35);
    ctx.lineTo(-reach * .78, -W * .42); ctx.lineTo(-reach, W * 1.02); ctx.lineTo(-reach * .46, W * .45); ctx.lineTo(0, W * .18);
  } else {
    ctx.moveTo(0, -W * .2); ctx.lineTo(-reach, -W); ctx.lineTo(-reach * .75, 0); ctx.lineTo(-reach, W); ctx.lineTo(0, W * .2);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = withA(shade(o.accent, .28), .5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-reach * .72, 0); ctx.stroke();
  ctx.restore();
}

function finPath(ctx, style, L, W, scale, dorsal) {
  const side = dorsal ? -1 : 1;
  if (style === 'sail') {
    ctx.moveTo(L * .18, 0); ctx.quadraticCurveTo(-L * .05, side * W * scale * 1.65, -L * .38, side * W * scale * 1.12); ctx.lineTo(-L * .28, 0);
  } else if (style === 'swept' || style === 'tuna' || style === 'blade') {
    ctx.moveTo(L * .18, 0); ctx.lineTo(-L * .24, side * W * scale * (style === 'blade' ? 1.18 : .98)); ctx.lineTo(-L * .15, 0);
  } else if (style === 'reduced') {
    ctx.moveTo(L * .12, 0); ctx.lineTo(-L * .08, side * W * scale * .55); ctx.lineTo(-L * .16, 0);
  } else if (style === 'fan') {
    ctx.moveTo(L * .16, 0); ctx.quadraticCurveTo(L * .02, side * W * scale, -L * .3, side * W * scale * .82); ctx.quadraticCurveTo(-L * .25, side * W * .18, -L * .16, 0);
  } else if (style === 'banner') {
    ctx.moveTo(L * .16, 0); ctx.bezierCurveTo(0, side * W * scale * .6, -L * .22, side * W * scale * 1.42, -L * .48, side * W * scale * 1.55); ctx.quadraticCurveTo(-L * .24, side * W * .28, -L * .13, 0);
  } else if (style === 'spined') {
    ctx.moveTo(L * .15, 0); ctx.lineTo(L * .01, side * W * scale * 1.22); ctx.lineTo(-L * .08, side * W * scale * .46); ctx.lineTo(-L * .28, side * W * scale * .95); ctx.lineTo(-L * .15, 0);
  } else if (style === 'torn') {
    ctx.moveTo(L * .14, 0); ctx.lineTo(-L * .02, side * W * scale * 1.1); ctx.lineTo(-L * .08, side * W * scale * .48); ctx.lineTo(-L * .28, side * W * scale * .72); ctx.lineTo(-L * .14, 0);
  } else {
    ctx.moveTo(L * .15, 0); ctx.quadraticCurveTo(-L * .02, side * W * scale, -L * .3, side * W * scale * .72); ctx.quadraticCurveTo(-L * .2, side * W * .14, -L * .13, 0);
  }
  ctx.closePath();
}

function drawMedianFins(ctx, o, L, W, bodyTop, bodyBottom) {
  const style = o.finStyle || 'rounded', dorsalScale = (o.dorsalScale || 1) * (o.finScale || 1);
  ctx.fillStyle = withA(o.accent, .64); ctx.strokeStyle = shade(o.body, -.42); ctx.lineWidth = 1.4;
  ctx.save(); ctx.translate(-L * .14, -bodyTop * .83); ctx.beginPath(); finPath(ctx, style, L, W, dorsalScale, true); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(-L * .35, bodyBottom * .7); ctx.beginPath(); finPath(ctx, style === 'sail' ? 'swept' : style, L * .62, W, (o.finScale || 1) * .62, false); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawPectoralFin(ctx, o, L, W, baseX, baseY, t) {
  const style = o.finStyle || 'rounded', scale = o.finScale || 1, beat = Math.sin(t * 4.8) * .08;
  ctx.save(); ctx.translate(baseX, baseY); ctx.rotate(.38 + beat);
  ctx.fillStyle = withA(o.accent, .72); ctx.strokeStyle = shade(o.body, -.46); ctx.lineWidth = 1.5; ctx.beginPath();
  if (style === 'reduced') {
    ctx.moveTo(L * .08, 0); ctx.lineTo(-L * .18, W * .45 * scale); ctx.lineTo(-L * .24, W * .08); ctx.closePath();
  } else if (style === 'swept' || style === 'tuna' || style === 'blade') {
    ctx.moveTo(L * .08, 0); ctx.lineTo(-L * .42, W * .9 * scale); ctx.lineTo(-L * .22, W * .12); ctx.closePath();
  } else if (style === 'banner') {
    ctx.moveTo(L * .07, 0); ctx.bezierCurveTo(-L * .08, W * .6, -L * .28, W * 1.3 * scale, -L * .56, W * 1.48 * scale); ctx.quadraticCurveTo(-L * .3, W * .22, -L * .2, 0); ctx.closePath();
  } else if (style === 'torn') {
    ctx.moveTo(L * .08, 0); ctx.lineTo(-L * .22, W * 1.0 * scale); ctx.lineTo(-L * .23, W * .42); ctx.lineTo(-L * .42, W * .75); ctx.lineTo(-L * .2, 0); ctx.closePath();
  } else {
    ctx.moveTo(L * .08, 0); ctx.quadraticCurveTo(-L * .03, W * .9 * scale, -L * .4, W * .83 * scale); ctx.quadraticCurveTo(-L * .27, W * .18, -L * .18, 0); ctx.closePath();
  }
  ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawBodyPattern(ctx, o, L, W, top, bottom) {
  ctx.save();
  if (o.pattern === 'countershade') {
    ctx.fillStyle = withA(o.accent, .2); ctx.beginPath(); ctx.ellipse(-L * .25, bottom * .34, L * .5, bottom * .44, -.03, 0, TAU); ctx.fill();
  } else if (o.pattern === 'shoulder-bars') {
    ctx.strokeStyle = withA(o.accent, .46); ctx.lineWidth = Math.max(2, L * .045);
    for (let i = 0; i < 4; i++) { const x = lerp(-L * .55, L * .02, i / 3); ctx.beginPath(); ctx.moveTo(x, -top * .68); ctx.lineTo(x - L * .08, bottom * .68); ctx.stroke(); }
  } else if (o.pattern === 'lateral-line') {
    ctx.strokeStyle = withA(o.accent, .66); ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(L * .12, -W * .04); ctx.quadraticCurveTo(-L * .28, W * .08, -L * .7, 0); ctx.stroke();
  } else if (o.pattern === 'glow-line') {
    ctx.strokeStyle = withA(o.glow, .72); ctx.shadowColor = o.glow; ctx.shadowBlur = 9; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(L * .12, -W * .06); ctx.bezierCurveTo(-L * .18, -top * .34, -L * .48, bottom * .16, -L * .72, 0); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = withA(o.glow, .72); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(lerp(-L * .58, L * .02, i / 5), bottom * .42, 1.4, 0, TAU); ctx.fill(); }
  } else if (o.pattern === 'mottle' || o.pattern === 'stone-mottle' || o.pattern === 'lichen') {
    for (let i = 0; i < 19; i++) {
      const x = lerp(-L * .66, L * .08, (i * .618) % 1), y = Math.sin(i * 4.7) * (i % 2 ? top : bottom) * .58;
      const lichen = o.pattern === 'lichen', stone = o.pattern === 'stone-mottle';
      ctx.fillStyle = withA(i % 2 ? o.accent : shade(o.body, stone ? -.28 : -.42), (lichen ? .3 : .22) + i % 3 * .07);
      ctx.beginPath(); ctx.ellipse(x, y, W * ((lichen ? .13 : .1) + i % 4 * .025), W * ((lichen ? .1 : .07) + i % 3 * .025), i * .7, 0, TAU); ctx.fill();
      if (lichen && i % 3 === 0) { ctx.strokeStyle = withA(shade(o.accent, .25), .42); ctx.lineWidth = 1; ctx.stroke(); }
    }
  } else if (o.pattern === 'kelp-blotches') {
    ctx.strokeStyle = withA(o.accent, .38); ctx.lineWidth = W * .16;
    for (let i = 0; i < 6; i++) {
      const x = lerp(-L * .62, L * .04, i / 5); ctx.beginPath(); ctx.moveTo(x - L * .05, -top * .5);
      ctx.bezierCurveTo(x + L * .08, -top * .15, x - L * .11, bottom * .22, x + L * .03, bottom * .58); ctx.stroke();
    }
  } else if (o.pattern === 'sand-speckle') {
    ctx.fillStyle = withA(shade(o.accent, -.25), .5);
    for (let i = 0; i < 34; i++) {
      const x = lerp(-L * .68, L * .08, (i * .618) % 1), y = Math.sin(i * 7.13) * (i % 2 ? top : bottom) * .58;
      ctx.beginPath(); ctx.arc(x, y, 1 + i % 3 * .45, 0, TAU); ctx.fill();
    }
  } else if (o.pattern === 'coral-spots') {
    for (let i = 0; i < 14; i++) {
      const x = lerp(-L * .62, L * .06, (i * .754) % 1), y = Math.sin(i * 5.37) * (i % 2 ? top : bottom) * .55;
      ctx.fillStyle = withA(i % 2 ? o.accent : shade(o.accent, .22), .38); ctx.strokeStyle = withA(shade(o.body, -.35), .5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, W * (.08 + i % 3 * .025), 0, TAU); ctx.fill(); ctx.stroke();
    }
  } else if (o.pattern === 'plate-rivets') {
    ctx.fillStyle = withA(o.accent, .52);
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(lerp(-L * .58, L * .03, i / 6), Math.sin(i * 2.2) * W * .2, 1.8, 0, TAU); ctx.fill(); }
  } else if (o.pattern === 'bone-bands') {
    ctx.strokeStyle = withA(o.accent, .38); ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const x = -L * (.08 + i * .18); ctx.beginPath(); ctx.moveTo(x, -top * .62); ctx.lineTo(x - L * .06, bottom * .58); ctx.stroke(); }
  } else if (o.pattern === 'royal-bars') {
    ctx.strokeStyle = withA(o.accent, .72); ctx.lineWidth = 2.6;
    for (let i = 0; i < 4; i++) { const x = lerp(-L * .58, L * .02, i / 3); ctx.beginPath(); ctx.moveTo(x, -top * .68); ctx.lineTo(x - L * .07, bottom * .64); ctx.stroke(); }
  } else if (o.pattern === 'slashes' || o.pattern === 'scars') {
    ctx.strokeStyle = o.pattern === 'scars' ? withA('#d1a48e', .66) : withA(o.accent, .48); ctx.lineWidth = 2.2;
    const count = o.pattern === 'scars' ? 4 : 2;
    for (let i = 0; i < count; i++) { const x = -L * (.03 + i * .15); ctx.beginPath(); ctx.moveTo(x - L * .12, -top * .52); ctx.lineTo(x + L * .06, bottom * .47); ctx.stroke(); }
  }
  ctx.restore();
}

function snoutProfile(o, L, depth) {
  const style = o.snout;
  if (style === 'blade') return { x: L * 1.12, browY: -depth * .2, lipY: -depth * .015 };
  if (style === 'blunt') return { x: L * .96, browY: -depth * .45, lipY: depth * .02 };
  if (style === 'hooked') return { x: L * 1.03, browY: -depth * .3, lipY: depth * .08 };
  if (style === 'visor') return { x: L * 1.05, browY: -depth * .27, lipY: -depth * .03 };
  if (style === 'flat') return { x: L, browY: -depth * .17, lipY: depth * .04 };
  if (style === 'beak') return { x: L * 1.09, browY: -depth * .2, lipY: depth * .04 };
  if (style === 'broken') return { x: L * .98, browY: -depth * .3, lipY: depth * .04 };
  if (style === 'wedge') return { x: L * 1.04, browY: -depth * .22, lipY: 0 };
  return { x: L, browY: -depth * .28, lipY: depth * .015 };
}

function drawUpperArmor(ctx, o, L, W, rearX, hingeX, depth, profile) {
  const gradient = ctx.createLinearGradient(0, -depth, 0, depth * .45);
  gradient.addColorStop(0, shade(o.plate, .28)); gradient.addColorStop(.56, o.plate); gradient.addColorStop(1, shade(o.plate, -.28));
  ctx.fillStyle = gradient; ctx.strokeStyle = o.plateEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(profile.x, profile.lipY);
  if (o.snout === 'blunt') ctx.lineTo(profile.x, profile.browY);
  else if (o.snout === 'broken') { ctx.lineTo(profile.x - L * .08, -depth * .08); ctx.lineTo(profile.x, profile.browY); }
  else ctx.quadraticCurveTo(profile.x * .92, profile.browY, L * .72, -depth * .65);
  ctx.quadraticCurveTo(L * .42, -depth * 1.02, rearX, -depth * .76);
  if (o.armor === 'crested') ctx.lineTo(rearX + L * .08, -depth * 1.27);
  ctx.lineTo(rearX - L * .03, depth * .28);
  ctx.quadraticCurveTo(hingeX, depth * .46, hingeX + L * .14, depth * .2);
  ctx.quadraticCurveTo(L * .62, depth * .06, profile.x, profile.lipY); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawArmorDetails(ctx, o, L, W, rearX, hingeX, depth, profile) {
  const seam = o.armor === 'layered' && o.glow ? o.glow : o.plateEdge;
  ctx.strokeStyle = withA(seam, o.armor === 'layered' ? .96 : .7); ctx.lineWidth = o.armor === 'fossil' ? 2.2 : 1.45;
  if (o.armor === 'field' || o.armor === 'fitted' || o.armor === 'low') {
    ctx.beginPath(); ctx.moveTo(L * .68, -depth * .68); ctx.quadraticCurveTo(L * .56, -depth * .2, L * .59, depth * .14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * .36, -depth * .86); ctx.lineTo(L * .28, depth * .2); ctx.stroke();
  } else if (o.armor === 'fossil') {
    ctx.beginPath(); ctx.moveTo(L * .72, -depth * .72); ctx.lineTo(L * .54, depth * .14); ctx.lineTo(hingeX, depth * .36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * .38, -depth * .92); ctx.lineTo(L * .24, depth * .24); ctx.stroke();
    ctx.fillStyle = o.accent; for (const [x, y] of [[.29,-.55],[.49,-.74],[.72,-.47],[.34,.06]]) { ctx.beginPath(); ctx.arc(L * x, depth * y, 2.2, 0, TAU); ctx.fill(); }
  } else if (o.armor === 'split') {
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(L * .83, -depth * .43); ctx.lineTo(L * .43, -depth * .78); ctx.lineTo(hingeX, depth * .2); ctx.stroke();
  } else if (o.armor === 'saddle') {
    ctx.fillStyle = withA(o.plate, .84); ctx.strokeStyle = o.plateEdge;
    ctx.beginPath(); ctx.moveTo(rearX + L * .02, -depth * .72); ctx.lineTo(rearX - L * .34, -depth * .48); ctx.lineTo(rearX - L * .24, depth * .02); ctx.lineTo(rearX + L * .02, depth * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * .65, -depth * .7); ctx.lineTo(L * .47, depth * .18); ctx.stroke();
  } else if (o.armor === 'layered') {
    ctx.shadowColor = o.glow; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(L * .82, -depth * .38); ctx.lineTo(L * .52, -depth * .72); ctx.lineTo(L * .43, depth * .1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * .4, -depth * .82); ctx.lineTo(rearX + L * .04, depth * .16); ctx.stroke(); ctx.shadowBlur = 0;
  } else if (o.armor === 'crested') {
    if (!o.crestStyle) {
      ctx.fillStyle = o.plate; ctx.strokeStyle = o.plateEdge;
      for (let i = 0; i < 3; i++) {
        const x = lerp(rearX + L * .07, L * .48, i / 2), h = depth * (.2 + (i % 2) * .12);
        ctx.beginPath(); ctx.moveTo(x - L * .08, -depth * .75); ctx.lineTo(x, -depth - h); ctx.lineTo(x + L * .08, -depth * .72); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.moveTo(L * .68, -depth * .68); ctx.lineTo(L * .52, depth * .15); ctx.stroke();
  } else if (o.armor === 'royal') {
    ctx.strokeStyle = o.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(profile.x * .91, -depth * .18); ctx.quadraticCurveTo(L * .57, -depth * .77, L * .36, depth * .15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * .38, -depth * .78); ctx.lineTo(rearX + L * .04, depth * .12); ctx.stroke();
    ctx.fillStyle = o.accent; ctx.beginPath(); ctx.arc(L * .38, -depth * .13, W * .11, 0, TAU); ctx.fill();
  } else if (o.armor === 'scarred') {
    ctx.strokeStyle = '#d2a28d'; ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(L * .76, -depth * .74); ctx.lineTo(L * .59, -depth * .2); ctx.lineTo(L * .67, depth * .18); ctx.stroke();
    ctx.strokeStyle = o.plateEdge; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(L * .4, -depth * .8); ctx.lineTo(rearX + L * .04, depth * .13); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawArmorOrnaments(ctx, o, L, W, rearX, depth) {
  const style = o.crestStyle; if (!style) return;
  ctx.save(); ctx.fillStyle = o.plate; ctx.strokeStyle = o.plateEdge; ctx.lineWidth = 1.5;
  const spike = (x, halfWidth, height) => {
    ctx.beginPath(); ctx.moveTo(x - halfWidth, -depth * .72); ctx.lineTo(x, -depth - height); ctx.lineTo(x + halfWidth, -depth * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  if (style === 'knobs' || style === 'coral-knobs') {
    const count = style === 'coral-knobs' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const x = lerp(rearX + L * .08, L * .58, i / Math.max(1, count - 1)), radius = W * (style === 'coral-knobs' ? .13 + i % 2 * .05 : .11);
      ctx.beginPath(); ctx.arc(x, -depth * (.78 + i % 2 * .06), radius, 0, TAU); ctx.fill(); ctx.stroke();
      if (style === 'coral-knobs' && i % 2) spike(x, L * .035, depth * .18);
    }
  } else if (style === 'rear-horn') {
    ctx.beginPath(); ctx.moveTo(rearX + L * .15, -depth * .78); ctx.lineTo(rearX - L * .32, -depth * 1.18); ctx.lineTo(rearX + L * .28, -depth * .62); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (style === 'brow-horn') {
    ctx.beginPath(); ctx.moveTo(L * .54, -depth * .78); ctx.lineTo(L * .96, -depth * 1.1); ctx.lineTo(L * .66, -depth * .56); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (style === 'ice-ridge') {
    ctx.fillStyle = withA(o.plate, .78);
    for (let i = 0; i < 4; i++) spike(lerp(rearX + L * .06, L * .52, i / 3), L * .055, depth * (.18 + i % 2 * .14));
  } else if (style === 'square-ridge') {
    for (let i = 0; i < 3; i++) {
      const x = lerp(rearX + L * .08, L * .48, i / 2); ctx.beginPath(); ctx.rect(x - L * .07, -depth * 1.02, L * .14, depth * .28); ctx.fill(); ctx.stroke();
    }
  } else if (style === 'kelp-fringe') {
    ctx.strokeStyle = withA(o.accent, .72); ctx.lineWidth = Math.max(2.4, W * .16); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = lerp(rearX, L * .42, i / 3); ctx.beginPath(); ctx.moveTo(x, -depth * .72);
      ctx.quadraticCurveTo(x + (i % 2 ? -1 : 1) * L * .08, -depth * 1.08, x + L * .02, -depth * (1.2 + i % 2 * .12)); ctx.stroke();
    }
  } else if (style === 'double-crown') {
    spike(rearX + L * .2, L * .09, depth * .5); spike(rearX + L * .48, L * .1, depth * .38);
  } else if (style === 'saw') {
    for (let i = 0; i < 7; i++) spike(lerp(rearX - L * .08, L * .54, i / 6), L * .045, depth * (.14 + i % 2 * .08));
  } else if (style === 'antler') {
    ctx.strokeStyle = o.plate; ctx.lineWidth = Math.max(3, W * .22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L * .54, -depth * .76); ctx.quadraticCurveTo(L * .38, -depth * 1.28, rearX - L * .28, -depth * 1.2); ctx.stroke();
    ctx.lineWidth *= .65; ctx.beginPath(); ctx.moveTo(L * .27, -depth * 1.08); ctx.lineTo(L * .42, -depth * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rearX + L * .02, -depth * 1.22); ctx.lineTo(rearX - L * .03, -depth * 1.48); ctx.stroke();
  } else if (style === 'cathedral') {
    spike(rearX + L * .3, L * .13, depth * .65); spike(rearX + L * .08, L * .07, depth * .3); spike(rearX + L * .52, L * .07, depth * .28);
    ctx.strokeStyle = o.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rearX + L * .3, -depth * .93); ctx.lineTo(rearX + L * .3, -depth * 1.52); ctx.stroke();
  } else if (style === 'crown') {
    for (let i = 0; i < 5; i++) spike(lerp(rearX + L * .02, L * .55, i / 4), L * .055, depth * (.2 + (i === 2 ? .25 : i % 2 * .08)));
  }
  ctx.restore();
}

function drawJaw(ctx, o, L, W, hingeX, hingeY, profile, depth, gape) {
  const jawLength = profile.x - hingeX, scale = o.jawScale || 1;
  // Mouth cavity follows the articulated lower tip so an opening bite is
  // unmistakable in profile rather than appearing as two mirrored top plates.
  const lowerTipX = hingeX + Math.cos(gape) * jawLength;
  const lowerTipY = hingeY + Math.sin(gape) * jawLength;
  ctx.fillStyle = '#100d11'; ctx.beginPath(); ctx.moveTo(hingeX, hingeY - depth * .06);
  ctx.lineTo(profile.x, profile.lipY); ctx.lineTo(lowerTipX, lowerTipY); ctx.lineTo(hingeX, hingeY + depth * .2); ctx.closePath(); ctx.fill();

  // Upper self-sharpening plates.
  ctx.fillStyle = o.blade; ctx.strokeStyle = shade(o.blade, -.34); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(profile.x * .985, profile.lipY); ctx.lineTo(L * (.57 - .05 * scale), depth * .12); ctx.lineTo(L * (.68 - .02 * scale), -depth * .05); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * .83, profile.lipY); ctx.lineTo(L * (.58 - .03 * scale), depth * .28 * scale); ctx.lineTo(L * .7, depth * .08); ctx.closePath(); ctx.fill(); ctx.stroke();

  // Lower jaw and its counter-blade rotate as one rigid armored unit.
  ctx.save(); ctx.translate(hingeX, hingeY); ctx.rotate(gape);
  const gradient = ctx.createLinearGradient(0, 0, 0, depth * .62); gradient.addColorStop(0, o.plate); gradient.addColorStop(1, shade(o.plate, -.3));
  ctx.fillStyle = gradient; ctx.strokeStyle = o.plateEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -depth * .01); ctx.lineTo(jawLength, profile.lipY - hingeY + depth * .04);
  ctx.lineTo(jawLength * .77, depth * .35 * scale); ctx.quadraticCurveTo(jawLength * .34, depth * .58, -L * .03, depth * .24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.blade; ctx.strokeStyle = shade(o.blade, -.34); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(jawLength * .88, depth * .07); ctx.lineTo(jawLength * .52, -depth * .17 * scale); ctx.lineTo(jawLength * .65, depth * .18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawDunkleosteus(ctx, o) {
  const t = o.t || 0, L = o.len, W = o.wid, mouth = Math.max(0, Math.min(1, o.mouth || 0));
  const sway = o.sway == null ? 1 : o.sway, wag = Math.sin(t * 2.4) * sway;
  const headLength = o.headLength || .45, headDepth = W * (o.headDepth || 1.05);
  const bodyTop = W * (o.bodyDepth || .95), bodyBottom = W * (o.bellyDepth || o.bodyDepth || .95);
  const arch = W * (o.backArch || 0), rearX = L * (.58 - headLength * 1.18), tailX = -L * .74, tailY = wag * W * .08;
  const hingeX = rearX + L * .17, hingeY = headDepth * .13, profile = snoutProfile(o, L, headDepth);
  const gape = mouth * (.22 + (o.jawScale || 1) * .24);

  ctx.save();
  if (o.glow) {
    const aura = ctx.createRadialGradient(L * .22, 0, 2, L * .12, 0, L * 1.2);
    aura.addColorStop(0, withA(o.glow, .13)); aura.addColorStop(1, withA(o.glow, 0));
    ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, 0, L * 1.25, W * 2.15, 0, 0, TAU); ctx.fill();
  }

  drawTail(ctx, o, L, W, tailX, tailY, wag);
  drawMedianFins(ctx, o, L, W, bodyTop + arch, bodyBottom);

  const bodyGradient = ctx.createLinearGradient(0, -bodyTop - arch, 0, bodyBottom);
  bodyGradient.addColorStop(0, shade(o.body, .3)); bodyGradient.addColorStop(.48, o.body); bodyGradient.addColorStop(1, shade(o.body, -.38));
  ctx.fillStyle = bodyGradient; ctx.strokeStyle = shade(o.body, -.48); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rearX + L * .14, -headDepth * .42);
  ctx.bezierCurveTo(L * .04, -bodyTop - arch, -L * .46, -bodyTop * .82, tailX, tailY - W * .2);
  ctx.quadraticCurveTo(tailX - L * .04, tailY, tailX, tailY + W * .2);
  ctx.bezierCurveTo(-L * .48, bodyBottom * .75, L * .02, bodyBottom, rearX + L * .14, headDepth * .36);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  drawBodyPattern(ctx, o, L, W, bodyTop + arch, bodyBottom);

  // Far pectoral fin sits behind the cheek; the near fin is redrawn later.
  ctx.save(); ctx.globalAlpha = .3; drawPectoralFin(ctx, o, L, W, rearX - L * .02, headDepth * .2, t + 1.2); ctx.restore();
  drawJaw(ctx, o, L, W, hingeX, hingeY, profile, headDepth, gape);
  drawUpperArmor(ctx, o, L, W, rearX, hingeX, headDepth, profile);
  drawArmorDetails(ctx, o, L, W, rearX, hingeX, headDepth, profile);
  drawArmorOrnaments(ctx, o, L, W, rearX, headDepth);

  // One visible orbital opening is the strongest immediate side-view cue.
  const eyeX = lerp(rearX, profile.x, .6), eyeY = -headDepth * .43, eyeR = Math.max(2.6, W * .17 * (o.eyeSize || 1));
  drawEye(ctx, eyeX, eyeY, eyeR, o.eyeColor || '#d9e9dc', o.armor === 'scarred');
  ctx.strokeStyle = o.plateEdge; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR + 2.3, 0, TAU); ctx.stroke();
  if (o.armor === 'scarred') {
    ctx.strokeStyle = '#cf9b86'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(eyeX - eyeR * 1.8, eyeY - eyeR * 1.45); ctx.lineTo(eyeX + eyeR * 1.7, eyeY + eyeR * 1.4); ctx.stroke();
  }

  drawPectoralFin(ctx, o, L, W, rearX - L * .01, headDepth * .27, t);

  // Gill/neck joint separates rigid armor from the flexible living trunk.
  ctx.fillStyle = withA(o.accent, .34); ctx.strokeStyle = withA(o.plateEdge, .76); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.ellipse(rearX + L * .035, headDepth * .03, L * .09, headDepth * .39, -.08, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

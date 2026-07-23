import { drawCreature } from '../drawCreature.js';
import { drawAbilityIcon } from '../drawAbilityIcon.js';
import { drawItemIcon } from '../drawItem.js';
import { drawTalentIcon } from '../drawTalentIcon.js';

const CREST_STYLES = new Set(['ice-ridge', 'square-ridge', 'double-crown', 'saw', 'antler', 'cathedral', 'crown']);

export function drawCreaturePlanVisual(ctx, state) {
  drawCreature(ctx, state);
}

export function creaturePreviewScale(plan, width, height, { compact = false, zoom = 1 } = {}) {
  const concept = plan.kind === 'dunkleosteus';
  const horizontal = concept ? 3.25 : 3.5;
  const vertical = !concept ? 5.1
    : plan.finStyle === 'sail' ? 6.35
      : plan.finStyle === 'banner' ? 5.75
        : CREST_STYLES.has(plan.crestStyle) ? 5.85
          : plan.armor === 'crested' || plan.finStyle === 'spined' ? 5.35 : 4.45;
  const fit = Math.min(
    width / Math.max(1, plan.len * horizontal),
    height / Math.max(1, plan.wid * vertical),
  );
  return fit * (compact ? .91 : zoom);
}

export function drawCreatureVisual(ctx, {
  plan, width, height, time = 1.4, mouth = 0, hurt = 0,
  flipped = false, compact = false, zoom = 1, shift = 0, tilt = 0,
  centerY = .52, shadow = false,
} = {}) {
  if (!ctx || !plan || !width || !height) return;
  const scale = creaturePreviewScale(plan, width, height, { compact, zoom });
  ctx.save();
  ctx.translate(width * .5 + shift, height * centerY);
  ctx.rotate(tilt);
  ctx.scale((flipped ? -1 : 1) * scale, scale);
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.68)';
    ctx.shadowBlur = compact ? 4 / Math.max(scale, .01) : 10 / Math.max(scale, .01);
  }
  drawCreaturePlanVisual(ctx, { ...plan, t: time, mouth, hurt });
  ctx.restore();
}

const centeredIcon = (ctx, width, height, painter) => {
  const size = Math.min(width, height);
  ctx.save(); ctx.translate((width - size) * .5, (height - size) * .5);
  painter(size);
  ctx.restore();
};

export function drawAbilityIconVisual(ctx, { id, color, width, height } = {}) {
  centeredIcon(ctx, width, height, size => drawAbilityIcon(ctx, id, size, color));
}

export function drawItemIconVisual(ctx, { id, width, height } = {}) {
  centeredIcon(ctx, width, height, size => drawItemIcon(ctx, id, size));
}

export function drawTalentIconVisual(ctx, { id, color, width, height } = {}) {
  centeredIcon(ctx, width, height, size => drawTalentIcon(ctx, id, size, color));
}

export const PixiVisualFactory = Object.freeze({
  creaturePlan: drawCreaturePlanVisual,
  creature: drawCreatureVisual,
  abilityIcon: drawAbilityIconVisual,
  itemIcon: drawItemIconVisual,
  talentIcon: drawTalentIconVisual,
});

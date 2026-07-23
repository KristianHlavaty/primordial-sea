/* Pixi portrait of a species, shared by the tree wiki and evolution UI. */
import { html, useMemo } from '../react.js';
import { SPECIES } from '../../data/species.js';
import { drawCreatureVisual } from '../../render/pixi/PixiVisualFactory.js';
import { PixiPreview } from './PixiPreview.js';

export function CreatureCanvas({ id, w, h, className, animated = false }) {
  const species = SPECIES[id];
  const draw = useMemo(() => species
    ? (ctx, frame) => drawCreatureVisual(ctx, {
      plan: species.plan, width: frame.width, height: frame.height,
      time: animated ? frame.time * 2.5 : 1.4,
      tilt: animated ? Math.sin(frame.time * 1.2) * .15 : 0,
      centerY: .54,
    })
    : () => {}, [species, animated]);
  return html`<${PixiPreview}
    draw=${draw} width=${w} height=${h} className=${className}
    animated=${animated} ariaLabel=${species ? `${species.name} preview` : null}
  />`;
}

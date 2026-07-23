/* A talent icon rendered by the shared Pixi overlay. */
import { html, useMemo } from '../react.js';
import { drawTalentIconVisual } from '../../render/pixi/PixiVisualFactory.js';
import { PixiPreview } from './PixiPreview.js';

export function TalentIcon({ id, color, size = 40 }) {
  const draw = useMemo(() => (ctx, frame) => drawTalentIconVisual(ctx, {
    id, color, width: frame.width, height: frame.height,
  }), [id, color]);
  return html`<${PixiPreview}
    draw=${draw} width=${size} height=${size} className="pixiTalentIcon"
    ariaLabel=${`${id} talent icon`}
  />`;
}

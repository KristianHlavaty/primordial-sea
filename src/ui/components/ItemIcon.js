import { html, useMemo } from '../react.js';
import { drawItemIconVisual } from '../../render/pixi/PixiVisualFactory.js';
import { PixiPreview } from './PixiPreview.js';

export function ItemIcon({ id }) {
  const draw = useMemo(() => (ctx, frame) => drawItemIconVisual(ctx, {
    id, width: frame.width, height: frame.height,
  }), [id]);
  return html`<${PixiPreview}
    draw=${draw} width=${42} height=${42} className="pixiItemIcon"
    ariaLabel=${`${id} item icon`}
  />`;
}

/* A power icon rendered by the shared Pixi overlay. */
import { html, useMemo } from '../react.js';
import { drawAbilityIconVisual } from '../../render/pixi/PixiVisualFactory.js';
import { PixiPreview } from './PixiPreview.js';

export function AbilityIcon({ id, color }) {
  const draw = useMemo(() => (ctx, frame) => drawAbilityIconVisual(ctx, {
    id, color, width: frame.width, height: frame.height,
  }), [id, color]);
  return html`<${PixiPreview}
    draw=${draw} width=${40} height=${40} className="pixiAbilityIcon"
    ariaLabel=${`${id} ability icon`}
  />`;
}

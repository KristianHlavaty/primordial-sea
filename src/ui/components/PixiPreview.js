import { html, useRef, useLayoutEffect } from '../react.js';
import { registerPixiDomView } from '../../render/pixi/PixiDomOverlay.js';

export function PixiPreview({
  draw, width, height, className = '', animated = false,
  ariaLabel = null, overlayKey = 'game-ui', overlayZIndex = 40,
}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof draw !== 'function') return undefined;
    return registerPixiDomView(element, draw, {
      animated, key: overlayKey, zIndex: overlayZIndex,
    });
  }, [draw, animated, overlayKey, overlayZIndex]);
  return html`<div
    ref=${ref}
    className=${`pixiPreview ${className}`.trim()}
    style=${{ '--pixi-width': `${width}px`, '--pixi-height': `${height}px` }}
    role=${ariaLabel ? 'img' : undefined}
    aria-label=${ariaLabel || undefined}
    aria-hidden=${ariaLabel ? undefined : 'true'}
  />`;
}

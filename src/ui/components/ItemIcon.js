import { html, useRef, useLayoutEffect } from '../react.js';
import { drawItemIcon } from '../../render/drawItem.js';

export function ItemIcon({ id }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); drawItemIcon(ctx, id, canvas.width);
  }, [id]);
  return html`<canvas width="42" height="42" ref=${ref}/>`;
}

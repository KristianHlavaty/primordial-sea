/* A small canvas rendering one talent's vector icon. */
import { html, useRef, useLayoutEffect } from '../react.js';
import { drawTalentIcon } from '../../render/drawTalentIcon.js';

export function TalentIcon({ id, color, size = 40 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    drawTalentIcon(c, id, cv.width, color);
  }, [id, color, size]);
  return html`<canvas width=${size} height=${size} ref=${ref}/>`;
}

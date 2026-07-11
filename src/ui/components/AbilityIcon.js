/* A small canvas rendering one power's vector icon. */
import { html, useRef, useLayoutEffect } from '../react.js';
import { drawAbilityIcon } from '../../render/drawAbilityIcon.js';

export function AbilityIcon({ id, color }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    drawAbilityIcon(c, id, cv.width, color);
  }, [id, color]);
  return html`<canvas width="40" height="40" ref=${ref}/>`;
}

/* Static portrait of a species, drawn once from its plan (tree wiki). */
import { html, useRef, useLayoutEffect } from '../react.js';
import { SPECIES } from '../../data/species.js';
import { drawCreature } from '../../render/drawCreature.js';

export function CreatureCanvas({ id, w, h, className }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = cv.getContext('2d'); c.clearRect(0, 0, w, h);
    const sp = SPECIES[id]; if (!sp) return;
    c.save(); c.translate(w / 2, h * 0.54);
    const s = Math.min(w, h) / (sp.plan.len * 3.1); c.scale(s, s);
    drawCreature(c, Object.assign({ t: 1.4, mouth: 0, hurt: 0 }, sp.plan));
    c.restore();
  }, [id, w, h]);
  return html`<canvas ref=${ref} width=${w} height=${h} className=${className}/>`;
}

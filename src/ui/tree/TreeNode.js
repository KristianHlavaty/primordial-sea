/* One species card in the evolution tree grid. */
import { html } from '../react.js';
import { ABILITIES, ABILITY_SETS } from '../../data/abilities.js';
import { BRANCH_COL } from '../../data/branches.js';
import { CreatureCanvas } from '../components/CreatureCanvas.js';

export function TreeNode({ node, pos, NW, NH, current, hovered, onHover }) {
  const abils = ABILITY_SETS[node.id] || [];
  return html`
    <div className=${'tnode ' + node.branch + (current ? ' current' : '') + (hovered ? ' hov' : '')}
         style=${{ left: pos.x, top: pos.yc - NH / 2, width: NW, '--bc': BRANCH_COL[node.branch] }}
         onMouseEnter=${() => onHover(node.id)} onClick=${() => onHover(node.id)}>
      <${CreatureCanvas} id=${node.id} w=${NW - 2} h=${46} className="tnCanvas"/>
      <div className="tnName">${node.name}</div>
      <div className="tnDots">
        ${abils.map(aid => html`<span key=${aid} className="tnDot" style=${{ background: ABILITIES[aid].color, color: ABILITIES[aid].color }} title=${ABILITIES[aid].name}/>`)}
        ${abils.length === 0 && html`<span className="tnNo">no powers</span>`}
      </div>
      ${current && html`<div className="tnCur">◄ YOU</div>`}
    </div>`;
}

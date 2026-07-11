/* The evolution-tree wiki (T key). Lays SPECIES out on a tier × branch grid,
   draws bezier links between forms and shows a detail pane for the hovered
   node. Branch filters just hide whole branches from the layout. */
import { html, useState } from '../react.js';
import { SPECIES } from '../../data/species.js';
import { BRANCH_COL, BRANCH_ORDER, BRANCH_LABEL } from '../../data/branches.js';
import { TreeNode } from './TreeNode.js';
import { TreeDetail } from './TreeDetail.js';

const NW = 152, NH = 90, COLW = 182, PADX = 22, PADY = 20;

export function TreeModal({ curId, onClose }) {
  const branches = Object.keys(BRANCH_LABEL);
  const [vis, setVis] = useState(() => Object.fromEntries(branches.map(b => [b, true])));
  const [hoverId, setHoverId] = useState(curId || 'protocell');

  const all = Object.keys(SPECIES).map(id => Object.assign({ id }, SPECIES[id]));
  const maxTier = all.reduce((m, n) => Math.max(m, n.tier), 0);
  const visible = all.filter(n => n.branch === '-' || vis[n.branch]);
  const byTier = {};
  visible.forEach(n => { (byTier[n.tier] = byTier[n.tier] || []).push(n); });
  Object.values(byTier).forEach(l => l.sort((a, b) => (BRANCH_ORDER[a.branch] - BRANCH_ORDER[b.branch]) || a.name.localeCompare(b.name)));

  // the canvas grows with the fullest column so nodes never overlap
  const maxRow = Object.values(byTier).reduce((m, l) => Math.max(m, l.length), 1);
  const innerH = Math.max(474, PADY * 2 + maxRow * (NH + 14));
  const pos = {};
  for (let t = 0; t <= maxTier; t++) {
    const list = byTier[t] || [], n = list.length || 1;
    list.forEach((node, i) => { pos[node.id] = { x: PADX + t * COLW, yc: PADY + (i + 0.5) * (innerH - PADY * 2) / n }; });
  }
  const treeW = PADX * 2 + maxTier * COLW + NW, treeH = innerH;
  const links = [];
  visible.forEach(n => (n.evolvesTo || []).forEach(cid => { if (pos[cid]) links.push({ from: n.id, to: cid, color: BRANCH_COL[SPECIES[cid].branch] }); }));

  return html`
    <div className="scrim treeScrim">
      <div className="treeCard">
        <div className="treeHead">
          <div className="treeTitle">🧬 EVOLUTION TREE</div>
          <div className="branchFilters"><span className="bfLabel">Show:</span>
            ${branches.map(b => html`
              <button key=${b} className=${'bfChip ' + (vis[b] ? 'on' : '')} style=${{ '--bc': BRANCH_COL[b] }}
                      onClick=${() => setVis(v => ({ ...v, [b]: !v[b] }))}>${BRANCH_LABEL[b]}</button>`)}
          </div>
          <button className="treeClose" onClick=${onClose} title="Close (T / Esc)">✕</button>
        </div>
        <div className="treeBody">
          <div className="treeCanvasWrap">
            <div className="treeInner" style=${{ width: treeW, height: treeH }}>
              <svg width=${treeW} height=${treeH} className="treeSvg">
                ${links.map((l, i) => {
                  const a = pos[l.from], b = pos[l.to], x1 = a.x + NW, y1 = a.yc, x2 = b.x, y2 = b.yc, mx = (x1 + x2) / 2;
                  return html`<path key=${i} d=${`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} stroke=${l.color} strokeWidth="2.5" fill="none" opacity=${(hoverId === l.from || hoverId === l.to) ? 0.95 : 0.4}/>`;
                })}
              </svg>
              ${visible.map(n => html`<${TreeNode} key=${n.id} node=${n} pos=${pos[n.id]} NW=${NW} NH=${NH} current=${n.id === curId} hovered=${n.id === hoverId} onHover=${setHoverId}/>`)}
            </div>
          </div>
          <${TreeDetail} id=${hoverId}/>
        </div>
        <div className="treeHint">Hover a creature to see its powers · toggle branches above to declutter · <span className="kbd">T</span>/<span className="kbd">Esc</span> closes</div>
      </div>
    </div>`;
}

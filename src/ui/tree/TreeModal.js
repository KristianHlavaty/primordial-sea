/* The evolution-tree wiki (T key). Shows one stage's tree at a time (sea or
   land — each stage has its own tier space), laid out on a tier × branch grid
   with bezier links and a detail pane for the hovered node. A stage switcher
   flips between them; branch chips hide whole branches from the layout. */
import { html, useState } from '../react.js';
import { SPECIES, speciesStage } from '../../data/species.js';
import { STAGES } from '../../data/maps.js';
import { BRANCH_COL, BRANCH_ORDER, BRANCH_LABEL } from '../../data/branches.js';
import { TreeNode } from './TreeNode.js';
import { TreeDetail } from './TreeDetail.js';

const NW = 152, NH = 90, COLW = 182, PADX = 22, PADY = 20;
const STAGE_IDS = Object.keys(STAGES).sort((a, b) => STAGES[a].order - STAGES[b].order);

export function TreeModal({ curId, onClose }) {
  const [stage, setStage] = useState(() => speciesStage(curId || 'protocell'));
  const [vis, setVis] = useState(() => Object.fromEntries(Object.keys(BRANCH_LABEL).map(b => [b, true])));

  // all species in the shown stage (the sea tree keeps the protocell root)
  const all = Object.keys(SPECIES)
    .filter(id => speciesStage(id) === stage)
    .map(id => Object.assign({ id }, SPECIES[id]));
  const stageBranches = [...new Set(all.map(n => n.branch).filter(b => b !== '-'))].sort((a, b) => BRANCH_ORDER[a] - BRANCH_ORDER[b]);

  const [hoverId, setHoverId] = useState(curId || all[0].id);
  const hovered = SPECIES[hoverId] && speciesStage(hoverId) === stage ? hoverId : all[0].id;

  const minTier = all.reduce((m, n) => Math.min(m, n.tier), Infinity);
  const maxTier = all.reduce((m, n) => Math.max(m, n.tier), 0);
  const visible = all.filter(n => n.branch === '-' || vis[n.branch]);
  const byTier = {};
  visible.forEach(n => { (byTier[n.tier] = byTier[n.tier] || []).push(n); });
  Object.values(byTier).forEach(l => l.sort((a, b) => (BRANCH_ORDER[a.branch] - BRANCH_ORDER[b.branch]) || a.name.localeCompare(b.name)));

  // the canvas grows with the fullest column so nodes never overlap
  const maxRow = Object.values(byTier).reduce((m, l) => Math.max(m, l.length), 1);
  const innerH = Math.max(474, PADY * 2 + maxRow * (NH + 14));
  const cols = maxTier - minTier;
  const pos = {};
  for (let t = minTier; t <= maxTier; t++) {
    const list = byTier[t] || [], n = list.length || 1;
    list.forEach((node, i) => { pos[node.id] = { x: PADX + (t - minTier) * COLW, yc: PADY + (i + 0.5) * (innerH - PADY * 2) / n }; });
  }
  const treeW = PADX * 2 + cols * COLW + NW, treeH = innerH;
  const links = [];
  visible.forEach(n => (n.evolvesTo || []).forEach(cid => { if (pos[cid]) links.push({ from: n.id, to: cid, color: BRANCH_COL[SPECIES[cid].branch] }); }));

  return html`
    <div className="scrim treeScrim">
      <div className="treeCard">
        <div className="treeHead">
          <div className="treeTitle">🧬 TREE OF LIFE</div>
          <div className="stageTabs">
            ${STAGE_IDS.map(s => html`<button key=${s} className=${'stageTab' + (stage === s ? ' on' : '')} onClick=${() => setStage(s)}>${STAGES[s].name}</button>`)}
          </div>
          <div className="branchFilters"><span className="bfLabel">Show:</span>
            ${stageBranches.map(b => html`
              <button key=${b} className=${'bfChip ' + (vis[b] ? 'on' : '')} style=${{ '--bc': BRANCH_COL[b] }}
                      onClick=${() => setVis(v => ({ ...v, [b]: !v[b] }))}>${BRANCH_LABEL[b]}</button>`)}
          </div>
          <button className="treeClose" onClick=${onClose} title="Close (T / Esc)">✕</button>
        </div>
        <div className="treeBody">
          <div className="treeCanvasWrap">
            ${stage === 'devonian' && html`<div className="treeFromSea">⇡ crawled ashore from the sea</div>`}
            ${stage === 'carboniferous' && html`<div className="treeFromSea">⇡ unlocked by a final Devonian evolution</div>`}
            <div className="treeInner" style=${{ width: treeW, height: treeH }}>
              <svg width=${treeW} height=${treeH} className="treeSvg">
                ${links.map((l, i) => {
                  const a = pos[l.from], b = pos[l.to], x1 = a.x + NW, y1 = a.yc, x2 = b.x, y2 = b.yc, mx = (x1 + x2) / 2;
                  return html`<path key=${i} d=${`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} stroke=${l.color} strokeWidth="2.5" fill="none" opacity=${(hovered === l.from || hovered === l.to) ? 0.95 : 0.4}/>`;
                })}
              </svg>
              ${visible.map(n => html`<${TreeNode} key=${n.id} node=${n} pos=${pos[n.id]} NW=${NW} NH=${NH} current=${n.id === curId} hovered=${n.id === hovered} onHover=${setHoverId}/>`)}
            </div>
          </div>
          <${TreeDetail} id=${hovered}/>
        </div>
        <div className="treeHint">Switch <b>Sea</b>/<b>Land</b> above · hover a creature to see its powers · <span className="kbd">T</span>/<span className="kbd">Esc</span> closes</div>
      </div>
    </div>`;
}

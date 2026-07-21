/* The talent tree overlay. App pauses it through runtime commands. It reads a
   ready-made simulation snapshot and publishes spend/undo/respec commands.
   Re-renders on every action and once a second so the 30s undo countdown lives. */
import { html, useState, useEffect } from '../react.js';
import { TalentIcon } from '../components/TalentIcon.js';

const COLW = 194, ROWH = 182, PADX = 22, PADY = 18, NW = 172, NH = 164;

export function TalentModal({ engine, commands, onClose }) {
  const [, force] = useState(0);
  const [tab, setTab] = useState(engine.stage);
  const bump = () => force(n => n + 1);
  useEffect(() => { const iv = setInterval(bump, 1000); return () => clearInterval(iv); }, []);

  const info = engine.talentInfo();
  const tree = info.trees.find(t => t.id === tab) || info.trees[0];
  const spend = id => { commands.spendTalent(tree.id, id); bump(); };
  const undo = id => { commands.undoTalent(tree.id, id); bump(); };
  const respec = () => { commands.respecTree(tree.id); bump(); };

  const rows = Math.max(...tree.nodes.map(n => n.row)) + 1;
  const gridW = PADX * 2 + tree.paths.length * COLW, gridH = PADY * 2 + rows * ROWH;
  const posOf = n => ({ x: PADX + n.col * COLW + (COLW - NW) / 2, y: PADY + n.row * ROWH });
  const links = [];
  for (const n of tree.nodes) {
    if (!n.req) continue;
    const rq = tree.nodes.find(x => x.id === n.req); if (rq) links.push({ a: posOf(rq), b: posOf(n), on: n.rank > 0 });
  }

  return html`
    <div className="scrim talentScrim">
      <div className="talentCard" style=${{ '--tc': tree.color }}>
        <div className="talentHead">
          <div className="talentTitle">✦ TALENTS</div>
          <div className="talentTabs">
            ${info.trees.map(t => html`
              <button key=${t.id} className=${'ttab' + (t.id === tab ? ' active' : '') + (t.unlocked ? '' : ' locked')} style=${{ '--tc': t.color }}
                onClick=${() => t.unlocked && setTab(t.id)} disabled=${!t.unlocked}
                title=${t.unlocked ? t.name + ' talents' : t.name + ' — unlocks on reaching that stage'}>
                ${t.unlocked ? '' : '🔒 '}${t.name}${t.unlocked && t.available > 0 ? html`<em>${t.available}</em>` : ''}
              </button>`)}
          </div>
          <button className="talentClose" onClick=${onClose} title="Close (K / Esc)">✕</button>
        </div>

        ${!tree.unlocked ? html`
          <div className="talentLockedMsg">🔒 The <b>${tree.name}</b> tree unlocks once your lineage reaches the ${tree.name} stage.</div>`
        : html`
          <div className="talentSub">
            <span className="tpoints"><b>${tree.available}</b> point${tree.available === 1 ? '' : 's'}</span>
            <span className="tspent">${tree.spent}/${tree.earned} spent · 1 point per level in the ${tree.name}</span>
            <button className="respecBtn" onClick=${respec} disabled=${tree.respecUsed || tree.spent === 0}
              title=${tree.respecUsed ? 'Respec already used for this tree this run' : 'Refund every point in the ' + tree.name + ' tree only — once per run'}>
              ↺ ${tree.respecUsed ? 'Respec used' : 'Respec ' + tree.name}
            </button>
          </div>

          <div className="talentScroll">
            <div className="talentPaths" style=${{ width: gridW + 'px' }}>
              ${tree.paths.map((p, i) => html`<div key=${i} className="tpath" style=${{ left: (PADX + i * COLW) + 'px', width: COLW + 'px' }}>${p}</div>`)}
            </div>
            <div className="talentGrid" style=${{ width: gridW + 'px', height: gridH + 'px' }}>
              <svg className="talentSvg" width=${gridW} height=${gridH}>
                ${links.map((l, i) => html`<line key=${i} x1=${l.a.x + NW / 2} y1=${l.a.y + NH - 6} x2=${l.b.x + NW / 2} y2=${l.b.y + 6}
                  stroke=${l.on ? tree.color : '#2a3f56'} stroke-width="3" stroke-linecap="round"/>`)}
              </svg>
              ${tree.nodes.map(n => {
                const p = posOf(n);
                const cls = 'tnode' + (n.rank > 0 ? ' has' : '') + (n.rank >= n.max ? ' maxed' : '')
                  + (n.canSpend ? ' can' : '') + (n.locked ? ' locked' : '') + (n.capstone ? ' capstone' : '') + (n.gated ? ' gated' : '');
                const tip = n.locked ? n.lockReason : (n.display || (n.perRank + ' ' + n.valueLabel + ' per rank'));
                return html`
                  <div key=${n.id} className=${cls} style=${{ left: p.x + 'px', top: p.y + 'px', width: NW + 'px', height: NH + 'px' }}
                    onClick=${() => n.canSpend && spend(n.id)} title=${tip}>
                    <div className="tnicon"><${TalentIcon} id=${n.icon} color=${tree.color} size=${40}/></div>
                    <div className="tninfo">
                      <b>${n.name}${n.capstone ? html`<span className="star">★</span>` : ''}</b>
                      <span className="tnblurb">${
                        n.display ? html`<span className="tval cap">${n.display}</span>`
                        : html`<span className="tval"><b className=${'cur' + (n.rank >= n.max ? ' full' : '')}>${n.valueNow}</b> → <b className="mx">${n.valueFull}</b> ${n.valueLabel}</span>`
                      }</span>
                      ${n.locked && html`<span className="tnlock">${n.lockShort}</span>`}
                    </div>
                    <div className="tnpips">${Array.from({ length: n.max }, (_, k) => html`<i key=${k} className=${k < n.rank ? 'on' : ''}/>`)}</div>
                    ${n.canSpend && html`<div className="tnplus">＋</div>`}
                    ${n.undoable && html`<button className="tnundo" title=${'Undo — misclick window ' + n.undoIn + 's'} onClick=${e => { e.stopPropagation(); undo(n.id); }}>↶ ${n.undoIn}s</button>`}
                  </div>`;
              })}
            </div>
          </div>
          <div className="talentHint">Click a talent to rank it up · undo within <b>30s</b> · one free <b>respec</b> per tree · everything resets each run</div>
        `}
      </div>
    </div>`;
}

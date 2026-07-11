/* Right-hand detail pane of the tree wiki: portrait, lore, stat bars and
   the species' powers. */
import { html } from '../react.js';
import { clamp } from '../../core/math.js';
import { SPECIES } from '../../data/species.js';
import { ABILITIES, ABILITY_SETS } from '../../data/abilities.js';
import { BRANCH_COL, BRANCH_WORD } from '../../data/branches.js';
import { CreatureCanvas } from '../components/CreatureCanvas.js';
import { AbilityIcon } from '../components/AbilityIcon.js';

const MAX = { hp: 340, maxSpeed: 340, dmg: 42, radius: 28 };

export function TreeDetail({ id }) {
  const sp = SPECIES[id]; if (!sp) return null;
  const abils = ABILITY_SETS[id] || []; const col = BRANCH_COL[sp.branch], st = sp.stats;
  const bar = (lab, v, mx, c) => html`
    <div className="dstat" key=${lab}><span>${lab}</span><i><b style=${{ width: clamp(v / mx, 0, 1) * 100 + '%', background: c }}/></i><em>${Math.round(v)}</em></div>`;
  return html`
    <div className="tdetail">
      <div className="tdCanvas" style=${{ '--bc': col }}><${CreatureCanvas} id=${id} w=${302} h=${150}/></div>
      <div className="tdName">${sp.name}${sp.branch !== '-' && html`<span className=${'ctag ' + sp.branch}>${BRANCH_WORD[sp.branch]}</span>`}</div>
      <div className="tdTier">Tier ${sp.tier}${sp.evolvesTo && sp.evolvesTo.length ? ' · evolves into ' + sp.evolvesTo.map(x => SPECIES[x].name).join(', ') : ' · apex form'}</div>
      <div className="tdDesc">${sp.desc}</div>
      <div className="dstats">${bar('HP', st.hp, MAX.hp, '#f0637a')}${bar('Speed', st.maxSpeed, MAX.maxSpeed, '#5ee0f2')}${bar('Bite', st.dmg, MAX.dmg, '#f2c15e')}${bar('Bulk', st.radius, MAX.radius, '#8affd0')}</div>
      <div className="tdAbTitle">Powers</div>
      <div className="tdAbs">
        ${abils.length === 0 && html`<div className="tdNoab">— no powers —</div>`}
        ${abils.map(aid => {
          const ab = ABILITIES[aid];
          return html`
            <div key=${aid} className="tdAb" style=${{ '--ac': ab.color }}>
              <div className="tdAbIcon"><${AbilityIcon} id=${aid} color=${ab.color}/></div>
              <div className="tdAbInfo"><b>${ab.name}${ab.passive && html`<span className="pp">PASSIVE</span>`}</b><span>${ab.desc}</span></div>
            </div>`;
        })}
      </div>
    </div>`;
}

/* Evolution choice cards. The preview canvases are registered with the
   engine, which animates them from the render loop (renderWorld.js). */
import { html } from '../react.js';
import { SPECIES } from '../../data/species.js';
import { ABILITIES, ABILITY_SETS } from '../../data/abilities.js';
import { StatRow } from '../components/StatRow.js';

const MAX = { hp: 340, maxSpeed: 340, dmg: 42, radius: 26 };
const BRANCH_TAG = { arth: 'arthropod', chord: 'chordate', cnid: 'cnidarian' };

export function EvolveModal({ engine, hud }) {
  const cur = engine.player.species.stats;
  return html`
    <div className="scrim">
      <div className="card">
        <div className="evolveTitle">✦ EVOLUTION ✦</div>
        <div className="subtitle">Your egg quivers and splits — choose the shape of the next generation</div>
        <div className="choices">
          ${hud.choices.map(id => {
            const sp = SPECIES[id];
            const bcls = (sp.branch === '-') ? '' : sp.branch;
            const blabel = BRANCH_TAG[sp.branch] || '';
            return html`
              <div key=${id} className=${'choice ' + bcls} onClick=${() => engine.chooseEvolution(id)}>
                <canvas width="200" height="120" ref=${el => engine.registerPreview(id, el)}/>
                <div className="cname">${sp.name}
                  ${bcls && html`<span className=${'ctag ' + bcls}>${blabel}</span>`}</div>
                <div className="cdesc">${sp.desc}</div>
                <div className="cabil">
                  ${(ABILITY_SETS[id] || []).map(aid => html`
                    <span key=${aid} className="ab" style=${{ '--ac': ABILITIES[aid].color }}>${ABILITIES[aid].name}${ABILITIES[aid].passive && html`<b className="p">·P</b>`}</span>`)}
                </div>
                <${StatRow} label="Health" cur=${cur.hp} next=${sp.stats.hp} max=${MAX.hp} color="#f0637a"/>
                <${StatRow} label="Speed" cur=${cur.maxSpeed} next=${sp.stats.maxSpeed} max=${MAX.maxSpeed} color="#5ee0f2"/>
                <${StatRow} label="Bite" cur=${cur.dmg} next=${sp.stats.dmg} max=${MAX.dmg} color="#f2c15e"/>
                <${StatRow} label="Bulk" cur=${cur.radius} next=${sp.stats.radius} max=${MAX.radius} color="#8affd0"/>
              </div>`;
          })}
        </div>
      </div>
    </div>`;
}

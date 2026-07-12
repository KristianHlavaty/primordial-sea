/* Evolution choice cards. Two modes:
   - normal: pick the next form within your stage.
   - ascend: "crawl ashore" — pick a land pioneer, or stay in the sea for now
     (a button that dismisses the prompt but leaves it re-openable).
   The preview canvases are registered with the engine, which animates them
   from the render loop (renderWorld.js). */
import { html } from '../react.js';
import { SPECIES, STAT_MAX } from '../../data/species.js';
import { ABILITIES, ABILITY_SETS } from '../../data/abilities.js';
import { BRANCH_WORD } from '../../data/branches.js';
import { StatRow } from '../components/StatRow.js';

const MAX = STAT_MAX;

export function EvolveModal({ engine, hud }) {
  const cur = engine.player.species.stats;
  const ascend = hud.evolveMode === 'ascend';
  const advance = hud.evolveMode === 'advance';
  const title = ascend ? '🏝 CRAWL ASHORE 🏝' : advance ? '◆ ENTER THE CARBONIFEROUS ◆' : '✦ EVOLUTION ✦';
  const subtitle = ascend
    ? 'The tide draws back and the shore beckons — choose the shape that first leaves the water'
    : advance
      ? 'Your Devonian lineage is ready for the coal forests — evolve now or remain and finish exploring'
      : 'Your egg quivers and splits — choose the shape of the next generation';
  return html`
    <div className="scrim">
      <div className="card">
        <div className="evolveTitle">${title}</div>
        <div className="subtitle">${subtitle}</div>
        <div className="choices">
          ${hud.choices.map(id => {
            const sp = SPECIES[id];
            const bcls = (sp.branch === '-') ? '' : sp.branch;
            const blabel = BRANCH_WORD[sp.branch] || '';
            return html`
              <div key=${id} className=${'choice ' + bcls} onClick=${() => engine.chooseEvolution(id)}>
                <canvas width="200" height="120" ref=${el => engine.registerPreview(id, el)}/>
                <div className="cname">${sp.name}
                  ${bcls && html`<span className=${'ctag ' + bcls}>${blabel}</span>`}</div>
                <div className="cdesc">${sp.desc}</div>
                ${engine.leadsToLandDeadEnd(id) && html`<div className="deadEndTag">⚠ Dead end with Fantasy Evolution off — this road never reaches land</div>`}
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
        ${ascend && html`
          <div className="ascendStay">
            <button className="stayBtn" onClick=${() => engine.dismissAscend()}>Not yet — stay in the sea</button>
            <div className="ascendHint">Finish hunting the deep (bosses, kills…) and reopen this from the <b>🏝 Ashore</b> button anytime.</div>
          </div>`}
        ${advance && html`
          <div className="ascendStay">
            <button className="stayBtn" onClick=${() => engine.dismissAdvance()}>Not yet — stay in the Devonian</button>
            <div className="ascendHint">Finish exploring Devonian zones and reopen this transition from the <b>Carboniferous</b> button anytime.</div>
          </div>`}
      </div>
    </div>`;
}

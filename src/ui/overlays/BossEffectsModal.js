/* Permanent effects earned from defeated map guardians in the current run. */
import { html } from '../react.js';
import { AbilityIcon } from '../components/AbilityIcon.js';

export function BossEffectsModal({ perks, onClose }) {
  return html`
    <div className="scrim bossEffectsScrim">
      <div className="bossEffectsCard">
        <div className="bossEffectsHead">
          <div><span className="bossEffectsMark">◆</span><b>BOSS EFFECTS</b><small>Permanent trophies gathered this run</small></div>
          <button className="treeClose" onClick=${onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="bossEffectsList">
          ${perks.map(pk => html`
            <div key=${pk.id} className="bossEffectRow" style=${{ '--ac': pk.color }}>
              <div className="bossEffectIcon"><${AbilityIcon} id=${pk.icon} color=${pk.color}/></div>
              <div><b>${pk.name}</b><span>${pk.blurb}</span></div>
            </div>`)}
        </div>
        <div className="bossEffectsHint">These effects remain active until the current run ends · <span className="kbd">Esc</span> closes</div>
      </div>
    </div>`;
}

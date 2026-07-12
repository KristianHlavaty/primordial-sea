/* Modal reward window shown when a miniboss grants a permanent perk. */
import { html } from '../react.js';
import { AbilityIcon } from './AbilityIcon.js';

export function AchievementToast({ ach, onClose }) {
  return html`
    <div className="scrim bossRewardScrim">
      <div className="achv" style=${{ '--ac': ach.color }}>
        <div className="achIcon"><${AbilityIcon} id=${ach.icon} color=${ach.color}/></div>
        <div className="achTxt">
          <div className="achHdr">☠ MINIBOSS SLAIN</div>
          <div className="achBoss">${ach.boss}</div>
          <div className="achPerk">Permanent trophy — <b>${ach.perk}</b> <span>${ach.blurb}</span></div>
        </div>
        <button className="achClose" onClick=${onClose}>CONTINUE</button>
      </div>
    </div>`;
}

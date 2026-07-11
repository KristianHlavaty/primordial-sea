/* Slide-in toast when a miniboss falls and grants its permanent perk. */
import { html } from '../react.js';
import { AbilityIcon } from './AbilityIcon.js';

export function AchievementToast({ ach }) {
  return html`
    <div className="achv" style=${{ '--ac': ach.color }}>
      <div className="achIcon"><${AbilityIcon} id=${ach.icon} color=${ach.color}/></div>
      <div className="achTxt">
        <div className="achHdr">☠ MINIBOSS SLAIN</div>
        <div className="achBoss">${ach.boss}</div>
        <div className="achPerk">Permanent trophy — <b>${ach.perk}</b> <span>${ach.blurb}</span></div>
      </div>
    </div>`;
}

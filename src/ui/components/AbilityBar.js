/* Bottom-center power bar: actives are clickable (or keys 1/2/3), passives
   show as always-on. Cooldown curtain and active-duration underline come
   from the HUD snapshot. */
import { html } from '../react.js';
import { AbilityIcon } from './AbilityIcon.js';

export function AbilityBar({ abilities, commands }) {
  if (!abilities || !abilities.length) return null;
  return html`
    <div className="abilbar">
      ${abilities.map((a, i) => html`
        <div key=${a.id} className=${'abil' + (a.active ? ' active' : '') + (a.passive ? ' passive' : '')}
             style=${{ '--ac': a.color }}
             title=${a.name + ' — ' + a.desc}
             onClick=${() => a.passive ? null : commands.useAbility(i)}>
          <${AbilityIcon} id=${a.id} color=${a.color}/>
          ${a.passive ? html`<span className="apass">PASSIVE</span>` : html`<span className="akey">${a.key}</span>`}
          <span className="aname">${a.name}</span>
          ${!a.passive && !a.active && a.cdFrac > 0 && html`<div className="acd" style=${{ height: (a.cdFrac * 100) + '%' }}><span>${a.cd}</span></div>`}
          ${a.meter > 0 && html`<div className="ameter" style=${{ width: (a.meter * 100) + '%' }}/>`}
          ${a.meterLabel && html`<span className="ameterlabel">${a.meterLabel}</span>`}
          ${a.active && a.activeFrac > 0 && html`<div className="aactive" style=${{ width: (a.activeFrac * 100) + '%' }}/>`}
        </div>
      `)}
    </div>`;
}

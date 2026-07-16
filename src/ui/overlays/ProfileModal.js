/* Name + colour picker. Shown automatically on first run (no profile yet) and
   re-openable from the menu to edit. Saving persists via net/profile.js. */
import { html, useState } from '../react.js';
import { PROFILE_COLORS, saveProfile } from '../../net/profile.js';

export function ProfileModal({ profile, firstRun, onSave, onClose }) {
  const [name, setName] = useState(profile ? profile.name : '');
  const [color, setColor] = useState(profile ? profile.color : PROFILE_COLORS[0]);
  const trimmed = name.trim();
  const commit = () => { if (!trimmed) return; onSave(saveProfile({ name, color })); };

  return html`
    <div className="scrim profileScrim">
      <div className="card profileCard">
        <div className="title" style=${{ fontSize: '24px' }}>${firstRun ? 'WELCOME' : 'YOUR PROFILE'}</div>
        <div className="subtitle">${firstRun ? 'pick a name and colour before you begin' : 'change your name or colour'}</div>

        <div className="profileForm">
          <label className="pfLabel">Name</label>
          <input className="pfInput" type="text" maxLength=${16} value=${name} placeholder="your name" autoFocus
            onInput=${e => setName(e.target.value)}
            onKeyDown=${e => { if (e.key === 'Enter') commit(); }}/>

          <label className="pfLabel">Colour</label>
          <div className="pfColors">
            ${PROFILE_COLORS.map(c => html`<button key=${c} type="button"
              className=${'pfSwatch' + (c === color ? ' sel' : '')} style=${{ background: c }}
              title=${c} onClick=${() => setColor(c)}/>`) }
          </div>

          <div className="pfPreview">
            <span className="pfDot" style=${{ background: color }}></span>
            <b style=${{ color }}>${trimmed || 'Nameless'}</b>
          </div>
        </div>

        <div className="pfActions">
          ${!firstRun && html`<button className="stayBtn" onClick=${onClose}>Cancel</button>`}
          <button className="bigbtn" disabled=${!trimmed} onClick=${commit}>${firstRun ? 'CONTINUE' : 'SAVE'}</button>
        </div>
      </div>
    </div>`;
}

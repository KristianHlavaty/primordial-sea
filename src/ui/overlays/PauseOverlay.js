import { html } from '../react.js';

export function PauseOverlay({ onResume, onSettings, onMainMenu, multiplayer = false }) {
  return html`
    <div className="scrim"><div className="card pausewrap">
      <div className="title" style=${{ fontSize: '28px' }}>${multiplayer ? 'GAME MENU' : 'PAUSED'}</div>
      ${multiplayer && html`<div className="pauseNote">The shared match continues while this menu is open.</div>`}
      <button className="bigbtn" onClick=${onResume}>RESUME</button>
      <button className="pauseSettingsBtn" onClick=${onSettings}>SETTINGS</button>
      <button className="menubtn" onClick=${onMainMenu}>MAIN MENU</button>
    </div></div>`;
}

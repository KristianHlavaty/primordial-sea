import { html } from '../react.js';

export function PauseOverlay({ onResume }) {
  return html`
    <div className="scrim"><div className="card pausewrap">
      <div className="title" style=${{ fontSize: '28px' }}>PAUSED</div>
      <button className="bigbtn" onClick=${onResume}>RESUME</button>
    </div></div>`;
}

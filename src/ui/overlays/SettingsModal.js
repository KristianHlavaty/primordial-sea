import { html } from '../react.js';
import { FRAME_RATE_OPTIONS } from '../settings.js';

export function SettingsModal({ settings, onChange, onClose }) {
  const selectFrameRate = frameRate => onChange({ ...settings, frameRate });

  return html`
    <div className="scrim settingsScrim">
      <div className="card settingsCard" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="title" style=${{ fontSize: '26px' }}>SETTINGS</div>
        <div className="subtitle">visual performance</div>

        <section className="settingsGroup">
          <div className="settingsLabel">
            <div><b>Frame rate</b><small>Visible rendering only; gameplay and networking keep their optimized fixed rates.</small></div>
            <span>${settings.frameRate ? settings.frameRate + ' FPS' : 'Unlimited'}</span>
          </div>
          <div className="frameRateOptions">
            ${FRAME_RATE_OPTIONS.map(option => html`
              <button key=${option.value} type="button" aria-pressed=${settings.frameRate === option.value}
                className=${'frameRateOption' + (settings.frameRate === option.value ? ' selected' : '')}
                onClick=${() => selectFrameRate(option.value)}>
                <b>${option.label}</b><small>${option.detail}</small>
              </button>`)}
          </div>
          <p className="settingsHint">Higher limits make motion smoother on high-refresh displays, but use more GPU. Unlimited follows the browser's display refresh rate.</p>
        </section>

        <button className="bigbtn settingsDone" onClick=${onClose}>DONE</button>
        <div className="settingsEscape">Esc closes settings</div>
      </div>
    </div>`;
}

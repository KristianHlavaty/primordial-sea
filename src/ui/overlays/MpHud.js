/* Multiplayer in-game overlay: a live FFA scoreboard (sorted by kills), a
   transient kill feed, and the "respawning" notice while you're dead. Reads
   only the HUD snapshot — no engine access. */
import { html } from '../react.js';

export function MpHud({ hud }) {
  const players = hud.mpPlayers || [];
  const feed = hud.mpFeed || [];
  return html`
    <${'div'}>
      <div className="mpScore">
        <div className="mpScoreHead">FREE-FOR-ALL</div>
        ${players.map(p => html`
          <div key=${p.connId} className=${'mpScoreRow' + (p.self ? ' me' : '') + (p.dead ? ' dead' : '')}>
            <span className="pfDot" style=${{ background: p.color }}></span>
            <span className="msName" style=${{ color: p.color }}>${p.name}${p.self ? ' (you)' : ''}</span>
            <span className="msLv">Lv${p.level}</span>
            <span className="msK">${p.kills}</span>
          </div>`)}
      </div>

      ${feed.length > 0 && html`
        <div className="mpKillFeed">
          ${feed.map(f => html`<div key=${f.id} className="mpKillLine"><b style=${{ color: f.color }}>${f.text}</b></div>`)}
        </div>`}

      ${hud.mpDead && html`
        <div className="mpRespawn">
          <div className="mpRespawnCard"><b>You were eaten!</b><span>Respawning in ${hud.mpRespawnIn}…</span></div>
        </div>`}
    <//>`;
}

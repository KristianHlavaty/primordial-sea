/* In-game HUD: name/era badges, health + level bars, perk trophies,
   top-right buttons, controls hint and the ability bar. */
import { html } from '../react.js';
import { clamp } from '../../core/math.js';
import { AbilityBar } from './AbilityBar.js';
import { AbilityIcon } from './AbilityIcon.js';

export function Hud({ hud, engine, onOpenTree, onOpenAtlas, onOpenBossEffects }) {
  return html`
    <div className="hud">
      <div className="topleft">
        <div className="name">${hud.name}<br/><small>Lv ${hud.level} · Era ${hud.era} · Tier ${hud.tier}</small>
          <div className="mapline">📍 ${hud.mapName} <span>· ${hud.stageName}</span></div></div>
        <div className="bars">
          ${hud.shield > 0 && html`
            <div className="bar shield">
              <div className="fill" style=${{ transform: `scaleX(${clamp(hud.shield / (hud.shieldMax || 1), 0, 1)})` }}/>
              <div className="lab"><span>SHIELD</span><span>${Math.round(hud.shield)}</span></div>
            </div>`}
          <div className="bar hp">
            <div className="fill" style=${{ transform: `scaleX(${clamp(hud.hp / hud.maxHp, 0, 1)})` }}/>
            <div className="lab"><span>HEALTH</span><span>${Math.round(hud.hp)}/${Math.round(hud.maxHp)}</span></div>
          </div>
          <div className="bar bio">
            <div className="fill" style=${{ transform: `scaleX(${hud.level >= 10 ? 1 : clamp(hud.xp / hud.xpNeed, 0, 1)})` }}/>
            <div className="lab"><span>LEVEL ${hud.level}</span><span>${hud.level >= 10 ? (hud.canEvolve ? 'EVOLVE!' : 'MAX') : hud.xp + ' / ' + hud.xpNeed}</span></div>
          </div>
        </div>
        ${hud.perks && hud.perks.length > 0 && html`
          <div className="perks">
            ${hud.perks.map(pk => html`
              <span key=${pk.id} className="perk" style=${{ '--ac': pk.color }} title=${pk.name + ' — ' + pk.blurb + ' (miniboss trophy)'}>
                <${AbilityIcon} id=${pk.icon} color=${pk.color}/><b>${pk.name}</b>
              </span>`)}
          </div>
          <button className="bossEffectsBtn" onClick=${onOpenBossEffects} title="View permanent boss effects">
            <span>◆</span><b>Boss effects</b><em>${hud.perks.length}</em>
          </button>`}
      </div>
      <div className="topright">
        <div className="kills">${hud.kills} <span>kills</span></div>
        <button className="iconbtn" onClick=${onOpenTree} title="Evolution tree (T)">🧬</button>
        <button className="iconbtn" onClick=${onOpenAtlas} title="World atlas (B)">🗺</button>
        <button className=${'iconbtn' + (hud.showLevels ? ' on' : '')} onClick=${() => engine.toggleLevels()} title="Toggle level labels (L)">Lv</button>
        <button className="iconbtn" onClick=${() => engine.toggleMute()} title="Mute (M)">${hud.muted ? '🔇' : '🔊'}</button>
        <button className="iconbtn" onClick=${() => engine.togglePause()} title="Pause (P)">⏸</button>
      </div>
      ${hud.ascendAvailable && html`
        <button className="ashoreBtn" onClick=${() => engine.openAscend()} title="Crawl ashore — evolve onto the land">🏝 Ashore</button>`}
      ${hud.advanceAvailable && html`
        <button className="advanceBtn" onClick=${() => engine.openAdvance()} title="Continue into the Carboniferous">◆ Carboniferous</button>`}
      ${hud.landDeadEnd && html`
        <div className="deadEndNote">🌊 <b>Dead end.</b> This lineage has no real land descendants — it can't crawl ashore. Start a new run with <b>Fantasy Evolution</b> on to give it a speculative land path.</div>`}
      ${hud.nearEdge && html`<div className="edgePrompt">▸ crossing to <b>${hud.nearEdge}</b>…</div>`}
      <div className="hint">Steer <b>mouse</b>/<b>WASD</b> · <b>Click / Space</b> bite & dash · Powers <b>1 2 3</b> · Eat to <b>level up</b> — reach <b>Lv 10</b> to evolve</div>
      ${hud.cheatsEnabled && html`
        <div className="cheatPanel">
          <div className="cheatTitle">CHEATS</div>
          <button className=${hud.invincible ? 'active' : ''} onClick=${() => engine.toggleInvincible()}>${hud.invincible ? '◆' : '◇'} Invincibility</button>
          <button onClick=${() => engine.cheatLevelUp()} disabled=${hud.level >= 10 || hud.pendingEvolve}>＋ Level up</button>
        </div>`}
      <${AbilityBar} abilities=${hud.abilities} engine=${engine}/>
    </div>`;
}

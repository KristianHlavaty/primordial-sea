/* Title screen / main menu. The home view sells the game and splits into
   Single Player (the original flow: begin, skip-ahead, toggles) and local
   Multiplayer. A profile chip (top-right) shows who you are and edits it. */
import { html, useState } from '../react.js';
import { SPECIES, stagePioneers } from '../../data/species.js';
import { BRANCH_WORD } from '../../data/branches.js';
import { frameRateLabel } from '../settings.js';

export function StartScreen({ onBegin, onSkipToLand, onMultiplayer, profile, onEditProfile, settings, onOpenSettings }) {
  const [view, setView] = useState('home');   // 'home' | 'single'
  const [showLand, setShowLand] = useState(false);
  const [fantasyEvolution, setFantasyEvolution] = useState(true);
  const [cheats, setCheats] = useState(false);

  const pioneerBtn = id => {
    const sp = SPECIES[id];
    return html`<button key=${id} className=${'skipBtn ' + sp.branch} onClick=${() => onSkipToLand(id, { fantasyEvolution, cheats })}>
      ${sp.name}<small>${BRANCH_WORD[sp.branch] || sp.branch}</small></button>`;
  };

  const chip = html`
    <button className="profileChip" onClick=${onEditProfile} title="Edit your profile">
      <span className="pfDot" style=${{ background: profile ? profile.color : '#5ec8f2' }}></span>
      <span className="pcName">${profile ? profile.name : 'Nameless'}</span>
      <small>edit</small>
    </button>`;

  const home = html`
    <${'div'}>
      <div className="body">
        You are a single cell adrift in an ancient ocean. <b>Hunt</b> smaller creatures and <b>graze</b> on algae to
        gain experience and <b>level up</b>. Reach <b>Lv 10</b> and you'll lay an <b>egg</b> — then choose how your lineage evolves.<br/><br/>
        Four roads open the deep: the armored <b style=${{ color: 'var(--arth)' }}>arthropods</b>, the swift
        <b style=${{ color: 'var(--chord)' }}> chordates</b>, the stinging <b style=${{ color: 'var(--cnid)' }}>cnidarians</b> and the
        cunning <b style=${{ color: 'var(--moll)' }}>molluscs</b>. Reach the apex of any road and you can <b style=${{ color: 'var(--tetra)' }}>crawl ashore</b>.
      </div>
      <div className="menuChoices">
        <button className="menuChoice sp" onClick=${() => setView('single')}>
          <span className="mcTitle">SINGLE PLAYER</span>
          <span className="mcSub">evolve from cell to apex, solo</span>
        </button>
        <button className="menuChoice mp" onClick=${onMultiplayer}>
          <span className="mcTitle">MULTIPLAYER <em>local</em></span>
          <span className="mcSub">shared arena on your network · free-for-all</span>
        </button>
        <button className="menuChoice settings" onClick=${onOpenSettings}>
          <span className="mcTitle">SETTINGS</span>
          <span className="mcSub">frame rate: ${frameRateLabel(settings.frameRate)}</span>
        </button>
      </div>
    <//>`;

  const single = html`
    <${'div'}>
      <div className="body" style=${{ margin: '16px 0 8px' }}>
        Each evolution grants a new <b>power</b> (<span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> or click its icon).<br/>
        <span style=${{ color: 'var(--dim)' }}>Steer with <span className="kbd">mouse</span> or <span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> · bite & dash with <span className="kbd">click</span> / <span className="kbd">Space</span> · <span className="kbd">P</span> pause · <span className="kbd">T</span> tree · <span className="kbd">B</span> atlas · <span className="kbd">K</span> talents</span>
      </div>
      <label className="fantasyToggle"><input type="checkbox" checked=${fantasyEvolution} onChange=${e => setFantasyEvolution(e.target.checked)}/>
        Enable fantasy evolution bridges <small>(adds speculative land descendants for cnidarians and molluscs)</small>
      </label>
      <label className="cheatsToggle"><input type="checkbox" checked=${cheats} onChange=${e => setCheats(e.target.checked)}/> Cheats <small>(show testing controls in game)</small></label>
      <button className="bigbtn" onClick=${() => onBegin({ fantasyEvolution, cheats })}>BEGIN LIFE</button>
      <div className="skipRow">
        <button className="skipToggle" onClick=${() => setShowLand(v => !v)}>${showLand ? '▾ hide' : '▸ skip ahead'}</button>
        ${showLand && html`
          <div className="skipChoices">
            <div className="skipLabel">Start further along — you keep the <b>talent points</b> you'd have earned getting there, so it's no setback.</div>
            <div className="skipStage">
              <div className="skipStageName" style=${{ color: 'var(--tetra)' }}>Devonian <span>+45 sea talent points</span></div>
              <div className="skipBtns">${stagePioneers('devonian', fantasyEvolution).map(pioneerBtn)}</div>
            </div>
            <div className="skipStage">
              <div className="skipStageName" style=${{ color: 'var(--myria)' }}>Carboniferous <span>+45 sea &amp; +36 Devonian points</span></div>
              <div className="skipBtns">${stagePioneers('carboniferous', fantasyEvolution).map(pioneerBtn)}</div>
            </div>
          </div>`}
      </div>
      <div className="menuBackRow"><button className="menuBack" onClick=${() => setView('home')}>‹ Back to menu</button></div>
    <//>`;

  return html`
    <div className="scrim"><div className="card menuCard">
      <div className="menuTop">${chip}</div>
      <div className="title">PRIMORDIAL SEA</div>
      <div className="subtitle">an evolution game · from the sea to the land</div>
      ${view === 'home' ? home : single}
    </div></div>`;
}

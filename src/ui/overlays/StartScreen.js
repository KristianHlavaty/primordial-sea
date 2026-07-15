/* Title screen: the game's premise, controls, and a shortcut to begin already
   ashore as one of the land pioneers. */
import { html, useState } from '../react.js';
import { SPECIES, stagePioneers } from '../../data/species.js';
import { BRANCH_WORD } from '../../data/branches.js';

export function StartScreen({ onBegin, onSkipToLand }) {
  const [showLand, setShowLand] = useState(false);
  const [fantasyEvolution, setFantasyEvolution] = useState(false);
  const [cheats, setCheats] = useState(false);
  const pioneerBtn = id => {
    const sp = SPECIES[id];
    return html`<button key=${id} className=${'skipBtn ' + sp.branch} onClick=${() => onSkipToLand(id, { fantasyEvolution, cheats })}>
      ${sp.name}<small>${BRANCH_WORD[sp.branch] || sp.branch}</small></button>`;
  };
  return html`
    <div className="scrim"><div className="card">
      <div className="title">PRIMORDIAL SEA</div>
      <div className="subtitle">an evolution game · from the sea to the land</div>
      <div className="body">
        You are a single cell adrift in an ancient ocean. <b>Hunt</b> smaller creatures and <b>graze</b> on algae to
        gain experience and <b>level up</b>. Reach <b>Lv 10</b> and you'll lay an <b>egg</b> — then choose how your lineage evolves.<br/><br/>
        Four roads open the deep: the armored <b style=${{ color: 'var(--arth)' }}>arthropods</b>, the swift
        <b style=${{ color: 'var(--chord)' }}> chordates</b>, the stinging <b style=${{ color: 'var(--cnid)' }}>cnidarians</b> and the
        cunning <b style=${{ color: 'var(--moll)' }}>molluscs</b>. Reach the apex of any road and you can <b style=${{ color: 'var(--tetra)' }}>crawl ashore</b> —
        into the Devonian, where four new tiers lead toward the Carboniferous coal forests. Each evolution grants a new <b>power</b>,
        used with <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> or by clicking its icon.
        <br/><br/>
        <span style=${{ color: 'var(--dim)' }}>Steer with <span className="kbd">mouse</span> or <span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> · bite & dash with <span className="kbd">click</span> / <span className="kbd">Space</span> · powers <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> · <span className="kbd">P</span> pause · <span className="kbd">T</span> tree · <span className="kbd">B</span> atlas</span>
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
    </div></div>`;
}

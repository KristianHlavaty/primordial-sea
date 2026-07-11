/* Title screen with the game's premise and controls. */
import { html } from '../react.js';

export function StartScreen({ onBegin }) {
  return html`
    <div className="scrim"><div className="card">
      <div className="title">PRIMORDIAL SEA</div>
      <div className="subtitle">an evolution game · sea stage</div>
      <div className="body">
        You are a single cell adrift in an ancient ocean. <b>Hunt</b> smaller creatures and <b>graze</b> on algae to
        gain experience and <b>level up</b>. Reach <b>Lv 10</b> and you'll lay an <b>egg</b> — then choose how your lineage evolves.<br/><br/>
        Four roads open the deep: the armored <b style=${{ color: 'var(--arth)' }}>arthropods</b>, the swift
        <b style=${{ color: 'var(--chord)' }}> chordates</b>, the stinging <b style=${{ color: 'var(--cnid)' }}>cnidarians</b> and the
        cunning <b style=${{ color: 'var(--moll)' }}>molluscs</b>. Each time you evolve, <b>the whole sea evolves with you</b> —
        new species appear and everything grows stronger. Every evolution also grants a new <b>power</b> — grounded, not
        magic (harden your shell, roll up, burst-swim, feeding frenzy…) — used with <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> or by clicking its icon.
        <br/><br/>
        <span style=${{ color: 'var(--dim)' }}>Steer with <span className="kbd">mouse</span> or <span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> · bite & dash with <span className="kbd">click</span> / <span className="kbd">Space</span> · powers <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">3</span> · <span className="kbd">P</span> pause</span>
      </div>
      <button className="bigbtn" onClick=${onBegin}>BEGIN LIFE</button>
    </div></div>`;
}

/* Death screen with the run's final tally. */
import { html } from '../react.js';

export function GameOverScreen({ hud, onRestart }) {
  return html`
    <div className="scrim gameover"><div className="card">
      <div className="title">CONSUMED</div>
      <div className="subtitle">Your lineage ends here — but the sea remembers</div>
      <div className="statgrid">
        <div><span>Final form</span><b>${hud.name}</b></div>
        <div><span>Era reached</span><b>${hud.era}</b></div>
        <div><span>Evolutions</span><b>${hud.tier}</b></div>
        <div><span>Kills</span><b>${hud.kills}</b></div>
      </div>
      <button className="bigbtn" onClick=${onRestart}>EVOLVE AGAIN</button>
    </div></div>`;
}

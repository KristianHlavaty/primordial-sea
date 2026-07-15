/* The world atlas (🗺). Lists every map grouped by stage, each with its
   dedicated boss(es), whether they've been slain, which map you're on, and how
   the land maps connect. Read-only — purely informational. */
import { html } from '../react.js';
import { MAPS, STAGES, mapsOfStage } from '../../data/maps.js';
import { BOSSES } from '../../data/bosses.js';

const THEME_SWATCH = {
  sea: 'linear-gradient(135deg,#1c6a92,#04121e)',
  coast: 'linear-gradient(135deg,#b8a06a,#8a744a)',
  swamp: 'linear-gradient(135deg,#3f5a34,#20301b)',
  marsh: 'linear-gradient(135deg,#64734d,#293827)',
  webgrove: 'linear-gradient(135deg,#4c4b43,#171c1d)',
};

const EDGE_INFO = {
  left: { arrow: '←', label: 'LEFT EDGE' }, right: { arrow: '→', label: 'RIGHT EDGE' },
  top: { arrow: '↑', label: 'TOP EDGE' }, bottom: { arrow: '↓', label: 'BOTTOM EDGE' },
};

export function AtlasModal({ engine, hud, onClose }) {
  const defeated = engine.bossesDefeated;
  const stages = Object.keys(STAGES).sort((a, b) => STAGES[a].order - STAGES[b].order);
  return html`
    <div className="scrim atlasScrim">
      <div className="atlasCard">
        <div className="treeHead">
          <div className="treeTitle">🗺 WORLD ATLAS</div>
          <button className="treeClose" onClick=${onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="atlasBody">
          ${stages.map(sid => {
            const st = STAGES[sid];
            const reachable = sid === hud.stage || sid === 'sea' || engine.visitedMaps.has(mapsOfStage(sid)[0]);
            return html`
              <div key=${sid} className=${'atlasStage' + (reachable ? '' : ' locked')}>
                <div className="atlasStageHead"><span className=${'atlasStageName ' + sid}>${st.name}</span><span className="atlasStageBlurb">${st.blurb}</span></div>
                <div className="atlasMaps">
                  ${mapsOfStage(sid).map(mid => {
                    const m = MAPS[mid]; const here = mid === hud.mapId;
                    const exits = Object.entries(m.neighbors || {});
                    return html`
                      <div key=${mid} className=${'atlasMap' + (here ? ' here' : '')}>
                        <div className="atlasSwatch" style=${{ background: THEME_SWATCH[m.theme] || THEME_SWATCH.sea }}>
                          ${here && html`<span className="atlasYouHere">◈ HERE</span>`}
                          ${exits.map(([edge, target]) => {
                            const info = EDGE_INFO[edge] || { arrow: '◆', label: edge.toUpperCase() + ' EDGE' };
                            return html`<span key=${edge} className=${'atlasExitMarker ' + edge} title=${info.label + ' leads to ' + MAPS[target].name}>
                              <span>${info.arrow}</span><b>EXIT</b>
                            </span>`;
                          })}
                        </div>
                        <div className="atlasMapName">${m.name}</div>
                        <div className="atlasBosses">
                          ${(m.bosses || []).map(bk => {
                            const b = BOSSES[bk]; const slain = defeated.has(bk);
                            return html`<div key=${bk} className=${'atlasBoss' + (slain ? ' slain' : '')}>
                              <span className="atlasBossMark">${slain ? '✓' : '☠'}</span>
                              <span className="atlasBossName">${b ? b.short : bk}</span>
                              ${slain && html`<span className="atlasBossTag">slain</span>`}
                            </div>`;
                          })}
                        </div>
                        ${exits.length > 0 ? html`
                          <div className="atlasRoutes">
                            <div className="atlasRoutesTitle">CROSSING POINTS</div>
                            ${exits.map(([edge, target]) => {
                              const info = EDGE_INFO[edge] || { arrow: '◆', label: edge.toUpperCase() + ' EDGE' };
                              const visited = engine.visitedMaps.has(target);
                              return html`<div key=${edge} className="atlasRoute">
                                <span className="atlasRouteEdge"><i>${info.arrow}</i>${info.label}</span>
                                <span className="atlasRouteTarget">${MAPS[target].name}</span>
                                ${!visited && html`<em>unvisited</em>`}
                              </div>`;
                            })}
                          </div>` : html`
                          <div className="atlasNoRoutes">${m.stage === 'sea' ? 'No edge crossing · evolve ashore' : 'No connected edge'}</div>`}
                      </div>`;
                  })}
                </div>
              </div>`;
          })}
        </div>
        <div className="treeHint">Follow the glowing <b>EXIT</b> marker and walk off that map edge to cross · <span className="kbd">Esc</span> closes</div>
      </div>
    </div>`;
}

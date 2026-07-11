/* One stat comparison row in the evolve cards (current vs next form). */
import { html } from '../react.js';
import { clamp } from '../../core/math.js';

export function StatRow({ label, cur, next, max, color }) {
  const d = next - cur;
  const cls = d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'same';
  const sym = d > 0.5 ? '▲' : d < -0.5 ? '▼' : '=';
  return html`
    <div className="stat">
      <span className="sl">${label}</span>
      <span className="sbar"><i style=${{ width: clamp(next / max, 0, 1) * 100 + '%', background: color }}/></span>
      <span className=${'delta ' + cls}>${sym}${d === 0 ? '' : Math.abs(Math.round(d))}</span>
    </div>`;
}

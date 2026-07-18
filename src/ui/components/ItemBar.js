/* Three collectible slots. Click or Q/E/F uses an item; dragging a
   filled slot onto the world drops it beside the player's creature. */
import { html, useState, Fragment } from '../react.js';
import { ItemIcon } from './ItemIcon.js';

export function ItemBar({ items, engine }) {
  const [dragging, setDragging] = useState(null);
  if (!items) return null;
  const startDrag = (event, slot) => {
    if (items[slot].empty) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(slot)); setDragging(slot);
  };
  const drop = event => { event.preventDefault(); if (dragging != null) engine.dropItem(dragging); setDragging(null); };
  return html`
    <${Fragment}>
      <div className="itembarWrap">
      <div className="itembarLabel">COLLECTED ITEMS <span>drag out to drop</span></div>
      <div className="itembar">
        ${items.map(item => html`
          <div key=${item.slot} draggable=${!item.empty}
            className=${'itemslot' + (item.empty ? ' empty' : '') + (item.modern ? ' modern' : '')}
            style=${item.empty ? null : { '--ic': item.color }}
            title=${item.empty ? 'Empty item slot' : item.name + ' — ' + item.desc + ' (drag to drop)'}
            onClick=${() => item.empty ? null : engine.useItem(item.slot)}
            onDragStart=${event => startDrag(event, item.slot)} onDragEnd=${() => setDragging(null)}>
            <span className="itemkey">${item.key}</span>
            ${item.empty ? html`<span className="itemempty">EMPTY</span>` : html`
              <${ItemIcon} id=${item.id}/><span className="itemname">${item.name}</span><span className="itemuses">${item.uses}</span>
              ${item.modern && html`<span className="modernBadge">FUN</span>`}
              ${item.cdFrac > 0 && html`<div className="itemcd" style=${{ height: item.cdFrac * 100 + '%' }}></div>`}`}
          </div>`) }
      </div>
      </div>
      ${dragging != null && html`<div className="itemDropLayer" onDragOver=${event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop=${drop}>
        <span>DROP ${items[dragging].name.toUpperCase()}</span><small>Release anywhere in the world</small>
      </div>`}
    <//>`;
}

/* Three collectible slots. Click or Q/E/F uses an item; dragging a
   filled slot onto the world drops it beside the player's creature. */
import { html, useState, useRef, useEffect, Fragment } from '../react.js';
import { ItemIcon } from './ItemIcon.js';

export function ItemBar({ items, commands }) {
  const [dragging, setDragging] = useState(null);
  const dragSlot = useRef(null);
  const itemsRef = useRef(items), commandsRef = useRef(commands);
  itemsRef.current = items; commandsRef.current = commands;
  const finishDrag = () => { dragSlot.current = null; setDragging(null); };
  const slotFromTransfer = transfer => {
    if (!transfer) return dragSlot.current;
    const raw = transfer.getData('application/x-primordial-item-slot') || transfer.getData('text/plain');
    const payloadSlot = raw === '' ? NaN : Number(raw);
    return Number.isInteger(payloadSlot) ? payloadSlot : dragSlot.current;
  };

  // The canvas and HUD live in separate hit-test layers, and some browsers do
  // not accept a drop target mounted after dragstart. Capture native DnD at the
  // window instead, which makes releasing anywhere inside the game reliable.
  useEffect(() => {
    const allowDrop = event => {
      if (dragSlot.current == null) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    };
    const dropAnywhere = event => {
      if (dragSlot.current == null) return;
      event.preventDefault(); event.stopPropagation();
      const currentItems = itemsRef.current || [], slot = slotFromTransfer(event.dataTransfer);
      if (slot != null && slot >= 0 && slot < currentItems.length && !currentItems[slot].empty) commandsRef.current.dropItem(slot);
      finishDrag();
    };
    window.addEventListener('dragenter', allowDrop, true);
    window.addEventListener('dragover', allowDrop, true);
    window.addEventListener('drop', dropAnywhere, true);
    return () => {
      window.removeEventListener('dragenter', allowDrop, true);
      window.removeEventListener('dragover', allowDrop, true);
      window.removeEventListener('drop', dropAnywhere, true);
    };
  }, []);

  if (!items) return null;
  const startDrag = (event, slot) => {
    if (items[slot].empty) { event.preventDefault(); return; }
    dragSlot.current = slot;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-primordial-item-slot', String(slot));
    event.dataTransfer.setData('text/plain', String(slot));
    setDragging(slot);
  };
  const discard = (event, slot) => { event.preventDefault(); event.stopPropagation(); commands.dropItem(slot); finishDrag(); };
  return html`
    <${Fragment}>
      <div className="itembarWrap">
      <div className="itembarLabel">COLLECTED ITEMS <span>drag out or × to drop</span></div>
      <div className="itembar">
        ${items.map(item => html`
          <div key=${item.slot} draggable=${!item.empty}
            className=${'itemslot' + (item.empty ? ' empty' : '') + (item.modern ? ' modern' : '') + (item.rare ? ' rare' : '')}
            style=${item.empty ? null : { '--ic': item.color }}
            title=${item.empty ? 'Empty item slot' : item.name + ' — ' + item.desc + ' (drag or × to drop)'}
            onClick=${() => item.empty ? null : commands.useItem(item.slot)}
            onDragStart=${event => startDrag(event, item.slot)} onDragEnd=${finishDrag}>
            <span className="itemkey">${item.key}</span>
            ${item.empty ? html`<span className="itemempty">EMPTY</span>` : html`
              <${ItemIcon} id=${item.id}/><span className="itemname">${item.name}</span><span className="itemuses">${item.uses}</span>
              <button className="itemdiscard" draggable=${false} title=${'Drop ' + item.name} aria-label=${'Drop ' + item.name}
                onMouseDown=${event => event.stopPropagation()} onDragStart=${event => { event.preventDefault(); event.stopPropagation(); }}
                onClick=${event => discard(event, item.slot)}>×</button>
              ${item.modern && html`<span className="modernBadge">${item.rare ? 'RARE' : 'FUN'}</span>`}
              ${item.cdFrac > 0 && html`<div className="itemcd" style=${{ height: item.cdFrac * 100 + '%' }}></div>`}`}
          </div>`) }
      </div>
      </div>
      ${dragging != null && items[dragging] && html`<div className="itemDropLayer">
        <span>DROP ${items[dragging].name.toUpperCase()}</span><small>Release anywhere in the world</small>
      </div>`}
    <//>`;
}

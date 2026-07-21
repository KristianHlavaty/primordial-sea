/* DOM input publisher. It knows about browser events and current modal state,
   but sends gameplay intent through the runtime bus instead of calling Engine. */
import { GameEvents } from '../engine/events.js';

const KEYMAP = { w: 'up', a: 'left', s: 'down', d: 'right', arrowup: 'up', arrowleft: 'left', arrowdown: 'down', arrowright: 'right' };

export function attachInput(events, canvas, ui) {
  const emit = (event, payload) => events.emit(event, payload);
  const onResize = () => emit(GameEvents.INPUT_RESIZE_REQUESTED);
  const rect = () => canvas.getBoundingClientRect();
  const onMove = event => {
    const bounds = rect();
    emit(GameEvents.INPUT_POINTER_MOVED, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };
  const onDown = event => {
    if (event.button === 0 && !ui.current.inputBlocked) emit(GameEvents.INPUT_BITE_CHANGED, { pressed: true });
  };
  const onUp = event => {
    if (event.button === 0) emit(GameEvents.INPUT_BITE_CHANGED, { pressed: false });
  };
  const onBlur = () => emit(GameEvents.INPUT_RELEASED);

  const onKeyDown = event => {
    if (['Space', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'KeyQ', 'KeyE', 'KeyF', 'KeyV', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    const key = event.key.toLowerCase(), currentUi = ui.current;
    if (key === 'escape') {
      if (!event.repeat) currentUi.handleEscape && currentUi.handleEscape();
      return;
    }
    if (currentUi.inputBlocked) return;

    // Physical codes keep powers/items in the same place on non-US layouts.
    if (event.code === 'Digit1') { emit(GameEvents.INPUT_ABILITY_REQUESTED, { index: 0 }); return; }
    if (event.code === 'Digit2') { emit(GameEvents.INPUT_ABILITY_REQUESTED, { index: 1 }); return; }
    if (event.code === 'Digit3') { emit(GameEvents.INPUT_ABILITY_REQUESTED, { index: 2 }); return; }
    if (event.code === 'KeyQ') { emit(GameEvents.INPUT_ITEM_REQUESTED, { slot: 0 }); return; }
    if (event.code === 'KeyE') { emit(GameEvents.INPUT_ITEM_REQUESTED, { slot: 1 }); return; }
    if (event.code === 'KeyF') { emit(GameEvents.INPUT_ITEM_REQUESTED, { slot: 2 }); return; }
    if (event.code === 'KeyV') { if (!event.repeat) emit(GameEvents.INPUT_VEHICLE_REQUESTED); return; }

    const anyModal = currentUi.treeOpen || currentUi.atlasOpen || currentUi.bossEffectsOpen || currentUi.talentsOpen || currentUi.achievementOpen;
    if (key === 't') {
      if (currentUi.treeOpen) currentUi.closeTree && currentUi.closeTree();
      else if (!anyModal) currentUi.openTree && currentUi.openTree();
      return;
    }
    if (key === 'b') {
      if (currentUi.atlasOpen) currentUi.closeAtlas && currentUi.closeAtlas();
      else if (!anyModal) currentUi.openAtlas && currentUi.openAtlas();
      return;
    }
    if (key === 'k') {
      if (currentUi.talentsOpen) currentUi.closeTalents && currentUi.closeTalents();
      else if (!anyModal) currentUi.openTalents && currentUi.openTalents();
      return;
    }

    if (key === ' ') emit(GameEvents.INPUT_BITE_CHANGED, { pressed: true });
    else if (key === 'p') {
      if (!anyModal) {
        if (currentUi.multiplayer) currentUi.handleEscape && currentUi.handleEscape();
        else emit(GameEvents.INPUT_PAUSE_REQUESTED);
      }
    } else if (key === 'm') emit(GameEvents.INPUT_MUTE_REQUESTED);
    else if (key === 'l') emit(GameEvents.INPUT_LEVELS_REQUESTED);
    else if (KEYMAP[key]) emit(GameEvents.INPUT_MOVE_CHANGED, { direction: KEYMAP[key], pressed: true });
  };

  const onKeyUp = event => {
    const key = event.key.toLowerCase();
    if (key === ' ') emit(GameEvents.INPUT_BITE_CHANGED, { pressed: false });
    else if (KEYMAP[key]) emit(GameEvents.INPUT_MOVE_CHANGED, { direction: KEYMAP[key], pressed: false });
  };

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}

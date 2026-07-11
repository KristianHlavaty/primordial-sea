/* Global mouse/keyboard bindings. `ui` is a ref whose .current always holds
   the latest { treeOpen, openTree, closeTree } from App, so handlers stay
   registered once but see fresh UI state. */
const KEYMAP = { w: 'up', a: 'left', s: 'down', d: 'right', arrowup: 'up', arrowleft: 'left', arrowdown: 'down', arrowright: 'right' };

export function attachInput(engine, canvas, ui) {
  const onResize = () => engine.resize();
  const rect = () => canvas.getBoundingClientRect();
  const onMove = e => { const r = rect(); engine.setMouse(e.clientX - r.left, e.clientY - r.top); };
  const onDown = e => { if (e.button === 0) engine.setBite(true); };
  const onUp = e => { if (e.button === 0) engine.setBite(false); };

  const onKeyDown = e => {
    if (['Space', 'Digit1', 'Digit2', 'Digit3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    // powers on the number-row keys — bound by physical code so Czech +/ě/š work like 1/2/3
    if (e.code === 'Digit1') { engine.useAbility(0); return; }
    if (e.code === 'Digit2') { engine.useAbility(1); return; }
    if (e.code === 'Digit3') { engine.useAbility(2); return; }
    const k = e.key.toLowerCase();
    const u = ui.current;
    if (k === 't') { if (u.treeOpen) { u.closeTree && u.closeTree(); } else { u.openTree && u.openTree(); } return; }
    if (k === ' ') engine.setBite(true);
    else if (k === 'escape') { if (u.treeOpen) u.closeTree && u.closeTree(); else engine.togglePause(); }
    else if (k === 'p') { if (!u.treeOpen) engine.togglePause(); }   // ignore P while the wiki is open — it manages pause itself
    else if (k === 'm') engine.toggleMute();
    else if (k === 'l') engine.toggleLevels();
    else if (KEYMAP[k]) engine.setKey(KEYMAP[k], true);
  };
  const onKeyUp = e => {
    const k = e.key.toLowerCase();
    if (k === ' ') engine.setBite(false);
    else if (KEYMAP[k]) engine.setKey(KEYMAP[k], false);
  };

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

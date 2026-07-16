/* Global mouse/keyboard bindings. `ui` is a ref whose .current always holds
   the latest { treeOpen, openTree, closeTree } from App, so handlers stay
   registered once but see fresh UI state. */
const KEYMAP = { w: 'up', a: 'left', s: 'down', d: 'right', arrowup: 'up', arrowleft: 'left', arrowdown: 'down', arrowright: 'right' };

export function attachInput(engine, canvas, ui) {
  const onResize = () => engine.resize();
  const rect = () => canvas.getBoundingClientRect();
  const onMove = e => { const r = rect(); engine.setMouse(e.clientX - r.left, e.clientY - r.top); };
  const onDown = e => { if (e.button === 0 && !ui.current.inputBlocked) engine.setBite(true); };
  const onUp = e => { if (e.button === 0) engine.setBite(false); };

  const onKeyDown = e => {
    if (['Space', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    const k = e.key.toLowerCase();
    const u = ui.current;
    if (k === 'escape') { if (!e.repeat) u.handleEscape && u.handleEscape(); return; }
    if (u.inputBlocked) return;
    // powers on the number-row keys — bound by physical code so Czech +/ě/š work like 1/2/3
    if (e.code === 'Digit1') { engine.useAbility(0); return; }
    if (e.code === 'Digit2') { engine.useAbility(1); return; }
    if (e.code === 'Digit3') { engine.useAbility(2); return; }
    const anyModal = u.treeOpen || u.atlasOpen || u.bossEffectsOpen || u.talentsOpen || u.achievementOpen;
    // T / B / K toggle the tree wiki, world atlas and talents (only one open at a time)
    if (k === 't') { if (u.treeOpen) u.closeTree && u.closeTree(); else if (!anyModal) u.openTree && u.openTree(); return; }
    if (k === 'b') { if (u.atlasOpen) u.closeAtlas && u.closeAtlas(); else if (!anyModal) u.openAtlas && u.openAtlas(); return; }
    if (k === 'k') { if (u.talentsOpen) u.closeTalents && u.closeTalents(); else if (!anyModal) u.openTalents && u.openTalents(); return; }
    if (k === ' ') engine.setBite(true);
    else if (k === 'p') { if (!anyModal) engine.togglePause(); }   // ignore P while an overlay is open — it manages pause itself
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

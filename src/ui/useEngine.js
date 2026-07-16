/* Owns the engine's lifecycle: creates it against the canvas, runs the
   requestAnimationFrame loop (sim steps gated by game state, render always),
   wires global input and the window.__game debug API. */
import { useState, useRef, useLayoutEffect } from './react.js';
import { Engine } from '../engine/Engine.js';
import { attachInput } from './input.js';
import { installDebugApi } from './debug.js';

export function useEngine(canvasRef, uiRef) {
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);

  useLayoutEffect(() => {
    const engine = new Engine(canvasRef.current, { onHud: setHud });
    engineRef.current = engine;
    engine.resize();

    const stepEngine = dt => {
      if (engine.mp && engine.mp.role === 'client') engine.updateReplica(dt);
      else engine.update(dt);
    };

    let raf, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.05) dt = 0.05;   // clamp long frames (tab was hidden etc.)
      if (engine.playing && !engine.paused && !engine.dead && !engine.pendingEvolve) stepEngine(dt);
      engine.render();
    };
    raf = requestAnimationFrame(loop);

    /* A multiplayer host must keep simulating even if its tab is backgrounded —
       browsers pause rAF and clamp timers in hidden tabs, but a Worker's timer
       keeps firing. This "metronome" worker drives the MP sim ONLY while the tab
       is hidden; when visible, the rAF loop above handles it (no double-step). */
    let worker = null, mpLast = performance.now();
    const stepHidden = () => {
      if (document.visibilityState === 'visible') { mpLast = performance.now(); return; }
      const now = performance.now(); let dt = (now - mpLast) / 1000; mpLast = now;
      if (dt > 0.2) dt = 0.2;
      if (engine.mp && engine.playing && !engine.dead) stepEngine(dt);
    };
    try {
      const src = 'let h=null;onmessage=function(e){if(e.data===1){if(!h)h=setInterval(function(){postMessage(1)},33)}else{clearInterval(h);h=null}}';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = stepHidden;
      worker.postMessage(1);
    } catch (e) { worker = null; }

    const detachInput = attachInput(engine, canvasRef.current, uiRef);
    const removeDebug = installDebugApi(engine, uiRef);

    return () => { cancelAnimationFrame(raf); if (worker) { try { worker.postMessage(0); worker.terminate(); } catch (e) { } } detachInput(); removeDebug(); };
  }, []);

  return { engineRef, hud };
}

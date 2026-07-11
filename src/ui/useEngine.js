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

    let raf, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.05) dt = 0.05;   // clamp long frames (tab was hidden etc.)
      if (engine.playing && !engine.paused && !engine.dead && !engine.pendingEvolve) engine.update(dt);
      engine.render();
    };
    raf = requestAnimationFrame(loop);

    const detachInput = attachInput(engine, canvasRef.current, uiRef);
    const removeDebug = installDebugApi(engine, uiRef);

    return () => { cancelAnimationFrame(raf); detachInput(); removeDebug(); };
  }, []);

  return { engineRef, hud };
}

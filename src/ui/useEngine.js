/* Owns the engine's lifecycle: creates it against the canvas, runs the
   requestAnimationFrame loop (sim steps gated by game state, render always),
   wires global input and the window.__game debug API. */
import { useState, useRef, useLayoutEffect } from './react.js';
import { Engine } from '../engine/Engine.js';
import { attachInput } from './input.js';
import { installDebugApi } from './debug.js';

const SIM_HZ = 60;
const HOST_BACKGROUND_HZ = 20;
const DEFAULT_RENDER_HZ = 60;
const MENU_RENDER_HZ = 30;

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
    const canStep = () => engine.playing && !engine.paused && !engine.dead && !engine.pendingEvolve;

    /* Simulation should cost the same on 60 Hz and high-refresh displays. */
    const simStep = 1 / SIM_HZ;
    let raf, last = performance.now(), simAcc = 0, lastRender = 0, interpolating = false;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const elapsed = Math.min((now - last) / 1000, 0.1); last = now;
      const requestedRate = Number.isFinite(uiRef.current.frameRate) ? uiRef.current.frameRate : DEFAULT_RENDER_HZ;
      const wantsInterpolation = engine.playing && (requestedRate === 0 || requestedRate > SIM_HZ);
      if (wantsInterpolation && !interpolating) engine.captureRenderState();
      interpolating = wantsInterpolation;
      if (!document.hidden && canStep()) {
        simAcc = Math.min(simAcc + elapsed, simStep * 4);
        let steps = 0;
        while (simAcc >= simStep && steps < 4) {
          if (interpolating) engine.captureRenderState();
          stepEngine(simStep); simAcc -= simStep; steps++;
        }
      } else simAcc = 0;

      const renderHz = engine.playing ? requestedRate : MENU_RENDER_HZ;
      const renderEvery = renderHz > 0 ? 1000 / renderHz : 0;
      if (!document.hidden && (!renderEvery || now - lastRender >= renderEvery - 1)) {
        engine.render(interpolating && canStep() ? simAcc / simStep : 1);
        lastRender = renderEvery ? now - ((now - lastRender) % renderEvery) : now;
      }
    };
    raf = requestAnimationFrame(loop);

    /* A multiplayer host must keep simulating even if its tab is backgrounded —
       browsers pause rAF and clamp timers in hidden tabs, but a Worker's timer
       keeps firing. This "metronome" worker drives the MP sim ONLY while the tab
       is hidden; when visible, the rAF loop above handles it (no double-step). */
    let worker = null, workerRunning = false, mpLast = performance.now();
    const ensureWorker = () => {
      if (worker) return worker;
      try {
        const interval = Math.round(1000 / HOST_BACKGROUND_HZ);
        const src = `let h=null;onmessage=e=>{if(e.data===1){if(!h)h=setInterval(()=>postMessage(1),${interval})}else{clearInterval(h);h=null}}`;
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url); URL.revokeObjectURL(url);
        worker.onmessage = stepHidden;
      } catch (e) { worker = null; }
      return worker;
    };
    const stepHidden = () => {
      if (!document.hidden || !engine.mp || engine.mp.role !== 'host' || !canStep()) return;
      const now = performance.now(); let dt = (now - mpLast) / 1000; mpLast = now;
      if (dt > 0.1) dt = 0.1;
      stepEngine(dt);
    };
    const syncBackgroundLoop = () => {
      engine.setBackgrounded(document.hidden);
      const shouldRun = document.hidden && engine.mp && engine.mp.role === 'host' && engine.remotePlayers.length > 0 && canStep();
      if (shouldRun && !workerRunning) {
        const w = ensureWorker();
        if (w) { mpLast = performance.now(); w.postMessage(1); workerRunning = true; }
      } else if (!shouldRun && workerRunning) {
        try { worker.postMessage(0); } catch (e) { }
        workerRunning = false;
      }
      if (!document.hidden) { last = performance.now(); simAcc = 0; engine.captureRenderState(); }
    };
    engine.onScheduleChange = syncBackgroundLoop;
    document.addEventListener('visibilitychange', syncBackgroundLoop);

    const detachInput = attachInput(engine, canvasRef.current, uiRef);
    const removeDebug = installDebugApi(engine, uiRef);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', syncBackgroundLoop);
      engine.onScheduleChange = null;
      if (worker) { try { worker.postMessage(0); worker.terminate(); } catch (e) { } }
      detachInput(); removeDebug();
    };
  }, []);

  return { engineRef, hud };
}

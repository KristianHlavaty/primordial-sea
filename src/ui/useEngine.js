/* React lifecycle adapter for the runtime composition root. Timing, input,
   rendering, audio and component mirroring live in GameRuntime. */
import { useState, useRef, useLayoutEffect } from './react.js';
import { GameRuntime } from '../runtime/GameRuntime.js';
import { installDebugApi } from './debug.js';

export function useEngine(canvasRef, uiRef) {
  const runtimeRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);

  useLayoutEffect(() => {
    const runtime = new GameRuntime(canvasRef.current, {
      uiRef,
      onHud: setHud,
      getRenderRate: () => uiRef.current.frameRate,
    });
    runtimeRef.current = runtime;
    engineRef.current = runtime.engine;
    const removeDebug = installDebugApi(runtime, uiRef);

    return () => {
      removeDebug(); runtime.destroy();
      runtimeRef.current = null; engineRef.current = null;
    };
  }, []);

  return { runtimeRef, engineRef, hud };
}

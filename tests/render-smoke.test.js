import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { MAPS } from '../src/data/maps.js';

let seed = 0x51f15e;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };

try {
  const mode = 'pixi';
  const runtime = new GameRuntime(document.getElementById('game'), { rendererMode: mode, autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  runtime.startRun({ fantasyEvolution: true, items: true, funItems: true, cheats: true });
  const requestedMap = new URLSearchParams(location.search).get('map');
  if (requestedMap && MAPS[requestedMap]) runtime.engine.loadMap(requestedMap);
  for (let i = 0; i < 30; i++) runtime.step(1 / 60);
  runtime.capturePresentation(); runtime.render(1);
  window.__renderRuntime = runtime;
  document.body.dataset.tests = 'pass'; document.body.dataset.renderer = mode;
  document.title = `PASS - renderer smoke (${mode})`;
} catch (error) {
  const failure = document.createElement('pre'); failure.textContent = error.stack || String(error); failure.style.color = '#fff';
  document.body.appendChild(failure); document.body.dataset.tests = 'fail'; document.title = 'FAIL - renderer smoke';
}

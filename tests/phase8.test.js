import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { GameEvents } from '../src/engine/events.js';
import { MAPS } from '../src/data/maps.js';
import { spawnRandomNpc } from '../src/engine/systems/spawning.js';
import { createLobby } from '../src/net/lobby.js';
import {
  getPixiDomOverlay, pixiDomOverlayStats,
} from '../src/render/pixi/PixiDomOverlay.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`);
  }
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, message, timeout = 6000) => {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const result = check();
    if (result) return result;
    await wait(25);
  }
  throw new Error(message);
};

function trackListeners(targets) {
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const records = [];
  const captureOf = options => typeof options === 'boolean' ? options : !!options?.capture;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    add.call(this, type, listener, options);
    if (!targets.has(this) || !listener) return;
    const capture = captureOf(options);
    if (!records.some(record => record.active && record.target === this && record.type === type
      && record.listener === listener && record.capture === capture)) {
      records.push({ target: this, type, listener, capture, active: true });
    }
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    remove.call(this, type, listener, options);
    const capture = captureOf(options);
    const record = records.find(candidate => candidate.active && candidate.target === this
      && candidate.type === type && candidate.listener === listener && candidate.capture === capture);
    if (record) record.active = false;
  };
  return {
    remaining: () => records.filter(record => record.active).map(record => record.type),
    restore() {
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
    },
  };
}

const makeCanvas = () => {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { width: '640px', height: '360px' });
  document.body.appendChild(canvas);
  return canvas;
};

test('restart, every map, multiplayer leave, resize, and teardown release runtime ownership', async () => {
  const canvas = makeCanvas();
  const listenerTracker = trackListeners(new Set([window, document, canvas]));
  const uiRef = { current: { inputBlocked: false } };
  let runtime;
  try {
    runtime = new GameRuntime(canvas, { uiRef, autoStartClock: true });
    await runtime.ready;
    assert(runtime.clock.stats().running, 'Runtime clock did not start');
    runtime.resize(640, 360, 3);

    for (let restart = 0; restart < 3; restart++) {
      runtime.startRun({ items: restart % 2 === 0, funItems: true, cheats: true });
      runtime.step(1 / 60);
    }
    for (const mapId of Object.keys(MAPS)) {
      runtime.engine.loadMap(mapId);
      runtime.componentRegistry.sync(runtime.engine);
      runtime.step(1 / 60);
      assert(runtime.engine.mapId === mapId, `Failed to exercise ${mapId}`);
    }
    const lobby = { raw() {}, rawTransient() {} };
    runtime.startMpHost({
      room: { map: 'sea_shallows', tier: 0, era: 0, fantasy: false, evolution: true, bosses: false, mapTransitions: true, items: false },
      profile: { name: 'Host', color: '#8affd0' }, lobby, selfConn: 1,
      roster: { 1: { species: 'protocell', name: 'Host' }, 2: { species: 'protocell', name: 'Remote' } },
    });
    runtime.step(1 / 60);
    runtime.returnToMenu();
    runtime.componentRegistry.sync(runtime.engine);
    equal([runtime.engine.mp, runtime.network.transport, runtime.engine.remotePlayers.length], [null, null, 0], 'Multiplayer leave retained session state');

    runtime.clock.ensureWorker();
    assert(runtime.events.totalListenerCount() > 0, 'Runtime did not own any subscribers before teardown');
    runtime.destroy();
    equal(runtime.componentWorld.stats(), { entities: 0, componentTypes: 0, components: 0, systems: 0, pending: 0 });
    equal(runtime.clock.stats(), {
      running: false, animationFrameScheduled: false, backgroundWorker: false,
      backgroundWorkerRunning: false, scheduleSubscribed: false,
    });
    assert(runtime.events.totalListenerCount() === 0, 'Event subscribers survived runtime teardown');
    assert(runtime.componentRegistry.size() === 0, 'Entity registry survived runtime teardown');
    assert(runtime.rendererDestroyed && !runtime.rendererReady && !runtime.renderer.app && !runtime.renderer.context, 'Pixi resources survived runtime teardown');
    assert(runtime.audio.destroyed && runtime.audio.ac === null && runtime.audio.timers.size === 0, 'Audio resources survived runtime teardown');
    assert(runtime.detachInput === null && runtime.lastFrame === null, 'Input or presentation ownership survived runtime teardown');
    const remaining = listenerTracker.remaining();
    assert(remaining.length === 0, `Browser listeners survived runtime teardown: ${remaining.join(', ')}`);
  } finally {
    runtime?.destroy();
    listenerTracker.restore();
    canvas.remove();
  }
});

test('renderer initialization failure is reported and cleaned exactly once', async () => {
  const canvas = makeCanvas();
  const failure = new Error('synthetic renderer failure');
  let destroyCalls = 0;
  const renderer = {
    mode: 'pixi',
    async init() { throw failure; },
    resize() {},
    render() {},
    destroy() { destroyCalls++; },
    stats() { return {}; },
  };
  const runtime = new GameRuntime(canvas, {
    autoStartClock: false,
    attachInputHandlers: false,
    rendererFactory: () => renderer,
  });
  const errors = [];
  runtime.events.subscribe(GameEvents.RUNTIME_ERROR, payload => errors.push(payload));
  let rejected = null;
  try { await runtime.ready; } catch (error) { rejected = error; }
  assert(rejected === failure, 'Renderer startup did not reject with the original failure');
  assert(errors.length === 1 && errors[0].error === failure, 'Renderer failure did not reach the runtime error stream');
  runtime.destroy();
  assert(destroyCalls === 1, `Failed renderer was destroyed ${destroyCalls} times`);
  assert(runtime.events.totalListenerCount() === 0 && runtime.componentWorld.stats().entities === 0, 'Failed startup retained runtime state');
  canvas.remove();
});

test('static and animated DOM overlays stop scheduling and auto-destroy after unmount', async () => {
  const element = document.createElement('div');
  Object.assign(element.style, { position: 'fixed', left: '0', top: '0', width: '48px', height: '48px' });
  document.body.appendChild(element);

  const staticOverlay = await getPixiDomOverlay({ key: 'phase8-static', zIndex: -1 });
  const unregisterStatic = staticOverlay.register(element, ctx => {
    ctx.fillStyle = '#8affd0'; ctx.fillRect(0, 0, 48, 48);
  });
  staticOverlay.render(performance.now());
  assert(!staticOverlay.stats().animationFrameScheduled, 'Static overlay kept a continuous animation frame');
  unregisterStatic();
  await wait(0);
  assert(staticOverlay.destroyed && !pixiDomOverlayStats().some(entry => entry.key === 'phase8-static'), 'Static overlay survived its final unmount');

  const animatedOverlay = await getPixiDomOverlay({ key: 'phase8-animated', zIndex: -1 });
  const unregisterAnimated = animatedOverlay.register(element, ctx => {
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(0, 0, 48, 48);
  }, { animated: true });
  animatedOverlay.render(performance.now());
  assert(animatedOverlay.stats().animationFrameScheduled, 'Animated overlay did not schedule its next frame');
  unregisterAnimated();
  await wait(0);
  assert(animatedOverlay.destroyed && !animatedOverlay.stats().animationFrameScheduled, 'Animated overlay retained its frame after unmount');
  element.remove();
});

test('lobby close detaches WebSocket callbacks and suppresses post-unmount state', async () => {
  const NativeWebSocket = window.WebSocket;
  const sockets = [];
  class FakeWebSocket {
    constructor() {
      this.readyState = 0; this.bufferedAmount = 0; this.closed = false;
      this.onopen = this.onclose = this.onerror = this.onmessage = null;
      sockets.push(this);
    }
    send() {}
    close() { this.closed = true; }
  }
  window.WebSocket = FakeWebSocket;
  const updates = [];
  try {
    const lobby = createLobby({ id: 'test', name: 'Test', color: '#fff' }, state => updates.push(state), () => updates.push('relay'));
    lobby.close();
    await wait(0);
    const socket = sockets[0];
    assert(socket.closed, 'Lobby did not close its WebSocket');
    assert(!socket.onopen && !socket.onclose && !socket.onerror && !socket.onmessage, 'Lobby retained WebSocket callbacks');
    assert(updates.length === 0, `Lobby published state after close: ${JSON.stringify(updates)}`);
  } finally {
    window.WebSocket = NativeWebSocket;
  }
});

const poolFingerprint = stats => ({
  gradients: stats.gradients,
  layers: Object.fromEntries(Object.entries(stats.layers).map(([name, layer]) => [
    name, { graphics: layer.graphics, pooledTexts: layer.pooledTexts, clips: layer.clips },
  ])),
});

test('long populated simulation and repeated rendering remain bounded at their high-water marks', async () => {
  const canvas = makeCanvas();
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  try {
    await runtime.ready;
    runtime.resize(960, 540, 2);
    runtime.startRun({ items: false, cheats: true });
    runtime.engine.invincible = true;
    runtime.engine.spawnT = 999;
    const parameters = new URLSearchParams(location.search);
    const population = Number(parameters.get('population')) || 24;
    const simulationFrames = Number(parameters.get('frames')) || 600;
    const repeatedRenders = Number(parameters.get('renders')) || 1;
    for (let index = 0; index < population; index++) spawnRandomNpc(runtime.engine);
    runtime.componentRegistry.sync(runtime.engine);

    for (let frame = 0; frame < simulationFrames; frame++) {
      runtime.step(1 / 60);
      if (frame === 0) runtime.render();
      if (frame % 240 === 239) await wait(0);
    }
    runtime.render();
    const world = runtime.componentWorld.stats();
    assert(world.entities === runtime.componentRegistry.size() + 1, `Component/source ownership diverged: ${JSON.stringify(world)}`);
    assert(world.entities < 1000 && world.components < 30000, `Simulation state grew without a bound: ${JSON.stringify(world)}`);

    runtime.engine.creatures.length = 0;
    runtime.engine.particles.length = 0;
    runtime.engine.fx.length = 0;
    runtime.engine.floaters.length = 0;
    runtime.componentRegistry.sync(runtime.engine);
    runtime.render();
    const first = poolFingerprint(runtime.renderer.stats());
    for (let frame = 0; frame < repeatedRenders; frame++) runtime.render();
    const second = poolFingerprint(runtime.renderer.stats());
    equal(second, first, 'Pixi pools or gradient caches grew while rendering an unchanged population');
  } finally {
    runtime.destroy();
    canvas.remove();
  }
});

test('Model Lab page teardown removes observers, animation frames, listeners, and Pixi canvases', async () => {
  const iframe = document.getElementById('modelLabFixture');
  iframe.src = '../model-lab.html';
  const lab = await waitFor(() => iframe.contentWindow?.__modelLab, 'Model Lab did not initialize');
  await waitFor(() => iframe.contentDocument?.body?.dataset.ready === 'true', 'Model Lab did not become ready');
  const doc = iframe.contentDocument;
  assert(doc.querySelectorAll('canvas').length === 2, 'Model Lab did not own its two shared Pixi canvases');
  lab.destroy();
  await wait(0);
  assert(doc.body.dataset.ready === 'destroyed', 'Model Lab did not expose its teardown state');
  assert(doc.querySelectorAll('canvas').length === 0, 'Model Lab retained Pixi canvases after teardown');
  assert(lab.overlay.destroyed && lab.mainOverlay.destroyed && lab.overlay.views.size === 0 && lab.mainOverlay.views.size === 0,
    'Model Lab retained overlay views after teardown');
});

const results = document.getElementById('results');
let passed = 0;
const selection = new URLSearchParams(location.search);
const only = Number(selection.get('only'));
const from = Math.max(1, Number(selection.get('from')) || 1);
const to = Math.min(tests.length, Number(selection.get('to')) || tests.length);
const suite = document.body.dataset.suite;
const selectedTests = only > 0
  ? tests.slice(only - 1, only)
  : selection.has('from') || selection.has('to')
    ? tests.slice(from - 1, to)
    : suite === 'lifecycle' ? tests.slice(0, 4) : suite === 'soak' ? tests.slice(4) : tests;
for (const { name, run } of selectedTests) {
  try {
    await run(); passed++;
    results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`);
  } catch (error) {
    results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`);
  }
}
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${selectedTests.length} passed`);
document.title = passed === selectedTests.length ? 'PASS - Phase 8 hardening' : 'FAIL - Phase 8 hardening';
document.body.dataset.tests = passed === selectedTests.length ? 'pass' : 'fail';

import { EventBus } from '../src/core/EventBus.js';
import { ComponentWorld } from '../src/engine/components/ComponentWorld.js';
import { GameEvents } from '../src/engine/events.js';
import { PixiApplication } from '../src/render/pixi/PixiApplication.js';
import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { ComponentTypes } from '../src/engine/components/componentTypes.js';
import { ABILITIES, ABILITY_SETS, ACTIVE_TIMER } from '../src/data/abilities.js';
import { SPECIES } from '../src/data/species.js';
import { MAPS, OPPOSITE_EDGE, STAGES } from '../src/data/maps.js';
import { BOSSES, PERKS } from '../src/data/bosses.js';
import { ITEMS } from '../src/data/items.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { shade, withA } from '../src/core/color.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const equal = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`);
  }
};

test('EventBus uses priority then subscription order', () => {
  const bus = new EventBus(), calls = [];
  bus.subscribe('tick', () => calls.push('normal-a'));
  bus.subscribe('tick', () => calls.push('high'), { priority: 10 });
  bus.subscribe('tick', () => calls.push('normal-b'));
  equal(bus.emit('tick'), 3);
  equal(calls, ['high', 'normal-a', 'normal-b']);
});

test('Color helpers preserve functional colors when composing alpha', () => {
  const color = withA(shade('#173f49', -.2), .75);
  if (color.includes('NaN') || !color.startsWith('rgba(')) throw new Error(`Invalid composed color: ${color}`);
});

test('EventBus dispatches a snapshot and once is nested-safe', () => {
  const bus = new EventBus(), calls = [];
  let removeB;
  bus.once('tick', () => { calls.push('once'); bus.emit('tick'); }, { priority: 10 });
  bus.subscribe('tick', () => { calls.push('a'); removeB(); });
  removeB = bus.subscribe('tick', () => calls.push('b'));
  bus.emit('tick');
  equal(calls, ['once', 'a', 'b', 'a', 'b']);
  calls.length = 0; bus.emit('tick');
  equal(calls, ['a']);
});

test('EventBus reports listener failures without skipping peers', () => {
  const bus = new EventBus(), calls = [];
  bus.subscribe(GameEvents.RUNTIME_ERROR, event => calls.push(event.error.message));
  bus.subscribe('tick', () => { throw new Error('boom'); });
  bus.subscribe('tick', () => calls.push('peer'));
  bus.emit('tick');
  equal(calls, ['peer', 'boom']);
});

test('EventBus cleanup supports disposers and AbortSignal ownership', () => {
  const bus = new EventBus(), abort = new AbortController(), calls = [];
  const dispose = bus.subscribe('tick', () => calls.push('manual'));
  bus.subscribe('tick', () => calls.push('owned'), { signal: abort.signal });
  equal(bus.listenerCount('tick'), 2);
  equal(dispose(), true); equal(dispose(), false);
  abort.abort(); equal(bus.listenerCount('tick'), 0);
  bus.emit('tick'); equal(calls, []);
});

test('ComponentWorld stores components and returns stable queries', () => {
  const world = new ComponentWorld();
  const a = world.createEntity({ transform: { x: 1 }, health: { hp: 4 } });
  const b = world.createEntity({ transform: { x: 2 } });
  equal(world.query('transform'), [a, b]);
  equal(world.query('transform', 'health'), [a]);
  equal(world.requireComponent(a, 'health'), { hp: 4 });
  world.setComponent(a, 'health', { hp: 3 });
  equal(world.requireComponent(a, 'health'), { hp: 3 });
});

test('ComponentWorld defers structural changes until the system boundary', () => {
  const world = new ComponentWorld(), seen = [];
  const first = world.createEntity({ marker: { value: 1 } });
  world.addSystem(w => {
    seen.push(w.query('marker'));
    w.destroyEntity(first);
    w.createEntity({ marker: { value: 2 } });
    seen.push(w.query('marker'));
  });
  world.update(1 / 60);
  equal(seen, [[first], [first]]);
  equal(world.query('marker'), [first + 1]);
});

test('ComponentWorld runs systems in explicit stable order', () => {
  const world = new ComponentWorld(), calls = [];
  world.addSystem(() => calls.push('late'), { order: 20 });
  world.addSystem(() => calls.push('early-a'), { order: 10 });
  world.addSystem(() => calls.push('early-b'), { order: 10 });
  world.update(0);
  equal(calls, ['early-a', 'early-b', 'late']);
});

test('ComponentWorld publishes complete lifecycle facts', () => {
  const bus = new EventBus(), world = new ComponentWorld({ events: bus }), calls = [];
  for (const event of [GameEvents.WORLD_ENTITY_CREATED, GameEvents.WORLD_COMPONENT_ADDED,
    GameEvents.WORLD_COMPONENT_CHANGED, GameEvents.WORLD_COMPONENT_REMOVED, GameEvents.WORLD_ENTITY_DESTROYED]) {
    bus.subscribe(event, payload => calls.push([event, payload.type || null]));
  }
  const entity = world.createEntity({ transform: { x: 1 } });
  world.setComponent(entity, 'transform', { x: 2 });
  world.removeComponent(entity, 'transform'); world.destroyEntity(entity);
  equal(calls, [
    [GameEvents.WORLD_ENTITY_CREATED, null],
    [GameEvents.WORLD_COMPONENT_ADDED, 'transform'],
    [GameEvents.WORLD_COMPONENT_CHANGED, 'transform'],
    [GameEvents.WORLD_COMPONENT_REMOVED, 'transform'],
    [GameEvents.WORLD_ENTITY_DESTROYED, null],
  ]);
});

test('PixiApplication initializes the planned scene layers without owning a clock', async () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const bus = new EventBus(), lifecycle = [];
  bus.subscribe(GameEvents.RENDERER_READY, () => lifecycle.push('ready'));
  bus.subscribe(GameEvents.RENDERER_RESIZED, () => lifecycle.push('resized'));
  bus.subscribe(GameEvents.RENDERER_DESTROYED, () => lifecycle.push('destroyed'));
  const renderer = new PixiApplication(canvas, { events: bus });
  await renderer.init({ width: 64, height: 64, resolution: 1 });
  equal(Object.keys(renderer.layers), ['background', 'worldRoot', 'terrain', 'fields', 'pickups', 'vehicles', 'actors', 'actorOverlays', 'particles', 'screenFx']);
  equal([canvas.style.width, canvas.style.height], ['', '']);
  renderer.resize(80, 72, 1); renderer.render(); renderer.destroy(); canvas.remove();
  equal(lifecycle, ['ready', 'resized', 'destroyed']);
});

test('GameRuntime keeps the legacy simulation playable behind runtime boundaries', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready;
  const engine = runtime.engine, seen = { hud: 0, map: 0, resize: 0 };
  runtime.events.subscribe(GameEvents.UI_HUD_UPDATED, () => seen.hud++);
  runtime.events.subscribe(GameEvents.WORLD_MAP_CHANGED, () => seen.map++);
  runtime.events.subscribe(GameEvents.RUNTIME_RESIZED, () => seen.resize++);
  runtime.resize(640, 360, 1);
  runtime.startRun({ fantasyEvolution: true, items: false });
  for (let i = 0; i < 6; i++) runtime.step(1 / 60);
  const frame = runtime.render();
  equal([engine.playing, engine.mapId, engine.stage], [true, 'sea_shallows', 'sea']);
  equal([frame.presentationFrame, frame.vw, frame.vh], [true, 640, 360]);
  if (!engine.player || seen.hud < 1 || seen.map !== 1 || seen.resize !== 1) throw new Error(`Missing runtime state/events: ${JSON.stringify(seen)}`);
  runtime.returnToMenu(); runtime.destroy(); canvas.remove();
});

test('GameRuntime advances ordered component systems at the fixed-step boundary', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false });
  const calls = [];
  runtime.componentWorld.addSystem((world, dt, context) => {
    calls.push(['early', dt, context.runtime === runtime, world.query(ComponentTypes.TRANSFORM).length > 0]);
  }, { order: 10 });
  runtime.componentWorld.addSystem(() => calls.push(['late']), { order: 20 });
  runtime.step(1 / 60);
  equal(calls, [['early', 1 / 60, true, true], ['late']]);
  runtime.destroy(); canvas.remove();
});

test('Presentation interpolation never mutates authoritative entities', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false });
  const player = runtime.engine.player;
  player.x = 100; player.angle = Math.PI - 0.1; runtime.capturePresentation();
  player.x = 140; player.angle = -Math.PI + 0.1;
  const frame = runtime.render(0.5);
  equal([player.x, frame.player.x], [140, 120]);
  if (Math.abs(Math.abs(frame.player.angle) - Math.PI) > 0.001) throw new Error('Angle did not interpolate across the shortest arc');
  if (!Object.isFrozen(frame) || !Object.isFrozen(frame.player)) throw new Error('Presentation frame is not read-only');
  if (frame.player.plan === player.plan || frame.player.species === player.species || frame.player.items === player.items) {
    throw new Error('Presentation frame retained nested authoritative references');
  }
  if (!Object.isFrozen(frame.player.plan) || !Object.isFrozen(frame.player.species) || !Object.isFrozen(frame.player.items)) {
    throw new Error('Nested presentation data is not read-only');
  }
  runtime.destroy(); canvas.remove();
});

test('LegacyComponentMirror exposes stable presentation components', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false }); runtime.render();
  const player = runtime.engine.player, entity = runtime.componentMirror.entityFor(player);
  if (!entity) throw new Error('Player was not mirrored');
  player.x += 25; runtime.render();
  equal(runtime.componentMirror.entityFor(player), entity);
  equal(runtime.componentWorld.getComponent(entity, ComponentTypes.TRANSFORM).x, player.x);
  const renderable = runtime.componentWorld.getComponent(entity, ComponentTypes.RENDERABLE);
  if (renderable.plan === player.plan || !Object.isFrozen(renderable.plan)) throw new Error('Mirror leaked the authoritative render plan');
  runtime.componentWorld.destroyEntity(entity); runtime.render();
  const replacement = runtime.componentMirror.entityFor(player);
  if (replacement === entity || !runtime.componentWorld.hasEntity(replacement)) throw new Error('Mirror did not recover an externally destroyed entity');
  const particle = { x: 2, y: 3, vx: 0, vy: 0, life: 1, max: 1, size: 2, color: '#fff' };
  runtime.engine.particles.push(particle); runtime.render();
  const particleEntity = runtime.componentMirror.entityFor(particle);
  runtime.engine.particles.splice(runtime.engine.particles.indexOf(particle), 1); runtime.render();
  equal(runtime.componentWorld.hasEntity(particleEntity), false);
  runtime.destroy(); canvas.remove();
});

test('Multiplayer client map changes publish the same map boundary event', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready;
  runtime.startMpClient({
    room: { map: 'sea_shallows', tier: 0, era: 0, fantasy: false, evolution: true, bosses: true, mapTransitions: true, items: true },
    profile: { name: 'Client', color: '#8affd0' }, lobby: null,
    selfConn: 2, hostConn: 1, roster: { 2: { species: 'protocell' } },
  });
  const changes = [];
  runtime.events.subscribe(GameEvents.WORLD_MAP_CHANGED, event => changes.push(event));
  runtime.receiveNetworkPacket(1, {
    k: 'W', map: 'starless_bloom', W: MAPS.starless_bloom.W, H: MAPS.starless_bloom.H,
    theme: MAPS.starless_bloom.theme, era: 1, obstacles: [], plants: [], webs: [],
  });
  equal([runtime.engine.mapId, changes.length, changes[0]?.previousMapId, changes[0]?.mapId], ['starless_bloom', 1, 'sea_shallows', 'starless_bloom']);
  runtime.destroy(); canvas.remove();
});

test('Input, audio and network ingress are subscriber commands', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready;
  runtime.events.emit(GameEvents.INPUT_POINTER_MOVED, { x: 12, y: 34 });
  runtime.events.emit(GameEvents.INPUT_MOVE_CHANGED, { direction: 'left', pressed: true });
  runtime.events.emit(GameEvents.INPUT_BITE_CHANGED, { pressed: true });
  runtime.events.emit(GameEvents.INPUT_MUTE_REQUESTED);
  equal([runtime.engine.mouse.x, runtime.engine.mouse.y, runtime.engine.keys.left, runtime.engine.biteHeld, runtime.audio.muted], [12, 34, true, true, true]);
  let packet = null; runtime.engine.onNetPacket = (from, data) => { packet = { from, data }; };
  runtime.receiveNetworkPacket(7, { type: 'test' });
  equal(packet, { from: 7, data: { type: 'test' } });
  runtime.destroy(); canvas.remove();
});

test('GameRuntime can explicitly select the Pixi parity renderer', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { rendererMode: 'pixi', autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.resize(640, 360, 1); runtime.startRun({ items: true, funItems: true });
  runtime.step(1 / 60); runtime.render();
  equal([runtime.rendererMode, runtime.renderer.mode, runtime.rendererReady], ['pixi', 'pixi', true]);
  const resources = runtime.renderer.stats();
  if (resources.fills < 20 || resources.strokes < 20) throw new Error(`Pixi did not render a populated gameplay frame: ${JSON.stringify(resources)}`);
  runtime.destroy(); canvas.remove();
});

test('Data catalogs have complete cross-references', () => {
  const failures = [];
  for (const [id, species] of Object.entries(SPECIES)) {
    if (!ABILITY_SETS[id]) failures.push(`species ${id} has no ability set`);
    for (const target of species.evolvesTo || []) if (!SPECIES[target]) failures.push(`species ${id} evolves to missing ${target}`);
  }
  for (const [id, abilities] of Object.entries(ABILITY_SETS)) {
    if (!SPECIES[id]) failures.push(`ability set belongs to missing species ${id}`);
    for (const ability of abilities) if (!ABILITIES[ability]) failures.push(`${id} uses missing ability ${ability}`);
  }
  for (const ability of Object.keys(ACTIVE_TIMER)) if (!ABILITIES[ability]) failures.push(`timer belongs to missing ability ${ability}`);
  for (const [id, map] of Object.entries(MAPS)) {
    if (!STAGES[map.stage]) failures.push(`map ${id} uses missing stage ${map.stage}`);
    for (const boss of map.bosses || []) if (!BOSSES[boss]) failures.push(`map ${id} uses missing boss ${boss}`);
    for (const [edge, neighbor] of Object.entries(map.neighbors || {})) {
      if (!MAPS[neighbor]) failures.push(`map ${id} points to missing neighbor ${neighbor}`);
      else if (MAPS[neighbor].neighbors?.[OPPOSITE_EDGE[edge]] !== id) failures.push(`map edge ${id}.${edge} is not reciprocal`);
    }
  }
  for (const [id, boss] of Object.entries(BOSSES)) if (!PERKS[boss.perk]) failures.push(`boss ${id} uses missing perk ${boss.perk}`);
  for (const [id, vehicle] of Object.entries(VEHICLES)) if (!ITEMS[vehicle.projectile]) failures.push(`vehicle ${id} uses missing projectile ${vehicle.projectile}`);
  equal(failures, []);
});

const results = document.getElementById('results');
let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed++; results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`); }
  catch (error) { results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`); }
}
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${tests.length} passed`);
document.title = passed === tests.length ? 'PASS - core tests' : 'FAIL - core tests';
document.body.dataset.tests = passed === tests.length ? 'pass' : 'fail';

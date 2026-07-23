import { EventBus } from '../src/core/EventBus.js';
import { ComponentWorld } from '../src/engine/components/ComponentWorld.js';
import { GameEvents } from '../src/engine/events.js';
import { PixiApplication } from '../src/render/pixi/PixiApplication.js';
import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { ComponentTypes } from '../src/engine/components/componentTypes.js';
import { CoreSystemPhases } from '../src/engine/systems/CoreComponentSystems.js';
import { ABILITIES, ABILITY_SETS, ACTIVE_TIMER } from '../src/data/abilities.js';
import { SPECIES } from '../src/data/species.js';
import { EDGE_DWELL_TIME, MAPS, OPPOSITE_EDGE, STAGES } from '../src/data/maps.js';
import { xpNeed } from '../src/data/progression.js';
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

test('ComponentWorld isolates explicitly ordered simulation phases', () => {
  const world = new ComponentWorld(), calls = [];
  world.addSystem(() => calls.push('main'), { order: 10 });
  world.addSystem(() => calls.push('environment-late'), { phase: 'environment', order: 20 });
  world.addSystem(() => calls.push('environment-early'), { phase: 'environment', order: 5 });
  world.update(0); world.updatePhase('environment', 0);
  equal(calls, ['main', 'environment-early', 'environment-late']);
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

test('GameRuntime keeps the source-object simulation playable behind runtime boundaries', async () => {
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

test('Phase 4 command streams produce deterministic component motion', async () => {
  const runScenario = async () => {
    const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
    const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
    await runtime.ready; runtime.startRun({ items: false }); runtime.render();
    const engine = runtime.engine;
    engine.stage = 'devonian'; engine.creatures.length = 0; engine.plants.length = 0; engine.food.length = 0;
    engine.obstacles.length = 0; engine.spawnT = 999; engine.player.x = 1000; engine.player.y = 800;
    engine.player.vx = 0; engine.player.vy = 0; engine.player.angle = 0; engine.player.faceTarget = 0;
    engine.releaseInput(); engine.setKey('right', true);
    for (let i = 0; i < 60; i++) runtime.step(1 / 60);
    const entity = runtime.componentRegistry.entityFor(engine.player);
    const transform = runtime.componentWorld.requireComponent(entity, ComponentTypes.TRANSFORM);
    const motion = runtime.componentWorld.requireComponent(entity, ComponentTypes.MOTION);
    const previous = runtime.componentWorld.requireComponent(entity, ComponentTypes.PREVIOUS_TRANSFORM);
    const result = [transform.x, transform.y, motion.vx, motion.vy, transform.angle, previous.x]
      .map(value => Math.round(value * 1000) / 1000);
    equal([engine.player.x, engine.player.y, engine.player.vx], [transform.x, transform.y, motion.vx]);
    runtime.destroy(); canvas.remove(); return result;
  };
  const first = await runScenario(), second = await runScenario();
  equal(first, second);
  if (first[0] <= 1000 || first[2] <= 0 || first[5] >= first[0]) throw new Error(`Invalid movement fixture: ${JSON.stringify(first)}`);
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

test('ComponentEntityRegistry exposes stable presentation components', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false }); runtime.render();
  const player = runtime.engine.player, entity = runtime.componentRegistry.entityFor(player);
  if (!entity) throw new Error('Player was not mirrored');
  player.x += 25; runtime.render();
  equal(runtime.componentRegistry.entityFor(player), entity);
  equal(runtime.componentWorld.getComponent(entity, ComponentTypes.TRANSFORM).x, player.x);
  const renderable = runtime.componentWorld.getComponent(entity, ComponentTypes.RENDERABLE);
  if (renderable.plan === player.plan || !Object.isFrozen(renderable.plan)) throw new Error('Mirror leaked the authoritative render plan');
  runtime.componentWorld.destroyEntity(entity); runtime.render();
  const replacement = runtime.componentRegistry.entityFor(player);
  if (replacement === entity || !runtime.componentWorld.hasEntity(replacement)) throw new Error('Mirror did not recover an externally destroyed entity');
  const particle = { x: 2, y: 3, vx: 0, vy: 0, life: 1, max: 1, size: 2, color: '#fff' };
  runtime.engine.particles.push(particle); runtime.render();
  const particleEntity = runtime.componentRegistry.entityFor(particle);
  runtime.engine.particles.splice(runtime.engine.particles.indexOf(particle), 1); runtime.render();
  equal(runtime.componentWorld.hasEntity(particleEntity), false);
  runtime.destroy(); canvas.remove();
});

test('Component records stay authoritative through source-object accessors', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false }); runtime.render();
  const player = runtime.engine.player, entity = runtime.componentRegistry.entityFor(player), world = runtime.componentWorld;
  const transform = world.requireComponent(entity, ComponentTypes.TRANSFORM);
  const motion = world.requireComponent(entity, ComponentTypes.MOTION);
  const collider = world.requireComponent(entity, ComponentTypes.COLLIDER);
  const health = world.requireComponent(entity, ComponentTypes.HEALTH);
  const experience = world.requireComponent(entity, ComponentTypes.EXPERIENCE);
  transform.x = 321; motion.vx = 47; collider.radius = 19; health.hp = 7; experience.xp = 5;
  equal([player.x, player.vx, player.radius, player.hp, player.xp], [321, 47, 19, 7, 5]);
  player.y = 654; player.vy = -23; player.maxHp = 81; player.level = 3;
  equal([transform.y, motion.vy, health.maxHp, experience.level], [654, -23, 81, 3]);
  const input = world.requireComponent(runtime.componentRegistry.inputEntity(), ComponentTypes.PLAYER_INPUT);
  input.pointer.x = 12; input.bite = true; input.keys.right = true;
  equal([runtime.engine.mouse.x, runtime.engine.biteHeld, runtime.engine.keys.right], [12, true, true]);
  const talents = world.requireComponent(runtime.componentRegistry.inputEntity(), ComponentTypes.TALENTS);
  const perks = world.requireComponent(runtime.componentRegistry.inputEntity(), ComponentTypes.PERKS);
  const evolution = world.requireComponent(runtime.componentRegistry.inputEntity(), ComponentTypes.EVOLUTION);
  if (talents.state !== runtime.engine.talent || talents.bonus !== runtime.engine.talentBonus || perks.state !== runtime.engine.perks) {
    throw new Error('Run progression projections are not component-owned');
  }
  evolution.era = 4; evolution.pending = true;
  equal([runtime.engine.era, runtime.engine.pendingEvolve], [4, true]);
  runtime.destroy(); canvas.remove();
});

test('Phase 4 systems own resources, lifetimes, progression and map crossing', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: false }); runtime.render();
  const engine = runtime.engine, systems = runtime.componentSystems;
  engine.player.x = 400; engine.player.y = 400; engine.player.xp = 0; engine.player.level = 1;
  const food = { x: 400, y: 400, vx: 0, vy: 0, value: 2, kind: 'meat', life: 1, r: 4 };
  const plant = { kind: 'algae', x: 500, y: 500, amount: 0, max: 2, value: 1, regen: .01, eatCd: .01 };
  const particle = { x: 2, y: 3, vx: 0, vy: 0, life: .01, max: .01, size: 2, color: '#fff' };
  engine.food.push(food); engine.plants.push(plant); engine.particles.push(particle); runtime.render();
  const foodEntity = runtime.componentRegistry.entityFor(food), particleEntity = runtime.componentRegistry.entityFor(particle);
  systems.run(CoreSystemPhases.RESOURCES, engine, .1);
  systems.run(CoreSystemPhases.LIFETIMES, engine, .1);
  equal([engine.food.includes(food), plant.amount, engine.particles.includes(particle)], [false, 1, false]);
  equal([runtime.componentWorld.hasEntity(foodEntity), runtime.componentWorld.hasEntity(particleEntity)], [false, false]);

  const facts = [];
  for (const event of [
    GameEvents.PROGRESSION_LEVEL_CHANGED, GameEvents.PROGRESSION_XP_CHANGED,
    GameEvents.PROGRESSION_EVOLUTION_OFFERED, GameEvents.PROGRESSION_EVOLUTION_CHOSEN,
    GameEvents.WORLD_ENTITY_DIED, GameEvents.WORLD_ENTITY_RESPAWNED,
  ]) runtime.events.subscribe(event, () => facts.push(event));
  engine.player.xp = 0; engine.player.level = 1;
  systems.addXp(engine.player, engine, xpNeed(1));
  equal(engine.player.level, 2);
  engine.triggerEvolve();
  const evolutionChoice = engine.choices[0]; engine.chooseEvolution(evolutionChoice); runtime.render();
  equal([engine.player.speciesId, engine.pendingEvolve], [evolutionChoice, false]);
  engine.singlePlayerDied(engine.player); engine.player.deadT = .01;
  systems.run(CoreSystemPhases.PRE_ACTORS, engine, .02);
  equal([engine.player.deadT, engine.player.hp > 0, engine.player.spawnProtT], [0, true, 2.5]);
  equal(facts, [
    GameEvents.PROGRESSION_LEVEL_CHANGED, GameEvents.PROGRESSION_XP_CHANGED,
    GameEvents.PROGRESSION_EVOLUTION_OFFERED, GameEvents.PROGRESSION_EVOLUTION_CHOSEN,
    GameEvents.WORLD_ENTITY_DIED, GameEvents.WORLD_ENTITY_RESPAWNED,
  ]);

  engine.loadMap('sea_shallows'); runtime.render();
  const gate = MAPS.sea_shallows.passages.right;
  engine.player.x = engine.W - engine.player.radius; engine.player.y = engine.H * gate.center;
  engine.transitionCd = 0; engine.edgeDwell = EDGE_DWELL_TIME;
  systems.run(CoreSystemPhases.MAP_CROSSING, engine, 0);
  equal(engine.mapId, 'fangwall_trench');
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

test('Multiplayer host actors retain component authority through a fixed step', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready;
  runtime.startMpHost({
    room: { map: 'sea_shallows', tier: 0, era: 0, fantasy: false, evolution: true, bosses: false, mapTransitions: true, items: false },
    profile: { name: 'Host', color: '#8affd0' }, lobby: null, selfConn: 1,
    roster: { 1: { species: 'protocell', name: 'Host' }, 2: { species: 'protocell', name: 'Remote' } },
  });
  runtime.receiveNetworkPacket(2, { k: 'I', tx: 1, ty: 0, m: true, b: false });
  runtime.step(1 / 60);
  const actors = [runtime.engine.player, runtime.engine.remotePlayers[0]];
  for (const actor of actors) {
    const entity = runtime.componentRegistry.entityFor(actor);
    const transform = runtime.componentWorld.requireComponent(entity, ComponentTypes.TRANSFORM);
    const motion = runtime.componentWorld.requireComponent(entity, ComponentTypes.MOTION);
    equal([actor.x, actor.y, actor.vx, actor.vy], [transform.x, transform.y, motion.vx, motion.vy]);
  }
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

test('GameRuntime initializes the Pixi world renderer', async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
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

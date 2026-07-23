import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { ComponentTypes as C } from '../src/engine/components/componentTypes.js';
import { GameEvents } from '../src/engine/events.js';
import { GameplaySystemPhases } from '../src/engine/systems/GameplayComponentSystems.js';
import { Creature } from '../src/engine/entities/Creature.js';
import { Boss } from '../src/engine/entities/Boss.js';
import { ABILITIES } from '../src/data/abilities.js';
import { ITEMS } from '../src/data/items.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { BOSSES } from '../src/data/bosses.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const equal = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`);
};
const makeRuntime = async () => {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready; runtime.startRun({ items: true, funItems: true, cheats: true });
  runtime.engine.creatures.length = 0; runtime.engine.plants.length = 0;
  runtime.engine.worldItems.length = 0; runtime.engine.itemProjectiles.length = 0;
  runtime.componentAdapter.sync(runtime.engine);
  return { runtime, engine: runtime.engine, player: runtime.engine.player, canvas };
};
const destroy = ({ runtime, canvas }) => { runtime.destroy(); canvas.remove(); };

test('Phase 5 combat state is component-authoritative and publishes facts', async () => {
  const fixture = await makeRuntime(), { runtime, engine, player } = fixture;
  const target = Creature.spawn('amoeba', player.x + player.radius + 12, player.y, 0);
  target.hp = target.maxHp = 500; engine.creatures.push(target); player.angle = 0;
  runtime.componentAdapter.sync(engine);
  const entity = runtime.componentAdapter.entityFor(player), world = runtime.componentWorld;
  const combat = world.requireComponent(entity, C.COMBAT), status = world.requireComponent(entity, C.STATUS);
  const shield = world.requireComponent(entity, C.SHIELD), loadout = world.requireComponent(entity, C.ABILITY_LOADOUT);
  const abilityState = world.requireComponent(entity, C.ABILITY_STATE), inventory = world.requireComponent(entity, C.INVENTORY);
  combat.cd = 0; status.stunT = .25; shield.shield = 18; loadout.abilities = ['burst'];
  abilityState.castAbility = 'burst'; inventory.items = [{ id: 'bone_club', uses: 2, cd: 0 }, null, null];
  equal([player.cd, player.stunT, player.shield, player.abilities[0], player.castAbility, player.items[0].id], [0, .25, 18, 'burst', 'burst', 'bone_club']);
  for (const component of [combat, status, shield, loadout, abilityState, inventory]) JSON.stringify(component);
  player.stunT = 0; player.abilities = ['engulf']; player.castAbility = null;

  const facts = [];
  for (const event of [GameEvents.COMBAT_BITE_STARTED, GameEvents.COMBAT_BITE_HIT, GameEvents.COMBAT_DAMAGED, GameEvents.COMBAT_STATUS_APPLIED, GameEvents.COMBAT_KILLED]) {
    runtime.events.subscribe(event, payload => facts.push([event, payload]));
  }
  player.bite(engine); player.resolveBite(engine);
  player.shield = 20; player.takeHit(engine, 7, target.x, target.y, target);
  runtime.componentSystems.applyStatus(engine, player, target, 'stunT', 1.25);
  runtime.componentSystems.prepare(engine); target.slowT = 2;
  runtime.componentSystems.run(GameplaySystemPhases.STATUS_FACTS, engine, 0);
  target.takeDamage(engine, 9999, player.x, player.y, true);
  const types = facts.map(([event]) => event);
  for (const expected of [GameEvents.COMBAT_BITE_STARTED, GameEvents.COMBAT_BITE_HIT, GameEvents.COMBAT_DAMAGED, GameEvents.COMBAT_STATUS_APPLIED, GameEvents.COMBAT_KILLED]) {
    if (!types.includes(expected)) throw new Error(`Missing combat fact ${expected}: ${JSON.stringify(types)}`);
  }
  equal([player.hp, player.shield, target.stunT, target.slowT, engine.creatures.includes(target)], [player.maxHp, 13, 1.25, 2, false]);
  destroy(fixture);
});

test('Every ability reaches the component-owned activation/runtime path', async () => {
  const fixture = await makeRuntime(), { runtime, engine, player } = fixture;
  const activated = [];
  const audio = [];
  runtime.events.subscribe(GameEvents.ABILITY_ACTIVATED, event => activated.push(event.ability));
  runtime.events.subscribe(GameEvents.AUDIO_PLAY_REQUESTED, event => audio.push(event.type));
  const active = [], passive = [];
  for (const [id, definition] of Object.entries(ABILITIES)) (definition.passive ? passive : active).push(id);
  for (const id of active) {
    runtime.componentSystems.respawnPlayer(player, engine);
    player.x = engine.W / 2; player.y = engine.H / 2; player.angle = 0;
    player.abilities = [id]; player.acd = {}; player.stunT = 0; player.deadT = 0;
    engine.dead = false; engine.paused = false; engine.pendingEvolve = false; engine.playing = true;
    const audioBefore = audio.length; runtime.componentSystems.activateAbility(engine, 0, player);
    if (!activated.includes(id)) throw new Error(`Active ability did not activate through the coordinator: ${id}`);
    if (audio.length <= audioBefore) throw new Error(`Active ability produced no audio fact: ${id}`);
    runtime.componentSystems.updateAbilityRuntime(engine, player, 1 / 60);
  }
  for (const id of passive) {
    player.abilities = [id];
    runtime.componentSystems.updateAbilityRuntime(engine, player, 1 / 60);
  }
  runtime.componentAdapter.sync(engine);
  const state = runtime.componentWorld.requireComponent(runtime.componentAdapter.entityFor(player), C.ABILITY_STATE);
  const loadout = runtime.componentWorld.requireComponent(runtime.componentAdapter.entityFor(player), C.ABILITY_LOADOUT);
  if (loadout.abilities !== player.abilities || state.acd !== player.acd) throw new Error('Ability state escaped component authority');
  equal(new Set(activated).size, active.length, 'Not every active ability produced a fact');
  equal(active.length + passive.length, Object.keys(ABILITIES).length);
  destroy(fixture);
});

test('Every item kind uses the inventory system and projectiles become components', async () => {
  const fixture = await makeRuntime(), { runtime, engine, player } = fixture;
  let used = 0; runtime.events.subscribe(GameEvents.ITEM_USED, () => used++);
  let audio = 0; runtime.events.subscribe(GameEvents.AUDIO_PLAY_REQUESTED, () => audio++);
  for (const [id, definition] of Object.entries(ITEMS)) {
    player.items = [{ id, uses: Math.max(1, definition.uses || 0), cd: 0 }, null, null];
    player.vehicle = null; player.vehicleType = null; player.deadT = 0;
    const audioBefore = audio;
    if (!runtime.componentSystems.useItem(engine, player, 0)) throw new Error(`Item did not use through coordinator: ${id}`);
    if (audio <= audioBefore) throw new Error(`Item produced no audio fact: ${id}`);
  }
  equal(used, Object.keys(ITEMS).length);
  runtime.componentAdapter.sync(engine);
  for (const projectile of engine.itemProjectiles) {
    const entity = runtime.componentAdapter.entityFor(projectile);
    if (!runtime.componentWorld.hasComponent(entity, C.PROJECTILE)) throw new Error(`Missing Projectile component for ${projectile.type}/${projectile.visual}`);
  }
  destroy(fixture);
});

test('Both vehicle catalogs enter, update, fire, take damage, exit and destroy through facts', async () => {
  const fixture = await makeRuntime(), { runtime, engine, player } = fixture;
  const facts = [];
  for (const event of [GameEvents.VEHICLE_ENTERED, GameEvents.VEHICLE_EXITED, GameEvents.VEHICLE_DAMAGED, GameEvents.VEHICLE_DESTROYED]) {
    runtime.events.subscribe(event, payload => facts.push([event, payload.vehicleType]));
  }
  let sequence = 1000;
  for (const [type, definition] of Object.entries(VEHICLES)) {
    const makeVehicle = () => ({
      netId: ++sequence, type, x: player.x, y: player.y, angle: 0, vx: 0, vy: 0,
      radius: definition.radius, hp: definition.hp, maxHp: definition.hp, weaponCd: 0,
      occupant: null, occupantConn: null, hurt: 0, shotSide: -1, timeLeft: definition.duration,
    });
    let vehicle = makeVehicle(); engine.vehicles = [vehicle]; runtime.componentAdapter.sync(engine);
    if (!runtime.componentSystems.toggleVehicle(engine, player)) throw new Error(`Could not enter ${type}`);
    engine.biteHeld = true; runtime.componentSystems.updatePilotedVehicle(engine, player, 1 / 60); engine.biteHeld = false;
    runtime.componentSystems.damageOccupiedVehicle(engine, player, 10);
    runtime.componentSystems.exitVehicle(engine, player);
    vehicle = makeVehicle(); engine.vehicles = [vehicle]; runtime.componentAdapter.sync(engine);
    runtime.componentSystems.toggleVehicle(engine, player);
    runtime.componentSystems.damageOccupiedVehicle(engine, player, definition.hp + 1);
  }
  const types = facts.map(([event]) => event);
  for (const event of [GameEvents.VEHICLE_ENTERED, GameEvents.VEHICLE_EXITED, GameEvents.VEHICLE_DAMAGED, GameEvents.VEHICLE_DESTROYED]) {
    if (types.filter(type => type === event).length < Object.keys(VEHICLES).length) throw new Error(`Vehicle fact coverage missing ${event}`);
  }
  runtime.componentAdapter.sync(engine);
  for (const vehicle of engine.vehicles) {
    const entity = runtime.componentAdapter.entityFor(vehicle);
    if (!runtime.componentWorld.hasComponent(entity, C.VEHICLE)) throw new Error(`Missing Vehicle component for ${vehicle.type}`);
  }
  destroy(fixture);
});

test('Every boss attack timeline starts and resolves through tagged boss components', async () => {
  const fixture = await makeRuntime(), { runtime, engine, player } = fixture;
  engine.invincible = true;
  const timelines = {
    bulwark: [['quake', 0], ['shellRush', 1]],
    render: [['charge', 0], ['tailFan', 1]],
    lumenara: [['radiantNova', 0], ['starMotes', 1], ['abyssBeam', 2]],
    panderodus: [['edgePass', 0], ['fangCharge', 1]],
    tidewarden: [['tidalSweep', 0], ['undertow', 1]],
    sovereign: [['stomp', 0], ['fissure', 1]],
    gilboa_matriarch: [['webBurst', 0], ['cocoon', 1]],
    marshqueen: [['mire', 0], ['tongueLash', 1]],
  };
  const started = [], resolved = [];
  let audio = 0; runtime.events.subscribe(GameEvents.AUDIO_PLAY_REQUESTED, () => audio++);
  runtime.events.subscribe(GameEvents.BOSS_TELEGRAPH_STARTED, event => started.push(`${event.boss}:${event.special}`));
  runtime.events.subscribe(GameEvents.BOSS_TELEGRAPH_RESOLVED, event => resolved.push(`${event.boss}:${event.special}`));
  for (const [kind, cases] of Object.entries(timelines)) {
    for (const [special, selector] of cases) {
      const boss = new Boss(kind, engine); engine.creatures = [boss];
      player.x = boss.x + Math.min(240, boss.sense * .35); player.y = boss.y; player.hp = player.maxHp;
      boss.specialCount = selector; boss.abilT = 0; boss.tailSlapCd = 99;
      runtime.componentAdapter.sync(engine); boss.update(engine, 0);
      equal(boss.telegraph?.special, special, `${kind} selected the wrong attack`);
      runtime.componentAdapter.sync(engine);
      const entity = runtime.componentAdapter.entityFor(boss);
      if (!runtime.componentWorld.hasComponent(entity, C.BOSS) || !runtime.componentWorld.hasComponent(entity, C.TELEGRAPH)) throw new Error(`${kind} lacks boss timeline components`);
      const audioBefore = audio; boss.telegraph.t = 0; boss.update(engine, 0);
      if (!resolved.includes(`${kind}:${special}`)) throw new Error(`${kind}:${special} did not resolve`);
      if (audio <= audioBefore && special !== 'fangCharge') throw new Error(`${kind}:${special} produced no audio fact`);
    }
  }
  const panderodus = new Boss('panderodus', engine); engine.creatures = [panderodus];
  player.x = panderodus.x + panderodus.radius + player.radius + 60; player.y = panderodus.y;
  panderodus.tailSlapCd = 0; panderodus.abilT = 99; runtime.componentAdapter.sync(engine); panderodus.update(engine, 0);
  equal(panderodus.telegraph?.special, 'panderTail'); panderodus.telegraph.t = 0; panderodus.update(engine, 0);
  for (const [kind, cases] of Object.entries(timelines)) for (const [special] of cases) {
    const key = `${kind}:${special}`;
    if (!started.includes(key) || !resolved.includes(key)) throw new Error(`Incomplete boss fixture ${key}`);
  }
  if (!started.includes('panderodus:panderTail') || !resolved.includes('panderodus:panderTail')) throw new Error('Panderodus tail fixture incomplete');
  equal(Object.keys(timelines).sort(), Object.keys(BOSSES).sort());
  destroy(fixture);
});

const results = document.getElementById('results');
let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed++; results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`); }
  catch (error) { results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`); }
}
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${tests.length} passed`);
document.title = passed === tests.length ? 'PASS - Phase 5 tests' : 'FAIL - Phase 5 tests';
document.body.dataset.tests = passed === tests.length ? 'pass' : 'fail';

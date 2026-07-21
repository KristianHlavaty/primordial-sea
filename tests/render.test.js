import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { drawCreature } from '../src/render/drawCreature.js';
import { drawItemIcon, drawItemProjectile } from '../src/render/drawItem.js';
import { drawVehicle } from '../src/render/drawVehicle.js';
import { SPECIES } from '../src/data/species.js';
import { NPCS } from '../src/data/npcs.js';
import { BOSSES } from '../src/data/bosses.js';
import { ITEMS } from '../src/data/items.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { MAPS } from '../src/data/maps.js';
import { ABILITIES, ACTIVE_TIMER } from '../src/data/abilities.js';
import { DUNKLEOSTEUS_VARIANTS } from '../src/data/dunkleosteusVariants.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const canvas = document.createElement('canvas');
canvas.width = 1024; canvas.height = 640; canvas.style.display = 'none'; document.body.appendChild(canvas);
const runtime = new GameRuntime(canvas, { rendererMode: 'pixi', autoStartClock: false, attachInputHandlers: false });
await runtime.ready; runtime.resize(1024, 640, 1);

test('all map themes and populated world layers render', () => {
  runtime.startRun({ fantasyEvolution: true, items: true, funItems: true, cheats: true });
  for (const mapId of Object.keys(MAPS)) {
    runtime.engine.loadMap(mapId);
    runtime.engine.cam.x = Math.max(0, runtime.engine.W * .5 - 512);
    runtime.engine.cam.y = Math.max(0, runtime.engine.H * .5 - 320);
    runtime.capturePresentation(); runtime.render();
  }
  const stats = runtime.renderer.stats();
  for (const layer of ['background', 'terrain', 'fields', 'pickups', 'vehicles', 'actors', 'actorOverlays', 'particles', 'screenFx']) {
    assert(stats.layers[layer], `Missing Pixi scene layer ${layer}`);
  }
  assert(stats.fills > 500 && stats.strokes > 200, `Map render coverage was unexpectedly low: ${JSON.stringify(stats)}`);
});

test('every procedural creature plan renders through native Pixi geometry', () => {
  const ctx = runtime.renderer.context;
  const plans = [
    ...Object.values(SPECIES).map(value => value.plan),
    ...Object.values(NPCS).map(value => value.plan),
    ...Object.values(BOSSES).map(value => value.plan),
    ...DUNKLEOSTEUS_VARIANTS.map(value => value.plan),
  ];
  const before = ctx.stats(); ctx.beginFrame('actors');
  plans.forEach((plan, index) => {
    ctx.save(); ctx.translate(40 + index % 16 * 62, 42 + Math.floor(index / 16) * 70);
    drawCreature(ctx, { ...plan, t: 1.7 + index * .03, mouth: .55, hurt: index % 5 ? 0 : .35 });
    ctx.restore();
  });
  ctx.endFrame(); runtime.renderer.app.render();
  const after = ctx.stats();
  assert(after.fills - before.fills > plans.length * 2, `Not all ${plans.length} creature plans produced geometry`);
  assert(after.imagesSkipped === 0, 'Pixi creature rendering fell back to Canvas bitmap layers');
  assert(after.clipsApplied - before.clipsApplied > 0 && after.clipsSkipped === 0, 'Pixi skipped a creature clipping path');
});

test('every item icon, projectile phase and vehicle renders', () => {
  const ctx = runtime.renderer.context, before = ctx.stats(); ctx.beginFrame('vehicles');
  Object.keys(ITEMS).forEach((id, index) => {
    ctx.save(); ctx.translate(index % 8 * 62, Math.floor(index / 8) * 62); drawItemIcon(ctx, id, 48); ctx.restore();
  });
  const player = runtime.engine.player;
  const E = { ctx, cam: { x: 0, y: 0 }, time: 2.4, vw: 1024, vh: 640, stage: 'sea', player, mp: null };
  const common = { x: 510, y: 330, life: .55, maxLife: 1, angle: .28, length: 230, radius: 150, spread: .8, seed: 47, armed: true, armT: 0, armMax: 1, triggerRadius: 125 };
  const visuals = [
    ['orbital_strike', 'orbital_marker'], ['orbital_strike', 'orbital_beam'],
    ['black_hole_generator', 'black_hole'], ['underwater_mine', 'mine'],
    ['laser_pointer', 'laser_pointer'], ['laser_pointer', 'cat_attack'], ['laser_pointer', 'cat_slash'],
    ['ak47', 'tracer'], ['shotgun', 'muzzle'], ['ak47', 'impact'],
    ['bone_club', 'swing'], ['shock_pearl', 'pulse'], ['underwater_mine', 'mine_ping'],
    ['shield_generator', 'force_field_burst'], ['grenade', 'blast'],
    ['fossil_spear', 'projectile'], ['venom_pod', 'projectile'], ['grenade', 'projectile'],
    ['rocket_launcher', 'projectile'], ['black_hole_generator', 'projectile'],
    ['vehicle_torpedo', 'projectile'], ['vehicle_missile', 'projectile'],
  ];
  visuals.forEach(([type, visual]) => drawItemProjectile(E, { ...common, type, visual, color: ITEMS[type].color }));
  Object.keys(VEHICLES).forEach((type, index) => drawVehicle(E, {
    type, x: 220 + index * 350, y: 500, angle: .2, radius: VEHICLES[type].radius,
    hp: VEHICLES[type].hp * .72, maxHp: VEHICLES[type].hp, hurt: .2, timeLeft: 12,
    occupant: null, occupantConn: null,
  }));
  ctx.endFrame(); runtime.renderer.app.render();
  const after = ctx.stats();
  assert(after.fills - before.fills > 150 && after.strokes - before.strokes > 100, 'Item/vehicle visual coverage was unexpectedly low');
  assert(after.shadowPasses - before.shadowPasses > 0, 'Pixi did not render item/vehicle shadow and glow passes');
});

test('Pixi preserves normal, additive and text command order within a layer', () => {
  const ctx = runtime.renderer.context, surface = runtime.renderer.surfaces.actors;
  ctx.beginFrame('actors');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 5, 5);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(6, 0, 5, 5);
  ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(12, 0, 5, 5);
  ctx.fillText('ordered', 18, 5); ctx.fillRect(24, 0, 5, 5);
  ctx.endFrame(); runtime.renderer.app.render();
  const order = surface.container.children.map(child => child.label.includes('text') ? 'text' : child.blendMode);
  assert(JSON.stringify(order) === JSON.stringify(['normal', 'add', 'normal', 'text', 'normal']), `Pixi reordered draw commands: ${JSON.stringify(order)}`);
});

test('player powers, boss telegraphs and screen effects render together', () => {
  runtime.engine.loadMap('sea_shallows');
  const engine = runtime.engine, player = engine.player;
  player.abilities = Object.keys(ABILITIES);
  for (const timer of Object.values(ACTIVE_TIMER)) player[timer] = .45;
  Object.assign(player, {
    shield: player.maxHp, shieldMax: player.maxHp, forceFieldT: 5,
    inkCloudT: 1, inkX: player.x - 30, inkY: player.y, decoyX: player.x + 90, decoyY: player.y + 20, decoyAngle: .2,
    vortexT: 1, vortexX: player.x + 120, vortexY: player.y - 80,
    leapT: .4, leapMax: .8, leapLandX: player.x + 150, leapLandY: player.y + 40, leapKind: 'dive',
    impaleT: .5, impaleReach: 150, impaleAngle: .1, tailSweepT: .4, tailSweepAngle: .2,
    armorPlates: 3, barbCharge: 3, filterCombo: 4, regenDelay: 0, hp: player.maxHp * .55,
    fortify: .8, sailHeat: .7, rebirthT: .4, withdrawStored: player.maxHp * .5,
    graspT: .5, graspX: player.x + 180, graspY: player.y - 30,
    castT: .5, castAbility: 'shock', frenzyT: .35, armorBreakT: .4, venomStacks: 2, venomMarkT: 1,
  });
  engine.danger = .8; engine.shake = 4;
  engine.bubbles.push({ x: 120, y: 100, r: 5 });
  engine.webs.push({ x: player.x + 80, y: player.y, r: 90, angle: .2, life: 4 });
  const boss = engine.creatures.find(creature => creature.boss);
  assert(boss, 'Scenario map did not seed a boss');
  const telegraphs = [
    { shape: 'circle', special: 'starMotes', x: boss.x, y: boss.y, ox: boss.x, oy: boss.y, r: 120 },
    { shape: 'ring', special: 'quake', x: boss.x, y: boss.y, ox: boss.x, oy: boss.y, inner: 55, outer: 145 },
    { shape: 'lane', special: 'abyssBeam', x: boss.x, y: boss.y, ox: boss.x, oy: boss.y, angle: .2, width: 70, length: 360 },
    { shape: 'cone', special: 'tongueLash', x: boss.x, y: boss.y, ox: boss.x, oy: boss.y, angle: .2, spread: .6, length: 260 },
  ];
  for (const telegraph of telegraphs) {
    boss.telegraph = { ...telegraph, color: '#ff697a', t: .45, max: 1 };
    runtime.capturePresentation(); runtime.render(.5);
  }
  const activeTimers = [...new Set(Object.values(ACTIVE_TIMER))];
  for (const [ability, timer] of Object.entries(ACTIVE_TIMER)) {
    for (const field of activeTimers) player[field] = 0;
    player[timer] = .45; player.castT = .45; player.castAbility = ability;
    runtime.capturePresentation(); runtime.render(.5);
  }
  const stats = runtime.renderer.stats();
  assert(stats.dashedStrokes > 0 && stats.texts > 0 && stats.gradients > 0 && stats.gradientHits > 0, `Effects did not exercise expected Pixi resources: ${JSON.stringify(stats)}`);
});

test('renderer pools stay bounded and all GPU-side resources are destroyed', () => {
  const renderer = runtime.renderer, stats = renderer.stats();
  const pooledTexts = Object.values(stats.layers).reduce((total, layer) => total + layer.pooledTexts, 0);
  assert(pooledTexts < 256, `Text pool grew unexpectedly: ${pooledTexts}`);
  assert(stats.gradients < 1024, `Gradient cache grew unexpectedly: ${stats.gradients}`);
  runtime.destroy();
  assert(renderer.app === null && renderer.context === null && renderer.surfaces === null, 'Pixi renderer retained resources after destroy()');
});

const results = document.getElementById('results');
let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed++; results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`); }
  catch (error) { results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`); }
}
runtime.destroy(); canvas.remove();
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${tests.length} passed`);
document.title = passed === tests.length ? 'PASS - Pixi renderer tests' : 'FAIL - Pixi renderer tests';
document.body.dataset.tests = passed === tests.length ? 'pass' : 'fail';

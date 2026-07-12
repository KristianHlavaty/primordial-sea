/* Population control: seeds a map's creatures/plants/bosses and keeps them
   topped up. Everything here is stage-aware — it only spawns species whose
   `stage` matches the current map, and spawns the current map's dedicated
   boss(es) from data/maps.js. */
import { Creature } from '../entities/Creature.js';
import { Boss } from '../entities/Boss.js';
import { NPCS, PLANTS, npcStage, plantStage } from '../../data/npcs.js';
import { MAPS } from '../../data/maps.js';
import { TAU, rand } from '../../core/math.js';

export function creatureTarget(era) { return Math.min(26 + era * 4, 54); }

/* A random world point outside the current viewport (falls back to anywhere). */
export function offscreenPoint(game) {
  for (let i = 0; i < 12; i++) {
    const x = rand(120, game.W - 120), y = rand(120, game.H - 120);
    if (Math.abs(x - game.cam.x - game.vw / 2) > game.vw * 0.6 || Math.abs(y - game.cam.y - game.vh / 2) > game.vh * 0.6) return { x, y };
  }
  return { x: rand(120, game.W - 120), y: rand(120, game.H - 120) };
}

function eligibleNpcs(game) { return Object.keys(NPCS).filter(k => npcStage(k) === game.stage && NPCS[k].minEra <= game.era && (!NPCS[k].maps || NPCS[k].maps.includes(game.mapId))); }

/* Weighted roll over every species of this stage unlocked in this era. */
function weightedNpc(game) {
  const el = eligibleNpcs(game);
  let tot = 0; for (const k of el) tot += NPCS[k].weight;
  let r = Math.random() * tot;
  for (const k of el) { r -= NPCS[k].weight; if (r <= 0) return k; }
  return el[0];
}

/* The two easy-food species used to keep prey around, per stage. */
function easyPrey(game) {
  if (game.stage === 'carboniferous') return Math.random() < 0.6 ? 'carbon_roach' : 'carbon_millipede';
  if (game.stage === 'devonian') return Math.random() < 0.6 ? 'springtail' : 'mudskipper';
  return Math.random() < 0.6 ? 'plankton' : 'silverfish';
}
function plantKinds(game) {
  return Object.keys(PLANTS).filter(k => plantStage(k) === game.stage);
}
function randomPlantKind(game) {
  const ks = plantKinds(game);
  // first kind (algae/moss) is the common one; second (kelp/fern) rarer
  return Math.random() < 0.72 ? ks[0] : (ks[1] || ks[0]);
}

/* How many plants a map sustains, and where they grow. Sea flora clings to the
   floor (bottom of the world); land flora is scattered across the whole map and
   is a bit scarcer. */
function plantCap(game) { return game.stage === 'sea' ? 12 : 8; }
function plantSpot(game) {
  if (game.stage === 'sea') return { x: rand(120, game.W - 120), y: game.H - 30 };
  return { x: rand(160, game.W - 160), y: rand(220, game.H - 180) };
}
function seedPlant(game) { const s = plantSpot(game); spawnPlant(game, s.x, s.y, randomPlantKind(game)); }

export function spawnRandomNpc(game) {
  const p = offscreenPoint(game);
  game.creatures.push(Creature.spawn(weightedNpc(game), p.x, p.y, game.era));
}

export function spawnPlant(game, x, y, kind) {
  const d = PLANTS[kind];
  game.plants.push({ kind, x, y, amount: d.max, max: d.max, value: d.value, regen: 0, eatCd: 0, sway: rand(0, TAU), h: d.h * rand(0.8, 1.2) });
}

export function spawnInitial(game) {
  game.creatures.length = 0; game.plants.length = 0; game.food.length = 0; game.particles.length = 0; game.eggs.length = 0;
  game.webs.length = 0;
  const webCount = MAPS[game.mapId].webFields || 0;
  for (let i = 0; i < webCount; i++) {
    let x = 260 + (i * 733) % (game.W - 520), y = 240 + (i * 977) % (game.H - 480);
    if (Math.abs(x - game.player.x) < 300 && Math.abs(y - game.player.y) < 260) x = (x + 700) % (game.W - 300) + 150;
    game.webs.push({ x, y, r: 92 + (i % 4) * 24, angle: i * .73 });
  }
  const target = creatureTarget(game.era);
  for (let i = 0; i < target; i++) spawnRandomNpc(game);
  // seed some easy food near the player at start
  for (let i = 0; i < 6; i++) game.creatures.push(Creature.spawn(easyPrey(game), game.player.x + rand(-260, 260), game.player.y + rand(-200, 200), game.era));
  for (let i = 0; i < plantCap(game); i++) seedPlant(game);
  game.bubbles.length = 0;
  for (let i = 0; i < 120; i++) game.bubbles.push({ x: rand(0, game.vw), y: rand(0, game.vh), r: rand(0.6, 2.6), sp: rand(6, 26), ph: rand(0, TAU) });
  for (const k of (MAPS[game.mapId].bosses || [])) if (!game.bossesDefeated.has(k)) game.creatures.push(new Boss(k, game));
}

/* Runs every half second of sim time: top up creatures, easy prey and
   plants, and recycle the farthest-away creature when far over cap. */
export function spawnMaintain(game, dt) {
  game.spawnT -= dt; if (game.spawnT > 0) return; game.spawnT = 0.5;
  const alive = game.creatures.length, target = creatureTarget(game.era);
  if (alive < target) { const n = Math.min(3, target - alive); for (let i = 0; i < n; i++) spawnRandomNpc(game); }
  // keep some easy prey around
  const prey = game.creatures.filter(c => c.role === 'prey').length;
  if (prey < 8) { const p = offscreenPoint(game); game.creatures.push(Creature.spawn(easyPrey(game), p.x, p.y, game.era)); }
  // top up plants (slowly — plants persist and regrow in place, so this is really a total cap)
  if (game.plants.length < plantCap(game)) seedPlant(game);
  // recycle far creatures if far over cap
  if (game.creatures.length > target + 6) {
    let fi = -1, fd = 0;
    for (let i = 0; i < game.creatures.length; i++) {
      const c = game.creatures[i]; if (c.boss) continue;
      const d = Math.abs(c.x - game.player.x) + Math.abs(c.y - game.player.y);
      if (d > fd && d > game.vw) { fd = d; fi = i; }
    }
    if (fi >= 0) game.creatures.splice(fi, 1);
  }
}

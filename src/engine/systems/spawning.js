/* Population control: initial world seeding and the steady drip that keeps
   the sea stocked as things die (or get eaten). */
import { Creature } from '../entities/Creature.js';
import { Boss } from '../entities/Boss.js';
import { NPCS, PLANTS } from '../../data/npcs.js';
import { BOSS_AGE } from '../../data/bosses.js';
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

function eligibleNpcs(era) { return Object.keys(NPCS).filter(k => NPCS[k].minEra <= era); }

/* Weighted roll over every species unlocked in this era. */
function weightedNpc(era) {
  const el = eligibleNpcs(era);
  let tot = 0; for (const k of el) tot += NPCS[k].weight;
  let r = Math.random() * tot;
  for (const k of el) { r -= NPCS[k].weight; if (r <= 0) return k; }
  return el[0];
}

export function spawnRandomNpc(game) {
  const p = offscreenPoint(game);
  game.creatures.push(Creature.spawn(weightedNpc(game.era), p.x, p.y, game.era));
}

export function spawnPlant(game, x, y, kind) {
  const d = PLANTS[kind];
  game.plants.push({ kind, x, y, amount: d.max, max: d.max, value: d.value, regen: 0, eatCd: 0, sway: rand(0, TAU), h: d.h * rand(0.8, 1.2) });
}

export function spawnInitial(game) {
  game.creatures.length = 0; game.plants.length = 0; game.food.length = 0; game.particles.length = 0; game.eggs.length = 0;
  const target = creatureTarget(game.era);
  for (let i = 0; i < target; i++) spawnRandomNpc(game);
  // seed some easy food near the player at start
  for (let i = 0; i < 6; i++) game.creatures.push(Creature.spawn('plankton', game.player.x + rand(-260, 260), game.player.y + rand(-200, 200), game.era));
  const floorY = game.H - 30;
  for (let i = 0; i < 12; i++) { const kind = Math.random() < 0.72 ? 'algae' : 'kelp'; spawnPlant(game, rand(120, game.W - 120), floorY, kind); }
  for (let i = 0; i < 120; i++) game.bubbles.push({ x: rand(0, game.vw), y: rand(0, game.vh), r: rand(0.6, 2.6), sp: rand(6, 26), ph: rand(0, TAU) });
  for (const k of (BOSS_AGE[game.age] || [])) if (!game.bossesDefeated.has(k)) game.creatures.push(new Boss(k, game));
}

/* Runs every half second of sim time: top up creatures, easy prey and
   plants, and recycle the farthest-away creature when far over cap. */
export function spawnMaintain(game, dt) {
  game.spawnT -= dt; if (game.spawnT > 0) return; game.spawnT = 0.5;
  const alive = game.creatures.length, target = creatureTarget(game.era);
  if (alive < target) { const n = Math.min(3, target - alive); for (let i = 0; i < n; i++) spawnRandomNpc(game); }
  // keep some easy prey around
  const prey = game.creatures.filter(c => c.role === 'prey').length;
  if (prey < 8) { const p = offscreenPoint(game); game.creatures.push(Creature.spawn(Math.random() < 0.6 ? 'plankton' : 'silverfish', p.x, p.y, game.era)); }
  // top up plants (slowly — plants persist and regrow in place, so this is really a total cap)
  if (game.plants.length < 12) spawnPlant(game, rand(120, game.W - 120), game.H - 30, Math.random() < 0.72 ? 'algae' : 'kelp');
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

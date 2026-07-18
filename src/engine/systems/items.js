/* Collectible items and weapon combat. Single-player simulates these locally;
   multiplayer remains host-authoritative, with clients only requesting slot
   actions and rendering snapshots. */
import { ITEMS, NATURAL_ITEMS, MODERN_ITEMS, ITEM_SLOT_COUNT } from '../../data/items.js';
import { clamp, hyp, rand } from '../../core/math.js';
import { burst } from './effects.js';

const isAuthority = game => !game.mp || game.mp.role === 'host';
const itemsEnabled = game => game.mp ? game.mp.items !== false : game.itemsEnabled !== false;
const funItemsEnabled = game => game.mp ? !!game.mp.funItems : !!game.funItems;
const worldCap = game => funItemsEnabled(game) ? 20 : 14;
const itemPool = game => funItemsEnabled(game) ? NATURAL_ITEMS.concat(MODERN_ITEMS) : NATURAL_ITEMS;
const heldItem = (type, uses) => ({ id: type, uses: uses == null ? ITEMS[type].uses : uses, cd: 0 });

function spawnPoint(game) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rand(140, game.W - 140), y = rand(140, game.H - 140);
    if (hyp(x - game.player.x, y - game.player.y) < 280) continue;
    if (game.obstacles.some(o => hyp(x - o.x, y - o.y) < (o.r || 40) + 45)) continue;
    return { x, y };
  }
  return { x: rand(100, game.W - 100), y: rand(100, game.H - 100) };
}

function addWorldItem(game, type, x, y, uses) {
  const p = x == null ? spawnPoint(game) : { x, y };
  game.worldItems.push({ type, x: p.x, y: p.y, uses: uses == null ? ITEMS[type].uses : uses, radius: 18, bob: rand(0, 6.28) });
}

export function spawnMapItems(game) {
  game.worldItems.length = 0; game.itemProjectiles.length = 0; game.itemSpawnT = 12;
  if (!isAuthority(game) || !itemsEnabled(game)) return;
  const pool = itemPool(game), count = worldCap(game);
  for (let i = 0; i < count; i++) addWorldItem(game, pool[i % pool.length]);
}

const actorConn = (game, actor) => !game.mp ? null : actor === game.player ? game.mp.self : actor.connId;
const targets = (game, actor) => {
  const out = game.creatures.slice();
  for (const player of game.allPlayers()) if (player !== actor && player.deadT <= 0) out.push(player);
  return out;
};
const isPlayer = target => !!target.speciesId;

function damageTarget(game, actor, target, damage, x, y, knockback = 0) {
  if (!target || target.hp <= 0) return;
  if (isPlayer(target)) target.takeHit(game, damage, x, y, actor);
  else target.takeDamage(game, damage, x, y, true);
  if (knockback && target.hp > 0) target.knockbackFrom(x, y, knockback);
}

function addVisual(game, visual, data) {
  game.itemProjectiles.push({ visual, life: data.life || 0.35, maxLife: data.life || 0.35, ...data });
}

function rayTarget(game, actor, angle, range, width = 9) {
  const fx = Math.cos(angle), fy = Math.sin(angle); let best = null, bestAlong = range;
  // Solid map features stop bullets before they can reach a target behind them.
  for (const obstacle of game.obstacles) {
    const dx = obstacle.x - actor.x, dy = obstacle.y - actor.y;
    const along = dx * fx + dy * fy; if (along <= 0 || along >= bestAlong) continue;
    const side = Math.abs(-dx * fy + dy * fx), radius = (obstacle.r || 35) + width;
    if (side <= radius) bestAlong = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - side * side)));
  }
  for (const target of targets(game, actor)) {
    const dx = target.x - actor.x, dy = target.y - actor.y;
    const along = dx * fx + dy * fy; if (along <= 0 || along >= bestAlong) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side <= target.radius + width) { best = target; bestAlong = along; }
  }
  return { target: best, distance: bestAlong };
}

function explode(game, projectile) {
  const def = ITEMS[projectile.type], R = projectile.blast || def.blast;
  for (const target of targets(game, projectile.owner)) {
    const d = hyp(target.x - projectile.x, target.y - projectile.y); if (d > R + target.radius) continue;
    const falloff = Math.max(0.35, 1 - d / (R + target.radius));
    damageTarget(game, projectile.owner, target, projectile.damage * falloff, projectile.x, projectile.y, 420 * falloff);
    if (!isPlayer(target) && projectile.poison && target.hp > 0) {
      target.poisonT = Math.max(target.poisonT || 0, projectile.poison);
      target.poisonDps = Math.max(target.poisonDps || 0, projectile.damage * 0.22);
    }
  }
  burst(game, projectile.x, projectile.y, def.color, 34, 290);
  addVisual(game, 'blast', { x: projectile.x, y: projectile.y, radius: R, color: def.color, life: 0.5 });
  game.shake = Math.min(18, game.shake + Math.min(12, projectile.damage * 0.06)); game.sfx.play('power');
}

function fireItem(game, actor, held, def) {
  const angle = actor.angle, fx = Math.cos(angle), fy = Math.sin(angle);
  if (def.kind === 'melee' || def.kind === 'cone') {
    const range = def.range, spread = def.spread;
    for (const target of targets(game, actor)) {
      const dx = target.x - actor.x, dy = target.y - actor.y, d = hyp(dx, dy); if (d > range + target.radius) continue;
      const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
      if (Math.abs(delta) > spread) continue;
      const damage = def.kind === 'cone' ? def.damage * Math.max(0.45, 1 - d / (range * 1.5)) : def.damage;
      damageTarget(game, actor, target, damage, actor.x, actor.y, def.knockback || 0);
    }
    if (def.kind === 'cone') {
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * spread * 0.38;
        addVisual(game, 'tracer', { x: actor.x + fx * actor.radius, y: actor.y + fy * actor.radius, angle: a, length: range, color: def.color, life: 0.16 });
      }
    } else addVisual(game, 'swing', { x: actor.x, y: actor.y, angle, radius: range, spread, color: def.color, life: 0.28 });
  } else if (def.kind === 'hitscan') {
    const shotAngle = angle + rand(-def.spread, def.spread), hit = rayTarget(game, actor, shotAngle, def.range);
    if (hit.target) damageTarget(game, actor, hit.target, def.damage, actor.x, actor.y, 90);
    addVisual(game, 'tracer', { x: actor.x + fx * actor.radius, y: actor.y + fy * actor.radius, angle: shotAngle, length: hit.distance, color: def.color, life: 0.18 });
  } else if (def.kind === 'pulse') {
    for (const target of targets(game, actor)) {
      if (hyp(target.x - actor.x, target.y - actor.y) > def.blast + target.radius) continue;
      damageTarget(game, actor, target, def.damage, actor.x, actor.y, 360);
      if (!isPlayer(target) && !target.boss) target.stunT = Math.max(target.stunT || 0, def.stun);
      else if (!isPlayer(target) && target.boss) target.slowT = Math.max(target.slowT || 0, def.stun);
    }
    addVisual(game, 'pulse', { x: actor.x, y: actor.y, radius: def.blast, color: def.color, life: 0.55 });
    burst(game, actor.x, actor.y, def.color, 24, 240); game.sfx.play('power');
  } else {
    const start = actor.radius + 18;
    game.itemProjectiles.push({
      type: held.id, visual: 'projectile', owner: actor, ownerConn: actorConn(game, actor),
      x: actor.x + fx * start, y: actor.y + fy * start, vx: fx * def.speed, vy: fy * def.speed,
      angle, radius: def.radius || 9, damage: def.damage, blast: def.blast || 0, poison: def.poison || 0,
      life: def.life || def.fuse, maxLife: def.life || def.fuse, timed: def.kind === 'grenade', impactBlast: def.kind === 'rocket',
    });
  }
  held.uses--;
}

export function useHeldItem(game, actor, slot) {
  if (!isAuthority(game) || !itemsEnabled(game) || !actor || actor.deadT > 0 || slot < 0 || slot >= ITEM_SLOT_COUNT) return false;
  const held = actor.items[slot], def = held && ITEMS[held.id];
  if (!def || held.uses <= 0 || held.cd > 0 || (actor.mpEvolveChoices && actor.mpEvolveChoices.length)) return false;
  held.cd = def.cooldown; fireItem(game, actor, held, def);
  if (held.uses <= 0) actor.items[slot] = null;
  if (game.mp) game.mp.sendAcc = 1;
  game.pushHud(true); return true;
}

export function dropHeldItem(game, actor, slot) {
  if (!isAuthority(game) || !itemsEnabled(game) || !actor || slot < 0 || slot >= ITEM_SLOT_COUNT) return false;
  const held = actor.items[slot]; if (!held || !ITEMS[held.id]) return false;
  const distance = actor.radius + 95;
  let x = clamp(actor.x + Math.cos(actor.angle) * distance, 24, game.W - 24);
  let y = clamp(actor.y + Math.sin(actor.angle) * distance, 24, game.H - 24);
  // At a map edge the forward point can clamp back onto the player. Put the
  // item behind them instead so the next pickup pass does not undo the drop.
  if (hyp(x - actor.x, y - actor.y) < actor.radius + 45) {
    x = clamp(actor.x - Math.cos(actor.angle) * distance, 24, game.W - 24);
    y = clamp(actor.y - Math.sin(actor.angle) * distance, 24, game.H - 24);
  }
  addWorldItem(game, held.id, x, y, held.uses);
  actor.items[slot] = null;
  if (game.mp) game.mp.sendAcc = 1;
  game.pushHud(true); return true;
}

function pickupItems(game) {
  for (const actor of game.allPlayers()) {
    if (!actor || actor.deadT > 0) continue;
    const slot = actor.items.findIndex(x => !x); if (slot < 0) continue;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < game.worldItems.length; i++) {
      const item = game.worldItems[i], d = hyp(item.x - actor.x, item.y - actor.y);
      if (d < actor.radius + item.radius + 12 && d < bestD) { best = i; bestD = d; }
    }
    if (best < 0) continue;
    const item = game.worldItems[best]; actor.items[slot] = heldItem(item.type, item.uses); game.worldItems.splice(best, 1);
    burst(game, actor.x, actor.y, ITEMS[item.type].color, 12, 130); game.sfx.play('eat');
    if (game.mp) game.mp.sendAcc = 1;
  }
}

function projectileHit(game, projectile) {
  for (const target of targets(game, projectile.owner)) {
    if (hyp(target.x - projectile.x, target.y - projectile.y) <= target.radius + projectile.radius) return target;
  }
  return null;
}

function updateProjectiles(game, dt) {
  for (let i = game.itemProjectiles.length - 1; i >= 0; i--) {
    const p = game.itemProjectiles[i]; p.life -= dt;
    if (p.visual !== 'projectile') { if (p.life <= 0) game.itemProjectiles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.timed) { p.vx *= Math.exp(-dt * 1.8); p.vy *= Math.exp(-dt * 1.8); }
    const out = p.x < p.radius || p.y < p.radius || p.x > game.W - p.radius || p.y > game.H - p.radius;
    const blocked = game.obstacles.some(o => hyp(p.x - o.x, p.y - o.y) < (o.r || 35) + p.radius);
    const hit = projectileHit(game, p);
    if (p.timed && (out || blocked)) {
      if (p.x < p.radius || p.x > game.W - p.radius || blocked) p.vx *= -0.45;
      if (p.y < p.radius || p.y > game.H - p.radius || blocked) p.vy *= -0.45;
      p.x = clamp(p.x, p.radius, game.W - p.radius); p.y = clamp(p.y, p.radius, game.H - p.radius);
    }
    if (hit && !p.timed) {
      if (p.impactBlast) explode(game, p); else damageTarget(game, p.owner, hit, p.damage, p.x, p.y, 280);
      game.itemProjectiles.splice(i, 1); continue;
    }
    if (p.life <= 0 || (!p.timed && (out || blocked))) {
      if (p.blast) explode(game, p);
      game.itemProjectiles.splice(i, 1);
    }
  }
}

export function updateItems(game, dt) {
  if (!isAuthority(game) || !itemsEnabled(game)) return;
  for (const actor of game.allPlayers()) for (const held of actor.items) if (held && held.cd > 0) held.cd = Math.max(0, held.cd - dt);
  pickupItems(game); updateProjectiles(game, dt);
  game.itemSpawnT -= dt;
  if (game.itemSpawnT <= 0) {
    game.itemSpawnT = 12;
    let total = game.worldItems.length;
    for (const actor of game.allPlayers()) total += actor.items.filter(Boolean).length;
    if (total < worldCap(game)) { const pool = itemPool(game); addWorldItem(game, pool[Math.floor(Math.random() * pool.length)]); }
  }
}

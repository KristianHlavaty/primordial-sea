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

function pushShockwave(target, x, y, distance, radius, force) {
  if (!target || target.hp <= 0 || !force || distance > radius + target.radius) return;
  const falloff = clamp(1 - distance / (radius + target.radius), 0, 1);
  const resistance = target.boss ? 0.38 : 1;
  target.knockbackFrom(x, y, force * (0.25 + falloff * 0.75) * resistance);
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
  const shockRadius = projectile.shockRadius || def.shockRadius || R;
  const shockwave = projectile.shockwave || def.shockwave || 0;
  for (const target of targets(game, projectile.owner)) {
    const d = hyp(target.x - projectile.x, target.y - projectile.y);
    if (d <= R + target.radius) {
      const falloff = Math.max(0.35, 1 - d / (R + target.radius));
      damageTarget(game, projectile.owner, target, projectile.damage * falloff, projectile.x, projectile.y);
      if (!isPlayer(target) && projectile.poison && target.hp > 0) {
        target.poisonT = Math.max(target.poisonT || 0, projectile.poison);
        target.poisonDps = Math.max(target.poisonDps || 0, projectile.damage * 0.22);
      }
    }
    pushShockwave(target, projectile.x, projectile.y, d, shockRadius, shockwave);
  }
  const conventional = projectile.type === 'grenade' || projectile.type === 'rocket_launcher';
  burst(game, projectile.x, projectile.y, conventional ? '#ffb347' : def.color, conventional ? 52 : 40, conventional ? 440 : 330);
  if (conventional) burst(game, projectile.x, projectile.y, '#59463f', 24, 230);
  addVisual(game, 'blast', {
    type: projectile.type, x: projectile.x, y: projectile.y, radius: shockRadius,
    color: conventional ? '#ff7b32' : def.color, life: conventional ? (projectile.type === 'rocket_launcher' ? 0.95 : 0.85) : 0.7,
    seed: projectile.seed || Math.floor(rand(1, 100000)),
  });
  const shake = projectile.type === 'rocket_launcher' ? 17 : projectile.type === 'grenade' ? 14 : 10;
  game.shake = Math.min(22, game.shake + shake); game.sfx.play(conventional ? 'explosion' : 'power');
}

function fireOrbitalStrike(game, marker) {
  const def = ITEMS[marker.type], R = def.blast, shockRadius = def.shockRadius || R;
  for (const target of targets(game, marker.owner)) {
    const d = hyp(target.x - marker.x, target.y - marker.y);
    if (d <= R + target.radius) {
      const falloff = Math.max(0.45, 1 - d / (R + target.radius));
      damageTarget(game, marker.owner, target, def.damage * falloff, marker.x, marker.y);
    }
    pushShockwave(target, marker.x, marker.y, d, shockRadius, def.shockwave);
  }
  burst(game, marker.x, marker.y, '#fff4ff', 72, 620);
  burst(game, marker.x, marker.y, def.color, 44, 460);
  addVisual(game, 'orbital_beam', {
    type: marker.type, x: marker.x, y: marker.y, radius: shockRadius, color: def.color,
    life: def.beamLife, seed: marker.seed,
  });
  game.shake = Math.min(22, game.shake + 22); game.sfx.play('orbital_strike');
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
        addVisual(game, 'tracer', { type: held.id, x: actor.x + fx * actor.radius, y: actor.y + fy * actor.radius, angle: a, length: range * rand(.82, 1), color: def.color, life: 0.2, seed: Math.floor(rand(1, 100000)) });
      }
      addVisual(game, 'muzzle', { type: held.id, x: actor.x + fx * (actor.radius + 8), y: actor.y + fy * (actor.radius + 8), angle, radius: 54, color: def.color, life: 0.18, seed: Math.floor(rand(1, 100000)) });
      game.shake = Math.min(22, game.shake + 5); game.sfx.play('shotgun');
    } else {
      addVisual(game, 'swing', { type: held.id, x: actor.x, y: actor.y, angle, radius: range, spread, color: def.color, life: 0.34 });
      game.shake = Math.min(22, game.shake + 2.5); game.sfx.play('swing');
    }
  } else if (def.kind === 'hitscan') {
    const shotAngle = angle + rand(-def.spread, def.spread), hit = rayTarget(game, actor, shotAngle, def.range);
    if (hit.target) damageTarget(game, actor, hit.target, def.damage, actor.x, actor.y, 90);
    const mx = actor.x + fx * (actor.radius + 8), my = actor.y + fy * (actor.radius + 8);
    addVisual(game, 'tracer', { type: held.id, x: mx, y: my, angle: shotAngle, length: hit.distance, color: def.color, life: 0.2, seed: Math.floor(rand(1, 100000)) });
    addVisual(game, 'muzzle', { type: held.id, x: mx, y: my, angle: shotAngle, radius: 34, color: def.color, life: 0.14, seed: Math.floor(rand(1, 100000)) });
    addVisual(game, 'impact', { type: held.id, x: mx + Math.cos(shotAngle) * hit.distance, y: my + Math.sin(shotAngle) * hit.distance, angle: shotAngle, radius: hit.target ? 25 : 15, color: def.color, life: 0.22, seed: Math.floor(rand(1, 100000)) });
    game.shake = Math.min(22, game.shake + 1.2); game.sfx.play('shot');
  } else if (def.kind === 'pulse') {
    const shockRadius = def.shockRadius || def.blast;
    for (const target of targets(game, actor)) {
      const d = hyp(target.x - actor.x, target.y - actor.y);
      if (d <= def.blast + target.radius) {
        damageTarget(game, actor, target, def.damage, actor.x, actor.y);
        if (!isPlayer(target) && !target.boss) target.stunT = Math.max(target.stunT || 0, def.stun);
        else if (!isPlayer(target) && target.boss) target.slowT = Math.max(target.slowT || 0, def.stun);
      }
      pushShockwave(target, actor.x, actor.y, d, shockRadius, def.shockwave);
    }
    addVisual(game, 'pulse', { type: held.id, x: actor.x, y: actor.y, radius: shockRadius, color: def.color, life: 0.72, seed: Math.floor(rand(1, 100000)) });
    burst(game, actor.x, actor.y, def.color, 38, 360); game.shake = Math.min(22, game.shake + 9); game.sfx.play('power');
  } else if (def.kind === 'orbital') {
    const margin = def.blast + 35;
    const x = clamp(actor.x + fx * def.range, margin, game.W - margin);
    const y = clamp(actor.y + fy * def.range, margin, game.H - margin);
    game.itemProjectiles.push({
      type: held.id, visual: 'orbital_marker', owner: actor, ownerConn: actorConn(game, actor),
      x, y, angle, radius: def.blast, life: def.delay, maxLife: def.delay, seed: Math.floor(rand(1, 100000)),
    });
    game.shake = Math.min(22, game.shake + 2); game.sfx.play('orbital_lock');
  } else {
    const start = actor.radius + 18;
    game.itemProjectiles.push({
      type: held.id, visual: 'projectile', owner: actor, ownerConn: actorConn(game, actor),
      x: actor.x + fx * start, y: actor.y + fy * start, vx: fx * def.speed, vy: fy * def.speed,
      angle, radius: def.radius || 9, damage: def.damage, blast: def.blast || 0, poison: def.poison || 0,
      knockback: def.knockback || 0, shockRadius: def.shockRadius || 0, shockwave: def.shockwave || 0, seed: Math.floor(rand(1, 100000)),
      life: def.life || def.fuse, maxLife: def.life || def.fuse, timed: def.kind === 'grenade', impactBlast: def.kind === 'rocket',
    });
    if (def.kind === 'rocket') {
      addVisual(game, 'muzzle', { type: held.id, x: actor.x + fx * start, y: actor.y + fy * start, angle, radius: 48, color: '#ffb347', life: 0.2, seed: Math.floor(rand(1, 100000)) });
      game.shake = Math.min(22, game.shake + 5); game.sfx.play('rocket');
    } else game.sfx.play('throw');
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
    if (p.visual === 'orbital_marker') {
      if (p.life <= 0) { fireOrbitalStrike(game, p); game.itemProjectiles.splice(i, 1); }
      continue;
    }
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
      if (p.impactBlast) explode(game, p); else damageTarget(game, p.owner, hit, p.damage, p.x, p.y, p.knockback || 280);
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

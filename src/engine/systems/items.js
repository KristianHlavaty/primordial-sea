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
const itemAllowedHere = (game, type) => !ITEMS[type].waterOnly || game.stage === 'sea';
const itemPool = game => (funItemsEnabled(game) ? NATURAL_ITEMS.concat(MODERN_ITEMS) : NATURAL_ITEMS)
  .filter(type => itemAllowedHere(game, type));
const heldItem = (type, uses) => ({ id: type, uses: uses == null ? ITEMS[type].uses : uses, cd: 0 });

function randomItemType(game) {
  const pool = itemPool(game);
  let total = 0;
  for (const type of pool) total += ITEMS[type].spawnWeight == null ? 1 : ITEMS[type].spawnWeight;
  let roll = Math.random() * total;
  for (const type of pool) {
    roll -= ITEMS[type].spawnWeight == null ? 1 : ITEMS[type].spawnWeight;
    if (roll <= 0) return type;
  }
  return pool[pool.length - 1];
}

function spawnPoint(game) {
  const focus = game.worldPlayer ? game.worldPlayer() : game.player;
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = rand(140, game.W - 140), y = rand(140, game.H - 140);
    if (hyp(x - focus.x, y - focus.y) < 280) continue;
    if (game.obstacles.some(o => hyp(x - o.x, y - o.y) < (o.r || 40) + 45)) continue;
    return { x, y };
  }
  return { x: rand(100, game.W - 100), y: rand(100, game.H - 100) };
}

function addWorldItem(game, type, x, y, uses, pickupDelay = 0) {
  const p = x == null ? spawnPoint(game) : { x, y };
  const item = { type, x: p.x, y: p.y, uses: uses == null ? ITEMS[type].uses : uses, radius: 18, bob: rand(0, 6.28), pickupDelay };
  game.worldItems.push(item); return item;
}

export function spawnMapItems(game) {
  game.worldItems.length = 0; game.itemProjectiles.length = 0; game.itemSpawnT = 12;
  if (!isAuthority(game) || !itemsEnabled(game)) return;
  const count = worldCap(game);
  if (!funItemsEnabled(game)) {
    const pool = itemPool(game);
    for (let i = 0; i < count; i++) addWorldItem(game, pool[i % pool.length]);
  } else {
    // Keep the broad fun arsenal available on a fresh map, then use weighted
    // rolls for the remaining slots. Rare items are never guaranteed.
    const common = itemPool(game).filter(type => !ITEMS[type].rare);
    let i = 0;
    for (; i < count && i < common.length; i++) addWorldItem(game, common[i]);
    for (; i < count; i++) addWorldItem(game, randomItemType(game));
  }
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
  const amount = force * (0.25 + falloff * 0.75) * resistance;
  if (target.vehicle) {
    const dx = target.vehicle.x - x, dy = target.vehicle.y - y, length = hyp(dx, dy) || 1;
    target.vehicle.vx += dx / length * amount; target.vehicle.vy += dy / length * amount;
  } else target.knockbackFrom(x, y, amount);
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
  const torpedo = projectile.type === 'vehicle_torpedo';
  const mine = projectile.type === 'underwater_mine';
  const aquatic = torpedo || mine;
  const conventional = projectile.type === 'grenade' || projectile.type === 'rocket_launcher' || projectile.type === 'vehicle_missile';
  burst(game, projectile.x, projectile.y, aquatic ? '#c9f8ff' : conventional ? '#ffb347' : def.color, conventional ? 52 : mine ? 58 : torpedo ? 48 : 40, conventional ? 440 : mine ? 430 : torpedo ? 390 : 330);
  if (mine) burst(game, projectile.x, projectile.y, '#489db5', 30, 280);
  if (conventional) burst(game, projectile.x, projectile.y, '#59463f', 24, 230);
  addVisual(game, 'blast', {
    type: projectile.type, x: projectile.x, y: projectile.y, radius: shockRadius,
    color: conventional ? '#ff7b32' : def.color, life: conventional ? (projectile.type === 'rocket_launcher' ? 0.95 : 0.85) : 0.7,
    seed: projectile.seed || Math.floor(rand(1, 100000)),
  });
  const shake = projectile.type === 'rocket_launcher' ? 17 : projectile.type === 'vehicle_missile' ? 16 : projectile.type === 'grenade' ? 14 : mine ? 18 : torpedo ? 15 : 10;
  game.shake = Math.min(22, game.shake + shake); game.sfx.play(mine ? 'mine_explosion' : torpedo ? 'torpedo_hit' : conventional ? 'explosion' : 'power');
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

function activateBlackHole(game, projectile) {
  const def = ITEMS[projectile.type];
  projectile.visual = 'black_hole'; projectile.vx = 0; projectile.vy = 0;
  projectile.radius = def.field; projectile.life = def.duration; projectile.maxLife = def.duration;
  projectile.damageTick = 0; projectile.angle = 0;
  burst(game, projectile.x, projectile.y, '#f4e6ff', 32, 260);
  burst(game, projectile.x, projectile.y, def.color, 30, 360);
  game.shake = Math.min(22, game.shake + 10); game.sfx.play('black_hole');
  if (game.mp) game.mp.sendAcc = 1;
}

function updateBlackHole(game, hole, dt) {
  const def = ITEMS[hole.type], radius = hole.radius || def.field;
  hole.damageTick -= dt;
  const dealsDamage = hole.damageTick <= 0;
  if (dealsDamage) hole.damageTick += 0.4;
  for (const target of targets(game, hole.owner)) {
    const dx = hole.x - target.x, dy = hole.y - target.y, distance = hyp(dx, dy);
    if (distance > radius + target.radius) continue;
    const falloff = clamp(1 - distance / (radius + target.radius), 0, 1);
    const resistance = target.boss ? 0.28 : isPlayer(target) ? 0.78 : 1;
    const force = def.pull * (0.18 + falloff * 0.82) * resistance * dt;
    const body = target.vehicle || target, length = distance || 1;
    body.vx += dx / length * force; body.vy += dy / length * force;
    if (dealsDamage) {
      // Damage APIs normally knock away from their source. Put the virtual
      // impact behind the victim so that hit impulse also points inward.
      const sourceX = target.x - dx, sourceY = target.y - dy;
      damageTarget(game, hole.owner, target, def.damage * 0.4 * (0.3 + falloff * 0.7), sourceX, sourceY);
    }
  }
  if (game.particles.length < 300 && Math.random() < dt * 12) {
    const angle = rand(0, Math.PI * 2), distance = rand(radius * 0.25, radius * 0.9);
    game.particles.push({
      x: hole.x + Math.cos(angle) * distance, y: hole.y + Math.sin(angle) * distance,
      vx: -Math.cos(angle) * rand(45, 120), vy: -Math.sin(angle) * rand(45, 120),
      life: 0.65, max: 0.65, size: rand(1.5, 3.5), color: 'rgba(200,145,255,0.8)',
    });
  }
}

function updateMine(game, mine, dt) {
  const def = ITEMS[mine.type];
  if (!mine.armed) {
    mine.armT = Math.max(0, mine.armT - dt);
    mine.x += mine.vx * dt; mine.y += mine.vy * dt;
    const drag = Math.exp(-dt * 3.3); mine.vx *= drag; mine.vy *= drag;
    const blocked = game.obstacles.some(o => hyp(mine.x - o.x, mine.y - o.y) < (o.r || 35) + mine.radius);
    const outX = mine.x < mine.radius || mine.x > game.W - mine.radius;
    const outY = mine.y < mine.radius || mine.y > game.H - mine.radius;
    if (blocked || outX) mine.vx *= -0.3;
    if (blocked || outY) mine.vy *= -0.3;
    mine.x = clamp(mine.x, mine.radius, game.W - mine.radius);
    mine.y = clamp(mine.y, mine.radius, game.H - mine.radius);
    if (mine.armT <= 0) {
      mine.armed = true; mine.vx = 0; mine.vy = 0;
      burst(game, mine.x, mine.y, def.color, 16, 145);
      addVisual(game, 'mine_ping', {
        type: mine.type, x: mine.x, y: mine.y, radius: mine.triggerRadius,
        color: def.color, life: 0.45, seed: mine.seed,
      });
      game.sfx.play('mine_arm');
      if (game.mp) game.mp.sendAcc = 1;
    }
    return false;
  }
  for (const target of targets(game, mine.owner)) {
    if (hyp(target.x - mine.x, target.y - mine.y) <= mine.triggerRadius + target.radius) {
      explode(game, mine); return true;
    }
  }
  if (mine.life <= 0) { explode(game, mine); return true; }
  return false;
}

function updateCatAttack(game, cat, dt) {
  const def = ITEMS[cat.type], target = cat.target;
  const targetHere = target && target.hp > 0
    && (!isPlayer(target) || !game.mp || (target.mapId || game.mapId) === game.mapId);
  if (!targetHere) {
    cat.life = Math.min(cat.life, 0.22);
    cat.scratchesDone = def.scratches;
    return;
  }

  cat.x = target.x; cat.y = target.y; cat.radius = Math.max(18, target.radius || 18);
  cat.scratchT -= dt;
  while (cat.scratchT <= 0 && cat.scratchesDone < def.scratches && target.hp > 0) {
    cat.scratchesDone++;
    cat.scratchT += def.scratchInterval;
    const finalSwipe = cat.scratchesDone === def.scratches;
    const sourceDistance = cat.radius + 54;
    const sourceX = cat.x - Math.cos(cat.angle) * sourceDistance;
    const sourceY = cat.y - Math.sin(cat.angle) * sourceDistance;
    damageTarget(game, cat.owner, target, def.damage / def.scratches, sourceX, sourceY, finalSwipe ? 320 : 0);
    addVisual(game, 'cat_slash', {
      type: cat.type, x: cat.x, y: cat.y, angle: cat.angle + rand(-0.16, 0.16),
      radius: cat.radius + 34, color: def.color, life: 0.3, seed: Math.floor(rand(1, 100000)),
    });
    burst(game, cat.x, cat.y, finalSwipe ? '#fff1c2' : def.color, finalSwipe ? 14 : 8, finalSwipe ? 175 : 115);
    game.shake = Math.min(22, game.shake + (finalSwipe ? 3 : 1.4)); game.sfx.play('cat_scratch');
  }
}

function fireItem(game, actor, held, def) {
  const angle = actor.angle, fx = Math.cos(angle), fy = Math.sin(angle);
  if (def.kind === 'shield') {
    actor.shieldMax = Math.max(1, Math.round(actor.maxHp * def.shieldPct));
    actor.shield = actor.shieldMax; actor.shieldT = def.duration; actor.forceFieldT = def.duration;
    burst(game, actor.x, actor.y, '#dffaff', 24, 220);
    addVisual(game, 'force_field_burst', { type: held.id, x: actor.x, y: actor.y, radius: actor.radius + 46, color: def.color, life: 0.65 });
    game.sfx.play('force_field');
  } else if (def.kind === 'melee' || def.kind === 'cone') {
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
  } else if (def.kind === 'laser_pointer') {
    const hit = rayTarget(game, actor, angle, def.range, def.lockWidth);
    const start = actor.radius + 7, mx = actor.x + fx * start, my = actor.y + fy * start;
    addVisual(game, 'laser_pointer', {
      type: held.id, x: mx, y: my, angle, length: Math.max(0, hit.distance - start),
      radius: hit.target ? Math.max(18, hit.target.radius || 18) : 12,
      color: def.color, life: 0.42, seed: Math.floor(rand(1, 100000)),
    });
    game.sfx.play('laser_pointer');
    if (hit.target) {
      game.itemProjectiles.push({
        type: held.id, visual: 'cat_attack', owner: actor, ownerConn: actorConn(game, actor), target: hit.target,
        x: hit.target.x, y: hit.target.y, angle, radius: Math.max(18, hit.target.radius || 18),
        life: def.catDuration, maxLife: def.catDuration, scratchT: def.scratchDelay, scratchesDone: 0,
        seed: Math.floor(rand(1, 100000)), color: def.color,
      });
      burst(game, hit.target.x, hit.target.y, '#fff1d2', 18, 155); game.sfx.play('cat_appear');
    }
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
  } else if (def.kind === 'black_hole') {
    const start = actor.radius + 18;
    game.itemProjectiles.push({
      type: held.id, visual: 'projectile', owner: actor, ownerConn: actorConn(game, actor), blackHoleCharge: true,
      x: actor.x + fx * start, y: actor.y + fy * start, vx: fx * def.speed, vy: fy * def.speed,
      angle, radius: def.radius, life: def.delay, maxLife: def.delay, timed: true, seed: Math.floor(rand(1, 100000)),
    });
    game.sfx.play('black_hole_charge');
  } else if (def.kind === 'mine') {
    const start = actor.radius + 22;
    game.itemProjectiles.push({
      type: held.id, visual: 'mine', owner: actor, ownerConn: actorConn(game, actor),
      x: actor.x + fx * start, y: actor.y + fy * start, vx: fx * def.speed, vy: fy * def.speed,
      angle, radius: def.radius, triggerRadius: def.triggerRadius, damage: def.damage, blast: def.blast,
      shockRadius: def.shockRadius, shockwave: def.shockwave, armT: def.armDelay, armMax: def.armDelay,
      armed: false, life: def.duration, maxLife: def.duration, seed: Math.floor(rand(1, 100000)),
    });
    game.sfx.play('mine_deploy');
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
  if (!isAuthority(game) || !itemsEnabled(game) || !actor || actor.vehicleType || actor.deadT > 0 || slot < 0 || slot >= ITEM_SLOT_COUNT) return false;
  const held = actor.items[slot], def = held && ITEMS[held.id];
  if (!def || !itemAllowedHere(game, held.id) || held.uses <= 0 || held.cd > 0 || (actor.mpEvolveChoices && actor.mpEvolveChoices.length)) return false;
  held.cd = def.cooldown; fireItem(game, actor, held, def);
  if (held.uses <= 0) actor.items[slot] = null;
  if (game.mp) game.mp.sendAcc = 1;
  game.pushHud(true); return true;
}

export function dropHeldItem(game, actor, slot) {
  if (!isAuthority(game) || !itemsEnabled(game) || !actor || actor.vehicleType || slot < 0 || slot >= ITEM_SLOT_COUNT) return false;
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
  addWorldItem(game, held.id, x, y, held.uses, 0.85);
  actor.items[slot] = null;
  if (game.mp) game.mp.sendAcc = 1;
  game.pushHud(true); return true;
}

function pickupItems(game) {
  for (const actor of game.allPlayers()) {
    if (!actor || actor.vehicleType || actor.deadT > 0) continue;
    const slot = actor.items.findIndex(x => !x); if (slot < 0) continue;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < game.worldItems.length; i++) {
      const item = game.worldItems[i]; if (item.pickupDelay > 0) continue;
      const d = hyp(item.x - actor.x, item.y - actor.y);
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
    if (p.visual === 'black_hole') {
      updateBlackHole(game, p, dt);
      if (p.life <= 0) {
        burst(game, p.x, p.y, ITEMS[p.type].color, 22, 180);
        game.itemProjectiles.splice(i, 1);
      }
      continue;
    }
    if (p.visual === 'mine') {
      if (updateMine(game, p, dt)) game.itemProjectiles.splice(i, 1);
      continue;
    }
    if (p.visual === 'cat_attack') {
      updateCatAttack(game, p, dt);
      if (p.life <= 0) game.itemProjectiles.splice(i, 1);
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
    if (p.life <= 0 && p.blackHoleCharge) {
      activateBlackHole(game, p); continue;
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
  for (const item of game.worldItems) if (item.pickupDelay > 0) item.pickupDelay = Math.max(0, item.pickupDelay - dt);
  pickupItems(game); updateProjectiles(game, dt);
  game.itemSpawnT -= dt;
  if (game.itemSpawnT <= 0) {
    game.itemSpawnT = 12;
    let total = game.worldItems.length;
    for (const actor of game.allPlayers()) total += actor.items.filter(Boolean).length;
    if (total < worldCap(game)) addWorldItem(game, randomItemType(game));
  }
}

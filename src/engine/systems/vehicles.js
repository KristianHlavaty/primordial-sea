/* Enterable fun-mode vehicles. The authoritative simulation keeps the vehicle
   and its pilot together; clients only send steering/fire input and render the
   resulting snapshots. */
import { VEHICLES, vehicleForStage } from '../../data/vehicles.js';
import { ITEMS } from '../../data/items.js';
import { angLerp, clamp, hyp, rand } from '../../core/math.js';
import { burst, addFloater } from './effects.js';

const isAuthority = game => !game.mp || game.mp.role === 'host';
const funEnabled = game => game.mp
  ? game.mp.items !== false && !!game.mp.funItems
  : game.itemsEnabled !== false && !!game.funItems;
const actorConn = (game, actor) => !game.mp ? 'solo' : actor === game.player ? game.mp.self : actor.connId;

const desiredCount = game => Math.max(2, Math.min(6, (game.mp ? game.allPlayers().length : 1) + 1));

function vehiclePoint(game) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = rand(180, game.W - 180), y = rand(180, game.H - 180);
    if (game.allPlayers().some(player => hyp(x - player.x, y - player.y) < 360)) continue;
    if (game.obstacles.some(obstacle => hyp(x - obstacle.x, y - obstacle.y) < (obstacle.r || 40) + 90)) continue;
    if (game.vehicles.some(vehicle => hyp(x - vehicle.x, y - vehicle.y) < 260)) continue;
    return { x, y };
  }
  return { x: rand(160, game.W - 160), y: rand(160, game.H - 160) };
}

function addVehicle(game) {
  const type = vehicleForStage(game.stage), def = VEHICLES[type], point = vehiclePoint(game);
  game.vehicles.push({
    netId: ++game.vehicleSeq, type, x: point.x, y: point.y, angle: rand(-Math.PI, Math.PI),
    vx: 0, vy: 0, radius: def.radius, hp: def.hp, maxHp: def.hp, weaponCd: 0,
    occupant: null, occupantConn: null, hurt: 0, shotSide: -1, timeLeft: null,
  });
}

export function spawnMapVehicles(game) {
  for (const vehicle of game.vehicles) if (vehicle.occupant) detachPilot(game, vehicle.occupant, true);
  game.vehicles.length = 0; game.vehicleSpawnT = 12;
  if (!isAuthority(game) || !funEnabled(game)) return;
  game.vehicleTarget = desiredCount(game);
  for (let i = 0; i < game.vehicleTarget; i++) addVehicle(game);
}

function resetPilotPowers(actor) {
  actor.biteT = actor.biteAnim = actor.mouth = 0;
  actor.enrollT = actor.burstT = actor.frenzyT = actor.withdrawT = actor.stealthT = 0;
  actor.ramT = actor.jetT = actor.bloomT = actor.vortexT = actor.burrowT = actor.sprintT = 0;
}

function attachPilot(game, actor, vehicle) {
  if (!Number.isFinite(vehicle.timeLeft)) vehicle.timeLeft = VEHICLES[vehicle.type].duration;
  vehicle.occupant = actor; vehicle.occupantConn = actorConn(game, actor);
  actor.vehicle = vehicle; actor.vehicleType = vehicle.type; actor.vehicleNetId = vehicle.netId;
  actor.vehicleCreatureRadius = actor.radius; actor.radius = vehicle.radius;
  actor.x = vehicle.x; actor.y = vehicle.y; actor.angle = vehicle.angle;
  actor.vx = vehicle.vx; actor.vy = vehicle.vy; actor.faceTarget = vehicle.angle;
  resetPilotPowers(actor);
  burst(game, vehicle.x, vehicle.y, VEHICLES[vehicle.type].accent, 14, 150);
  addFloater(game, { x: vehicle.x, y: vehicle.y - vehicle.radius - 18, vx: 0, vy: -28, text: 'PILOT ONLINE', life: 1.2, max: 1.2, color: VEHICLES[vehicle.type].accent, size: 14 });
  game.sfx.play('vehicle_enter');
}

function detachPilot(game, actor, silent = false) {
  const vehicle = actor && actor.vehicle;
  if (!vehicle) return false;
  const creatureRadius = actor.vehicleCreatureRadius || actor.species.stats.radius;
  const side = vehicle.angle + Math.PI / 2, distance = vehicle.radius + creatureRadius + 22;
  actor.radius = creatureRadius;
  actor.x = clamp(vehicle.x + Math.cos(side) * distance, creatureRadius, game.W - creatureRadius);
  actor.y = clamp(vehicle.y + Math.sin(side) * distance, creatureRadius, game.H - creatureRadius);
  actor.vx = vehicle.vx * .28; actor.vy = vehicle.vy * .28; actor.faceTarget = vehicle.angle;
  vehicle.occupant = null; vehicle.occupantConn = null; vehicle.vx *= .3; vehicle.vy *= .3;
  actor.vehicle = null; actor.vehicleType = null; actor.vehicleNetId = null; actor.vehicleCreatureRadius = null;
  if (!silent) {
    burst(game, actor.x, actor.y, VEHICLES[vehicle.type].accent, 9, 100);
    game.sfx.play('vehicle_exit');
  }
  return true;
}

export function exitVehicle(game, actor, silent = false) { return detachPilot(game, actor, silent); }

export function toggleVehicle(game, actor) {
  if (!isAuthority(game) || !funEnabled(game) || !actor || actor.deadT > 0) return false;
  if (actor.vehicle) {
    const changed = detachPilot(game, actor);
    if (changed) { if (game.mp) game.mp.sendAcc = 1; game.pushHud(true); }
    return changed;
  }
  let best = null, bestDistance = Infinity;
  for (const vehicle of game.vehicles) {
    if (vehicle.occupant || vehicle.hp <= 0) continue;
    const distance = hyp(vehicle.x - actor.x, vehicle.y - actor.y);
    if (distance <= actor.radius + vehicle.radius + 48 && distance < bestDistance) { best = vehicle; bestDistance = distance; }
  }
  if (!best) return false;
  attachPilot(game, actor, best);
  if (game.mp) game.mp.sendAcc = 1;
  game.pushHud(true); return true;
}

function fireWeapon(game, actor, vehicle) {
  const vehicleDef = VEHICLES[vehicle.type], type = vehicleDef.projectile, def = ITEMS[type];
  if (!def || vehicle.weaponCd > 0) return;
  const fx = Math.cos(vehicle.angle), fy = Math.sin(vehicle.angle), px = -fy, py = fx;
  const side = vehicle.type === 'helicopter' ? vehicle.shotSide * 20 : 0;
  const start = vehicle.radius + 24;
  const x = vehicle.x + fx * start + px * side, y = vehicle.y + fy * start + py * side;
  const seed = Math.floor(rand(1, 100000));
  game.itemProjectiles.push({
    type, visual: 'projectile', owner: actor, ownerConn: actorConn(game, actor),
    x, y, vx: fx * def.speed, vy: fy * def.speed, angle: vehicle.angle,
    radius: def.radius, damage: def.damage, blast: def.blast, shockRadius: def.shockRadius,
    shockwave: def.shockwave, life: def.life, maxLife: def.life, impactBlast: true, seed,
  });
  game.itemProjectiles.push({
    type, visual: 'muzzle', x, y, angle: vehicle.angle, radius: vehicle.type === 'submarine' ? 38 : 48,
    color: def.color, life: .2, maxLife: .2, seed,
  });
  vehicle.weaponCd = def.cooldown; vehicle.shotSide *= -1;
  game.shake = Math.min(22, game.shake + (vehicle.type === 'submarine' ? 3 : 4));
  game.sfx.play(vehicle.type === 'submarine' ? 'torpedo' : 'missile');
}

export function updatePilotedVehicle(game, actor, dt) {
  const vehicle = actor.vehicle, def = vehicle && VEHICLES[vehicle.type];
  if (!vehicle || !def || vehicle.hp <= 0) { if (vehicle) detachPilot(game, actor, true); return; }
  const mv = actor.steer(game);
  if (mv.moving) {
    vehicle.vx += mv.tx * def.accel * dt; vehicle.vy += mv.ty * def.accel * dt;
    actor.faceTarget = Math.atan2(mv.ty, mv.tx);
  }
  vehicle.angle = angLerp(vehicle.angle, actor.faceTarget, 1 - Math.exp(-dt * def.turn));
  const speed = hyp(vehicle.vx, vehicle.vy);
  if (speed > def.maxSpeed) { vehicle.vx *= def.maxSpeed / speed; vehicle.vy *= def.maxSpeed / speed; }
  vehicle.vx *= Math.exp(-dt * def.drag); vehicle.vy *= Math.exp(-dt * def.drag);
  vehicle.x = clamp(vehicle.x + vehicle.vx * dt, vehicle.radius, game.W - vehicle.radius);
  vehicle.y = clamp(vehicle.y + vehicle.vy * dt, vehicle.radius, game.H - vehicle.radius);
  actor.x = vehicle.x; actor.y = vehicle.y; actor.vx = vehicle.vx; actor.vy = vehicle.vy; actor.angle = vehicle.angle;
  if (actor.wantsBite(game)) fireWeapon(game, actor, vehicle);
  actor.biteAnim = Math.max(0, actor.biteAnim - dt * 3); actor.mouth = 0; actor.hurt = Math.max(0, actor.hurt - dt * 3);
}

function destroyVehicle(game, vehicle) {
  const actor = vehicle.occupant;
  if (actor) detachPilot(game, actor, true);
  burst(game, vehicle.x, vehicle.y, '#ffb35c', 54, 440);
  burst(game, vehicle.x, vehicle.y, '#4a4847', 24, 250);
  game.itemProjectiles.push({
    type: 'vehicle_missile', visual: 'blast', x: vehicle.x, y: vehicle.y, radius: 360,
    color: '#ff7b32', life: .95, maxLife: .95, seed: Math.floor(rand(1, 100000)),
  });
  game.shake = Math.min(22, game.shake + 18); game.sfx.play('vehicle_destroy');
  const index = game.vehicles.indexOf(vehicle); if (index >= 0) game.vehicles.splice(index, 1);
  game.vehicleSpawnT = Math.min(game.vehicleSpawnT, 16);
  if (actor) game.pushHud(true);
}

function expireVehicle(game, vehicle) {
  const actor = vehicle.occupant;
  if (actor) detachPilot(game, actor, true);
  burst(game, vehicle.x, vehicle.y, VEHICLES[vehicle.type].accent, 20, 190);
  addFloater(game, { x: vehicle.x, y: vehicle.y - vehicle.radius - 12, vx: 0, vy: -34, text: 'TIME UP', life: 1.3, max: 1.3, color: VEHICLES[vehicle.type].accent, size: 15 });
  game.sfx.play('vehicle_exit');
  const index = game.vehicles.indexOf(vehicle); if (index >= 0) game.vehicles.splice(index, 1);
  game.vehicleSpawnT = 12;
  if (game.mp) game.mp.sendAcc = 1;
  if (actor) game.pushHud(true);
}

/* Player.takeHit routes incoming attacks here while the player is enclosed. */
export function damageOccupiedVehicle(game, actor, damage) {
  const vehicle = actor && actor.vehicle;
  if (!vehicle || vehicle.hp <= 0) return false;
  vehicle.hp -= damage; vehicle.hurt = 1;
  burst(game, vehicle.x, vehicle.y, vehicle.hp > 0 ? '#ffd47a' : '#ff6b43', 7, 110);
  addFloater(game, { x: vehicle.x + rand(-10, 10), y: vehicle.y - vehicle.radius - 5, vx: rand(-12, 12), vy: -42, text: '' + Math.round(damage), life: .8, max: .8, color: '#ffbd69', size: 14 });
  game.shake = Math.min(18, game.shake + damage * .16); game.sfx.play('vehicle_hit');
  if (vehicle.hp <= 0) destroyVehicle(game, vehicle);
  return true;
}

export function updateVehicles(game, dt) {
  if (!isAuthority(game)) return;
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const vehicle = game.vehicles[i];
    vehicle.weaponCd = Math.max(0, vehicle.weaponCd - dt);
    vehicle.hurt = Math.max(0, vehicle.hurt - dt * 3);
    if (Number.isFinite(vehicle.timeLeft)) {
      vehicle.timeLeft = Math.max(0, vehicle.timeLeft - dt);
      if (vehicle.timeLeft <= 0) { expireVehicle(game, vehicle); continue; }
    }
    if (!vehicle.occupant) {
      vehicle.vx *= Math.exp(-dt * 2.6); vehicle.vy *= Math.exp(-dt * 2.6);
      vehicle.x = clamp(vehicle.x + vehicle.vx * dt, vehicle.radius, game.W - vehicle.radius);
      vehicle.y = clamp(vehicle.y + vehicle.vy * dt, vehicle.radius, game.H - vehicle.radius);
    }
  }
  if (!funEnabled(game)) return;
  game.vehicleTarget = desiredCount(game);
  if (game.vehicles.length >= game.vehicleTarget) return;
  game.vehicleSpawnT -= dt;
  if (game.vehicleSpawnT <= 0) { addVehicle(game); game.vehicleSpawnT = 16; }
}

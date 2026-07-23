import { ComponentTypes as C } from '../components/componentTypes.js';
import { GameEvents } from '../events.js';
import { MAPS, EDGE_TRIGGER_PAD, EDGE_PASSAGE_ASSIST, EDGE_DWELL_TIME, firstMapOf } from '../../data/maps.js';
import { speciesStage } from '../../data/species.js';
import { MAX_LEVEL, XP_MULT, xpNeed } from '../../data/progression.js';
import { clamp, hyp } from '../../core/math.js';
import { burst } from './effects.js';
import { exitVehicle } from './vehicles.js';
import { spawnMaintain, spawnRandomNpc } from './spawning.js';
import { mpSendPacket } from '../mp.js';
import { MultiplayerPacketKinds as PacketKinds } from '../net/ComponentSnapshotProtocol.js';

export const CoreSystemPhases = Object.freeze({
  PRE_ACTORS: 'core:pre-actors',
  MAP_CROSSING: 'core:map-crossing',
  ENVIRONMENT: 'core:environment',
  RESOURCES: 'core:resources',
  LIFETIMES: 'core:lifetimes',
  PROGRESSION: 'core:progression',
  SPAWNING: 'core:spawning',
});

const ACTIVE_BODY_KINDS = new Set(['player', 'remote-player', 'creature']);

class PreviousTransformSystem {
  update(world) {
    world.forEach([C.TRANSFORM, C.PREVIOUS_TRANSFORM], (_entity, transform, previous) => {
      previous.x = transform.x; previous.y = transform.y; previous.angle = transform.angle;
    });
  }
}

class InputProjectionSystem {
  update(_world, _dt, { engine }) {
    const player = engine.worldPlayer();
    if (player === engine.player) {
      engine.worldMouse.x = engine.cam.x + engine.mouse.x;
      engine.worldMouse.y = engine.cam.y + engine.mouse.y;
    }
  }
}

class RespawnSystem {
  constructor(owner) { this.owner = owner; }
  update(world, dt, { engine, registry }) {
    world.forEach([C.IDENTITY, C.RESPAWN, C.MAP_MEMBER], (entity, identity, respawn, member) => {
      if ((identity.kind !== 'player' && identity.kind !== 'remote-player') || member.mapId !== engine.mapId || respawn.deadT <= 0) return;
      respawn.deadT = Math.max(0, respawn.deadT - dt);
      if (respawn.deadT > 0) return;
      const player = registry.sourceFor(entity);
      if (player) this.owner.respawnPlayer(player, engine);
    });
  }
}

class MapCrossingSystem {
  update(world, dt, context) {
    const { engine, registry } = context;
    if (engine.mp || engine.dead || engine.pendingEvolve) return;
    const player = engine.worldPlayer();
    const entity = registry.entityFor(player);
    if (!entity) return;
    const transform = world.getComponent(entity, C.TRANSFORM), collider = world.getComponent(entity, C.COLLIDER), motion = world.getComponent(entity, C.MOTION);
    if (!transform || !collider || !motion) return;
    if (engine.transitionCd > 0) engine.transitionCd -= dt;
    const map = MAPS[engine.mapId], neighbors = map.neighbors;
    const throughPassage = edge => {
      const gate = map.passages && map.passages[edge]; if (!gate) return true;
      const horizontal = edge === 'top' || edge === 'bottom';
      const position = horizontal ? transform.x : transform.y, span = horizontal ? engine.W : engine.H;
      return Math.abs(position - span * gate.center) <= gate.width * .5 + Math.min(EDGE_PASSAGE_ASSIST, collider.radius);
    };
    let via = null;
    if (neighbors.left && throughPassage('left') && transform.x <= collider.radius + EDGE_TRIGGER_PAD) via = 'left';
    else if (neighbors.right && throughPassage('right') && transform.x >= engine.W - collider.radius - EDGE_TRIGGER_PAD) via = 'right';
    else if (neighbors.top && throughPassage('top') && transform.y <= collider.radius + EDGE_TRIGGER_PAD) via = 'top';
    else if (neighbors.bottom && throughPassage('bottom') && transform.y >= engine.H - collider.radius - EDGE_TRIGGER_PAD) via = 'bottom';
    engine.nearEdge = via ? MAPS[neighbors[via]].name : null;
    if (via && engine.transitionCd <= 0) {
      if (via === 'left') motion.vx = Math.min(0, motion.vx);
      else if (via === 'right') motion.vx = Math.max(0, motion.vx);
      else if (via === 'top') motion.vy = Math.min(0, motion.vy);
      else if (via === 'bottom') motion.vy = Math.max(0, motion.vy);
      engine.edgeDwell += dt;
      if (engine.edgeDwell >= EDGE_DWELL_TIME) {
        engine.loadMap(neighbors[via], via); context.mapChanged = true;
      }
    } else engine.edgeDwell = 0;
  }
}

class CurrentSystem {
  update(world, dt, { engine }) {
    if (engine.stage !== 'sea') return;
    world.forEach([C.TRANSFORM, C.CURRENT_AFFECTED, C.MAP_MEMBER], (_entity, transform, affected, member) => {
      if (member.mapId !== engine.mapId || affected.disabled) return;
      const current = engine.currentAt(transform.x, transform.y);
      transform.x += current.x * dt * affected.factor;
      transform.y += current.y * dt * affected.factor;
      if (!affected.bounded) return;
      const collider = world.getComponent(_entity, C.COLLIDER), radius = collider?.radius || 0;
      transform.x = clamp(transform.x, radius, engine.W - radius);
      transform.y = clamp(transform.y, radius, engine.H - radius);
    });
  }
}

class ObstacleCollisionSystem {
  update(world, _dt, { engine, registry }) {
    if (!engine.obstacles.length) return;
    const obstacles = world.query(C.TRANSFORM, C.COLLIDER, C.OBSTACLE, C.MAP_MEMBER)
      .map(entity => ({
        transform: world.getComponent(entity, C.TRANSFORM), collider: world.getComponent(entity, C.COLLIDER),
        member: world.getComponent(entity, C.MAP_MEMBER),
      })).filter(entry => entry.member.mapId === engine.mapId);
    world.forEach([C.IDENTITY, C.TRANSFORM, C.MOTION, C.COLLIDER, C.MAP_MEMBER], (entity, identity, transform, motion, collider, member) => {
      if (!ACTIVE_BODY_KINDS.has(identity.kind) || member.mapId !== engine.mapId) return;
      const source = registry.sourceFor(entity);
      if (source?.vehicleType === 'helicopter') return;
      for (const obstacle of obstacles) {
        const dx = transform.x - obstacle.transform.x, dy = transform.y - obstacle.transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy), minimum = collider.radius + obstacle.collider.radius;
        if (distance >= minimum) continue;
        const nx = distance > .001 ? dx / distance : 1, ny = distance > .001 ? dy / distance : 0, overlap = minimum - distance;
        transform.x += nx * overlap; transform.y += ny * overlap;
        const normalVelocity = motion.vx * nx + motion.vy * ny;
        if (normalVelocity < 0) {
          const response = source?.enrollT > 0 ? 1.78 : 1;
          motion.vx -= normalVelocity * nx * response; motion.vy -= normalVelocity * ny * response;
        }
      }
    });
  }
}

class FoodSystem {
  constructor(owner) { this.owner = owner; }
  update(_world, dt, { engine, registry }) {
    const focus = engine.worldPlayer();
    const collectors = engine.mp && engine.mp.role === 'host' ? engine.allPlayers() : [focus];
    for (let index = engine.food.length - 1; index >= 0; index--) {
      const food = engine.food[index];
      food.life -= dt; food.vx *= Math.exp(-dt * 2); food.vy *= Math.exp(-dt * 2);
      let eater = null, eatDistance2 = Infinity;
      let pullTarget = null, pullDistance2 = Infinity, pullRadius = 0, pullDx = 0, pullDy = 0;
      for (const candidate of collectors) {
        if (!candidate || candidate.deadT > 0) continue;
        const dx = candidate.x - food.x, dy = candidate.y - food.y, distance2 = dx * dx + dy * dy;
        const eatRadius = candidate.radius + 6;
        if (distance2 < eatRadius * eatRadius && distance2 < eatDistance2) { eater = candidate; eatDistance2 = distance2; }
        const candidatePullRadius = candidate.hasAbility('filter') ? 230 : 130;
        if (distance2 < candidatePullRadius * candidatePullRadius && distance2 < pullDistance2) {
          pullTarget = candidate; pullDistance2 = distance2; pullRadius = candidatePullRadius; pullDx = dx; pullDy = dy;
        }
      }
      if (!eater && pullTarget) {
        const distance = Math.sqrt(pullDistance2), pull = (1 - distance / pullRadius) * 520;
        food.vx += pullDx / (distance || 1) * pull * dt; food.vy += pullDy / (distance || 1) * pull * dt;
      }
      food.x += food.vx * dt; food.y += food.vy * dt;
      if (eater) {
        const filterFeed = eater.hasAbility('filter');
        if (filterFeed) { eater.filterCombo = Math.min(5, (eater.filterCombo || 0) + 1); eater.filterComboT = 2; }
        const combo = filterFeed ? eater.filterCombo : 0;
        this.owner.addXp(eater, engine, food.value * (1 + combo * .06));
        eater.hp = Math.min(eater.maxHp, eater.hp + (filterFeed ? 4 + combo : 3));
        burst(engine, food.x, food.y, food.kind === 'meat' ? '#ff9a8a' : '#8fe89a', 5, 80);
        engine.sfx.play('eat'); engine.food.splice(index, 1); registry.forget(food); continue;
      }
      if (food.life <= 0) { engine.food.splice(index, 1); registry.forget(food); }
    }
  }
}

class PlantSystem {
  update(world, dt, { engine }) {
    world.forEach([C.PLANT, C.MAP_MEMBER], (_entity, plant, member) => {
      if (member.mapId !== engine.mapId) return;
      if (plant.eatCd > 0) plant.eatCd -= dt;
      if (plant.amount < plant.max) {
        plant.regen -= dt;
        if (plant.regen <= 0) { plant.amount = Math.min(plant.max, plant.amount + 1); plant.regen = 14; }
      }
    });
  }
}

class LifetimeSystem {
  remove(array, index, registry) { const [source] = array.splice(index, 1); if (source) registry.forget(source); }
  update(_world, dt, { engine, registry }) {
    if (!engine.backgrounded) {
      for (let i = engine.particles.length - 1; i >= 0; i--) {
        const particle = engine.particles[i]; particle.life -= dt;
        particle.vx *= Math.exp(-dt * 3); particle.vy *= Math.exp(-dt * 3);
        particle.x += particle.vx * dt; particle.y += particle.vy * dt;
        particle.angle = (particle.angle || 0) + (particle.spin || 0) * dt;
        if (particle.shape === 'tooth') particle.vy += 150 * dt;
        if (particle.life <= 0) this.remove(engine.particles, i, registry);
      }
      for (let i = engine.fx.length - 1; i >= 0; i--) {
        const effect = engine.fx[i]; effect.t += dt;
        if (effect.t >= effect.max) this.remove(engine.fx, i, registry);
      }
      for (let i = engine.floaters.length - 1; i >= 0; i--) {
        const floater = engine.floaters[i]; floater.x += floater.vx * dt; floater.y += floater.vy * dt;
        floater.vy *= Math.exp(-dt * 2.4); floater.vx *= Math.exp(-dt * 3); floater.life -= dt;
        if (floater.life <= 0) this.remove(engine.floaters, i, registry);
      }
    } else {
      for (const collection of [engine.particles, engine.fx, engine.floaters]) {
        for (const source of collection) registry.forget(source);
        collection.length = 0;
      }
    }
    for (const egg of engine.eggs) egg.t += dt;
    for (let i = engine.webs.length - 1; i >= 0; i--) {
      const web = engine.webs[i]; if (web.life == null) continue;
      web.life -= dt; if (web.life <= 0) this.remove(engine.webs, i, registry);
    }
    if (!engine.backgrounded) { engine.updateFlow(dt); engine.updateBubbles(dt); }
  }
}

class ProgressionGateSystem {
  update(_world, _dt, { engine }) {
    const player = engine.worldPlayer(); if (!player) return;
    if (!engine.mp && !engine.pendingEvolve && !engine.dead && !engine.advanceAvailable && player.level >= MAX_LEVEL && player.species.evolvesTo.length) engine.triggerEvolve();
    else if (!engine.mp && !engine.pendingEvolve && !engine.dead && !engine.ascendOffered && engine.isSeaApex()) engine.triggerAscend();
  }
}

class SpawnPopulationSystem {
  update(_world, dt, { engine }) { spawnMaintain(engine, dt); }
}

/* Runtime-owned system coordinator. Explicit phases preserve the gameplay
   ordering between actor movement, environment work and presentation facts. */
export class CoreComponentSystems {
  constructor(world, registry) {
    this.world = world; this.registry = registry; this.disposers = [];
    const add = (system, phase, order) => this.disposers.push(world.addSystem(system, { phase, order }));
    add(new PreviousTransformSystem(), CoreSystemPhases.PRE_ACTORS, 0);
    add(new InputProjectionSystem(), CoreSystemPhases.PRE_ACTORS, 10);
    add(new RespawnSystem(this), CoreSystemPhases.PRE_ACTORS, 20);
    add(new MapCrossingSystem(), CoreSystemPhases.MAP_CROSSING, 0);
    add(new CurrentSystem(), CoreSystemPhases.ENVIRONMENT, 0);
    add(new ObstacleCollisionSystem(), CoreSystemPhases.ENVIRONMENT, 10);
    add(new FoodSystem(this), CoreSystemPhases.RESOURCES, 0);
    add(new PlantSystem(), CoreSystemPhases.RESOURCES, 10);
    add(new LifetimeSystem(), CoreSystemPhases.LIFETIMES, 0);
    add(new ProgressionGateSystem(), CoreSystemPhases.PROGRESSION, 0);
    add(new SpawnPopulationSystem(), CoreSystemPhases.SPAWNING, 0);
  }

  run(phase, engine, dt, extra = {}) {
    const context = { engine, registry: this.registry, componentSystems: this, ...extra };
    this.world.updatePhase(phase, dt, context);
    return context;
  }

  prepare(engine) { this.registry.sync(engine); }

  attachInput(events, engine) {
    const input = () => this.world.requireComponent(this.registry.inputEntity(), C.PLAYER_INPUT);
    const on = (event, listener) => events.subscribe(event, listener);
    const disposers = [
      on(GameEvents.INPUT_POINTER_MOVED, ({ x, y }) => { const state = input(); state.pointer.x = x; state.pointer.y = y; }),
      on(GameEvents.INPUT_MOVE_CHANGED, ({ direction, pressed }) => { input().keys[direction] = pressed; }),
      on(GameEvents.INPUT_BITE_CHANGED, ({ pressed }) => { input().bite = !!pressed; }),
      on(GameEvents.INPUT_RELEASED, () => { const state = input(); state.keys = {}; state.bite = false; }),
      on(GameEvents.FLOW_INPUT_SUPPRESSION_CHANGED, ({ suppressed }) => {
        const state = input(); state.suppressed = !!suppressed;
        if (state.suppressed) { state.keys = {}; state.bite = false; }
      }),
    ];
    return () => { for (const dispose of disposers) dispose(); };
  }

  integrate(entity, worldState, dt, drag, cap) {
    cap = cap || entity.maxSpeed || 99999;
    entity.vx *= Math.exp(-dt * drag); entity.vy *= Math.exp(-dt * drag);
    const speed = hyp(entity.vx, entity.vy);
    if (speed > cap) { entity.vx = entity.vx / speed * cap; entity.vy = entity.vy / speed * cap; }
    entity.x += entity.vx * dt; entity.y += entity.vy * dt;
    if (entity.x < entity.radius) { entity.x = entity.radius; entity.vx = Math.abs(entity.vx) * .3; }
    if (entity.x > worldState.W - entity.radius) { entity.x = worldState.W - entity.radius; entity.vx = -Math.abs(entity.vx) * .3; }
    if (entity.y < entity.radius) { entity.y = entity.radius; entity.vy = Math.abs(entity.vy) * .3; }
    if (entity.y > worldState.H - entity.radius) { entity.y = worldState.H - entity.radius; entity.vy = -Math.abs(entity.vy) * .3; }
  }

  addXp(player, engine, value) {
    if (engine.pendingEvolve || engine.dead || player.level >= MAX_LEVEL) return;
    player.xp += value * XP_MULT * (engine.talentBonus ? engine.talentBonus.xpMul : 1);
    while (player.level < MAX_LEVEL && player.xp >= xpNeed(player.level)) {
      player.xp -= xpNeed(player.level); player.level++; this.levelUp(player, engine);
    }
    const reachedMaximum = player.level >= MAX_LEVEL;
    if (reachedMaximum) player.xp = 0;
    engine.events.emit(GameEvents.PROGRESSION_XP_CHANGED, {
      entity: this.registry.entityFor(player), amount: value,
      level: player.level, xp: player.xp,
    });
    if (reachedMaximum) {
      if (engine.mp && engine.mp.role === 'host') engine.queueMpEvolution(player);
      else if (player.species.evolvesTo.length && !engine.mp) engine.triggerEvolve();
    }
  }

  levelUp(player, engine) {
    const oldMaximum = player.maxHp; player.applyLevelStats(engine);
    player.hp = Math.min(player.maxHp, player.hp + (player.maxHp - oldMaximum) + player.maxHp * .15);
    if (!engine.mp) engine.gainTalentPoint();
    engine.fx.push({ x: player.x, y: player.y, t: 0, max: .6, R: player.radius + 42, color: '#ffe27a', dir: 'out', width: 4 });
    engine.floaters.push({ x: player.x, y: player.y - player.radius - 12, vx: 0, vy: -34, text: `LEVEL ${player.level}`, life: 1.5, max: 1.5, color: '#ffe27a', size: 16 });
    engine.shake = Math.min(10, engine.shake + 3); engine.sfx.play('power');
    engine.events.emit(GameEvents.PROGRESSION_LEVEL_CHANGED, {
      entity: this.registry.entityFor(player), level: player.level,
      maxHp: player.maxHp, attackMultiplier: player.atkMul, speedMultiplier: player.spdMul,
    });
  }

  respawnPlayer(player, engine) {
    player.hp = player.maxHp; player.shield = 0; player.shieldT = 0; player.forceFieldT = 0; player.vx = 0; player.vy = 0;
    player.biteT = 0; player.cd = 0; player.hitSet = null;
    player.enrollT = player.burstT = player.frenzyT = player.withdrawT = player.stealthT = 0;
    player.ramT = player.jetT = player.bloomT = player.vortexT = player.burrowT = player.sprintT = player.graspT = 0;
    player.engulfT = player.engulfSwallowT = player.shockVisualT = player.inkCloudT = player.impaleT = player.crushT = 0;
    player.leapT = player.stompT = player.tailSweepT = player.webT = player.sprintMomentum = player.rebirthT = 0;
    player.engulfTarget = player.impaleTarget = player.hookTarget = null; player.burrowActive = player.hardenActive = 0;
    player.pinnedTarget = null; player.pinT = 0; player.vortexActive = 0; player.vortexReleased = 1;
    player.hardenStored = player.withdrawStored = player.filterCombo = player.camoCharge = player.fortify = player.sailHeat = player.barbCharge = 0;
    player.armorPlates = player.hasAbility('thickhide') ? 3 : 0;
    player.poisonT = player.poisonDps = player.poisonTick = player.venomStacks = player.venomMarkT = 0; player.poisonOwner = null;
    player.stunT = player.slowT = player.armorBreakT = player.vulnerableT = 0;
    player.castAbility = null; player.castT = 0; player.ramHit = null; player.rebirthUsed = false;
    player.vehicle = null; player.vehicleType = null; player.vehicleNetId = null; player.vehicleCreatureRadius = null;
    player.x = engine.W * (.2 + Math.random() * .6); player.y = engine.H * (.2 + Math.random() * .6); player.spawnProtT = 2.5;
    burst(engine, player.x, player.y, '#a0ffd8', 20, 200);
    engine.events.emit(GameEvents.WORLD_ENTITY_RESPAWNED, {
      entity: this.registry.entityFor(player), mapId: player.mapId || engine.mapId,
      x: player.x, y: player.y,
    });
  }

  triggerEvolution(engine, ascend = false) {
    engine.pendingEvolve = true; engine.paused = true;
    if (ascend) {
      engine.evolveMode = 'ascend'; engine.choices = engine.availablePioneers();
    } else {
      engine.choices = engine.player.species.evolvesTo.slice();
      engine.evolveMode = engine.isStageAdvance() ? 'advance' : 'normal';
    }
    engine.eggs.push({ x: engine.player.x, y: engine.player.y + engine.player.radius + 10, t: 0 });
    engine.sfx.play('egg'); engine.pushHud(true);
    engine.events.emit(GameEvents.PROGRESSION_EVOLUTION_OFFERED, {
      entity: this.registry.entityFor(engine.player), mode: engine.evolveMode,
      choices: engine.choices.slice(),
    });
  }

  dismissEvolution(engine, mode) {
    if (mode === 'advance' && engine.evolveMode !== 'advance') return;
    engine.pendingEvolve = false; engine.paused = false; engine.evolveMode = 'normal';
    engine.eggs.length = 0; engine.choices = [];
    if (mode === 'ascend') { engine.ascendOffered = true; engine.ascendAvailable = true; }
    if (mode === 'advance') engine.advanceAvailable = true;
    engine.pushHud(true);
  }

  chooseEvolution(engine, id) {
    if (!engine.pendingEvolve) return;
    const previousPlayer = engine.player, previousSpeciesId = previousPlayer.speciesId;
    const fromStage = engine.stage, toStage = speciesStage(id);
    engine.makePlayer(id); engine.era++;
    engine.pendingEvolve = false; engine.paused = false; engine.eggs.length = 0;
    engine.choices = []; engine.evolveMode = 'normal'; engine.advanceAvailable = false;
    if (toStage !== fromStage) {
      engine.ascendOffered = true; engine.ascendAvailable = false;
      engine.loadMap(firstMapOf(toStage));
      burst(engine, engine.player.x, engine.player.y, '#c2e89a', 30, 240); engine.shake = 10; engine.sfx.play('evolve');
    } else {
      burst(engine, engine.player.x, engine.player.y, '#8affd0', 30, 240); engine.shake = 8; engine.sfx.play('evolve');
      for (let i = 0; i < 4; i++) spawnRandomNpc(engine);
    }
    engine.pushHud(true);
    engine.events.emit(GameEvents.PROGRESSION_EVOLUTION_CHOSEN, {
      previousEntity: this.registry.entityFor(previousPlayer), previousSpeciesId,
      speciesId: id, fromStage, toStage,
    });
  }

  playerDied(engine, victim, attacker, multiplayer) {
    if (!victim || victim.deadT > 0) return;
    if (victim.vehicle) {
      if (this.exitVehicle) this.exitVehicle(engine, victim, true);
      else exitVehicle(engine, victim, true);
    }
    victim.hp = 0; victim.deadT = 3.5; victim.deaths = (victim.deaths || 0) + 1; victim.shield = 0; victim.forceFieldT = 0;
    if (multiplayer) {
      const killer = attacker && attacker !== victim && engine.allPlayers().includes(attacker) ? attacker : null;
      if (killer) killer.kills = (killer.kills || 0) + 1;
      const text = killer ? `${engine.mpNameOf(killer)} ate ${engine.mpNameOf(victim)}` : `${engine.mpNameOf(victim)} was eaten`;
      engine.mpAddFeed(text, killer ? engine.mpColorOf(killer) : '#cfd8e0');
      mpSendPacket(engine, PacketKinds.FEED, {
        text, color: killer ? engine.mpColorOf(killer) : '#cfd8e0',
      }, { broadcast: true });
    } else engine.releaseInput();
    burst(engine, victim.x, victim.y, '#ffd2d2', 26, 220); engine.sfx.play('kill'); engine.pushHud(true);
    engine.events.emit(GameEvents.WORLD_ENTITY_DIED, {
      entity: this.registry.entityFor(victim),
      killerEntity: attacker ? this.registry.entityFor(attacker) : null,
      multiplayer: !!multiplayer, mapId: victim.mapId || engine.mapId,
    });
  }

  destroy() { for (const dispose of this.disposers.splice(0).reverse()) dispose(); }
}

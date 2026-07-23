import { CoreComponentSystems, CoreSystemPhases } from './CoreComponentSystems.js';
import { activateAbility as runAbility } from './abilities.js';
import { updateAbilityRuntime as runAbilityRuntime } from './abilityRuntime.js';
import { useHeldItem, dropHeldItem, updateItems } from './items.js';
import {
  toggleVehicle, exitVehicle, updatePilotedVehicle, damageOccupiedVehicle, updateVehicles,
} from './vehicles.js';
import { GameEvents } from '../events.js';
import { rand } from '../../core/math.js';

export const GameplaySystemPhases = Object.freeze({
  ...CoreSystemPhases,
  ITEMS: 'gameplay:items',
  VEHICLES: 'gameplay:vehicles',
  STATUS_FACTS: 'gameplay:status-facts',
});

const STATUS_FIELDS = Object.freeze([
  'stunT', 'slowT', 'hardenT', 'armorBreakT', 'vulnerableT', 'conductiveT',
  'poisonT', 'venomStacks', 'venomMarkT', 'enrollT', 'burstT', 'frenzyT',
  'withdrawT', 'stealthT', 'ramT', 'jetT', 'vortexT', 'graspT', 'burrowT',
  'sprintT', 'webT', 'rebirthT',
]);

const entityOf = (adapter, source) => source ? adapter.entityFor(source) : null;

class ItemSystem {
  constructor(owner) { this.owner = owner; }
  update(_world, dt, { engine }) { this.owner.updateItems(engine, dt); }
}

class VehicleSystem {
  constructor(owner) { this.owner = owner; }
  update(_world, dt, { engine }) { this.owner.updateVehicles(engine, dt); }
}

class StatusFactSystem {
  constructor(owner) { this.owner = owner; }
  update(_world, _dt, { engine }) { this.owner.publishStatusChanges(engine, this.owner.frameStatuses); }
}

/* Phase 5 composition layer. The existing behavior modules remain useful as
   focused algorithms, but callers no longer import or schedule them directly.
   This coordinator owns command routing, ordered updates, component-backed
   entity dispatch, and the public fact stream. */
export class GameplayComponentSystems extends CoreComponentSystems {
  constructor(world, adapter) {
    super(world, adapter);
    const add = (system, phase, order) => this.disposers.push(world.addSystem(system, { phase, order }));
    add(new ItemSystem(this), GameplaySystemPhases.ITEMS, 0);
    add(new VehicleSystem(this), GameplaySystemPhases.VEHICLES, 0);
    add(new StatusFactSystem(this), GameplaySystemPhases.STATUS_FACTS, 0);
    this.frameStatuses = new Map();
  }

  prepare(engine) {
    super.prepare(engine);
    this.frameStatuses = this.captureStatuses(engine);
  }

  captureStatuses(game, targets = null) {
    const result = new Map();
    const players = game.allPlayers ? game.allPlayers() : game.player ? [game.player] : [];
    for (const target of targets || [...players, ...(game.creatures || [])]) {
      if (!target) continue;
      result.set(target, Object.fromEntries(STATUS_FIELDS.map(field => [field, target[field] || 0])));
    }
    return result;
  }

  publishStatusChanges(game, before, source = null) {
    for (const [target, oldState] of before) {
      for (const field of STATUS_FIELDS) {
        const previous = oldState[field] || 0, value = target[field] || 0;
        if (value <= previous) continue;
        game.events.emit(GameEvents.COMBAT_STATUS_APPLIED, {
          sourceEntity: entityOf(this.adapter, source), targetEntity: entityOf(this.adapter, target),
          status: field, duration: value, previous,
        });
        oldState[field] = value;
        const frameState = this.frameStatuses.get(target);
        if (frameState) frameState[field] = value;
      }
    }
  }

  applyStatus(game, source, target, status, duration, mode = 'max') {
    if (!target || !STATUS_FIELDS.includes(status) || !Number.isFinite(duration)) return false;
    const previous = target[status] || 0;
    target[status] = mode === 'add' ? previous + duration : Math.max(previous, duration);
    if (target[status] === previous) return false;
    game.events.emit(GameEvents.COMBAT_STATUS_APPLIED, {
      sourceEntity: entityOf(this.adapter, source), targetEntity: entityOf(this.adapter, target),
      status, duration: target[status], previous,
    });
    const frameState = this.frameStatuses.get(target);
    if (frameState) frameState[status] = target[status];
    return true;
  }

  startBite(player, game) {
    const before = player.cd;
    const result = player._startBite(game);
    if (player.cd !== before) game.events.emit(GameEvents.COMBAT_BITE_STARTED, {
      entity: entityOf(this.adapter, player), x: player.x, y: player.y, angle: player.angle,
    });
    return result;
  }

  resolveBite(player, game) {
    const before = new Set(player.hitSet || []);
    const result = player._resolveBite(game);
    for (const target of player.hitSet || []) {
      if (before.has(target)) continue;
      game.events.emit(GameEvents.COMBAT_BITE_HIT, {
        attackerEntity: entityOf(this.adapter, player), targetEntity: entityOf(this.adapter, target),
        targetKind: target.speciesId ? 'player' : target.amount != null ? 'plant' : 'creature',
      });
    }
    return result;
  }

  damagePlayer(player, game, damage, fromX, fromY, attacker = null) {
    const hp = player.hp, shield = player.shield || 0, evasionFlash = player.evasionFlashT || 0;
    const statuses = this.captureStatuses(game, [player, attacker]);
    const result = player._takeHit(game, damage, fromX, fromY, attacker);
    const hpDamage = Math.max(0, hp - player.hp), shieldDamage = Math.max(0, shield - (player.shield || 0));
    if (hpDamage || shieldDamage) game.events.emit(GameEvents.COMBAT_DAMAGED, {
      sourceEntity: entityOf(this.adapter, attacker), targetEntity: entityOf(this.adapter, player),
      requested: damage, damage: hpDamage, absorbed: shieldDamage, hp: player.hp, shield: player.shield || 0,
    });
    else {
      const dodged = (player.evasionFlashT || 0) > evasionFlash;
      game.events.emit(dodged ? GameEvents.COMBAT_DODGED : GameEvents.COMBAT_BLOCKED, {
        sourceEntity: entityOf(this.adapter, attacker), targetEntity: entityOf(this.adapter, player), requested: damage,
      });
    }
    if (hp > 0 && player.hp <= 0 && !(player.rebirthT > 0)) game.events.emit(GameEvents.COMBAT_KILLED, {
      sourceEntity: entityOf(this.adapter, attacker), targetEntity: entityOf(this.adapter, player),
      byPlayer: !!attacker?.speciesId, boss: null,
    });
    this.publishStatusChanges(game, statuses, attacker);
    return result;
  }

  damageCreature(creature, game, damage, fromX, fromY, byPlayer) {
    const hp = creature.hp, attacker = byPlayer ? game.worldPlayer() : null;
    const result = creature._takeDamage(game, damage, fromX, fromY, byPlayer);
    const applied = Math.max(0, hp - creature.hp);
    if (applied) game.events.emit(GameEvents.COMBAT_DAMAGED, {
      sourceEntity: entityOf(this.adapter, attacker), targetEntity: entityOf(this.adapter, creature),
      requested: damage, damage: applied, absorbed: Math.max(0, damage - applied), hp: creature.hp,
    });
    if (hp > 0 && creature.hp <= 0) this.killCreature(creature, game, byPlayer);
    return result;
  }

  killCreature(creature, game, byPlayer) {
    let result;
    if (creature.boss && creature._dieBoss) result = creature._dieBoss(game, byPlayer);
    else if (creature._dieEncounter) result = creature._dieEncounter(game, byPlayer);
    else result = creature._die(game, byPlayer);
    game.events.emit(GameEvents.COMBAT_KILLED, {
      targetEntity: entityOf(this.adapter, creature),
      sourceEntity: byPlayer ? entityOf(this.adapter, game.worldPlayer()) : null,
      byPlayer: !!byPlayer, boss: creature.bossKind || null,
    });
    return result;
  }

  activateAbility(game, index, actor) {
    const player = actor || game.player, beforeSeq = player?.castSeq || 0;
    const ability = player?.abilities?.[index], beforeWithdraw = player?.withdrawT || 0;
    const beforeBurrow = !!player?.burrowActive;
    const before = this.captureStatuses(game);
    const result = runAbility(game, index, actor);
    const recast = (ability === 'withdraw' && beforeWithdraw > 0 && player.withdrawT <= 0)
      || (ability === 'burrow' && beforeBurrow && !player.burrowActive);
    if (player && ((player.castSeq || 0) !== beforeSeq || recast)) game.events.emit(GameEvents.ABILITY_ACTIVATED, {
      entity: entityOf(this.adapter, player), index, ability, castSeq: player.castSeq, recast,
    });
    this.publishStatusChanges(game, before, player);
    return result;
  }

  updateAbilityRuntime(game, player, dt) {
    return runAbilityRuntime(game, player, dt);
  }

  useItem(game, actor, slot) {
    const held = actor?.items?.[slot], id = held?.id, before = this.captureStatuses(game);
    const used = useHeldItem(game, actor, slot);
    if (used) game.events.emit(GameEvents.ITEM_USED, { entity: entityOf(this.adapter, actor), slot, item: id });
    this.publishStatusChanges(game, before, actor);
    return used;
  }

  dropItem(game, actor, slot) {
    const id = actor?.items?.[slot]?.id, dropped = dropHeldItem(game, actor, slot);
    if (dropped) game.events.emit(GameEvents.ITEM_DROPPED, { entity: entityOf(this.adapter, actor), slot, item: id });
    return dropped;
  }

  updateItems(game, dt) {
    const players = game.allPlayers ? game.allPlayers() : game.player ? [game.player] : [];
    const before = new Map(players.map(player => [player, player.items.map(item => item?.id || null)]));
    updateItems(game, dt);
    for (const [player, slots] of before) player.items.forEach((item, slot) => {
      if (item && !slots[slot]) game.events.emit(GameEvents.ITEM_PICKED_UP, {
        entity: entityOf(this.adapter, player), slot, item: item.id,
      });
    });
  }

  toggleVehicle(game, actor) {
    const previous = actor?.vehicle || null, changed = toggleVehicle(game, actor);
    if (!changed) return false;
    game.events.emit(actor.vehicle ? GameEvents.VEHICLE_ENTERED : GameEvents.VEHICLE_EXITED, {
      entity: entityOf(this.adapter, actor), vehicleEntity: entityOf(this.adapter, actor.vehicle || previous),
      vehicleType: (actor.vehicle || previous)?.type || null,
    });
    return true;
  }

  exitVehicle(game, actor, silent = false) {
    const previous = actor?.vehicle || null, changed = exitVehicle(game, actor, silent);
    if (changed) game.events.emit(GameEvents.VEHICLE_EXITED, {
      entity: entityOf(this.adapter, actor), vehicleEntity: entityOf(this.adapter, previous), vehicleType: previous.type,
    });
    return changed;
  }

  updatePilotedVehicle(game, actor, dt) { return updatePilotedVehicle(game, actor, dt); }

  damageOccupiedVehicle(game, actor, damage) {
    const vehicle = actor?.vehicle, hp = vehicle?.hp;
    const handled = damageOccupiedVehicle(game, actor, damage);
    if (handled) game.events.emit(GameEvents.VEHICLE_DAMAGED, {
      entity: entityOf(this.adapter, vehicle), pilotEntity: entityOf(this.adapter, actor),
      damage: Math.max(0, hp - Math.max(0, vehicle.hp)), hp: Math.max(0, vehicle.hp),
    });
    if (handled && vehicle.hp <= 0) game.events.emit(GameEvents.VEHICLE_DESTROYED, {
      entity: entityOf(this.adapter, vehicle), pilotEntity: entityOf(this.adapter, actor), vehicleType: vehicle.type,
    });
    return handled;
  }

  updateVehicles(game, dt) { return updateVehicles(game, dt); }

  updateBoss(boss, game, dt) {
    boss.hurt = Math.max(0, boss.hurt - dt * 3); boss.mouth = Math.max(0, boss.mouth - dt * 3);
    boss.biteCd = Math.max(0, boss.biteCd - dt); boss.wanderT -= dt;
    if (boss.hpBarT > 0) boss.hpBarT -= dt;
    if (boss.stunT > 0) boss.stunT -= dt;
    if (boss.slowT > 0) boss.slowT -= dt;
    boss.armorBreakT = Math.max(0, boss.armorBreakT - dt);
    boss.vulnerableT = Math.max(0, boss.vulnerableT - dt);
    boss.conductiveT = Math.max(0, boss.conductiveT - dt);
    boss.venomMarkT = Math.max(0, boss.venomMarkT - dt);
    if (boss.venomMarkT <= 0) boss.venomStacks = 0;
    if ((boss.poisonT || 0) > 0) {
      boss.poisonT -= dt; boss.hp -= (boss.poisonDps || 0) * dt; boss.hpBarT = Math.max(boss.hpBarT, 1.2);
      if (game.particles.length < 300 && Math.random() < dt * 6) game.particles.push({
        x: boss.x + rand(-6, 6), y: boss.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-30, -6),
        life: .5, max: .5, size: 2, color: 'rgba(176,224,94,0.7)',
      });
      if (boss.hp <= 0) { this.killCreature(boss, game, true); return; }
    }
    return boss._actBoss(game, dt);
  }

  beginBossSpecial(game, boss, target) {
    if (boss.bossKind === 'panderodus') boss._beginPanderodusSpecial(game, target);
    else boss._beginSpecial(game, target);
    this.bossTelegraphStarted(game, boss);
  }

  beginBossTail(game, boss) {
    boss._beginPanderodusTail(game);
    this.bossTelegraphStarted(game, boss);
  }

  resolveBossSpecial(game, boss) {
    const telegraph = boss.telegraph;
    if (!telegraph) return;
    if (boss.bossKind === 'panderodus') boss._resolvePanderodusSpecial(game);
    else boss._resolveSpecial(game);
    this.bossTelegraphResolved(game, boss, telegraph);
  }

  bossTelegraphStarted(game, boss) {
    const telegraph = boss.telegraph;
    if (!telegraph) return;
    game.events.emit(GameEvents.BOSS_TELEGRAPH_STARTED, {
      entity: entityOf(this.adapter, boss), boss: boss.bossKind, special: telegraph.special,
      shape: telegraph.shape, duration: telegraph.max,
    });
  }

  bossTelegraphResolved(game, boss, telegraph) {
    if (!telegraph) return;
    game.events.emit(GameEvents.BOSS_TELEGRAPH_RESOLVED, {
      entity: entityOf(this.adapter, boss), boss: boss.bossKind, special: telegraph.special, shape: telegraph.shape,
    });
  }

  bossDefeated(game, boss) {
    game.events.emit(GameEvents.BOSS_DEFEATED, {
      entity: entityOf(this.adapter, boss), boss: boss.bossKind, perk: boss.perk,
    });
  }
}

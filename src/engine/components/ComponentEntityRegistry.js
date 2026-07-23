import { ComponentTypes as C } from './componentTypes.js';

const COLLECTION_KINDS = Object.freeze({
  remotePlayers: 'remote-player', creatures: 'creature', plants: 'plant', food: 'food',
  worldItems: 'world-item', itemProjectiles: 'item-projectile', vehicles: 'vehicle',
  webs: 'web', obstacles: 'obstacle', flow: 'current-streak', particles: 'particle',
  bubbles: 'bubble', eggs: 'egg', fx: 'effect', floaters: 'floater',
});

const PLAYER_KINDS = new Set(['player', 'remote-player']);
const CURRENT_KINDS = new Map([
  ['player', { factor: 1, bounded: true }],
  ['remote-player', { factor: 1, bounded: true }],
  ['creature', { factor: 1, bounded: true }],
  ['food', { factor: .8, bounded: false }],
]);

const shallowEqual = (left, right) => {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(key => Object.is(left[key], right[key]));
};

const visualKey = source => source.speciesId || source.bossKind || source.key || source.type || source.kind || source.visual || 'generic';
const owns = (source, key) => Object.prototype.hasOwnProperty.call(source, key);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

const COMBAT_FIELDS = [
  'dmg', 'atkMul', 'cd', 'biteT', 'biteAnim', 'biteCd', 'mouth', 'hurt', 'hpBarT',
  'lastHurtT', 'kills',
];
const STATUS_FIELDS = [
  'stunT', 'slowT', 'hardenT', 'armorBreakT', 'vulnerableT', 'conductiveT',
  'poisonT', 'poisonDps', 'poisonTick', 'venomStacks', 'venomMarkT',
  'enrollT', 'burstT', 'frenzyT', 'bloomT', 'withdrawT', 'stealthT', 'ramT',
  'jetT', 'vortexT', 'graspT', 'burrowT', 'sprintT', 'webT', 'rebirthT',
];
const ABILITY_STATE_FIELDS = [
  'acd', 'castAbility', 'castT', 'castSeq', 'hardenActive', 'hardenStored',
  'withdrawStored', 'burstBreach', 'bloomTick', 'bloomPoints',
  'ramAngle', 'vortexTick', 'vortexX', 'vortexY', 'vortexActive',
  'vortexReleased', 'graspX', 'graspY', 'shockEchoT', 'shockEchoX', 'shockEchoY',
  'engulfT', 'engulfSwallowT', 'engulfAngle', 'shockVisualT',
  'inkCloudT', 'inkX', 'inkY', 'decoyX', 'decoyY', 'decoyAngle',
  'impaleT', 'impaleAngle', 'impaleReach', 'crushT', 'crushAngle',
  'leapT', 'leapMax', 'leapKind', 'burrowActive', 'pinT',
  'stompT', 'stompX', 'stompY', 'tailSweepT', 'sprintMomentum',
  'hookT', 'senseCd', 'evasionFlashT', 'evasionBoostT',
  'regenDelay', 'filterCombo', 'filterComboT', 'camoCharge', 'camoFlashT',
  'armorPlates', 'plateRegenT', 'fortify', 'sailHeat', 'airStride', 'barbCharge',
  'rebirthUsed',
];
const ITEM_FIELDS = ['type', 'uses', 'pickupDelay', 'phase', 'armed', 'tick', 'visual', 'ownerConn'];
const PROJECTILE_FIELDS = [
  'type', 'visual', 'damage', 'blast', 'shockRadius', 'shockwave', 'timed',
  'impactBlast', 'blackHoleCharge', 'phase', 'tick', 'ownerConn',
];
const VEHICLE_FIELDS = [
  'type', 'hp', 'maxHp', 'weaponCd', 'occupantConn', 'hurt',
  'shotSide', 'timeLeft', 'netId',
];
const PILOT_FIELDS = ['vehicleType', 'vehicleNetId', 'vehicleCreatureRadius'];
const BOSS_FIELDS = [
  'bossKind', 'title', 'short', 'perk', 'meatBiomass', 'home', 'leash',
  'engaged', 'abilT', 'dashT', 'specialCount', 'panderodusMode',
  'stateT', 'passIndex', 'passDirection', 'passY', 'passPauseT',
  'chargeAngle', 'latchConn', 'latchT', 'drainTick', 'screamT',
  'tailSlapCd', 'tailSlapT', 'impactT', 'impactX', 'impactY', 'impactAngle', 'impactSeq',
];

/* Maps the simulation's source objects to component entity IDs and owns the
   component-backed property accessors used by gameplay methods and network
   serializers. ComponentWorld remains authoritative for migrated state; no
   source object is stored inside a component record. */
export class ComponentEntityRegistry {
  constructor(world) {
    this.world = world;
    this.records = new Map();
    this.sources = new Map();
    this.runtimeRecord = null;
  }

  sync(engine) {
    this.syncRuntime(engine);
    const present = new Set();
    /* Host map worlds are swapped onto Engine one at a time. Keep component
       records for inactive worlds alive, and only initialize sources that were
       newly spawned since that map's last simulation pass. Existing sources
       remain current through their component-backed accessors. */
    if (engine.mp?.role === 'host' && engine.mp.worlds) {
      for (const state of engine.mp.worlds.values()) {
        for (const [field, kind] of Object.entries(COLLECTION_KINDS)) {
          const sources = state[field];
          if (!Array.isArray(sources)) continue;
          for (const source of sources) {
            present.add(source);
            if (!this.records.has(source)) {
              this.syncSource(source, kind, engine, present, { mapId: state.mapId, stage: state.stage });
            }
          }
        }
      }
    }
    if (engine.player) this.syncSource(engine.player, 'player', engine, present);
    for (const [field, kind] of Object.entries(COLLECTION_KINDS)) {
      for (const source of engine[field] || []) this.syncSource(source, kind, engine, present);
    }
    for (const [source, record] of this.records) {
      if (present.has(source)) continue;
      this.forget(source, record);
    }
  }

  syncRuntime(engine) {
    let record = this.runtimeRecord;
    if (!record || !this.world.hasEntity(record.entity)) {
      record = this.makeRecord(engine, 'runtime');
      this.runtimeRecord = record;
    }
    const input = this.ensureComponent(record, C.PLAYER_INPUT, {
      keys: engine.keys || {}, pointer: engine.mouse || { x: 0, y: 0 },
      worldPointer: engine.worldMouse || { x: 0, y: 0 },
      bite: !!engine.biteHeld, suppressed: !!engine.inputSuppressed,
    });
    this.bind(record, engine, input, [
      ['keys', 'keys'], ['mouse', 'pointer'], ['worldMouse', 'worldPointer'],
      ['biteHeld', 'bite'], ['inputSuppressed', 'suppressed'],
    ]);

    const talents = this.ensureComponent(record, C.TALENTS, { state: engine.talent, bonus: engine.talentBonus });
    this.bind(record, engine, talents, [['talent', 'state'], ['talentBonus', 'bonus']]);
    const perks = this.ensureComponent(record, C.PERKS, { state: engine.perks, defeated: engine.bossesDefeated });
    this.bind(record, engine, perks, [['perks', 'state'], ['bossesDefeated', 'defeated']]);
    const evolution = this.ensureComponent(record, C.EVOLUTION, {
      era: engine.era, pending: engine.pendingEvolve, choices: engine.choices,
      mode: engine.evolveMode, ascendOffered: engine.ascendOffered,
      ascendAvailable: engine.ascendAvailable, advanceAvailable: engine.advanceAvailable,
    });
    this.bind(record, engine, evolution, [
      ['era', 'era'], ['pendingEvolve', 'pending'], ['choices', 'choices'], ['evolveMode', 'mode'],
      ['ascendOffered', 'ascendOffered'], ['ascendAvailable', 'ascendAvailable'], ['advanceAvailable', 'advanceAvailable'],
    ]);
    this.write(record, C.IDENTITY, { kind: 'runtime', visualKey: 'runtime', speciesId: null, bossKind: null, localPlayer: false });
  }

  syncSource(source, kind, engine, present = null, memberContext = null) {
    if (!source || typeof source !== 'object') return null;
    if (present) present.add(source);
    let record = this.records.get(source);
    if (!record || !this.world.hasEntity(record.entity)) {
      if (record) this.sources.delete(record.entity);
      record = this.makeRecord(source, kind);
      this.records.set(source, record); this.sources.set(record.entity, source);
    }
    record.kind = kind;

    const transform = this.ensureComponent(record, C.TRANSFORM, {
      x: finite(source.x), y: finite(source.y), angle: finite(source.angle), faceTarget: finite(source.faceTarget),
    });
    this.bind(record, source, transform, [
      ['x', 'x'], ['y', 'y'],
      ...(owns(source, 'angle') ? [['angle', 'angle']] : []),
      ...(owns(source, 'faceTarget') ? [['faceTarget', 'faceTarget']] : []),
    ]);
    const previous = this.ensureComponent(record, C.PREVIOUS_TRANSFORM, {
      x: transform.x, y: transform.y, angle: transform.angle,
    });

    let motion = null;
    if (owns(source, 'vx') || owns(source, 'vy') || owns(source, 'maxSpeed')) {
      motion = this.ensureComponent(record, C.MOTION, {
        vx: finite(source.vx), vy: finite(source.vy), maxSpeed: finite(source.maxSpeed),
      });
      this.bind(record, source, motion, [
        ...(owns(source, 'vx') ? [['vx', 'vx']] : []),
        ...(owns(source, 'vy') ? [['vy', 'vy']] : []),
        ...(owns(source, 'maxSpeed') ? [['maxSpeed', 'maxSpeed']] : []),
      ]);
    }

    let collider = null;
    if (owns(source, 'radius') || owns(source, 'r')) {
      const radiusField = owns(source, 'radius') ? 'radius' : 'r';
      collider = this.ensureComponent(record, C.COLLIDER, { radius: finite(source[radiusField]) });
      this.bind(record, source, collider, [[radiusField, 'radius']]);
    }

    const mapMember = this.ensureComponent(record, C.MAP_MEMBER, {
      mapId: source.mapId || memberContext?.mapId || engine.mapId,
      stage: memberContext?.stage || engine.stage,
    });
    if (owns(source, 'mapId')) this.bind(record, source, mapMember, [['mapId', 'mapId']]);
    else mapMember.mapId = memberContext?.mapId || engine.mapId;
    mapMember.stage = memberContext?.stage || engine.stage;

    let health = null;
    if (owns(source, 'hp') || owns(source, 'maxHp')) {
      health = this.ensureComponent(record, C.HEALTH, { hp: finite(source.hp), maxHp: finite(source.maxHp) });
      this.bind(record, source, health, [
        ...(owns(source, 'hp') ? [['hp', 'hp']] : []),
        ...(owns(source, 'maxHp') ? [['maxHp', 'maxHp']] : []),
      ]);
    }

    const combat = this.bindOwned(record, source, C.COMBAT, COMBAT_FIELDS);
    const status = this.bindOwned(record, source, C.STATUS, STATUS_FIELDS);
    const shield = this.bindOwned(record, source, C.SHIELD, ['shield', 'shieldMax', 'shieldT', 'forceFieldT']);
    const abilityLoadout = this.bindOwned(record, source, C.ABILITY_LOADOUT, ['abilities']);
    const abilityState = this.bindOwned(record, source, C.ABILITY_STATE, ABILITY_STATE_FIELDS);
    const inventory = this.bindOwned(record, source, C.INVENTORY, ['items']);
    const pilot = this.bindOwned(record, source, C.VEHICLE_PILOT, PILOT_FIELDS);
    const boss = source.boss ? this.bindOwned(record, source, C.BOSS, BOSS_FIELDS) : null;
    const telegraph = owns(source, 'telegraph') ? this.bindOwned(record, source, C.TELEGRAPH, ['telegraph']) : null;
    const item = kind === 'world-item' ? this.bindOwned(record, source, C.ITEM, ITEM_FIELDS) : null;
    const projectile = kind === 'item-projectile' ? this.bindOwned(record, source, C.PROJECTILE, PROJECTILE_FIELDS) : null;
    const vehicle = kind === 'vehicle' ? this.bindOwned(record, source, C.VEHICLE, VEHICLE_FIELDS) : null;
    const remoteInput = kind === 'remote-player' && owns(source, 'input')
      ? this.ensureComponent(record, C.REMOTE_INPUT, { state: source.input })
      : null;
    if (remoteInput) this.bind(record, source, remoteInput, [['input', 'state']]);
    const networkReplica = (owns(source, 'gx') || owns(source, 'gy') || owns(source, 'ga'))
      ? this.bindOwned(record, source, C.NETWORK_REPLICA, ['gx', 'gy', 'ga', 'snapshotSeq'])
      : null;
    const networkFields = [
      ...(owns(source, 'connId') ? [['connId', 'connId']] : []),
      ...(owns(source, 'netId') ? [['netId', 'netId']] : []),
    ];
    const networkIdentity = networkFields.length
      ? this.ensureComponent(record, C.NETWORK_IDENTITY, {
        connId: source.connId ?? null, netId: source.netId ?? null,
      })
      : null;
    if (networkIdentity) this.bind(record, source, networkIdentity, networkFields);

    let experience = null;
    if (owns(source, 'level') || owns(source, 'xp')) {
      experience = this.ensureComponent(record, C.EXPERIENCE, { level: finite(source.level, 1), xp: finite(source.xp) });
      this.bind(record, source, experience, [
        ...(owns(source, 'level') ? [['level', 'level']] : []),
        ...(owns(source, 'xp') ? [['xp', 'xp']] : []),
      ]);
    }

    let respawn = null;
    if (owns(source, 'deadT') || owns(source, 'spawnProtT') || owns(source, 'deaths')) {
      respawn = this.ensureComponent(record, C.RESPAWN, {
        deadT: finite(source.deadT), spawnProtT: finite(source.spawnProtT), deaths: finite(source.deaths),
      });
      this.bind(record, source, respawn, [
        ...(owns(source, 'deadT') ? [['deadT', 'deadT']] : []),
        ...(owns(source, 'spawnProtT') ? [['spawnProtT', 'spawnProtT']] : []),
        ...(owns(source, 'deaths') ? [['deaths', 'deaths']] : []),
      ]);
    }

    let lifetime = null;
    const lifetimeFields = [
      ...(owns(source, 'life') ? [['life', 'life']] : []),
      ...(owns(source, 't') ? [['t', 'time']] : []),
      ...(owns(source, 'timeLeft') ? [['timeLeft', 'timeLeft']] : []),
    ];
    if (lifetimeFields.length) {
      lifetime = this.ensureComponent(record, C.LIFETIME, {
        life: owns(source, 'life') ? source.life : null,
        time: owns(source, 't') ? source.t : null,
        timeLeft: owns(source, 'timeLeft') ? source.timeLeft : null,
        max: owns(source, 'max') ? source.max : null,
      });
      this.bind(record, source, lifetime, lifetimeFields);
    }

    if (kind === 'food') {
      const food = this.ensureComponent(record, C.FOOD, { value: finite(source.value), kind: source.kind || 'meat' });
      this.bind(record, source, food, [['value', 'value'], ['kind', 'kind']]);
    }
    if (kind === 'plant') {
      const plant = this.ensureComponent(record, C.PLANT, {
        amount: finite(source.amount), max: finite(source.max), value: finite(source.value),
        regen: finite(source.regen), eatCd: finite(source.eatCd),
      });
      this.bind(record, source, plant, [
        ['amount', 'amount'], ['max', 'max'], ['value', 'value'], ['regen', 'regen'], ['eatCd', 'eatCd'],
      ]);
    }
    if (kind === 'obstacle') this.write(record, C.OBSTACLE, { kind: source.kind || 'obstacle' });
    if (source.speciesId) this.write(record, C.SPECIES, { id: source.speciesId });

    const currentConfig = CURRENT_KINDS.get(kind);
    if (currentConfig) {
      const disabled = kind === 'creature' ? !!source.boss : PLAYER_KINDS.has(kind) ? !!source.vehicle || (respawn && respawn.deadT > 0) : false;
      this.write(record, C.CURRENT_AFFECTED, { ...currentConfig, disabled });
    }

    const values = {
      [C.IDENTITY]: {
        kind, visualKey: visualKey(source), speciesId: source.speciesId || null,
        bossKind: source.bossKind || null, localPlayer: source === engine.player,
      },
      [C.TRANSFORM]: transform,
      [C.PREVIOUS_TRANSFORM]: previous,
      [C.MAP_MEMBER]: mapMember,
      [C.RENDERABLE]: {
        kind, visualKey: visualKey(source), radius: collider ? collider.radius : finite(source.size),
        plan: this.planFor(record, source.plan), color: source.color || null, hidden: !!source.hidden,
      },
    };
    if (motion) values[C.MOTION] = motion;
    if (collider) values[C.COLLIDER] = collider;
    if (health) values[C.HEALTH] = health;
    if (experience) values[C.EXPERIENCE] = experience;
    if (respawn) values[C.RESPAWN] = respawn;
    if (lifetime) values[C.LIFETIME] = lifetime;
    if (combat) values[C.COMBAT] = combat;
    if (status) values[C.STATUS] = status;
    if (shield) values[C.SHIELD] = shield;
    if (abilityLoadout) values[C.ABILITY_LOADOUT] = abilityLoadout;
    if (abilityState) values[C.ABILITY_STATE] = abilityState;
    if (inventory) values[C.INVENTORY] = inventory;
    if (item) values[C.ITEM] = item;
    if (projectile) values[C.PROJECTILE] = projectile;
    if (vehicle) values[C.VEHICLE] = vehicle;
    if (pilot) values[C.VEHICLE_PILOT] = pilot;
    if (boss) values[C.BOSS] = boss;
    if (telegraph) values[C.TELEGRAPH] = telegraph;
    if (remoteInput) values[C.REMOTE_INPUT] = remoteInput;
    if (networkReplica) values[C.NETWORK_REPLICA] = networkReplica;
    if (networkIdentity) values[C.NETWORK_IDENTITY] = networkIdentity;

    for (const [type, value] of Object.entries(values)) this.write(record, type, value);
    const managed = new Set(Object.keys(values));
    if (currentConfig) managed.add(C.CURRENT_AFFECTED);
    if (kind === 'food') managed.add(C.FOOD);
    if (kind === 'plant') managed.add(C.PLANT);
    if (kind === 'obstacle') managed.add(C.OBSTACLE);
    if (source.speciesId) managed.add(C.SPECIES);
    for (const type of [...record.values.keys()]) {
      if (managed.has(type) && this.world.hasComponent(record.entity, type)) continue;
      this.world.removeComponent(record.entity, type); record.values.delete(type);
    }
    return record.entity;
  }

  makeRecord(source, kind) {
    const record = {
      entity: this.world.createEntity(), source, kind, values: new Map(), bindings: new Map(),
      planSource: null, planSnapshot: null,
    };
    return record;
  }

  ensureComponent(record, type, initial) {
    let component = this.world.getComponent(record.entity, type);
    if (!component) {
      component = { ...initial };
      this.world.setComponent(record.entity, type, component);
    }
    record.values.set(type, component);
    return component;
  }

  bindOwned(record, source, type, fields) {
    const present = fields.filter(field => owns(source, field));
    if (!present.length) return null;
    const component = this.ensureComponent(record, type, Object.fromEntries(present.map(field => [field, source[field]])));
    this.bind(record, source, component, present.map(field => [field, field]));
    return component;
  }

  bind(record, source, component, fields) {
    for (const [sourceKey, componentKey] of fields) {
      const active = record.bindings.get(sourceKey);
      if (active && active.component === component && active.key === componentKey) continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, sourceKey);
      if (descriptor && descriptor.configurable === false) continue;
      const current = source[sourceKey];
      if (current !== undefined) component[componentKey] = current;
      Object.defineProperty(source, sourceKey, {
        configurable: true, enumerable: true,
        get: () => component[componentKey],
        set: value => { component[componentKey] = value; },
      });
      record.bindings.set(sourceKey, { component, key: componentKey });
    }
  }

  planFor(record, plan) {
    if (!plan || typeof plan !== 'object') {
      record.planSource = plan || null; record.planSnapshot = null; return null;
    }
    if (record.planSource === plan && record.planSnapshot && shallowEqual(record.planSnapshot, plan)) return record.planSnapshot;
    record.planSource = plan; record.planSnapshot = Object.freeze({ ...plan });
    return record.planSnapshot;
  }

  write(record, type, value) {
    if (shallowEqual(record.values.get(type), value)) return;
    record.values.set(type, value);
    this.world.setComponent(record.entity, type, value);
  }

  forget(source, record = this.records.get(source)) {
    if (!record) return false;
    this.world.destroyEntity(record.entity);
    this.sources.delete(record.entity); this.records.delete(source);
    return true;
  }

  sourceFor(entity) { return this.sources.get(entity) || (this.runtimeRecord?.entity === entity ? this.runtimeRecord.source : null); }
  recordFor(source) { return this.records.get(source) || null; }
  entityFor(source) { return this.records.get(source)?.entity || null; }
  componentFor(source, type) {
    const entity = this.entityFor(source);
    return entity == null ? undefined : this.world.getComponent(entity, type);
  }
  inputEntity() { return this.runtimeRecord?.entity || null; }
  size() { return this.records.size; }

  destroy() {
    for (const record of this.records.values()) this.world.destroyEntity(record.entity);
    if (this.runtimeRecord) this.world.destroyEntity(this.runtimeRecord.entity);
    this.records.clear(); this.sources.clear(); this.runtimeRecord = null;
  }
}

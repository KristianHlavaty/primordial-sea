import { ComponentTypes as C } from './componentTypes.js';

const COLLECTION_KINDS = Object.freeze({
  remotePlayers: 'remote-player', creatures: 'creature', plants: 'plant', food: 'food',
  worldItems: 'world-item', itemProjectiles: 'item-projectile', vehicles: 'vehicle',
  webs: 'web', obstacles: 'obstacle', flow: 'current-streak', particles: 'particle',
  bubbles: 'bubble', eggs: 'egg', fx: 'effect', floaters: 'floater',
});

const shallowEqual = (left, right) => {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(key => Object.is(left[key], right[key]));
};

const visualKey = source => source.speciesId || source.bossKind || source.key || source.type || source.kind || source.visual || 'generic';

/* Temporary one-way projection from legacy object collections into component
   data. Source bookkeeping is the adapter's concern; no source object is stored
   in a component and the mirror never drives simulation. */
export class LegacyComponentMirror {
  constructor(world) {
    this.world = world;
    this.records = new Map();
  }

  sync(engine) {
    const present = new Set();
    if (engine.player) this.syncSource(engine.player, 'player', engine, present);
    for (const [field, kind] of Object.entries(COLLECTION_KINDS)) {
      for (const source of engine[field] || []) this.syncSource(source, kind, engine, present);
    }
    for (const [source, record] of this.records) {
      if (present.has(source)) continue;
      this.world.destroyEntity(record.entity);
      this.records.delete(source);
    }
  }

  syncSource(source, kind, engine, present) {
    if (!source || typeof source !== 'object') return;
    present.add(source);
    let record = this.records.get(source);
    if (!record || !this.world.hasEntity(record.entity)) {
      record = {
        entity: this.world.createEntity(), values: new Map(),
        planSource: null, planSnapshot: null,
      };
      this.records.set(source, record);
    }
    const values = {
      [C.LEGACY_IDENTITY]: {
        kind, visualKey: visualKey(source), speciesId: source.speciesId || null,
        bossKind: source.bossKind || null, localPlayer: source === engine.player,
      },
      [C.TRANSFORM]: {
        x: Number(source.x) || 0, y: Number(source.y) || 0,
        angle: Number(source.angle) || 0,
      },
      [C.MOTION]: { vx: Number(source.vx) || 0, vy: Number(source.vy) || 0 },
      [C.MAP_MEMBER]: { mapId: source.mapId || engine.mapId, stage: engine.stage },
      [C.RENDERABLE]: {
        kind, visualKey: visualKey(source), radius: Number(source.radius ?? source.r ?? source.size) || 0,
        plan: this.planFor(record, source.plan), color: source.color || null, hidden: !!source.hidden,
      },
    };
    if (Number.isFinite(source.hp) || Number.isFinite(source.maxHp)) {
      values[C.HEALTH] = { hp: Number(source.hp) || 0, maxHp: Number(source.maxHp) || 0, dead: source.deadT > 0 };
    }
    if (Number.isFinite(source.life) || Number.isFinite(source.t) || Number.isFinite(source.timeLeft)) {
      values[C.LIFETIME] = {
        life: Number.isFinite(source.life) ? source.life : null,
        time: Number.isFinite(source.t) ? source.t : null,
        timeLeft: Number.isFinite(source.timeLeft) ? source.timeLeft : null,
      };
    }
    if (source.connId != null || source.netId != null) {
      values[C.NETWORK_IDENTITY] = { connId: source.connId ?? null, netId: source.netId ?? null };
    }

    for (const [type, value] of Object.entries(values)) this.write(record, type, value);
    for (const type of [...record.values.keys()]) {
      if (Object.prototype.hasOwnProperty.call(values, type)) continue;
      this.world.removeComponent(record.entity, type); record.values.delete(type);
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

  entityFor(source) { return this.records.get(source)?.entity || null; }
  size() { return this.records.size; }

  destroy() {
    for (const record of this.records.values()) this.world.destroyEntity(record.entity);
    this.records.clear();
  }
}

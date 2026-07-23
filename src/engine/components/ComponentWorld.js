import { EventBus } from '../../core/EventBus.js';
import { GameEvents } from '../events.js';

/* Minimal ECS storage for the staged rewrite. Components are plain records,
   entities are stable numeric IDs, and systems run in an explicit order. */
export class ComponentWorld {
  constructor({ events = null } = {}) {
    this.events = events || new EventBus();
    this.ownsEvents = !events;
    this.nextEntity = 1;
    this.alive = new Set();
    this.components = new Map();
    this.systems = [];
    this.nextSystemOrder = 0;
    this.pending = [];
    this.pendingCreates = new Set();
    this.pendingDestroys = new Set();
    this.updating = false;
    this.flushing = false;
  }

  createEntity(initialComponents = {}) {
    const entity = this.nextEntity++;
    const entries = Object.entries(initialComponents);
    if (this.shouldDefer()) {
      this.pendingCreates.add(entity);
      this.pending.push(() => {
        this.pendingCreates.delete(entity);
        this.applyCreate(entity, entries);
      });
    } else this.applyCreate(entity, entries);
    return entity;
  }

  applyCreate(entity, entries) {
    if (this.pendingDestroys.has(entity)) return;
    this.alive.add(entity);
    this.events.emit(GameEvents.WORLD_ENTITY_CREATED, { entity });
    for (const [type, value] of entries) this.applySetComponent(entity, type, value);
  }

  destroyEntity(entity) {
    if (!this.isKnown(entity) || this.pendingDestroys.has(entity)) return false;
    if (this.shouldDefer()) {
      this.pendingDestroys.add(entity);
      this.pending.push(() => this.applyDestroy(entity));
    } else this.applyDestroy(entity);
    return true;
  }

  applyDestroy(entity) {
    this.pendingDestroys.delete(entity);
    this.pendingCreates.delete(entity);
    if (!this.alive.delete(entity)) return;
    for (const [type, store] of this.components) {
      if (!store.has(entity)) continue;
      const component = store.get(entity);
      store.delete(entity);
      this.events.emit(GameEvents.WORLD_COMPONENT_REMOVED, { entity, type, component });
      if (!store.size) this.components.delete(type);
    }
    this.events.emit(GameEvents.WORLD_ENTITY_DESTROYED, { entity });
  }

  setComponent(entity, type, component) {
    this.assertKnown(entity);
    this.assertType(type);
    if (this.shouldDefer()) this.pending.push(() => {
      if (this.alive.has(entity) && !this.pendingDestroys.has(entity)) this.applySetComponent(entity, type, component);
    });
    else this.applySetComponent(entity, type, component);
    return component;
  }

  applySetComponent(entity, type, component) {
    this.assertType(type);
    let store = this.components.get(type);
    if (!store) { store = new Map(); this.components.set(type, store); }
    const previous = store.get(entity), existed = store.has(entity);
    store.set(entity, component);
    this.events.emit(existed ? GameEvents.WORLD_COMPONENT_CHANGED : GameEvents.WORLD_COMPONENT_ADDED,
      { entity, type, component, previous });
  }

  removeComponent(entity, type) {
    this.assertKnown(entity);
    this.assertType(type);
    if (this.shouldDefer()) this.pending.push(() => this.applyRemoveComponent(entity, type));
    else return this.applyRemoveComponent(entity, type);
    return true;
  }

  applyRemoveComponent(entity, type) {
    const store = this.components.get(type);
    if (!store || !store.has(entity)) return false;
    const component = store.get(entity);
    store.delete(entity);
    if (!store.size) this.components.delete(type);
    this.events.emit(GameEvents.WORLD_COMPONENT_REMOVED, { entity, type, component });
    return true;
  }

  hasEntity(entity) { return this.alive.has(entity); }
  hasComponent(entity, type) { return !!this.components.get(type)?.has(entity); }
  getComponent(entity, type) { return this.components.get(type)?.get(entity); }

  requireComponent(entity, type) {
    const component = this.getComponent(entity, type);
    if (component === undefined) throw new Error(`Entity ${entity} has no ${type} component`);
    return component;
  }

  query(...types) {
    for (const type of types) this.assertType(type);
    if (!types.length) return [...this.alive];
    const stores = types.map(type => this.components.get(type));
    if (stores.some(store => !store)) return [];
    const smallest = stores.reduce((best, store) => store.size < best.size ? store : best);
    const entities = [];
    for (const entity of smallest.keys()) {
      if (this.alive.has(entity) && stores.every(store => store.has(entity))) entities.push(entity);
    }
    return entities.sort((a, b) => a - b);
  }

  forEach(types, visitor) {
    for (const entity of this.query(...types)) {
      visitor(entity, ...types.map(type => this.components.get(type).get(entity)));
    }
  }

  addSystem(system, { order = 0, phase = 'main' } = {}) {
    const update = typeof system === 'function' ? system : system && system.update;
    if (typeof update !== 'function') throw new TypeError('A system must be a function or expose update()');
    if (typeof phase !== 'string' || !phase) throw new TypeError('A system phase must be a non-empty string');
    const entry = { system, update, phase, order: Number.isFinite(order) ? order : 0, added: this.nextSystemOrder++ };
    this.systems.push(entry);
    this.systems.sort((a, b) => a.order - b.order || a.added - b.added);
    if (typeof system.start === 'function') system.start(this);
    return () => this.removeSystem(entry);
  }

  removeSystem(entryOrSystem) {
    const index = this.systems.findIndex(entry => entry === entryOrSystem || entry.system === entryOrSystem);
    if (index < 0) return false;
    const [entry] = this.systems.splice(index, 1);
    if (typeof entry.system.stop === 'function') entry.system.stop(this);
    return true;
  }

  update(dt, context = null) {
    this.updatePhase('main', dt, context);
  }

  updatePhase(phase, dt, context = null) {
    if (this.updating) throw new Error('ComponentWorld.update() cannot be nested');
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('ComponentWorld dt must be a non-negative finite number');
    if (typeof phase !== 'string' || !phase) throw new TypeError('ComponentWorld phase must be a non-empty string');
    this.updating = true;
    try {
      for (const entry of this.systems.slice()) {
        if (entry.phase === phase) entry.update.call(entry.system, this, dt, context);
      }
    } finally {
      this.updating = false;
      this.flush();
    }
  }

  flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.pending.length) this.pending.shift()();
    } finally { this.flushing = false; }
  }

  clear() {
    if (this.shouldDefer()) {
      for (const entity of [...this.alive, ...this.pendingCreates]) this.destroyEntity(entity);
      return;
    }
    for (const entity of [...this.alive]) this.applyDestroy(entity);
    this.pending.length = 0;
    this.pendingCreates.clear(); this.pendingDestroys.clear();
  }

  destroy() {
    for (const entry of [...this.systems].reverse()) this.removeSystem(entry);
    this.clear();
    if (this.ownsEvents) this.events.clear();
  }

  stats() {
    return {
      entities: this.alive.size,
      componentTypes: this.components.size,
      components: [...this.components.values()].reduce((total, store) => total + store.size, 0),
      systems: this.systems.length,
      pending: this.pending.length,
    };
  }

  shouldDefer() { return this.updating || this.flushing; }
  isKnown(entity) { return this.alive.has(entity) || this.pendingCreates.has(entity); }

  assertKnown(entity) {
    if (!this.isKnown(entity)) throw new Error(`Unknown entity ${entity}`);
  }

  assertType(type) {
    if (typeof type !== 'string' || !type) throw new TypeError('Component type must be a non-empty string');
  }
}

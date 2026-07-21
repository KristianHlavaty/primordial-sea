/* A small deterministic event bus used at subsystem boundaries.
   Dispatch is synchronous. Each emit walks a snapshot, so subscriptions added
   or removed by a listener affect the next emit rather than the current one. */

export class EventBus {
  constructor({ errorEvent = 'runtime:error' } = {}) {
    this.errorEvent = errorEvent;
    this.listeners = new Map();
    this.nextOrder = 0;
  }

  subscribe(event, listener, options = {}) {
    if ((typeof event !== 'string' || !event) && typeof event !== 'symbol') {
      throw new TypeError('EventBus event must be a non-empty string or symbol');
    }
    if (typeof listener !== 'function') throw new TypeError('EventBus listener must be a function');

    const { once = false, signal = null } = options;
    if (signal && signal.aborted) return () => false;

    const entry = {
      listener,
      once: !!once,
      priority: Number.isFinite(options.priority) ? options.priority : 0,
      order: this.nextOrder++,
      active: true,
      signal,
      abortHandler: null,
    };
    const entries = this.listeners.get(event) || [];
    entries.push(entry);
    entries.sort((a, b) => b.priority - a.priority || a.order - b.order);
    this.listeners.set(event, entries);

    const unsubscribe = () => this.unsubscribe(event, entry);
    if (signal) {
      entry.abortHandler = unsubscribe;
      signal.addEventListener('abort', unsubscribe, { once: true });
    }
    return unsubscribe;
  }

  once(event, listener, options = {}) {
    return this.subscribe(event, listener, { ...options, once: true });
  }

  unsubscribe(event, listenerOrEntry) {
    const entries = this.listeners.get(event);
    if (!entries) return false;
    const entry = typeof listenerOrEntry === 'function'
      ? entries.find(candidate => candidate.listener === listenerOrEntry && candidate.active)
      : listenerOrEntry;
    if (!entry || !entry.active) return false;
    entry.active = false;
    if (entry.signal && entry.abortHandler) entry.signal.removeEventListener('abort', entry.abortHandler);
    const next = entries.filter(candidate => candidate.active);
    if (next.length) this.listeners.set(event, next);
    else this.listeners.delete(event);
    return true;
  }

  emit(event, payload) {
    const entries = (this.listeners.get(event) || []).filter(entry => entry.active).slice();
    if (!entries.length) return 0;

    const errors = [];
    for (const entry of entries) {
      // Remove one-shot listeners before invocation so a nested emit cannot
      // invoke the same one-shot listener a second time.
      if (entry.once) this.unsubscribe(event, entry);
      try { entry.listener(payload, event, this); }
      catch (error) { errors.push(error); }
    }
    if (errors.length) this.reportErrors(event, payload, errors);
    return entries.length;
  }

  reportErrors(sourceEvent, payload, errors) {
    if (sourceEvent !== this.errorEvent && this.listenerCount(this.errorEvent)) {
      for (const error of errors) this.emit(this.errorEvent, { error, sourceEvent, payload });
      return;
    }
    if (errors.length === 1) throw errors[0];
    if (typeof AggregateError !== 'undefined') {
      throw new AggregateError(errors, `Multiple listeners failed while handling ${String(sourceEvent)}`);
    }
    const error = new Error(`Multiple listeners failed while handling ${String(sourceEvent)}`);
    error.causes = errors;
    throw error;
  }

  listenerCount(event) {
    const entries = this.listeners.get(event);
    return entries ? entries.filter(entry => entry.active).length : 0;
  }

  clear(event) {
    if (arguments.length) {
      const entries = this.listeners.get(event) || [];
      for (const entry of entries) this.deactivate(entry);
      this.listeners.delete(event);
      return;
    }
    for (const entries of this.listeners.values()) for (const entry of entries) this.deactivate(entry);
    this.listeners.clear();
  }

  deactivate(entry) {
    entry.active = false;
    if (entry.signal && entry.abortHandler) entry.signal.removeEventListener('abort', entry.abortHandler);
  }
}


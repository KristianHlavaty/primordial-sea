import { GameEvents } from '../engine/events.js';

export const SIM_HZ = 60;
export const HOST_BACKGROUND_HZ = 20;
export const DEFAULT_RENDER_HZ = 60;
export const MENU_RENDER_HZ = 30;

/* Owns the browser clock and hidden-host metronome. GameRuntime owns this
   object; React only creates/destroys the runtime. */
export class RuntimeClock {
  constructor(runtime, { getRenderRate = () => DEFAULT_RENDER_HZ } = {}) {
    this.runtime = runtime;
    this.getRenderRate = getRenderRate;
    this.running = false;
    this.raf = 0;
    this.last = 0; this.simAcc = 0; this.lastRender = 0; this.interpolating = false;
    this.worker = null; this.workerRunning = false; this.mpLast = 0;
    this.unsubscribeSchedule = null;
    this.loop = now => this.tick(now);
    this.syncBackgroundLoop = () => this.syncBackground();
    this.stepHidden = () => this.hiddenStep();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.unsubscribeSchedule = this.runtime.events.subscribe(GameEvents.RUNTIME_SCHEDULE_CHANGED, this.syncBackgroundLoop);
    document.addEventListener('visibilitychange', this.syncBackgroundLoop);
    this.raf = requestAnimationFrame(this.loop);
    this.runtime.events.emit(GameEvents.RUNTIME_STARTED, { runtime: this.runtime });
  }

  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const engine = this.runtime.engine;
    const elapsed = Math.min((now - this.last) / 1000, 0.1); this.last = now;
    const configuredRate = this.getRenderRate();
    const requestedRate = Number.isFinite(configuredRate) ? configuredRate : DEFAULT_RENDER_HZ;
    const wantsInterpolation = engine.playing && (requestedRate === 0 || requestedRate > SIM_HZ);
    if (wantsInterpolation && !this.interpolating) this.runtime.capturePresentation();
    this.interpolating = wantsInterpolation;

    if (!document.hidden && this.runtime.canStep()) {
      const simStep = 1 / SIM_HZ;
      this.simAcc = Math.min(this.simAcc + elapsed, simStep * 4);
      let steps = 0;
      while (this.simAcc >= simStep && steps < 4) {
        if (this.interpolating) this.runtime.capturePresentation();
        this.runtime.step(simStep); this.simAcc -= simStep; steps++;
      }
    } else this.simAcc = 0;

    const renderHz = engine.playing ? requestedRate : MENU_RENDER_HZ;
    const renderEvery = renderHz > 0 ? 1000 / renderHz : 0;
    if (!document.hidden && (!renderEvery || now - this.lastRender >= renderEvery - 1)) {
      this.runtime.render(this.interpolating && this.runtime.canStep() ? this.simAcc * SIM_HZ : 1);
      this.lastRender = renderEvery ? now - ((now - this.lastRender) % renderEvery) : now;
    }
  }

  ensureWorker() {
    if (this.worker) return this.worker;
    try {
      const interval = Math.round(1000 / HOST_BACKGROUND_HZ);
      const source = `let h=null;onmessage=e=>{if(e.data===1){if(!h)h=setInterval(()=>postMessage(1),${interval})}else{clearInterval(h);h=null}}`;
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      this.worker = new Worker(url); URL.revokeObjectURL(url);
      this.worker.onmessage = this.stepHidden;
    } catch (error) { this.worker = null; }
    return this.worker;
  }

  hiddenStep() {
    const engine = this.runtime.engine;
    if (!document.hidden || !engine.mp || engine.mp.role !== 'host' || !this.runtime.canStep()) return;
    const now = performance.now(); let dt = (now - this.mpLast) / 1000; this.mpLast = now;
    if (dt > 0.1) dt = 0.1;
    this.runtime.step(dt);
  }

  syncBackground() {
    const engine = this.runtime.engine;
    engine.setBackgrounded(document.hidden);
    const shouldRun = document.hidden && engine.mp && engine.mp.role === 'host' && engine.remotePlayers.length > 0 && this.runtime.canStep();
    if (shouldRun && !this.workerRunning) {
      const worker = this.ensureWorker();
      if (worker) { this.mpLast = performance.now(); worker.postMessage(1); this.workerRunning = true; }
    } else if (!shouldRun && this.workerRunning) {
      try { this.worker.postMessage(0); } catch (error) { }
      this.workerRunning = false;
    }
    if (!document.hidden) {
      this.last = performance.now(); this.simAcc = 0;
      this.runtime.capturePresentation();
    }
  }

  stop() {
    const wasRunning = this.running;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener('visibilitychange', this.syncBackgroundLoop);
    if (this.unsubscribeSchedule) this.unsubscribeSchedule();
    this.unsubscribeSchedule = null;
    if (this.worker) {
      try { this.worker.postMessage(0); this.worker.terminate(); } catch (error) { }
    }
    this.worker = null; this.workerRunning = false;
    if (wasRunning) this.runtime.events.emit(GameEvents.RUNTIME_STOPPED, { runtime: this.runtime });
  }

  stats() {
    return {
      running: this.running,
      animationFrameScheduled: !!this.raf,
      backgroundWorker: !!this.worker,
      backgroundWorkerRunning: this.workerRunning,
      scheduleSubscribed: !!this.unsubscribeSchedule,
    };
  }
}

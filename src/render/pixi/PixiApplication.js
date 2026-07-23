import { Application, Container } from '../../../vendor/pixi.min.mjs';
import { GameEvents } from '../../engine/events.js';

const cappedResolution = value => Math.max(1, Math.min(Number(value) || 1, 2));
const destroyApplication = app => {
  if (!app) return;
  const gl = app.renderer?.gl;
  app.destroy({ removeView: false }, { children: true, texture: false, textureSource: false });
  try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { }
};

/* Owns Pixi and its scene layers, but deliberately owns no clock. The runtime's
   fixed-step loop decides when presentation frames are rendered. */
export class PixiApplication {
  constructor(canvas, { events = null } = {}) {
    if (!canvas) throw new TypeError('PixiApplication requires a canvas');
    this.canvas = canvas;
    this.mode = 'pixi';
    this.events = events;
    this.app = null;
    this.layers = null;
    this.initializing = null;
    this.readyEmitted = false;
    this.destroyed = false;
  }

  async init({ width = window.innerWidth, height = window.innerHeight, resolution = window.devicePixelRatio || 1 } = {}) {
    if (this.destroyed) throw new Error('Cannot initialize a destroyed PixiApplication');
    if (this.app) return this;
    if (this.initializing) return this.initializing;
    this.initializing = this.initialize(width, height, resolution);
    try {
      const renderer = await this.initializing;
      if (!this.destroyed && !this.readyEmitted) {
        this.readyEmitted = true;
        this.events?.emit(GameEvents.RENDERER_READY, { renderer: this, layers: this.layers });
      }
      return renderer;
    }
    finally { this.initializing = null; }
  }

  async initialize(width, height, resolution) {
    const app = new Application();
    try {
      await app.init({
        canvas: this.canvas,
        width,
        height,
        resolution: cappedResolution(resolution),
        // The page owns the canvas' CSS box. Let Pixi resize only its backing
        // buffer; autoDensity writes inline pixel dimensions that override the
        // fullscreen/subdirectory host styles and can leave uncovered edges.
        autoDensity: false,
        autoStart: false,
        sharedTicker: false,
        preference: 'webgl',
        antialias: true,
        backgroundAlpha: 1,
        backgroundColor: 0x04121e,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      try { destroyApplication(app); } catch { }
      throw error;
    }
    if (this.destroyed) {
      destroyApplication(app);
      return this;
    }
    app.stop();

    const background = new Container({ label: 'background', isRenderGroup: true });
    const worldRoot = new Container({ label: 'world' });
    const terrain = new Container({ label: 'terrain' });
    const fields = new Container({ label: 'fields' });
    const pickups = new Container({ label: 'pickups' });
    const vehicles = new Container({ label: 'vehicles' });
    const actors = new Container({ label: 'actors' });
    const actorOverlays = new Container({ label: 'actor-overlays' });
    const particles = new Container({ label: 'particles' });
    const screenFx = new Container({ label: 'screen-fx', isRenderGroup: true });

    worldRoot.addChild(terrain, fields, pickups, vehicles, actors, actorOverlays, particles);
    app.stage.addChild(background, worldRoot, screenFx);
    this.app = app;
    this.layers = { background, worldRoot, terrain, fields, pickups, vehicles, actors, actorOverlays, particles, screenFx };
    return this;
  }

  resize(width, height, resolution = window.devicePixelRatio || 1) {
    if (!this.app) return;
    const nextResolution = cappedResolution(resolution);
    this.app.renderer.resize(width, height, nextResolution);
    this.events?.emit(GameEvents.RENDERER_RESIZED, { width, height, resolution: nextResolution });
  }

  render() {
    if (this.app) this.app.render();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.app) destroyApplication(this.app);
    this.app = null; this.layers = null;
    this.readyEmitted = false;
    this.events?.emit(GameEvents.RENDERER_DESTROYED, { renderer: this });
  }
}

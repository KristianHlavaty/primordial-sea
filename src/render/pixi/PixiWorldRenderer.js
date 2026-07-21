import { renderWorld } from '../renderWorld.js';
import { PixiApplication } from './PixiApplication.js';
import { PixiCanvasContext, PixiLayerSurface } from './PixiCanvasContext.js';

const DRAW_LAYERS = ['background', 'terrain', 'fields', 'pickups', 'vehicles', 'actors', 'actorOverlays', 'particles', 'screenFx'];

/* Full gameplay renderer for Phase 3. Existing procedural painters target a
   Canvas-shaped adapter, but every resulting shape/text node is owned and
   rendered by Pixi; no 2D context or frame-sized Canvas texture is involved. */
export class PixiWorldRenderer extends PixiApplication {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.surfaces = null;
    this.context = null;
    this.lastFrame = null;
  }

  async initialize(width, height, resolution) {
    await super.initialize(width, height, resolution);
    this.surfaces = Object.fromEntries(DRAW_LAYERS.map(name => [name, new PixiLayerSurface(this.layers[name], name)]));
    this.context = new PixiCanvasContext(this.surfaces, { defaultLayer: 'background' });
    return this;
  }

  render(frame) {
    if (!this.app || !this.context || !frame) return;
    this.lastFrame = frame;
    this.context.beginFrame('background');
    this.layers.worldRoot.position.set(0, 0);
    const view = Object.create(frame);
    view.ctx = this.context;
    view.canvas = this.canvas;
    view.setRenderLayer = name => this.context.setLayer(name);
    view.setWorldShake = (x, y) => this.layers.worldRoot.position.set(x, y);
    renderWorld(view);
    this.context.endFrame();
    this.app.render();
  }

  stats() {
    return this.context ? this.context.stats() : { frames: 0, layers: {} };
  }

  destroy() {
    if (this.context) this.context.destroy();
    this.context = null; this.surfaces = null; this.lastFrame = null;
    super.destroy();
  }
}

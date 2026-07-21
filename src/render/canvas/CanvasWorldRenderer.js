import { renderWorld } from '../renderWorld.js';

/* Compatibility renderer for the migration. It owns all Canvas 2D state; the
   simulation only publishes a presentation frame. */
export class CanvasWorldRenderer {
  constructor(canvas) {
    if (!canvas) throw new TypeError('CanvasWorldRenderer requires a canvas');
    this.mode = 'canvas';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D is unavailable');
    this.width = 0; this.height = 0; this.resolution = 1;
  }

  init(viewport = {}) {
    if (viewport.width && viewport.height) this.resize(viewport.width, viewport.height, viewport.resolution);
    return this;
  }

  resize(width, height, resolution = 1) {
    this.width = width; this.height = height; this.resolution = resolution;
    this.canvas.width = Math.max(1, Math.round(width * resolution));
    this.canvas.height = Math.max(1, Math.round(height * resolution));
    this.ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
  }

  render(frame) {
    const view = Object.create(frame);
    view.canvas = this.canvas; view.ctx = this.ctx;
    renderWorld(view);
  }

  destroy() { this.ctx = null; }
}


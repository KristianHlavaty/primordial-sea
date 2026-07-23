import { Application, Container, Rectangle } from '../../../vendor/pixi.min.mjs';
import { PixiCanvasContext, PixiLayerSurface } from './PixiCanvasContext.js';

const cappedResolution = value => Math.max(1, Math.min(Number(value) || 1, 2));
const overlays = new Map();
const destroyApplication = app => {
  if (!app) return;
  const gl = app.renderer?.gl;
  app.destroy({ removeView: false }, { children: true, texture: false, textureSource: false });
  try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { }
};

/* A single transparent Pixi renderer can service every DOM preview on a page.
   Views retain ordinary DOM boxes for layout/accessibility; their geometry is
   composited at those boxes' viewport coordinates into this pointer-transparent
   overlay. This avoids the browser's WebGL-context limit for icon grids and
   Model Lab's many animated cards. */
export class PixiDomOverlay {
  constructor({
    key = 'ui', zIndex = 40, className = 'pixiDomOverlay', root = null,
    autoDestroy = true,
  } = {}) {
    this.key = key;
    this.root = root;
    this.autoDestroy = autoDestroy;
    this.canvas = document.createElement('canvas');
    this.canvas.className = className;
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: root ? 'absolute' : 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: String(zIndex),
    });
    (root || document.body).appendChild(this.canvas);
    this.app = null;
    this.layer = null;
    this.surface = null;
    this.context = null;
    this.views = new Map();
    this.nextView = 1;
    this.raf = 0;
    this.lastTime = performance.now();
    this.dirty = true;
    this.destroyed = false;
    this.frame = now => this.render(now);
    this.invalidate = () => {
      this.dirty = true;
      this.start();
    };
    window.addEventListener('resize', this.invalidate);
    window.addEventListener('scroll', this.invalidate, true);
    window.visualViewport?.addEventListener('resize', this.invalidate);
    window.visualViewport?.addEventListener('scroll', this.invalidate);
    this.initializing = this.initialize();
  }

  async initialize() {
    const viewport = this.viewport();
    const app = new Application();
    try {
      await app.init({
        canvas: this.canvas,
        width: viewport.width,
        height: viewport.height,
        resolution: cappedResolution(devicePixelRatio || 1),
        autoDensity: false,
        autoStart: false,
        sharedTicker: false,
        preference: 'webgl',
        antialias: true,
        backgroundAlpha: 0,
        clearBeforeRender: true,
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
    const layer = new Container({ label: `dom-overlay:${this.key}` });
    app.stage.addChild(layer);
    this.app = app;
    this.layer = layer;
    this.surface = new PixiLayerSurface(layer, `dom-overlay:${this.key}`);
    this.context = new PixiCanvasContext({ ui: this.surface }, { defaultLayer: 'ui' });
    this.invalidate();
    return this;
  }

  start() {
    if (!this.raf && !this.destroyed && this.views.size) this.raf = requestAnimationFrame(this.frame);
  }

  register(element, draw, { animated = false, occlusion = true } = {}) {
    if (!element || typeof draw !== 'function') throw new TypeError('Pixi DOM views require an element and draw function');
    const id = this.nextView++;
    this.views.set(id, { element, draw, animated, occlusion, error: null });
    element.dataset.pixiView = String(id);
    this.invalidate();
    return () => {
      this.views.delete(id);
      if (element.dataset.pixiView === String(id)) delete element.dataset.pixiView;
      this.dirty = true;
      this.destroyIfUnused();
    };
  }

  destroyIfUnused() {
    if (!this.autoDestroy || this.views.size || this.destroyed) return;
    queueMicrotask(() => {
      if (this.autoDestroy && !this.views.size && !this.destroyed) this.destroy();
    });
  }

  viewport() {
    if (!this.root) {
      return { left: 0, top: 0, width: Math.max(1, innerWidth), height: Math.max(1, innerHeight) };
    }
    const rect = this.root.getBoundingClientRect();
    return {
      left: rect.left, top: rect.top,
      width: Math.max(1, this.root.clientWidth || rect.width),
      height: Math.max(1, this.root.clientHeight || rect.height),
    };
  }

  resize() {
    if (!this.app) return;
    const { width, height } = this.viewport();
    const resolution = cappedResolution(devicePixelRatio || 1);
    const renderer = this.app.renderer;
    if (renderer.screen.width !== width || renderer.screen.height !== height || renderer.resolution !== resolution) {
      renderer.resize(width, height, resolution);
    }
  }

  render(now = performance.now()) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.destroyed) return;
    if (!this.app || !this.context || !this.views.size) return;
    if (!this.dirty && ![...this.views.values()].some(view => view.animated)) return;
    this.dirty = false;
    this.resize();
    this.context.beginFrame('ui');
    const viewport = this.viewport();
    const viewportWidth = viewport.width, viewportHeight = viewport.height;
    for (const view of this.views.values()) {
      const { element } = view;
      if (!element.isConnected || element.hidden || getComputedStyle(element).display === 'none') continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1
        || rect.right <= viewport.left || rect.bottom <= viewport.top
        || rect.left >= viewport.left + viewportWidth || rect.top >= viewport.top + viewportHeight) continue;
      if (view.occlusion) {
        const hit = document.elementFromPoint(
          Math.max(0, Math.min(viewportWidth - 1, rect.left + rect.width * .5)),
          Math.max(0, Math.min(viewportHeight - 1, rect.top + rect.height * .5)),
        );
        if (hit && hit !== element && !element.contains(hit) && !hit.contains(element)) continue;
      }
      const left = rect.left - viewport.left, top = rect.top - viewport.top;
      const ctx = this.context;
      ctx.save();
      ctx.beginPath(); ctx.rect(left, top, rect.width, rect.height); ctx.clip();
      ctx.translate(left, top);
      try {
        view.draw(ctx, {
          width: rect.width, height: rect.height, time: now / 1000,
          delta: Math.min(.05, Math.max(0, (now - this.lastTime) / 1000)),
          element, rect,
        });
        view.error = null;
        delete element.dataset.pixiError;
      } catch (error) {
        view.error = error;
        element.dataset.pixiError = error?.message || String(error);
      }
      ctx.restore();
    }
    this.context.endFrame();
    this.app.render();
    this.lastTime = now;
    if ([...this.views.values()].some(view => view.animated)) this.start();
  }

  download(element, filename) {
    if (!this.app || !element) return false;
    this.dirty = true;
    this.render(performance.now());
    const rect = element.getBoundingClientRect(), viewport = this.viewport();
    if (rect.width < 1 || rect.height < 1) return false;
    this.app.renderer.extract.download({
      target: this.layer,
      frame: new Rectangle(rect.left - viewport.left, rect.top - viewport.top, rect.width, rect.height),
      filename,
      resolution: cappedResolution(devicePixelRatio || 1),
    });
    return true;
  }

  stats() {
    return {
      key: this.key, views: this.views.size,
      animatedViews: [...this.views.values()].filter(view => view.animated).length,
      animationFrameScheduled: !!this.raf,
      ...(this.context ? this.context.stats() : { frames: 0, layers: {} }),
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.views.clear();
    window.removeEventListener('resize', this.invalidate);
    window.removeEventListener('scroll', this.invalidate, true);
    window.visualViewport?.removeEventListener('resize', this.invalidate);
    window.visualViewport?.removeEventListener('scroll', this.invalidate);
    if (this.context) this.context.destroy();
    this.context = null; this.surface = null; this.layer = null;
    if (this.app) destroyApplication(this.app);
    this.app = null;
    this.canvas.remove();
    if (overlays.get(this.key) === this) overlays.delete(this.key);
  }
}

export async function getPixiDomOverlay(options = {}) {
  const key = options.key || 'ui';
  let overlay = overlays.get(key);
  if (!overlay || overlay.destroyed) {
    overlay = new PixiDomOverlay({ ...options, key });
    overlays.set(key, overlay);
  }
  try {
    await overlay.initializing;
    return overlay;
  } catch (error) {
    overlay.destroy();
    throw error;
  }
}

export function registerPixiDomView(element, draw, options = {}) {
  let disposed = false, unregister = null;
  getPixiDomOverlay(options).then(overlay => {
    if (disposed) { overlay.destroyIfUnused(); return; }
    unregister = overlay.register(element, draw, options);
  }).catch(error => {
    if (!disposed && element) element.dataset.pixiError = error?.message || String(error);
  });
  return () => {
    disposed = true;
    if (unregister) unregister();
  };
}

export function destroyPixiDomOverlay(key = 'ui') {
  overlays.get(key)?.destroy();
}

export function pixiDomOverlayStats() {
  return [...overlays.values()].map(overlay => overlay.stats());
}

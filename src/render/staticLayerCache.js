/* Shared cache for expensive, non-animated creature layers.
   Entries are created lazily and retained under a pixel budget so detailed
   renderers save frame time without allowing canvases to grow without bound. */

const SCALE_BUCKETS = [1, 1.5, 2, 3, 4, 6, 8];
const MAX_CACHE_SCALE = SCALE_BUCKETS[SCALE_BUCKETS.length - 1];
const MAX_CACHE_SIDE = 2048;
const PIXEL_BUDGET = 6 * 1024 * 1024;
const ENTRY_BUDGET = 64;

const entries = new Map();
let cachedPixels = 0;

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
  }
  return null;
}

function release(entry) {
  cachedPixels -= entry.pixels;
  for (const layer of entry.layers) {
    if (typeof layer.close === 'function') layer.close();
    else { layer.width = 1; layer.height = 1; }
  }
}

function touch(key, entry) {
  entries.delete(key); entries.set(key, entry);
}

function enforceBudget() {
  while ((cachedPixels > PIXEL_BUDGET || entries.size > ENTRY_BUDGET) && entries.size > 1) {
    const oldestKey = entries.keys().next().value, oldest = entries.get(oldestKey);
    entries.delete(oldestKey); release(oldest);
  }
}

/* Returns the smallest useful cache density for the caller's current transform.
   Very large close-ups bypass caching rather than stretching a blurry bitmap. */
export function staticLayerScale(ctx) {
  let required = 1;
  if (typeof ctx.getTransform === 'function') {
    const matrix = ctx.getTransform();
    required = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
  }
  if (!Number.isFinite(required) || required <= 0) return 0;
  if (required > MAX_CACHE_SCALE * 1.08) return 0;
  return SCALE_BUCKETS.find(scale => scale >= required) || MAX_CACHE_SCALE;
}

/* `drawers` contains one painter per static depth layer. Each painter receives
   an isolated transparent 2D context already transformed into model space. */
export function getStaticLayers(namespace, visualKey, bounds, resolution, drawers) {
  if (!resolution || !drawers.length) return null;
  const width = Math.max(1, Math.ceil(bounds.width * resolution));
  const height = Math.max(1, Math.ceil(bounds.height * resolution));
  if (width > MAX_CACHE_SIDE || height > MAX_CACHE_SIDE) return null;

  const key = `${namespace}|${resolution}|${visualKey}`;
  const existing = entries.get(key);
  if (existing) { touch(key, existing); return existing; }

  const pixels = width * height * drawers.length;
  if (pixels > PIXEL_BUDGET) return null;
  const layers = [];
  try {
    for (const draw of drawers) {
      const canvas = makeCanvas(width, height); if (!canvas) throw new Error('Canvas cache unavailable');
      const layerCtx = canvas.getContext('2d'); if (!layerCtx) throw new Error('2D cache context unavailable');
      layerCtx.setTransform(resolution, 0, 0, resolution, -bounds.x * resolution, -bounds.y * resolution);
      layerCtx.imageSmoothingEnabled = true; draw(layerCtx); layers.push(canvas);
    }
  } catch (error) {
    for (const layer of layers) { layer.width = 1; layer.height = 1; }
    return null;
  }

  const entry = {
    layers, pixels, resolution,
    bounds: { x: bounds.x, y: bounds.y, width: width / resolution, height: height / resolution },
  };
  entries.set(key, entry); cachedPixels += pixels; enforceBudget(); return entry;
}

export function drawStaticLayer(ctx, entry, index) {
  const layer = entry && entry.layers[index]; if (!layer) return false;
  const bounds = entry.bounds;
  ctx.drawImage(layer, bounds.x, bounds.y, bounds.width, bounds.height); return true;
}

export function clearStaticLayerCache() {
  for (const entry of entries.values()) release(entry);
  entries.clear(); cachedPixels = 0;
}

export function staticLayerCacheStats() {
  return { entries: entries.size, pixels: cachedPixels, pixelBudget: PIXEL_BUDGET, entryBudget: ENTRY_BUDGET };
}

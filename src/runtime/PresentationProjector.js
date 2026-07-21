import { clamp, lerp } from '../core/math.js';

const INTERPOLATED_FIELDS = ['x', 'y', 'angle', 't', 'px', 'py'];
const COLLECTION_FIELDS = [
  'remotePlayers', 'creatures', 'plants', 'food', 'worldItems', 'itemProjectiles',
  'vehicles', 'webs', 'obstacles', 'flow', 'particles', 'bubbles', 'eggs', 'fx', 'floaters',
];

const interpolateAngle = (from, to, alpha) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * alpha;
const isPlainObject = value => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function clonePresentationValue(value, roots, seen) {
  if (!value || typeof value !== 'object') return value;
  if (roots.has(value)) return roots.get(value);
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const copy = []; seen.set(value, copy);
    for (const entry of value) copy.push(clonePresentationValue(entry, roots, seen));
    return Object.freeze(copy);
  }
  // DOM/platform objects are presentation outputs rather than simulation data,
  // and class instances are either root entities above or deliberately opaque.
  if (!isPlainObject(value)) return value;
  const copy = Object.create(Object.getPrototypeOf(value)); seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) copy[key] = clonePresentationValue(entry, roots, seen);
  return Object.freeze(copy);
}

export function visitPresentationSources(engine, visitor) {
  if (engine.player) visitor(engine.player, 'player');
  for (const field of COLLECTION_FIELDS) {
    for (const source of engine[field] || []) if (source) visitor(source, field);
  }
}

/* Builds a detached view for renderers. Authoritative objects are never
   temporarily overwritten, including on high-refresh interpolation frames. */
export class PresentationProjector {
  constructor() {
    this.previous = new WeakMap();
    this.previousTime = NaN;
    this.previousCam = { x: 0, y: 0 };
  }

  capture(engine) {
    this.previousTime = engine.time;
    this.previousCam = { x: engine.cam.x, y: engine.cam.y };
    visitPresentationSources(engine, source => {
      const state = {};
      for (const field of INTERPOLATED_FIELDS) if (Number.isFinite(source[field])) state[field] = source[field];
      this.previous.set(source, state);
    });
  }

  snap(source, fields = INTERPOLATED_FIELDS) {
    if (!source) return;
    const state = this.previous.get(source) || {};
    for (const field of fields) if (Number.isFinite(source[field])) state[field] = source[field];
    this.previous.set(source, state);
  }

  createFrame(engine, requestedAlpha = 1) {
    const alpha = clamp(requestedAlpha, 0, 1);
    const interpolate = alpha < 1 && Number.isFinite(this.previousTime);
    const clones = new Map();

    visitPresentationSources(engine, source => {
      if (clones.has(source)) return;
      clones.set(source, Object.create(Object.getPrototypeOf(source)));
    });

    const seen = new Map(clones);
    for (const [source, clone] of clones) {
      for (const [key, value] of Object.entries(source)) clone[key] = clonePresentationValue(value, clones, seen);
      const previous = this.previous.get(source);
      if (interpolate && previous) {
        for (const field of INTERPOLATED_FIELDS) {
          const live = source[field], from = previous[field];
          if (!Number.isFinite(live) || !Number.isFinite(from)) continue;
          clone[field] = field === 'angle' ? interpolateAngle(from, live, alpha) : lerp(from, live, alpha);
        }
      }
    }

    // Renderers receive only scalar runtime facts plus explicitly projected
    // collections. This prevents a missing field from falling through to the
    // live Engine object via a prototype or shallow Object.assign copy.
    const frame = {};
    for (const [key, value] of Object.entries(engine)) {
      if (value == null || (typeof value !== 'object' && typeof value !== 'function')) frame[key] = value;
    }
    frame.time = interpolate ? lerp(this.previousTime, engine.time, alpha) : engine.time;
    frame.cam = Object.freeze({
      x: interpolate ? lerp(this.previousCam.x, engine.cam.x, alpha) : engine.cam.x,
      y: interpolate ? lerp(this.previousCam.y, engine.cam.y, alpha) : engine.cam.y,
    });
    frame.player = engine.player ? clones.get(engine.player) : null;
    for (const field of COLLECTION_FIELDS) {
      frame[field] = Object.freeze((engine[field] || []).map(source => clones.get(source) || source));
    }
    const visibleRemotes = Object.freeze((engine.visibleRemotePlayers ? engine.visibleRemotePlayers() : engine.remotePlayers || [])
      .map(source => clones.get(source) || source));
    frame.visibleRemotePlayers = () => visibleRemotes;
    frame.choices = Object.freeze((engine.choices || []).slice());
    frame.mp = engine.mp ? Object.freeze({
      role: engine.mp.role, self: engine.mp.self,
      selfName: engine.mp.selfName, selfColor: engine.mp.selfColor,
    }) : null;
    // Evolve previews are canvases the renderer is expected to write into;
    // they are the one intentional live platform handle on a frame.
    frame.previewCanvas = engine.previewCanvas;
    frame.renderAlpha = alpha;
    frame.presentationFrame = true;

    for (const clone of clones.values()) Object.freeze(clone);
    return Object.freeze(frame);
  }
}

export const PRESENTATION_COLLECTIONS = Object.freeze(COLLECTION_FIELDS.slice());

import { Container, FillGradient, Graphics, Matrix, Text } from '../../../vendor/pixi.min.mjs';
import { clamp } from '../../core/math.js';

const DEFAULT_STATE = () => ({
  matrix: new Matrix(),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  lineDash: [],
  lineDashOffset: 0,
  globalAlpha: 1,
  composite: 'source-over',
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  font: '10px sans-serif',
  textAlign: 'left',
  clipDepth: 0,
});

const cloneState = state => ({ ...state, matrix: state.matrix.clone(), lineDash: state.lineDash.slice() });
const isGradient = value => value instanceof PixiCanvasGradient;
const matrixPoint = (matrix, x, y) => ({ x: matrix.a * x + matrix.c * y + matrix.tx, y: matrix.b * x + matrix.d * y + matrix.ty });
const matrixScale = matrix => (Math.hypot(matrix.a, matrix.b) + Math.hypot(matrix.c, matrix.d)) * 0.5 || 1;

function parseFont(font) {
  const match = String(font || '').match(/^\s*(?:(\d+)\s+)?([\d.]+)px\s+(.+)$/);
  if (!match) return { fontFamily: 'sans-serif', fontSize: 10, fontWeight: '400' };
  const family = match[3].split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return { fontFamily: family || 'sans-serif', fontSize: Number(match[2]) || 10, fontWeight: match[1] || '400' };
}

class PixiCanvasGradient {
  constructor(owner, kind, values, matrix) {
    this.owner = owner;
    if (kind === 'linear') {
      const start = matrixPoint(matrix, values.x0, values.y0), end = matrixPoint(matrix, values.x1, values.y1);
      this.options = { type: 'linear', start, end, textureSpace: 'global' };
    } else {
      const center = matrixPoint(matrix, values.x0, values.y0), outerCenter = matrixPoint(matrix, values.x1, values.y1);
      const scale = matrixScale(matrix);
      this.options = {
        type: 'radial', center, outerCenter,
        innerRadius: Math.max(0, values.r0 * scale),
        outerRadius: Math.max(0.0001, values.r1 * scale),
        textureSpace: 'global',
      };
    }
    this.stops = [];
  }

  addColorStop(offset, color) {
    this.stops.push({ offset: clamp(Number(offset) || 0, 0, 1), color });
  }

  get native() { return this.owner.resolveGradient(this); }
}

/* One retained Pixi surface per planned scene layer. Geometry objects are
   reused and text objects grow only to the high-water mark for that layer. */
export class PixiLayerSurface {
  constructor(container, label) {
    this.container = container;
    this.label = label;
    this.graphicsPool = [];
    this.textPool = [];
    this.clipPool = [];
    this.graphicsUsed = 0; this.textUsed = 0; this.clipUsed = 0;
    this.currentParent = container;
    this.parentStack = [];
    this.activeGraphics = null;
  }

  beginFrame() {
    this.container.removeChildren();
    for (const view of this.graphicsPool) { view.clear(); view.visible = false; }
    for (const view of this.textPool) view.visible = false;
    for (const clip of this.clipPool) {
      clip.content.mask = null;
      clip.content.removeChildren(); clip.root.removeChildren(); clip.mask.clear();
    }
    this.graphicsUsed = 0; this.textUsed = 0; this.clipUsed = 0;
    this.currentParent = this.container; this.parentStack.length = 0; this.activeGraphics = null;
  }

  graphics(additive = false) {
    const blend = additive ? 'add' : 'normal';
    if (this.activeGraphics && this.activeGraphics.parent === this.currentParent && this.activeGraphics.blendMode === blend) {
      return this.activeGraphics;
    }
    let view = this.graphicsPool[this.graphicsUsed++];
    if (!view) {
      view = new Graphics({ label: `${this.label}:pooled-geometry` });
      this.graphicsPool.push(view);
    }
    view.clear(); view.visible = true; view.blendMode = blend;
    this.currentParent.addChild(view); this.activeGraphics = view;
    return view;
  }

  interruptGeometry() { this.activeGraphics = null; }

  beginClip(drawMask) {
    this.interruptGeometry();
    let clip = this.clipPool[this.clipUsed++];
    if (!clip) {
      const root = new Container({ label: `${this.label}:clip` });
      const content = new Container({ label: `${this.label}:clip-content` });
      const mask = new Graphics({ label: `${this.label}:clip-mask` });
      clip = { root, content, mask };
      this.clipPool.push(clip);
    }
    clip.content.mask = null;
    clip.content.removeChildren(); clip.root.removeChildren(); clip.mask.clear();
    clip.root.addChild(clip.content, clip.mask); clip.content.mask = clip.mask;
    drawMask(clip.mask);
    this.currentParent.addChild(clip.root);
    this.parentStack.push(this.currentParent); this.currentParent = clip.content;
    return clip;
  }

  endClip() {
    if (!this.parentStack.length) return;
    this.currentParent = this.parentStack.pop(); this.interruptGeometry();
  }

  text(spec) {
    this.interruptGeometry();
    let view = this.textPool[this.textUsed++];
    if (!view) {
      view = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 10, fill: '#ffffff' } });
      view.label = `${this.label}:pooled-text`;
      view.eventMode = 'none';
      this.textPool.push(view);
    }
    this.currentParent.addChild(view);
    view.visible = true;
    view.text = spec.text;
    if (view._styleKey !== spec.styleKey) {
      view.style = spec.style;
      view._styleKey = spec.styleKey;
    }
    view.anchor.set(spec.anchorX, .8);
    view.setFromMatrix(spec.matrix);
    view.alpha = spec.alpha;
    view.blendMode = spec.additive ? 'add' : 'normal';
    return view;
  }

  endFrame() {
    while (this.parentStack.length) this.endClip();
  }

  stats() {
    return {
      graphics: this.graphicsPool.length, activeGraphics: this.graphicsUsed,
      pooledTexts: this.textPool.length, activeTexts: this.textUsed, clips: this.clipPool.length,
    };
  }

  destroy() {
    this.container.removeChildren();
    for (const clip of this.clipPool) {
      clip.content.mask = null; clip.content.removeChildren(); clip.root.removeChildren();
      clip.content.destroy(); clip.mask.destroy({ context: true }); clip.root.destroy();
    }
    for (const view of this.graphicsPool) view.destroy({ context: true });
    for (const view of this.textPool) view.destroy();
    this.graphicsPool.length = 0; this.textPool.length = 0; this.clipPool.length = 0;
  }
}

/* Canvas-shaped procedural drawing API backed entirely by Pixi Graphics and
   Text. It lets the existing art functions define geometry while Pixi owns the
   renderer, scene graph, GPU resources, blend passes and object pools. */
export class PixiCanvasContext {
  constructor(surfaces, { defaultLayer = 'actors' } = {}) {
    this.kind = 'pixi';
    this.surfaces = surfaces;
    this.defaultLayer = defaultLayer;
    this.layerName = defaultLayer;
    this.state = DEFAULT_STATE();
    this.stack = [];
    this.path = [];
    this.currentPoint = null;
    this.clipStack = [];
    this.gradientCache = new Map();
    this.gradientCacheLimit = 512;
    this.metrics = {
      frames: 0, fills: 0, strokes: 0, texts: 0, dashedStrokes: 0,
      clipsApplied: 0, clipsSkipped: 0, imagesSkipped: 0, shadowPasses: 0,
      gradientHits: 0, gradientMisses: 0,
    };
  }

  beginFrame(layer = this.defaultLayer) {
    for (const surface of Object.values(this.surfaces)) surface.beginFrame();
    while (this.gradientCache.size > this.gradientCacheLimit) {
      const oldestKey = this.gradientCache.keys().next().value;
      this.gradientCache.get(oldestKey).destroy(); this.gradientCache.delete(oldestKey);
    }
    this.state = DEFAULT_STATE(); this.stack.length = 0; this.clipStack.length = 0; this.path.length = 0; this.currentPoint = null;
    this.layerName = this.surfaces[layer] ? layer : this.defaultLayer;
    this.metrics.frames++;
  }

  endFrame() {
    while (this.clipStack.length) this.clipStack.pop().endClip();
    for (const surface of Object.values(this.surfaces)) surface.endFrame();
  }
  setLayer(name) {
    if (!this.surfaces[name] || name === this.layerName) return;
    this.surface.interruptGeometry(); this.layerName = name; this.surface.interruptGeometry();
  }
  get surface() { return this.surfaces[this.layerName] || this.surfaces[this.defaultLayer]; }
  get target() { return this.surface.graphics(this.state.composite === 'lighter'); }

  syncTransform(target = this.target) { target.context.setTransform(this.state.matrix); return target; }
  beginPath() { this.path.length = 0; this.currentPoint = null; this.syncTransform().beginPath(); }
  closePath() { this.target.closePath(); if (this.path.length && this.currentPoint) this.path.push({ kind: 'close' }); }

  moveTo(x, y) { this.syncTransform().moveTo(x, y); this.path.push({ kind: 'move', x, y }); this.currentPoint = { x, y }; }
  lineTo(x, y) { this.syncTransform().lineTo(x, y); this.path.push({ kind: 'line', x, y }); this.currentPoint = { x, y }; }
  quadraticCurveTo(cpx, cpy, x, y) { this.syncTransform().quadraticCurveTo(cpx, cpy, x, y); this.path.push({ kind: 'quadratic', cpx, cpy, x, y }); this.currentPoint = { x, y }; }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { this.syncTransform().bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y); this.path.push({ kind: 'bezier', cp1x, cp1y, cp2x, cp2y, x, y }); this.currentPoint = { x, y }; }
  rect(x, y, width, height) { this.syncTransform().rect(x, y, width, height); this.path.push({ kind: 'rect', x, y, width, height }); }
  roundRect(x, y, width, height, radius = 0) { this.syncTransform().roundRect(x, y, width, height, radius); this.path.push({ kind: 'rect', x, y, width, height }); }
  arc(x, y, radius, start, end, anticlockwise = false) {
    this.syncTransform().arc(x, y, radius, start, end, anticlockwise);
    let sweep = end - start;
    if (!anticlockwise && sweep < 0) sweep += Math.PI * 2;
    if (anticlockwise && sweep > 0) sweep -= Math.PI * 2;
    const steps = Math.max(4, Math.ceil(Math.abs(sweep) * Math.max(4, radius) / 9));
    const points = [];
    for (let i = 0; i <= steps; i++) { const angle = start + sweep * i / steps; points.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius }); }
    this.path.push({ kind: 'polyline', points }); this.currentPoint = points[points.length - 1];
  }
  ellipse(x, y, radiusX, radiusY, rotation = 0, start = 0, end = Math.PI * 2) {
    const target = this.syncTransform();
    let sweep = end - start; if (sweep < 0) sweep += Math.PI * 2;
    const steps = Math.max(12, Math.ceil(Math.abs(sweep) * Math.max(radiusX, radiusY, 4) / 7));
    const cosR = Math.cos(rotation), sinR = Math.sin(rotation), points = [];
    for (let i = 0; i <= steps; i++) {
      const angle = start + sweep * i / steps, dx = Math.cos(angle) * radiusX, dy = Math.sin(angle) * radiusY;
      points.push({ x: x + dx * cosR - dy * sinR, y: y + dx * sinR + dy * cosR });
    }
    target.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) target.lineTo(points[i].x, points[i].y);
    if (Math.abs(sweep) >= Math.PI * 2 - .0001) target.closePath();
    this.path.push({ kind: 'polyline', points }); this.currentPoint = points[points.length - 1];
  }

  fill() {
    this.drawShadow(this.target, 0);
    this.target.fill(this.fillInput(this.state.fillStyle));
    this.metrics.fills++;
  }

  stroke() {
    this.drawShadow(this.target, this.state.lineWidth);
    if (this.state.lineDash.length) { this.strokeDashed(); this.metrics.dashedStrokes++; }
    else this.target.stroke(this.strokeInput());
    this.metrics.strokes++;
  }

  fillRect(x, y, width, height) {
    const target = this.syncTransform().rect(x, y, width, height);
    this.drawShadow(target, 0); target.fill(this.fillInput(this.state.fillStyle));
    this.metrics.fills++;
  }
  strokeRect(x, y, width, height) {
    const target = this.syncTransform().rect(x, y, width, height);
    this.drawShadow(target, this.state.lineWidth); target.stroke(this.strokeInput());
    this.metrics.strokes++;
  }
  clearRect() { }

  fillInput(style) {
    return isGradient(style)
      ? { fill: style.native, alpha: this.state.globalAlpha }
      : { color: style || '#000000', alpha: this.state.globalAlpha };
  }

  strokeInput() {
    const style = this.state.strokeStyle;
    const base = {
      width: Math.max(0, this.state.lineWidth),
      alpha: this.state.globalAlpha,
      cap: this.state.lineCap,
      join: this.state.lineJoin,
    };
    return isGradient(style) ? { ...base, fill: style.native } : { ...base, color: style || '#000000' };
  }

  drawShadow(target, baseWidth) {
    const blur = Math.max(0, this.state.shadowBlur);
    const color = String(this.state.shadowColor || '');
    if (!blur || !color || color === 'transparent' || /rgba?\([^)]*,\s*0(?:\.0*)?\s*\)$/i.test(color)) return;
    const base = {
      color,
      cap: this.state.lineCap,
      join: this.state.lineJoin,
    };
    for (const [scale, alpha] of [[1, .08], [.62, .11], [.3, .15]]) {
      target.stroke({ ...base, width: Math.max(.5, baseWidth + blur * 2 * scale), alpha: this.state.globalAlpha * alpha });
      this.metrics.shadowPasses++;
    }
  }

  strokeDashed() {
    const target = this.syncTransform(); target.beginPath();
    let first = null, cursor = null;
    for (const command of this.path) {
      if (command.kind === 'move') { cursor = { x: command.x, y: command.y }; if (!first) first = cursor; }
      else if (command.kind === 'line' || command.kind === 'quadratic' || command.kind === 'bezier') {
        if (cursor) this.dashSegment(target, cursor, command, this.state.lineDashOffset);
        cursor = { x: command.x, y: command.y };
      } else if (command.kind === 'polyline') {
        for (let i = 1; i < command.points.length; i++) this.dashSegment(target, command.points[i - 1], command.points[i], this.state.lineDashOffset);
        cursor = command.points[command.points.length - 1]; if (!first) first = command.points[0];
      } else if (command.kind === 'close' && cursor && first) this.dashSegment(target, cursor, first, this.state.lineDashOffset);
      else if (command.kind === 'rect') {
        const points = [{ x: command.x, y: command.y }, { x: command.x + command.width, y: command.y }, { x: command.x + command.width, y: command.y + command.height }, { x: command.x, y: command.y + command.height }, { x: command.x, y: command.y }];
        for (let i = 1; i < points.length; i++) this.dashSegment(target, points[i - 1], points[i], this.state.lineDashOffset);
      }
    }
    target.stroke(this.strokeInput());
  }

  dashSegment(target, from, to, offset) {
    const pattern = this.state.lineDash.map(value => Math.max(.001, Math.abs(value)));
    if (!pattern.length) { target.moveTo(from.x, from.y).lineTo(to.x, to.y); return; }
    if (pattern.length % 2) pattern.push(...pattern);
    const total = pattern.reduce((sum, value) => sum + value, 0);
    let phase = ((-offset % total) + total) % total, index = 0;
    while (phase >= pattern[index]) { phase -= pattern[index++]; index %= pattern.length; }
    let remaining = pattern[index] - phase, draw = index % 2 === 0;
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
    if (!length) return;
    let traveled = 0;
    while (traveled < length - .0001) {
      const step = Math.min(remaining, length - traveled), a = traveled / length, b = (traveled + step) / length;
      const ax = from.x + dx * a, ay = from.y + dy * a, bx = from.x + dx * b, by = from.y + dy * b;
      if (draw) target.moveTo(ax, ay).lineTo(bx, by);
      traveled += step; remaining -= step;
      if (remaining <= .0001) { index = (index + 1) % pattern.length; remaining = pattern[index]; draw = index % 2 === 0; }
    }
  }

  createLinearGradient(x0, y0, x1, y1) { return new PixiCanvasGradient(this, 'linear', { x0, y0, x1, y1 }, this.state.matrix); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new PixiCanvasGradient(this, 'radial', { x0, y0, r0, x1, y1, r1 }, this.state.matrix); }

  resolveGradient(description) {
    const rounded = value => typeof value === 'number' ? Math.round(value * 10) / 10 : value;
    const point = value => value ? { x: rounded(value.x), y: rounded(value.y) } : value;
    const options = {
      ...description.options,
      start: point(description.options.start), end: point(description.options.end),
      center: point(description.options.center), outerCenter: point(description.options.outerCenter),
      innerRadius: rounded(description.options.innerRadius), outerRadius: rounded(description.options.outerRadius),
    };
    const key = JSON.stringify([options, description.stops]);
    let gradient = this.gradientCache.get(key);
    if (gradient) {
      this.gradientCache.delete(key); this.gradientCache.set(key, gradient); this.metrics.gradientHits++;
      return gradient;
    }
    gradient = new FillGradient(options);
    for (const stop of description.stops) gradient.addColorStop(stop.offset, stop.color);
    this.gradientCache.set(key, gradient); this.metrics.gradientMisses++;
    return gradient;
  }

  drawText(text, x, y, stroke) {
    const font = parseFont(this.state.font), fill = stroke ? this.state.strokeStyle : this.state.fillStyle;
    const style = {
      ...font,
      fill: isGradient(fill) ? fill.native : fill,
      align: this.state.textAlign === 'center' ? 'center' : this.state.textAlign === 'right' ? 'right' : 'left',
    };
    if (stroke) style.stroke = { color: isGradient(fill) ? '#000000' : fill, width: Math.max(1, this.state.lineWidth * 2) };
    const matrix = this.state.matrix.clone();
    matrix.tx += matrix.a * x + matrix.c * y;
    matrix.ty += matrix.b * x + matrix.d * y;
    const styleKey = JSON.stringify({ font: this.state.font, fill: String(fill), stroke, width: this.state.lineWidth, align: this.state.textAlign });
    this.surface.text({
      text: String(text), style, styleKey, matrix,
      anchorX: this.state.textAlign === 'center' ? .5 : this.state.textAlign === 'right' ? 1 : 0,
      alpha: this.state.globalAlpha,
      additive: this.state.composite === 'lighter',
    });
    this.metrics.texts++;
  }
  fillText(text, x, y) { this.drawText(text, x, y, false); }
  strokeText(text, x, y) { this.drawText(text, x, y, true); }

  save() { this.state.clipDepth = this.clipStack.length; this.stack.push(cloneState(this.state)); }
  restore() {
    if (!this.stack.length) return;
    const state = this.stack.pop();
    while (this.clipStack.length > state.clipDepth) this.clipStack.pop().endClip();
    this.state = state;
  }
  translate(x, y) {
    const m = this.state.matrix; m.tx += m.a * x + m.c * y; m.ty += m.b * x + m.d * y;
  }
  rotate(angle) {
    const m = this.state.matrix, cos = Math.cos(angle), sin = Math.sin(angle);
    const a = m.a * cos + m.c * sin, b = m.b * cos + m.d * sin;
    const c = -m.a * sin + m.c * cos, d = -m.b * sin + m.d * cos;
    m.a = a; m.b = b; m.c = c; m.d = d;
  }
  scale(x, y = x) { const m = this.state.matrix; m.a *= x; m.b *= x; m.c *= y; m.d *= y; }
  setTransform(a, b, c, d, tx, ty) {
    if (a && typeof a === 'object') this.state.matrix.set(a.a, a.b, a.c, a.d, a.e ?? a.tx, a.f ?? a.ty);
    else this.state.matrix.set(a, b, c, d, tx, ty);
  }
  getTransform() { return this.state.matrix.clone(); }

  setLineDash(values) { this.state.lineDash = Array.from(values || [], value => Number(value) || 0); }
  getLineDash() { return this.state.lineDash.slice(); }
  replayPath(target) {
    target.context.setTransform(this.state.matrix); target.beginPath();
    for (const command of this.path) {
      if (command.kind === 'move') target.moveTo(command.x, command.y);
      else if (command.kind === 'line') target.lineTo(command.x, command.y);
      else if (command.kind === 'quadratic') target.quadraticCurveTo(command.cpx, command.cpy, command.x, command.y);
      else if (command.kind === 'bezier') target.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y);
      else if (command.kind === 'rect') target.rect(command.x, command.y, command.width, command.height);
      else if (command.kind === 'polyline' && command.points.length) {
        target.moveTo(command.points[0].x, command.points[0].y);
        for (let i = 1; i < command.points.length; i++) target.lineTo(command.points[i].x, command.points[i].y);
      } else if (command.kind === 'close') target.closePath();
    }
  }
  clip() {
    const surface = this.surface;
    surface.beginClip(mask => { this.replayPath(mask); mask.fill({ color: '#ffffff' }); });
    this.clipStack.push(surface); this.state.clipDepth = this.clipStack.length; this.metrics.clipsApplied++;
  }
  drawImage() { this.metrics.imagesSkipped++; }

  get fillStyle() { return this.state.fillStyle; } set fillStyle(value) { this.state.fillStyle = value; }
  get strokeStyle() { return this.state.strokeStyle; } set strokeStyle(value) { this.state.strokeStyle = value; }
  get lineWidth() { return this.state.lineWidth; } set lineWidth(value) { this.state.lineWidth = Number(value) || 0; }
  get lineCap() { return this.state.lineCap; } set lineCap(value) { this.state.lineCap = value || 'butt'; }
  get lineJoin() { return this.state.lineJoin; } set lineJoin(value) { this.state.lineJoin = value || 'miter'; }
  get lineDashOffset() { return this.state.lineDashOffset; } set lineDashOffset(value) { this.state.lineDashOffset = Number(value) || 0; }
  get globalAlpha() { return this.state.globalAlpha; } set globalAlpha(value) { this.state.globalAlpha = clamp(Number(value) || 0, 0, 1); }
  get globalCompositeOperation() { return this.state.composite; } set globalCompositeOperation(value) { this.state.composite = value === 'lighter' ? 'lighter' : 'source-over'; }
  get shadowColor() { return this.state.shadowColor; } set shadowColor(value) { this.state.shadowColor = value; }
  get shadowBlur() { return this.state.shadowBlur; } set shadowBlur(value) { this.state.shadowBlur = Number(value) || 0; }
  get font() { return this.state.font; } set font(value) { this.state.font = value || '10px sans-serif'; }
  get textAlign() { return this.state.textAlign; } set textAlign(value) { this.state.textAlign = value || 'left'; }

  stats() {
    return {
      ...this.metrics,
      gradients: this.gradientCache.size,
      layers: Object.fromEntries(Object.entries(this.surfaces).map(([name, surface]) => [name, surface.stats()])),
    };
  }

  destroy() {
    for (const gradient of this.gradientCache.values()) gradient.destroy();
    this.gradientCache.clear();
    for (const surface of Object.values(this.surfaces)) surface.destroy();
    this.surfaces = {};
  }
}

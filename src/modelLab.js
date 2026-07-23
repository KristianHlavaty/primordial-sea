/* Standalone Pixi visual test bench for the game's plan-driven creature
   renderer. Model Lab and gameplay now consume the same creature factory. */
import { SPECIES } from './data/species.js';
import { DUNKLEOSTEUS_VARIANTS } from './data/dunkleosteusVariants.js';
import { getPixiDomOverlay } from './render/pixi/PixiDomOverlay.js';
import { drawCreatureVisual } from './render/pixi/PixiVisualFactory.js';

const $ = selector => document.querySelector(selector);
const mainView = $('#modelViewport'), stage = $('#modelStage'), grid = $('#modelGrid');
const animationNames = { idle: 'IDLE', cruise: 'CRUISE', bite: 'BITE TEST', charge: 'CHARGE', hurt: 'DAMAGE READ' };

const gameCreatures = Object.entries(SPECIES)
  .map(([id, species]) => ({
    id, sourceId: id, name: species.name,
    direction: `Tier ${species.tier} · ${species.stage || 'primordial'} · ${species.branch === '-' ? 'origin' : species.branch}`,
    description: species.desc,
    tags: [species.plan.kind, `tier ${species.tier}`, species.fantasy ? 'fantasy' : species.branch].filter(Boolean),
    plan: species.plan, stats: species.stats, species,
  }))
  .sort((a, b) => a.species.tier - b.species.tier || a.name.localeCompare(b.name));

const collections = { concepts: DUNKLEOSTEUS_VARIANTS, species: gameCreatures };
const query = new URLSearchParams(location.search);
let collection = query.get('collection') === 'species' ? 'species' : 'concepts';
let models = collections[collection];
let selected = models.find(model => model.id === query.get('model'))
  || (collection === 'species' ? models.find(model => model.id === 'dunkleosteus') : models[0]);
let animation = animationNames[query.get('animation')] ? query.get('animation') : 'cruise';
let animationTime = 0, previousFrame = performance.now(), paused = false, flipped = false;
let zoom = 1, theme = 'deep', capturingSnapshot = false;
const cards = new Map();
const paletteSelections = new Map();
const listenerController = new AbortController();
const listenerOptions = { signal: listenerController.signal };
let destroyed = false, frameRequest = 0, revealRequest = 0;
const requestedPalette = Math.max(0, Number.parseInt(query.get('palette'), 10) || 0);
if (selected.palettes?.length) paletteSelections.set(selected.id, Math.min(requestedPalette, selected.palettes.length - 1));

const overlay = await getPixiDomOverlay({
  key: 'model-lab-cards', zIndex: 1, className: 'modelLabPixiOverlay', autoDestroy: false,
});
const mainOverlay = await getPixiDomOverlay({
  key: 'model-lab-main', root: stage, zIndex: 1, className: 'modelLabMainPixi', autoDestroy: false,
});
document.body.dataset.renderer = 'pixi';

const paletteIndex = model => Math.min(paletteSelections.get(model.id) || 0, Math.max(0, (model.palettes?.length || 1) - 1));
const resolvedPlan = model => model.palettes?.length
  ? { ...model.plan, ...model.palettes[paletteIndex(model)] }
  : model.plan;

const visibleCards = new Set();
const cardObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) entry.isIntersecting ? visibleCards.add(entry.target) : visibleCards.delete(entry.target);
}, { root: grid, rootMargin: '160px' }) : null;

function animationState(time) {
  if (animation === 'idle') return { t: time * .38, mouth: .025 + Math.sin(time * 1.7) * .015, hurt: 0, shift: Math.sin(time * 1.2) * 2, tilt: Math.sin(time * .8) * .008 };
  if (animation === 'bite') {
    const phase = time % 1.45;
    const mouth = phase < .16 ? phase / .16 : phase < .34 ? 1 - (phase - .16) / .18 : 0;
    const recoil = phase < .16 ? -mouth * 8 : phase < .42 ? (1 - (phase - .16) / .26) * -8 : 0;
    return { t: time * 1.2, mouth, hurt: 0, shift: recoil, tilt: Math.sin(phase * 8) * mouth * .018 };
  }
  if (animation === 'charge') {
    const surge = (time % 1.2) / 1.2;
    return { t: time * 3.15, mouth: .16 + Math.sin(time * 6) * .04, hurt: 0, shift: (surge - .5) * 15, tilt: Math.sin(time * 5) * .012, charge: surge };
  }
  if (animation === 'hurt') {
    const phase = time % 1.55, impact = phase < .18 ? 1 - phase / .18 : 0;
    return { t: time * .68, mouth: impact * .4, hurt: impact, shift: -impact * 12, tilt: -impact * .07 };
  }
  return { t: time * 1.12, mouth: 0, hurt: 0, shift: Math.sin(time * 1.5) * 3, tilt: Math.sin(time * 1.1) * .01 };
}

function drawBackdrop(ctx, width, height, time, compact) {
  const palettes = {
    deep: ['#04131f', '#0b2c3d'], neutral: ['#263139', '#35444d'], light: ['#c7cfcd', '#e0e5e1'],
  };
  const palette = palettes[theme];
  const gradient = ctx.createRadialGradient(width * .5, height * .48, 1, width * .5, height * .48, Math.max(width, height) * .72);
  gradient.addColorStop(0, palette[1]); gradient.addColorStop(1, palette[0]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = theme === 'light' ? 'rgba(55,75,78,.12)' : 'rgba(120,205,211,.08)';
  ctx.lineWidth = 1;
  const step = compact ? 24 : 48;
  for (let x = (time * 3) % step; x < width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  if (!compact) {
    ctx.fillStyle = theme === 'light' ? 'rgba(40,85,88,.18)' : 'rgba(118,225,218,.2)';
    for (let i = 0; i < 18; i++) {
      const x = (i * 137.3 + time * (4 + i % 4)) % (width + 20) - 10;
      const y = (i * 83.7 + Math.sin(time * .4 + i) * 12 + height) % height;
      ctx.beginPath(); ctx.arc(x, y, 1 + i % 3 * .45, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawWake(ctx, width, height, state, compact) {
  if (!state.charge) return;
  const direction = flipped ? 1 : -1, centerX = width * .5 - direction * 20;
  ctx.save();
  ctx.strokeStyle = theme === 'light' ? 'rgba(41,95,101,.28)' : 'rgba(125,239,235,.28)';
  for (let i = 0; i < (compact ? 4 : 8); i++) {
    const length = (compact ? 30 : 85) + i * (compact ? 7 : 14);
    const y = height * .5 + (i - (compact ? 1.5 : 3.5)) * (compact ? 7 : 12);
    ctx.globalAlpha = .15 + ((state.charge + i * .13) % 1) * .45;
    ctx.lineWidth = 1 + i % 2;
    ctx.beginPath(); ctx.moveTo(centerX, y);
    ctx.lineTo(centerX + direction * length, y + Math.sin(animationTime * 8 + i) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawModel(ctx, model, { width, height }, compact = false) {
  if (!model) return;
  if (capturingSnapshot) drawBackdrop(ctx, width, height, animationTime, compact);
  const state = animationState(animationTime);
  drawWake(ctx, width, height, state, compact);
  drawCreatureVisual(ctx, {
    plan: resolvedPlan(model), width, height, time: state.t,
    mouth: state.mouth, hurt: state.hurt, flipped, compact, zoom,
    shift: state.shift * (compact ? .3 : 1), tilt: state.tilt,
    centerY: .51,
  });
  if (capturingSnapshot && !compact) {
    const vignette = ctx.createRadialGradient(
      width * .5, height * .5, Math.min(width, height) * .24,
      width * .5, height * .5, Math.max(width, height) * .67,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, theme === 'light' ? 'rgba(40,55,58,.2)' : 'rgba(0,4,9,.65)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }
}

function modelMetrics(model) {
  if (model.plan.kind === 'dunkleosteus') return [
    ['Armor reach', `${Math.round((model.plan.headLength || .45) * 100)}%`],
    ['Head depth', `${(model.plan.headDepth || 1).toFixed(2)}×`],
    ['Tail', model.plan.tailStyle],
    ['Fins', model.plan.finStyle],
  ];
  return [
    ['Tier', model.species.tier], ['Body plan', model.plan.kind],
    ['Radius', model.stats.radius], ['Top speed', Math.round(model.stats.maxSpeed)],
  ];
}

function syncDetails() {
  const index = models.indexOf(selected);
  $('#modelName').textContent = selected.name;
  $('#modelDirection').textContent = selected.direction;
  $('#modelDescription').textContent = selected.description;
  $('#modelTags').replaceChildren(...selected.tags.map(tag => Object.assign(document.createElement('span'), { textContent: tag })));
  $('#modelMetrics').replaceChildren(...modelMetrics(selected).map(([label, value]) => {
    const item = document.createElement('span'), strong = document.createElement('b');
    item.textContent = label; strong.textContent = value; item.append(strong); return item;
  }));
  $('#stageIndex').textContent = collection === 'concepts'
    ? `SIDE PROFILE · ${String(index + 1).padStart(2, '0')} / ${models.length}`
    : `CREATURE ${String(index + 1).padStart(2, '0')} / ${models.length}`;
  $('#stageAnimation').textContent = animationNames[animation];
  for (const [id, card] of cards) {
    card.classList.toggle('selected', id === selected.id);
    const model = models.find(candidate => candidate.id === id);
    card.querySelectorAll('[data-palette]').forEach(dot => dot.classList.toggle('active', Number(dot.dataset.palette) === paletteIndex(model)));
  }
  syncStagePalettes();
  syncUrl();
}

function syncUrl() {
  const params = new URLSearchParams({ collection, model: selected.id, animation });
  if (selected.palettes?.length) params.set('palette', String(paletteIndex(selected)));
  history.replaceState(null, '', `${location.pathname}?${params}`);
}

function paletteDot(model, palette, index, compact = false) {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = `paletteDot${compact ? ' compact' : ''}`;
  dot.dataset.palette = index;
  dot.title = palette.name;
  dot.setAttribute('aria-label', `${model.name}: ${palette.name} colors`);
  const upper = palette.backColor || palette.plate || palette.body || '#526c70';
  const lower = palette.bellyColor || palette.accent || palette.body || '#a8b9a5';
  dot.style.background = `linear-gradient(135deg, ${upper} 0 49%, ${lower} 51% 100%)`;
  dot.classList.toggle('active', index === paletteIndex(model));
  dot.addEventListener('click', event => { event.stopPropagation(); setPalette(model, index); }, listenerOptions);
  return dot;
}

function syncStagePalettes() {
  const picker = $('#stagePalettePicker'), palettes = selected.palettes || [];
  picker.hidden = palettes.length === 0;
  picker.replaceChildren(...palettes.map((entry, index) => paletteDot(selected, entry, index)));
}

function setPalette(model, index) {
  if (!model.palettes?.length) return;
  paletteSelections.set(model.id, Math.max(0, Math.min(index, model.palettes.length - 1)));
  selected = model; animationTime = 0; syncDetails();
}

function selectModel(model, reveal = false) {
  if (!model) return;
  selected = model; animationTime = 0; syncDetails();
  if (reveal) cards.get(model.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function makeCard(model, index) {
  const card = document.createElement('div');
  card.className = 'modelCard';
  card.dataset.model = model.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${model.name} model option`);
  const preview = document.createElement('div');
  preview.className = 'modelCardPreview';
  preview.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'modelCardText';
  const number = document.createElement('span');
  number.className = 'modelCardIndex';
  number.textContent = collection === 'concepts'
    ? `DIRECTION ${String(index + 1).padStart(2, '0')}`
    : `TIER ${model.species.tier} · ${model.plan.kind.toUpperCase()}`;
  const name = document.createElement('span');
  name.className = 'modelCardName'; name.textContent = model.name;
  const direction = document.createElement('span');
  direction.className = 'modelCardDirection'; direction.textContent = model.direction;
  text.append(number, name, direction); card.append(preview, text);
  if (model.palettes?.length) {
    const picker = document.createElement('span');
    picker.className = 'modelCardPalettes';
    picker.setAttribute('aria-label', 'Color variants');
    picker.append(...model.palettes.map((entry, paletteNumber) => paletteDot(model, entry, paletteNumber, true)));
    card.append(picker);
  }
  card.addEventListener('click', () => selectModel(model), listenerOptions);
  card.addEventListener('keydown', event => {
    if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); selectModel(model);
    }
  }, listenerOptions);
  card._search = `${model.name} ${model.direction} ${model.description} ${model.tags.join(' ')}`.toLowerCase();
  card._unregisterPreview = overlay.register(preview, (ctx, frame) => {
    if (!visibleCards.has(card) || card.hidden) return;
    drawModel(ctx, model, frame, true);
  }, { animated: true, occlusion: false });
  cards.set(model.id, card);
  cardObserver?.observe(card);
  if (!cardObserver) visibleCards.add(card);
  return card;
}

function rebuildLibrary() {
  cardObserver?.disconnect();
  visibleCards.clear();
  for (const card of cards.values()) card._unregisterPreview?.();
  cards.clear();
  grid.replaceChildren();
  models.forEach((model, index) => grid.append(makeCard(model, index)));
  $('#libraryEyebrow').textContent = collection === 'concepts' ? 'REDESIGN STUDY' : 'LIVE GAME CATALOGUE';
  $('#libraryTitle').textContent = collection === 'concepts' ? 'Choose a direction' : `${models.length} current creatures`;
  $('#libraryIntro').textContent = collection === 'concepts'
    ? `${models.length} side-profile directions. Directions 31-40 develop Mangrove Shade's dark back, light belly and visible gills.`
    : 'Every current species uses this same renderer path. Filter by name, tier, branch or body plan.';
  $('#modelSearch').value = '';
  filterCards();
  syncDetails();
  if (revealRequest) cancelAnimationFrame(revealRequest);
  revealRequest = requestAnimationFrame(() => {
    revealRequest = 0;
    if (getComputedStyle(grid).overflowY !== 'visible') {
      cards.get(selected.id)?.scrollIntoView({ block: 'nearest' });
    }
  });
}

function filterCards() {
  const term = $('#modelSearch').value.trim().toLowerCase();
  let shown = 0;
  for (const card of cards.values()) {
    const matches = !term || card._search.includes(term);
    card.hidden = !matches;
    if (matches) shown++;
  }
  $('#emptyLibrary').hidden = shown !== 0;
}

function setCollection(next) {
  if (!collections[next] || next === collection) return;
  collection = next;
  models = collections[next];
  selected = next === 'concepts' ? models[0] : models.find(model => model.id === 'dunkleosteus') || models[0];
  document.querySelectorAll('[data-collection]').forEach(button => button.classList.toggle('active', button.dataset.collection === collection));
  animationTime = 0;
  rebuildLibrary();
}

function setAnimation(next) {
  if (!animationNames[next]) return;
  animation = next;
  animationTime = 0;
  document.querySelectorAll('[data-animation]').forEach(button => button.classList.toggle('active', button.dataset.animation === animation));
  $('#stageAnimation').textContent = animationNames[animation];
  syncUrl();
}

function stepModel(direction) {
  const index = models.indexOf(selected);
  selectModel(models[(index + direction + models.length) % models.length], true);
}

function togglePause() {
  paused = !paused;
  $('#pauseButton').textContent = paused ? '▶ Resume' : 'Ⅱ Pause';
  $('#pauseButton').setAttribute('aria-pressed', String(paused));
}

function snapshot() {
  capturingSnapshot = true;
  try {
    mainOverlay.download(mainView, `${selected.id}-${animation}.png`);
  } finally {
    capturingSnapshot = false;
    mainOverlay.render(performance.now());
  }
}

const unregisterMain = mainOverlay.register(
  mainView,
  (ctx, frame) => drawModel(ctx, selected, frame, false),
  { animated: true, occlusion: false },
);
document.querySelectorAll('[data-collection]').forEach(button => button.addEventListener('click', () => setCollection(button.dataset.collection), listenerOptions));
document.querySelectorAll('[data-animation]').forEach(button => button.addEventListener('click', () => setAnimation(button.dataset.animation), listenerOptions));
$('#modelSearch').addEventListener('input', filterCards, listenerOptions);
$('#previousModel').addEventListener('click', () => stepModel(-1), listenerOptions);
$('#nextModel').addEventListener('click', () => stepModel(1), listenerOptions);
$('#pauseButton').addEventListener('click', togglePause, listenerOptions);
$('#flipButton').addEventListener('click', () => {
  flipped = !flipped;
  $('#flipButton').classList.toggle('active', flipped);
  $('#flipButton').setAttribute('aria-pressed', String(flipped));
}, listenerOptions);
$('#zoomRange').addEventListener('input', event => {
  zoom = Number(event.target.value) / 100;
  $('#zoomOutput').textContent = `${event.target.value}%`;
}, listenerOptions);
$('#themeSelect').addEventListener('change', event => {
  theme = event.target.value;
  stage.dataset.theme = theme;
}, listenerOptions);
$('#snapshotButton').addEventListener('click', snapshot, listenerOptions);
window.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea,button,a')) return;
  if (/^[1-5]$/.test(event.key)) setAnimation(Object.keys(animationNames)[Number(event.key) - 1]);
  else if (event.key === 'ArrowLeft') stepModel(-1);
  else if (event.key === 'ArrowRight') stepModel(1);
  else if (event.code === 'Space') { event.preventDefault(); togglePause(); }
}, listenerOptions);

function frame(now) {
  if (destroyed) return;
  const dt = Math.min(.05, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  if (!paused) animationTime += dt;
  frameRequest = requestAnimationFrame(frame);
}

function destroy() {
  if (destroyed) return;
  destroyed = true;
  listenerController.abort();
  if (frameRequest) cancelAnimationFrame(frameRequest);
  if (revealRequest) cancelAnimationFrame(revealRequest);
  frameRequest = 0; revealRequest = 0;
  cardObserver?.disconnect();
  for (const card of cards.values()) card._unregisterPreview?.();
  cards.clear(); visibleCards.clear();
  unregisterMain();
  overlay.destroy();
  mainOverlay.destroy();
  document.body.dataset.ready = 'destroyed';
}

window.addEventListener('pagehide', destroy, { once: true, signal: listenerController.signal });

document.querySelectorAll('[data-collection]').forEach(button => button.classList.toggle('active', button.dataset.collection === collection));
document.querySelectorAll('[data-animation]').forEach(button => button.classList.toggle('active', button.dataset.animation === animation));
rebuildLibrary();
window.__modelLab = {
  renderer: 'pixi',
  overlay,
  mainOverlay,
  get state() {
    return { collection, selected: selected.id, animation, paused, flipped, zoom, theme, visibleCards: visibleCards.size };
  },
  setCollection, setAnimation, stepModel, togglePause, selectModel, destroy,
};
overlay.render(performance.now());
mainOverlay.render(performance.now());
document.body.dataset.ready = 'true';
frameRequest = requestAnimationFrame(frame);

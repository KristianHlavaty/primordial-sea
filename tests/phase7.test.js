import { SPECIES } from '../src/data/species.js';
import { DUNKLEOSTEUS_VARIANTS } from '../src/data/dunkleosteusVariants.js';
import { ABILITIES } from '../src/data/abilities.js';
import { ITEMS } from '../src/data/items.js';
import { TALENT_TREES } from '../src/data/talents.js';
import { getPixiDomOverlay } from '../src/render/pixi/PixiDomOverlay.js';
import {
  drawCreatureVisual, drawAbilityIconVisual,
  drawItemIconVisual, drawTalentIconVisual,
} from '../src/render/pixi/PixiVisualFactory.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, message, timeout = 5000) => {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const result = check();
    if (result) return result;
    await wait(25);
  }
  throw new Error(message);
};

const fixture = document.getElementById('visualFixture');
const overlay = await getPixiDomOverlay({ key: 'phase7-fixture', zIndex: -1 });
const plans = [
  ...Object.values(SPECIES).map(species => species.plan),
  ...DUNKLEOSTEUS_VARIANTS.map(variant => variant.plan),
];
const abilityIds = Object.keys(ABILITIES);
const itemIds = Object.keys(ITEMS);
const talentIcons = [...new Set(TALENT_TREES.flatMap(tree => tree.talents.map(talent => talent.icon)))];

overlay.register(fixture, (ctx, frame) => {
  const cellWidth = Math.max(64, frame.width / 12), cellHeight = 48;
  plans.forEach((plan, index) => {
    ctx.save();
    ctx.translate(index % 12 * cellWidth, Math.floor(index / 12) * cellHeight);
    drawCreatureVisual(ctx, {
      plan, width: cellWidth, height: cellHeight, time: 2.3,
      mouth: index % 3 * .3, hurt: index % 7 === 0 ? .4 : 0,
    });
    ctx.restore();
  });
  const iconY = Math.ceil(plans.length / 12) * cellHeight;
  abilityIds.forEach((id, index) => {
    ctx.save(); ctx.translate(index * 32 % frame.width, iconY + Math.floor(index * 32 / frame.width) * 32);
    drawAbilityIconVisual(ctx, { id, color: ABILITIES[id].color, width: 30, height: 30 }); ctx.restore();
  });
  const itemY = iconY + Math.ceil(abilityIds.length * 32 / frame.width) * 32;
  itemIds.forEach((id, index) => {
    ctx.save(); ctx.translate(index * 34 % frame.width, itemY + Math.floor(index * 34 / frame.width) * 34);
    drawItemIconVisual(ctx, { id, width: 32, height: 32 }); ctx.restore();
  });
  const talentY = itemY + Math.ceil(itemIds.length * 34 / frame.width) * 34;
  talentIcons.forEach((id, index) => {
    ctx.save(); ctx.translate(index * 34 % frame.width, talentY + Math.floor(index * 34 / frame.width) * 34);
    drawTalentIconVisual(ctx, { id, color: '#8affd0', width: 32, height: 32 }); ctx.restore();
  });
});

test('shared Pixi factory renders every species, concept, ability, item, and talent variant', () => {
  overlay.render(performance.now());
  const stats = overlay.stats();
  assert(stats.fills > plans.length * 2, `Creature factory coverage was too low: ${JSON.stringify(stats)}`);
  assert(stats.strokes > abilityIds.length + itemIds.length + talentIcons.length, `Icon factory coverage was too low: ${JSON.stringify(stats)}`);
  assert(stats.imagesSkipped === 0, 'A preview attempted to fall back to a Canvas bitmap');
  assert(stats.views === 1 && stats.layers.ui?.activeGraphics > 0, `DOM overlay did not retain its native Pixi view: ${JSON.stringify(stats)}`);
});

test('gameplay and preview source paths make no Canvas 2D requests', async () => {
  const sourcePaths = [
    '../src/runtime/GameRuntime.js',
    '../src/render/renderWorld.js',
    '../src/render/drawDunkleosteus.js',
    '../src/modelLab.js',
    '../src/ui/components/CreatureCanvas.js',
    '../src/ui/components/AbilityIcon.js',
    '../src/ui/components/ItemIcon.js',
    '../src/ui/components/TalentIcon.js',
  ];
  for (const path of sourcePaths) {
    const response = await fetch(path);
    assert(response.ok, `Could not audit ${path}`);
    const source = await response.text();
    assert(!/getContext\s*\(\s*['"]2d['"]/.test(source), `${path} still requests a Canvas 2D context`);
  }
  const removed = await Promise.all([
    fetch('../src/render/canvas/CanvasWorldRenderer.js'),
    fetch('../src/render/staticLayerCache.js'),
  ]);
  assert(removed.every(response => !response.ok), 'A removed Canvas renderer/cache module is still served');
});

test('Model Lab keeps its complete control surface on the shared Pixi renderer', async () => {
  const iframe = document.getElementById('modelLabFixture');
  const lab = await waitFor(() => iframe.contentWindow?.__modelLab, 'Model Lab did not become ready');
  await waitFor(() => iframe.contentDocument?.body?.dataset.ready === 'true', 'Model Lab did not render its first Pixi frame');
  const doc = iframe.contentDocument, win = iframe.contentWindow;
  assert(lab.renderer === 'pixi' && doc.body.dataset.renderer === 'pixi', 'Model Lab did not select Pixi');
  assert(doc.querySelector('#modelViewport') && !doc.querySelector('#modelCanvas'), 'Model Lab retained its legacy Canvas preview');
  const mainRect = doc.querySelector('#modelViewport').getBoundingClientRect();
  assert(mainRect.width > 600 && mainRect.height >= 300, `Responsive main preview collapsed: ${JSON.stringify(mainRect.toJSON())}`);
  assert(doc.querySelectorAll('.modelCardPreview').length === DUNKLEOSTEUS_VARIANTS.length, 'Concept card collection is incomplete');
  lab.mainOverlay.render(performance.now());
  assert(lab.mainOverlay.stats().fills > 20 && lab.mainOverlay.stats().imagesSkipped === 0, 'Model Lab main preview did not emit native Pixi graphics');

  lab.setAnimation('bite');
  lab.togglePause();
  assert(lab.state.animation === 'bite' && lab.state.paused, 'Animation/pause controls lost state');
  doc.querySelector('#flipButton').click();
  const zoom = doc.querySelector('#zoomRange');
  zoom.value = '130'; zoom.dispatchEvent(new win.Event('input', { bubbles: true }));
  const theme = doc.querySelector('#themeSelect');
  theme.value = 'light'; theme.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert(lab.state.flipped && lab.state.zoom === 1.3 && lab.state.theme === 'light', 'Flip, zoom, or theme controls lost state');
  assert(typeof lab.mainOverlay.app.renderer.extract.download === 'function', 'Snapshot extraction is unavailable');

  lab.setCollection('species');
  assert(doc.querySelectorAll('.modelCardPreview').length === Object.keys(SPECIES).length, 'Species collection is incomplete');
  const search = doc.querySelector('#modelSearch');
  search.value = 'dunkleosteus'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
  assert([...doc.querySelectorAll('.modelCard')].filter(card => !card.hidden).length >= 1, 'Search hid every matching species');
  const before = lab.state.selected;
  doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert(lab.state.selected !== before, 'Keyboard model stepping did not change the selection');
  assert(new URL(iframe.contentWindow.location.href).searchParams.get('collection') === 'species', 'URL state did not track the collection');
});

const results = document.getElementById('results');
let passed = 0;
for (const { name, run } of tests) {
  try {
    await run(); passed++;
    results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`);
  } catch (error) {
    results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`);
  }
}
overlay.destroy();
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${tests.length} passed`);
document.title = passed === tests.length ? 'PASS - Phase 7 Pixi previews' : 'FAIL - Phase 7 Pixi previews';
document.body.dataset.tests = passed === tests.length ? 'pass' : 'fail';

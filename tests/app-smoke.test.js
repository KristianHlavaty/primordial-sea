const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const requireElement = selector => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
};

try {
  await wait(80);
  const modelLab = requireElement('.modelLabShortcut');
  if (modelLab.tagName !== 'A' || !new URL(modelLab.href).pathname.endsWith('/model-lab.html') || new URL(modelLab.href).pathname.includes('/tests/')) {
    throw new Error(`Model Lab shortcut resolves to a dead route: ${modelLab.href}`);
  }
  requireElement('.menuChoice.sp').click();
  await wait(40);
  requireElement('.bigbtn').click();
  await wait(180);

  const state = window.__game?.state(), renderer = window.__game?.renderer();
  if (!state?.playing || state.phase !== 'play') throw new Error(`Game did not enter play: ${JSON.stringify(state)}`);
  requireElement('#game'); requireElement('.hud');
  if (!renderer?.ready) throw new Error(`Renderer did not initialize: ${JSON.stringify(renderer)}`);
  const requested = new URLSearchParams(location.search).get('renderer') === 'pixi' ? 'pixi' : 'canvas';
  if (renderer.mode !== requested) throw new Error(`Expected ${requested}, received ${renderer.mode}`);

  document.body.dataset.tests = 'pass';
  document.title = `PASS - app smoke (${renderer.mode})`;
} catch (error) {
  const failure = document.createElement('pre'); failure.className = 'appSmokeFailure';
  failure.textContent = error.stack || String(error); document.body.appendChild(failure);
  document.body.dataset.tests = 'fail'; document.title = 'FAIL - app smoke';
}

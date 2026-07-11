# Primordial Sea — an evolution game

A 2D canvas game: you start as a single cell, eat to level up, and evolve
along the arthropod / chordate / cnidarian / mollusc branches while the whole
sea evolves with you. Reach the apex of any sea branch and you can **crawl
ashore** — onto the **land stage**, a set of walk-between maps with their own
creatures, powers and dedicated bosses. This folder is the modular rewrite of
the original single-file `evolution.html`.

**Stages & maps.** The world is a set of MAPS (`src/data/maps.js`) grouped into
STAGES (`sea`, `land`). The sea is one map; the land has two (`The Tidal Coast`,
`The Fern Lowlands`) that you cross by walking off a shared edge. Each map has a
dedicated boss. Sea → land is a one-way *evolution* (crawling ashore), not an
edge walk. Open the **world atlas** (🗺 / `B`) to see every map and its boss.

## How to run

**Double-click `start-game.bat`.** It starts a tiny local web server
(PowerShell, no installs needed) and opens the game at
<http://localhost:8000/>. Keep the console window open while playing.

> Why a server? The game uses native ES modules, which browsers refuse to
> load from `file://`. Any static server works — if you ever install
> Node.js you can also just run `npx serve` in this folder.

There is no build step: edit any file, refresh the browser, done.

## Folder structure

```
index.html            entry page — loads styles, vendored libs, then src/main.js
start-game.bat        double-click to play
tools/serve.ps1       dependency-free static web server
vendor/               React 18, ReactDOM, htm (local copies; game works offline)
styles/               base.css (theme/reset) · hud.css · overlays.css · tree.css
src/
  main.js             boots the React app
  core/               math.js, color.js — pure helpers
  data/               ALL game content as plain data (no logic):
    species.js          player evolution tree (sea + land) + LAND_PIONEERS + STAT_MAX
    maps.js             stages (sea/land), maps, sizes, themes, boss lists, edge links
    npcs.js             NPC species + plants, each tagged with its `stage`
    abilities.js        power catalogue + per-species power sets + active-timer map
    bosses.js           minibosses & perks (referenced by map boss lists)
    plans.js            the parametric "body plan" factory
    branches.js         branch colors/labels (sea + land branches)
    progression.js      XP curve, level cap
  engine/
    Engine.js           orchestrator: world state, update loop, evolution, HUD snapshots
    audio.js            Sfx — tiny WebAudio beep synth
    entities/           class hierarchy:
      Entity.js           base (position, velocity, integration)
      Player.js           extends Entity — input steering, XP, bite, powers
      Creature.js         extends Entity — NPC AI (prey/predator/drifter)
      Boss.js             extends Creature — leashed guardian AI, perk drop
    systems/
      spawning.js         population control + world seeding
      abilities.js        what each active power actually does
      effects.js          particle bursts, floating text
  render/
    drawCreature.js     the one parametric creature renderer (incl. land tetrapods)
    drawPlant.js        sea + land flora (algae/kelp, moss/fern)
    drawAbilityIcon.js  vector icons for powers
    renderWorld.js      full frame draw; sea + land backgrounds by theme
  ui/                   React components (htm templates, JSX-like, no build)
    react.js            single React/htm import point
    App.js              root — picks which screens/overlays to show
    useEngine.js        engine lifecycle + requestAnimationFrame loop
    input.js            keyboard/mouse bindings
    debug.js            window.__game console API for testing
    components/         Hud, AbilityBar, AbilityIcon, AchievementToast, StatRow, CreatureCanvas
    overlays/           StartScreen, PauseOverlay, GameOverScreen, EvolveModal, AtlasModal
    tree/               TreeModal (Sea/Land toggle), TreeNode, TreeDetail (the T-key wiki)
```

### Architecture in one paragraph

`data/` is pure content — adding a species, power or boss is a data edit.
`engine/` owns the simulation: `Engine.update()` advances the world once per
frame, and each entity updates itself (`Creature.act()` is overridden by
`Boss`, so boss behavior is polymorphism, not if-chains). `render/` draws the
world from engine state and knows nothing about React. `ui/` is React: the
engine publishes plain HUD snapshot objects through a callback, and React
renders overlays from them — the UI never mutates engine internals directly.

## How to extend

- **New player species**: add an entry in `data/species.js` (give land forms
  `stage: 'land'`; land tiers restart at 1), reference it in some `evolvesTo`,
  give it powers in `ABILITY_SETS` (`data/abilities.js`). The tree wiki, evolve
  modal and renderer pick it up automatically. A tier-1 land species is
  auto-added to `LAND_PIONEERS` (the crawl-ashore / skip-to-land roster).
- **New NPC**: add to `data/npcs.js` with a `minEra` gate and a `stage`
  (defaults to `'sea'`); it only spawns on maps of that stage.
- **New power**: describe it in `data/abilities.js`, implement its effect in
  `engine/systems/abilities.js` (actives) or check `hasAbility()` where it
  applies (passives), add an icon case in `render/drawAbilityIcon.js`, and — if
  it has a duration — map it to a Player timer field in `ACTIVE_TIMER`.
- **New map**: add a `MAPS` entry in `data/maps.js` (size, theme, `bosses`,
  and `neighbors` for edge links) plus its boss in `data/bosses.js`. The atlas
  and edge-crossing pick it up automatically.
- **New stage**: add a `STAGES` entry, some species with that `stage`, and at
  least one map (with `STAGE_FIRST_MAP`). The tree wiki gains a stage tab.
- **New boss**: add to `BOSSES` in `data/bosses.js` and list its id in a map's
  `bosses` array. Boss ids must be unique across the whole game.

## Reaching the land (flow)

1. Evolve up any sea branch to its apex (a form with no `evolvesTo`).
2. At Lv 10 the **🏝 Crawl Ashore** prompt appears — pick a land pioneer, or
   **stay in the sea** to keep hunting (finish bosses, kills…). If you stay, a
   **🏝 Ashore** button re-opens the prompt anytime.
3. Ashore, you play the land maps; walk off a connected edge to cross between
   them. Each land map has its own dedicated boss.
4. The start screen's **▸ skip to land** jumps straight in as a land pioneer.

## Console debug API

Open DevTools and use `window.__game`, e.g.:

```js
__game.state()          // full snapshot of the run
__game.addXp(500)       // level up fast (triggers evolution at Lv 10)
__game.choose('trilobite')
__game.killBoss('bulwark')
__game.step(60)         // advance 60 sim frames manually
```

## Changes vs. the original evolution.html

Behavior is a 1:1 port, with these deliberate exceptions:

- Removed the vestigial biomass system (`S.biomass`, debug `setBiomass`/`fill`)
  — nothing read it since leveling replaced it; the debug API gained
  `addXp()` instead. Start-screen text updated to describe leveling.
- Fixed: pressing **P** while the evolution-tree wiki was open unpaused the
  game behind the modal.
- Fixed: `__game.state().phase` always reported `'start'` (stale closure).
- Removed dead code: `pick()`, `statBar()`, the `.flash` CSS rule, unused
  player fields (`born`, `dashT`).

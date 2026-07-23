# Primordial Sea — an evolution game

A 2D canvas game: you start as a single cell, eat to level up, and evolve
along the arthropod / chordate / cnidarian / mollusc branches while the whole
sea evolves with you. Reach the apex of any sea branch and you can **crawl
ashore** — onto the **land stage**, a set of walk-between maps with their own
creatures, powers and dedicated bosses. This folder is the modular rewrite of
the original single-file `evolution.html`.

**Stages & maps.** The world is a set of MAPS (`src/data/maps.js`) grouped into
STAGES. The sea contains `The Primordial Sea` and the darker `Starless Bloom`,
connected through a marked descent in the southern seabed; the Devonian and
Carboniferous stages each have their own connected land maps. Sea → land is a
one-way *evolution* (crawling ashore), not an edge walk. Open the **world atlas**
(🗺 / `B`) to see every map, crossing edge and dedicated boss.

**Multiplayer.** One player can host a free-for-all arena on the local network;
everyone else joins from a browser on the same Wi-Fi and picks an animal of the
host's chosen tier. See **Host multiplayer** below (the host needs Node.js
installed; joiners need only a browser).

## How to run

There is **no build step** — edit any file, refresh the browser, done. But the
game must be *served over http*: browsers can't load ES modules from `file://`,
so double-clicking `index.html` won't work on any OS. There are two ways to run
it, each with a one-file launcher.

### What you need installed (preconditions)

| To…                             | Precondition                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Play solo** — Windows         | Nothing — uses built-in PowerShell                                                             |
| **Play solo** — macOS / Linux   | One of **Python 3** (easiest), Python 2, PHP, or Node — most systems already ship Python 3     |
| **Host multiplayer** — any OS   | **Node.js** (LTS) — install once from <https://nodejs.org> (Windows: `winget install OpenJS.NodeJS.LTS`) |
| **Join** a multiplayer game     | Nothing but a web browser                                                                      |

No `npm install` is ever required — React/htm and the pinned PixiJS runtime are
vendored in `vendor/`, and the multiplayer server is a single dependency-free
Node script.

### Play solo

A zero-install launcher starts a tiny static server and opens the game at
<http://localhost:8888/>. Keep the window open while playing; close it or press
Ctrl+C to stop.

- **Windows** — double-click **`start-game.bat`** (built-in PowerShell; nothing to install).
- **macOS** — double-click **`start-game.command`** (first time only, run
  `chmod +x start-game.command start-game.sh` in Terminal so Finder may execute it).
- **Linux** — run **`./start-game.sh`** (or `bash start-game.sh`). Pass a port as the
  first argument if 8888 is busy, e.g. `./start-game.sh 9000`.

> With Node you can skip the scripts and serve the folder any way you like, e.g.
> `npx serve` or `python3 -m http.server 8888`, then open the printed URL.

### Host multiplayer (local network)

One person hosts; everyone else joins from a browser on the same Wi-Fi. The host
runs a small **Node** server, `server/relay.mjs`, that serves the game **and**
runs the lobby/relay on one port. It has **no dependencies** and never runs game
logic — the host's *browser* is the authority — so hosting stays "run one file."

1. **Install Node** once on the host machine (see the table above). Joiners install nothing.
2. **Start the host server:**
   - **Windows** — double-click **`host-game.bat`**
   - **macOS** — double-click **`host-game.command`** (first time: `chmod +x host-game.command host-game.sh`)
   - **Linux** — run **`./host-game.sh`**
   - …or from a terminal in this folder: **`node server/relay.mjs`** (custom port:
     `node server/relay.mjs 9100`; the default is **8899**).
3. The server prints its addresses, including a **LAN URL to share**:
   ```
   On THIS machine:   http://localhost:8899/
   On the network:    http://192.168.1.23:8899/   <- share this
   ```
4. Everyone (host included) opens one of those URLs, sets a name + colour, then
   **Multiplayer**. The host clicks **Host a game** (pick a map + tier); others
   **Join** and pick an animal; the host hits **START**. Combat is free-for-all.

> The host keeps simulating even if its tab is backgrounded (a background Web
> Worker drives it), but keeping the host window **visible** is most reliable.
> If port 8899 is busy, pass another port to the launcher/command. Stop the
> server with Ctrl+C (or close the window).

## Folder structure

```
index.html            entry page — loads styles, vendored libs, then src/main.js
start-game.bat        double-click to PLAY SOLO (Windows · static server, no installs)
start-game.command    double-click to play solo (macOS)
start-game.sh         run to play solo (macOS / Linux)
host-game.bat         double-click to HOST MULTIPLAYER (Windows · needs Node.js)
host-game.command     double-click to host multiplayer (macOS · needs Node.js)
host-game.sh          run to host multiplayer (macOS / Linux · needs Node.js)
server/relay.mjs      zero-dependency Node host: serves the game + WebSocket lobby/relay
tools/serve.ps1       dependency-free static web server (Windows, solo play)
vendor/               React 18, ReactDOM, htm, PixiJS 8.18.1 + licenses (local; offline)
docs/                 staged rewrite plan and feature-parity checklist
tests/                browser-run architecture, catalog, renderer and game smoke tests
styles/               base.css (theme/reset) · hud.css · overlays.css · tree.css · atlas.css · talents.css · menu.css
src/
  main.js             boots the React app
  core/               math.js, color.js + deterministic EventBus
  net/                multiplayer client — profile.js (local name/colour) · lobby.js (WebSocket lobby client)
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
    events.js           cross-subsystem subscriber-event names
    adapters/           command-event compatibility adapters for legacy simulation calls
    components/         component world plus the temporary legacy compatibility adapter
    Engine.js           simulation facade: world state, fixed updates, evolution, HUD snapshots
    audio.js            Sfx — tiny WebAudio beep synth
    mp.js               multiplayer netcode — host authority, snapshots, client replica, packets
    entities/           class hierarchy:
      Entity.js           base (position, velocity, integration)
      Player.js           extends Entity — input steering, XP, bite, powers, FFA death/respawn
      Creature.js         extends Entity — NPC AI (prey/predator/drifter), targets nearest player
      RemotePlayer.js     extends Player — another player, steered by network input (host side)
      Boss.js             extends Creature — leashed guardian AI, perk drop
    systems/
      CoreComponentSystems.js  ordered Phase 4 movement/world/progression systems
      GameplayComponentSystems.js  Phase 5 combat/ability/item/vehicle/boss coordinator
      spawning.js         population control + world seeding
      abilities.js        what each active power actually does
      effects.js          particle bursts, floating text
    net/
      ComponentSnapshotProtocol.js  v1/v2 multiplayer schemas, negotiation and adapters
  render/
    canvas/             compatibility world renderer used until Pixi reaches visual parity
    pixi/               native Pixi world renderer, scene layers, geometry bridge and pools
    drawCreature.js     the one parametric creature renderer (incl. land tetrapods)
    drawPlant.js        sea + land flora (algae/kelp, moss/fern)
    drawAbilityIcon.js  vector icons for powers
    renderWorld.js      full frame draw; sea + land backgrounds by theme
  runtime/              composition root, clock, interpolation projector and audio boundary
  ui/                   React components (htm templates, JSX-like, no build)
    react.js            single React/htm import point
    App.js              root — picks which screens/overlays to show
    useEngine.js        React lifecycle adapter for the game runtime
    input.js            keyboard/mouse command-event publisher
    debug.js            window.__game console API for testing
    components/         Hud, AbilityBar, AbilityIcon, AchievementToast, StatRow, CreatureCanvas
    overlays/           StartScreen (main menu), MultiplayerScreen (lobby), MpHud (FFA scoreboard + kill feed),
                        ProfileModal (name/colour), PauseOverlay, GameOverScreen, EvolveModal, AtlasModal, TalentModal
    tree/               TreeModal (Sea/Land toggle), TreeNode, TreeDetail (the T-key wiki)
```

### Architecture in one paragraph

`data/` is pure content — adding a species, power or boss is a data edit.
`engine/` owns simulation state: `Engine.update()` advances one fixed step, and
ordered component phases now own spatial/input, world resources, progression,
combat, abilities, inventory, vehicles, and boss timelines. Compatibility
entity methods preserve the current debug/render/network-facing object shape.
`runtime/` composes the clock, event bus, inputs, audio,
network ingress, immutable presentation projection and selected renderer.
`render/` consumes presentation frames and knows nothing about React. `ui/` is
React: it publishes commands and renders plain HUD snapshots received through
subscriber events. The full migration sequence and parity gates are in
`docs/PIXI_COMPONENT_MIGRATION.md`.

Canvas remains the default gameplay renderer while the Phase 3 parity matrix is
reviewed. Append `?renderer=pixi` to the game URL to run the complete Pixi world
path; it draws native Pixi geometry/text and does not upload Canvas frames.

The browser test pages are `tests/core.test.html` (architecture, catalogs and
runtime), `tests/gameplay-phase5.test.html` (all gameplay catalogs and fact
streams), `tests/multiplayer-phase6.test.html` (versioned packets, paired
host/client relay, ordering, maps/settings and reconnect/background behavior),
`tests/render.test.html` (all Pixi visual catalogs/scenarios), and
`tests/app-smoke.test.html` (real React startup and run flow). The deterministic
visual page is `tests/render-smoke.test.html`; add `?renderer=pixi` and optionally
`&map=spore_marsh` (or another map id). A passing run reports `PASS` in its title.

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
  `neighbors`, and optional restricted-width `passages`) plus its boss in
  `data/bosses.js`. The atlas
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

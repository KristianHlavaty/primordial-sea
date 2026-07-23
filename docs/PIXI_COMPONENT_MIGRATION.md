# PixiJS + Component Architecture Migration

Status: Phase 5 implementation and its catalog-driven gameplay gate are
complete. Phase 3's stored-reference and extended manual visual-parity checks
remain required before Pixi becomes the default or Canvas can be removed.

This document is the source of truth for the rewrite. Update its checkboxes as
work lands. A phase is not complete until its parity gate passes. The old path
stays available until the replacement path has passed that gate.

## Goals

- Replace the gameplay Canvas 2D renderer with PixiJS 8.18.1.
- Replace inheritance-heavy live game entities with composition: stable entity
  IDs, plain component data, and ordered systems.
- Replace ad-hoc callbacks and cross-module calls with typed-by-convention,
  documented subscriber events and commands.
- Preserve every current game mode, mechanic, visual cue, debug hook, and
  multiplayer behavior throughout the migration.
- Keep the current no-build, no-`npm install`, local/offline launch flow. PixiJS
  is vendored as an ES module just like React/htm are vendored today.

## Non-goals

- No gameplay rebalance during the architecture migration.
- No multiplayer protocol redesign until the component state is already
  authoritative and parity-tested.
- No React replacement. React continues to own menus, modals, and the DOM HUD.
- No conversion of data catalogs into classes. `src/data/` stays declarative.
- No art redesign. The procedural art should look and animate the same before
  visual improvements are considered.

## Baseline that must not be lost

The files named below are the current behavioral specifications. If prose here
and executable behavior disagree, record the discrepancy before changing it.

### Runtime and input

- Fixed 60 Hz simulation, capped catch-up, render interpolation, configurable
  render rate (30/60/120/144/uncapped), and 30 Hz menu rendering.
- Hidden multiplayer-host simulation driven at 20 Hz by the worker metronome;
  hidden tabs skip cosmetic work, sound, and React snapshots.
- Mouse and WASD/arrow steering; click/Space bite; physical Digit1-3 abilities;
  Q/E/F items; V vehicle; P/Escape pause/menu; M mute; L level labels; T tree;
  B atlas; K talents. Modal input suppression and key-up cleanup must remain.
- Device-pixel-ratio handling capped at 2, resize handling, camera smoothing,
  camera shake, and simulation-to-render interpolation.
- Console API compatibility through `window.__game`, including manual stepping,
  state inspection, evolution, maps, abilities, bosses, talents, and MP hooks.

### Run modes and UI

- Single-player new run, Devonian/Carboniferous skip-ahead with banked talent
  points, optional fantasy bridges, optional respawns, items, fun items/vehicles,
  and cheats.
- Local-network lobby: profile name/color persistence, room host/join/leave,
  host-selected map/tier/settings, species selection, roster refresh, and FFA.
- Start screen, HUD, ability bar, item drag/drop bar, perks, vehicle panel,
  achievements, evolution/ascension/advance choices, pause, settings, death,
  multiplayer scoreboard/feed/minimap/respawn, tree wiki, atlas, boss effects,
  talent tree, profile editor, and model-lab shortcut.
- UI previews and icons currently rendered by Canvas 2D: creatures, evolution
  cards, ability/item/talent icons, and Model Lab cards/selected model.

### World and progression

- Stages: Sea, Devonian, Carboniferous.
- Maps: `sea_shallows`, `starless_bloom`, `fangwall_trench`, `tidal_coast`,
  `silken_grove`, `coal_forest`, and `spore_marsh`.
- Edge passages, passage assist/dwell/cooldown, per-map dimensions/themes/NPC
  pools/caps, web fields, bosses, map visits, sea-to-land ascension, and
  Devonian-to-Carboniferous advancement.
- XP curve, levels 1-10, per-level stat growth, egg/evolution flow, all species
  and branches in `src/data/species.js`, fantasy filtering, dead-end warning,
  era scaling, respawn/death, kills, and healing/food collection.
- All stage talent trees: earn/unlock/spend/undo/respec, prerequisite and path
  rules, computed bonuses, skip-ahead grants, HUD badge, and debug inspection.

### Simulation content

- Player, remote player, prey/predator/drifter NPC behavior, plants/regrowth,
  meat/plant food attraction and collection, current, bubbles, obstacles, webs,
  eggs, particles, FX, floaters, and spawn population control.
- Bosses and their exact telegraphs/specials/leashes/drops/perks:
  `bulwark`, `render`, `lumenara`, `panderodus`, `tidewarden`, `sovereign`,
  `gilboa_matriarch`, and `marshqueen`.
- Abilities in `src/data/abilities.js`, including passive meters and visuals:
  harden, enroll, barbs, burst, frenzy, evasion, engulf, bloom, shock, nettle,
  jet, withdraw, ink, grasp, ram, filter, impale, crush, rebirth, bloodscent,
  venom, camo, whirlpool, pounce, burrow, stomp, tailsweep, sprint, regen,
  thickhide, bastion, ampullae, hypervenom, hookarms, airbreath, websnare,
  silksense, dive, venomsting, and sail.
- Natural and optional modern items in `src/data/items.js`, their cooldowns,
  uses, pickups, inventory/drop behavior, hit logic, projectiles, mines, cat,
  orbital strike, force field, black hole, and visual phases.
- Optional submarine/helicopter spawn, enter/exit, armor, lifetime, weapons,
  destruction, respawn, and multiplayer authority.
- Audio unlock/mute/background behavior and all current sound triggers.

### Rendering

Preserve the draw order and cues currently specified by
`src/render/renderWorld.js`: background, terrain/passages, fields/telegraphs,
plants/food/items/vehicles/projectiles, creatures and boss decoration, player
power states/bite/shields, particles/FX/floaters/bubbles, danger vignette,
off-screen boss markers, labels/tags, and evolution previews.

Creature parity includes every procedural body plan in `drawCreature.js`, the
specialized Dunkleosteus renderer and variants, static-layer caching, animation
phase, palette overrides, damage/status alpha, remote-player color rings, and
Model Lab flip/zoom/palette/animation controls.

### Multiplayer invariants

- The host browser remains authoritative; the relay remains dependency-free and
  contains no game simulation.
- Host snapshots remain 20 Hz and client input remains 30 Hz with keepalive.
- Multi-map host simulation, active-world swapping, player-specific snapshots,
  client interpolation/extrapolation, transient packet handling, evolution,
  cheats/items/vehicles, deaths/respawns, roster/feed/minimap all remain.
- Packet field names and shapes must not change until a protocol-versioned
  migration is explicitly introduced. Old and new renderers must be able to
  consume the same client replica state during the transition.

## Target architecture

### Events

One synchronous event bus belongs to each game runtime. It is not a global.
Subscriptions return cleanup functions, support one-shot listeners, and have a
defined priority/order. Emission uses a listener snapshot so subscribe/unsubscribe
during a dispatch affects the next dispatch, not the current one. Exceptions are
reported through a dedicated error event when possible and otherwise rethrown.

Event names use `domain:action` and live in one constants module. Initial public
domains are:

- `runtime:*`: resize, schedule change, started/stopped, pause/background.
- `world:*`: map load/change, entity lifecycle, stage/era changes.
- `input:*`: movement state and bite/ability/item/vehicle commands.
- `combat:*`: hit, damaged, dodged, killed, bite, status applied.
- `progression:*`: XP, level, evolution offered/chosen, talent/perk changes.
- `fx:*` and `audio:*`: disposable visual/audio requests derived from gameplay.
- `ui:*`: immutable HUD snapshot, achievement, modal request.
- `net:*`: decoded input/snapshot/transient events at the engine boundary.

Commands describe intent (`input:ability`, `progression:choose-evolution`), while
facts describe completed changes (`combat:damaged`, `world:map-changed`). Systems
may subscribe to commands/facts but must not use renderer objects as event data.

### Components and entities

An entity is a numeric ID. Components are plain data records stored by type.
Systems own behavior and iterate queries in a stable order. Render state and
network state are projections of components, not properties on Pixi objects.

Planned component groups:

- Identity/config: Species, NpcKind, BossKind, Owner, NetworkIdentity, MapMember.
- Spatial: Transform, PreviousTransform, Motion, Collider, Facing, CameraTarget.
- Vital/combat: Health, Damage, Bite, Status, Shield, Death/Respawn, Threat.
- Progression: Experience, Evolution, AbilityLoadout, AbilityState, Talents,
  Perks, Inventory, VehiclePilot.
- AI/world: SteeringInput, PlayerInput, AiBrain, HomeLeash, Food, Plant, Spawn,
  Obstacle, CurrentAffected, WebField, Vehicle, Projectile.
- Presentation tags/state: Visual, Animation, Tint, Nameplate, Telegraph,
  ParticleEmitter, Lifetime. These contain serializable descriptions, never
  Pixi `Container`, `Graphics`, or `Texture` instances.

The component world owns creation/removal/querying and emits entity/component
lifecycle events. Structural changes made during a system update are queued and
flushed at a defined boundary. A compatibility adapter mirrors legacy objects
into components while each vertical slice is migrated; there is never a second
authoritative simulation of the same mechanic.

### Ordered systems

The fixed-step pipeline is explicit:

1. Network input decode / local input command collection.
2. Player and AI intent.
3. Ability/item/vehicle intent.
4. Movement, current, collision, edge transitions.
5. Combat, statuses, deaths, drops.
6. Food/plants/progression/evolution.
7. Spawning and lifetime cleanup.
8. Previous/current transform capture and snapshot publication.
9. FX/audio/UI fact projection.

Order is registered in one runtime composition root and tested. Systems do not
import React or PixiJS.

### PixiJS renderer

PixiJS 8.18.1 is vendored at `vendor/pixi.min.mjs`. `Application.init()` is
asynchronous, uses the existing canvas, WebGL preference with supported fallback,
runtime-owned CSS sizing, capped backing-store resolution, and `autoStart: false`. The existing runtime
continues to own fixed stepping and render-rate throttling; Pixi's ticker does not
become a second game clock.

Scene graph (back to front):

```text
stage
|- background (screen space)
|- worldRoot (camera transform + shake)
|  |- terrain/passages
|  |- fields/underlays/telegraphs
|  |- plants/food/pickups
|  |- vehicles/projectiles
|  |- actors
|  |- actor overlays/power states
|  `- world particles/floaters
`- screenFx (bubbles, danger vignette, boss markers)
```

Renderable views subscribe to entity/component lifecycle facts, cache reusable
`GraphicsContext`/textures by visual key, update transforms on render, and destroy
GPU resources deterministically. Large maps use camera-aware visibility rather
than a map-sized cached texture. Dynamic Graphics geometry is rebuilt only when
its visual key changes; animation uses child transforms/uniform state.

React remains over the Pixi canvas. Preview/icon surfaces use small dedicated
Pixi renderers or generated textures after the gameplay renderer is stable.

## Phases

### Phase 0 - Inventory and safety rails

- [x] Inventory current source boundaries and user-visible functionality.
- [x] Record architectural decisions and phase gates in this document.
- [x] Add executable catalog validation and smoke-test entry points.
- [ ] Capture representative reference screenshots and debug-state fixtures for
  sea, abyss, Devonian, Carboniferous, bosses, items, vehicles, and MP replica.

Gate: this document covers all current feature families, and baseline fixtures
can be reproduced before legacy code is deleted.

### Phase 1 - Event/component/Pixi foundation

- [x] Add the deterministic runtime EventBus and event-name catalog.
- [x] Add component-world storage, stable queries, lifecycle events, ordered
  system registration, and safe structural-change flushing.
- [x] Route HUD and scheduler notifications through subscriptions while keeping
  compatibility methods for existing callers.
- [x] Vendor and license-pin PixiJS 8.18.1; add an async Pixi application wrapper
  that can initialize/destroy/resize/render without owning simulation time.
- [x] Add focused tests for event ordering/cleanup/reentrancy and component
  add/remove/query/system order.

Gate: the current Canvas game still plays unchanged; the new infrastructure is
covered by tests; a Pixi application can initialize against the game canvas in a
smoke page without driving simulation.

### Phase 2 - Runtime boundaries and legacy bridge

- [x] Introduce a composition root that owns clock, events, component world,
  simulation facade, renderer, audio, input, networking, and UI projection.
- [x] Convert input to command events and UI/HUD/audio/scheduling to subscribers.
- [x] Move render interpolation into a read-only presentation snapshot instead of
  temporarily mutating authoritative objects.
- [x] Mirror legacy entities/world collections into component presentation data.
- [x] Add a runtime renderer switch used only for parity testing.

Gate: Canvas renderer behavior and debug API remain unchanged through the new
runtime boundary; no renderer imports exist in simulation modules.

Verified in Phase 2 by 16 browser architecture/catalog/runtime tests and full
React application smoke runs in both default Canvas mode and `?renderer=pixi`
parity-test mode. Pixi mode intentionally owns only the application/scene
foundation until Phase 3 ports world views; Canvas remains the gameplay default.

### Phase 3 - Pixi world renderer

- [x] Implement scene layers, camera/shake, resize/resolution, backgrounds,
  terrain, sea floor/passages, current, bubbles, webs, danger and boss markers.
- [x] Port plants, obstacles, food, eggs, pickups, vehicles, projectiles,
  particles, FX, floaters, telegraphs, nameplates, health/level labels.
- [x] Port procedural creature visuals, specialized Dunkleosteus variants,
  player power state/shield/bite effects, remote rings, and bosses.
- [x] Pool high-churn views; cache static geometry/texture variants; add culling
  and deterministic cleanup/resource statistics.

Gate: automated snapshot scenes and manual play cover every map/theme, creature
plan, ability visual, boss telegraph, item projectile, vehicle, and screen effect.
Canvas gameplay rendering remains available until this gate passes.

Implementation note: `PixiCanvasContext` is a temporary procedural-art bridge.
It translates the shared drawing vocabulary into native retained Pixi
`Graphics`, `GraphicsContext`, `FillGradient`, and pooled `Text` nodes; it does
not acquire a gameplay 2D context or upload a frame-sized Canvas texture. The
bridge keeps the existing art definitions shared until Phase 7 turns them into
renderer-neutral factories.

Automated coverage currently includes 23 core/runtime tests plus 6 dedicated
Pixi renderer scenarios: all map themes, every species/NPC/boss/Dunkleosteus
plan, every active ability timer, every item/projectile/vehicle visual, all boss
telegraph shapes, screen effects, clip/shadow translation, intra-layer command
order, resource bounds, and deterministic teardown.
`tests/render-smoke.test.html` provides a seeded screenshot scene for either
renderer and accepts `?renderer=pixi&map=<map-id>`. Canvas/Pixi sea screenshots
have been manually compared, as have fixed-viewport `spore_marsh` frames after
the stabilization pass. The gate remains open for stored reference images and
extended manual play across the full scenario matrix.

The Phase 3 stabilization audit also hardened detached presentation snapshots,
component-mirror recovery after external entity removal, multiplayer map-change
events, Pixi command ordering/clipping/shadow cues, viewport sizing, and the
Model Lab shortcut's root-relative resolution. The Model Lab itself remains on
Canvas until its planned Phase 7 port.

### Phase 4 - Core entity composition

- [x] Migrate Transform/Motion/Collider/Input and movement/current/collision/map
  crossing from `Entity`/`Player`/`Creature` objects into components/systems.
- [x] Migrate food/plants/spawning/world lifetimes and map membership.
- [x] Migrate XP/level/evolution/respawn/death and talent/perk projection.
- [x] Remove the presentation mirror for migrated slices.

Gate: deterministic debug fixtures match positions, counts, transitions,
progression, and death/respawn for equivalent command sequences.

Phase 4 uses component-backed compatibility accessors while combat, abilities,
items, vehicles, and boss behavior await Phase 5. Those property names keep the
network/render/debug contracts stable, but their migrated values live only in
the component records; `LegacyComponentAdapter` keeps source/entity ownership
outside component data. Explicit component phases now own input projection,
previous transforms, integration, map crossing, current, obstacle collision,
food and plants, lifetimes, progression/respawn, and population maintenance.
Progression and lifecycle results also publish subscriber facts. The gate is
covered by deterministic movement, resource/lifetime, map transition,
progression/evolution/death/respawn, component-authority, and multiplayer-host
fixtures in `tests/core.test.html`.

### Phase 5 - Combat, abilities, items, vehicles, bosses

- [x] Migrate bite/damage/knockback/status/dodge/shield combat facts.
- [x] Migrate every ability and passive meter, including chained/secondary
  effects and all temporary entities.
- [x] Migrate inventory, every item kind/projectile phase, and optional vehicles.
- [x] Migrate each boss independently with attack timeline fixtures.
- [x] Replace class polymorphism with component tags plus focused systems.

Gate: catalog-driven tests exercise every ability/item/boss; combat outcomes and
visual/audio fact streams match baseline tolerances.

Phase 5 adds component-authoritative Combat, Status, Shield, AbilityLoadout,
AbilityState, Inventory, Item, Projectile, Vehicle, VehiclePilot, Boss, and
Telegraph records. Ephemeral target references and hit sets deliberately stay
outside component data so the records remain serializable for Phase 6. Legacy
property names are component-backed accessors, preserving renderer, debug, and
packet compatibility without maintaining a second simulation copy.

`GameplayComponentSystems` is now the only gameplay scheduling/command boundary
for ability activation/runtime, item use/drop/update, vehicle entry/exit/update,
damage/death dispatch, and boss timeline selection/resolution. Public entity
methods are compatibility delegates; boss updates and encounter deaths dispatch
by component tag instead of inherited `act()`/`die()` selection. Completed
changes publish combat, ability, item, vehicle, boss, FX, and audio facts through
the runtime event bus.

The deterministic Phase 5 gate in `tests/gameplay-phase5.test.html` covers all
40 abilities (active activation plus passive runtime), all 15 item definitions
and their spawned projectile components, both vehicle definitions, all eight
bosses and 18 attack timelines, component authority, and the gameplay fact
streams. It passes alongside the 23 core/runtime tests, six Pixi renderer
scenarios, and both Canvas and Pixi full-application smoke paths.

### Phase 6 - Multiplayer component snapshots

- [x] Add explicit component snapshot schemas and protocol-version adapters.
- [x] Keep old packet compatibility while host authority moves to components.
- [x] Migrate remote input, multi-map worlds, evolution, items/vehicles, FFA
  deaths/respawns/feed/scoreboard/minimap, and client interpolation.
- [x] Add packet round-trip, loss/out-of-order, reconnect/roster, background-host,
  and host/client mixed-version fixtures.

Gate: two-browser and synthetic relay tests pass across all MP settings/maps;
bandwidth and host step cost do not regress materially.

Phase 6 defines the compact wire contract in
`src/engine/net/ComponentSnapshotProtocol.js`. Protocol v2 intentionally keeps
the v1 `S/W/I/A/U/D/V/E/C/K/ready` packet letters and quantized fields, adding
only `pv` and the `ecs-1` schema marker to snapshot/world packets. A v1 client
therefore ignores the new metadata, while ready negotiation lets a v2 host omit
it for an old client. The component field catalog is executable documentation
for player, NPC, food, web, item, projectile, vehicle, roster, map, run, and
remote-input projections. The v2 marker adds 21 bytes rather than duplicating
the entity payload.

Host snapshots now run after the runtime's ordinary component projection.
Transform, health, experience, combat/status/shield, ability, inventory,
vehicle, boss/telegraph, lifetime, map membership, and network identity values
are read from component records. Inactive host-map records stay alive while the
legacy world arrays are swapped, avoiding destroy/recreate churn and retaining
component authority across occupied maps. `REMOTE_INPUT` and
`NETWORK_REPLICA` records own host input intent and client interpolation
targets. Snapshot emission remains once per map group at 20 Hz, so this phase
does not add a second per-recipient component projection.

Ingress publishes decoded, negotiated, dropped, and applied subscriber facts.
Per-peer input sequences reject delayed intent; client snapshot sequences and
map ids reject rollback and packets delayed across a map transition. Roster
departure also clears protocol/input/edge state before a reconnect creates a
fresh authority entity.

The deterministic gate in `tests/multiplayer-phase6.test.html` runs paired host
and client runtimes through a synthetic relay. Its seven fixtures cover v1/v2
round trips and mixed negotiation, fully enabled/disabled settings, component
authority for evolution/inventory/items/projectiles/vehicles/death, feed,
scoreboard and minimap projections, stale input/snapshot loss ordering, every
map's world-init boundary, reconnect cleanup, and background-host cadence. It
passes alongside the 23 core tests, five Phase 5 catalog tests, six Pixi
renderer scenarios, Canvas/Pixi application smoke paths, and Pixi smoke on all
seven maps.

### Phase 7 - Pixi previews, icons, and Model Lab

- [ ] Share the creature visual factory between gameplay, evolution/tree cards,
  Model Lab, and generated thumbnails.
- [ ] Port ability/item/talent icons to shared Pixi graphics/texture factories.
- [ ] Port Model Lab canvas surfaces and preserve collection/search/select,
  animation/pause, flip, zoom, palette variants, keyboard, and responsive layout.
- [ ] Remove gameplay-related Canvas 2D renderer/cache modules.

Gate: no gameplay or preview surface requests a Canvas 2D context; all model and
icon variants have parity coverage.

### Phase 8 - Cleanup and hardening

- [ ] Remove legacy entities, bridges, callback shims, Canvas renderer, and
  renderer switch only after all prior gates pass.
- [ ] Audit subscription/resource cleanup across restart, map change, MP leave,
  React unmount, resize, visibility changes, and renderer fallback/failure.
- [ ] Profile CPU/GPU/memory on large populations and long map/MP sessions.
- [ ] Update README architecture/extension/debug documentation and licenses.

Gate: full feature matrix passes, no legacy runtime path remains, offline launch
works on supported browsers, and soak tests show stable listener/entity/GPU counts.

## Verification strategy

- Pure unit tests: EventBus, component world/query invalidation, system order,
  interpolation, component serializers, progression/talent rules.
- Catalog tests: every species references a plan and valid ability set; every
  ability has behavior/HUD/icon coverage; every map neighbor is reciprocal and
  boss exists; every item has behavior and art; every boss perk exists.
- Deterministic scenario fixtures via `window.__game`: fixed command streams with
  assertions on snapshots and emitted event sequences.
- Rendering fixtures: seeded scenes at fixed time/camera/DPR with reference
  screenshots and a small tolerance for antialiasing differences.
- Multiplayer: packet round trips plus real two-tab host/client smoke tests,
  map separation, evolution, combat/death, roster changes, and hidden host.
- Manual parity pass at the end of every phase, not only at final cleanup.

## Migration rules

1. Data catalogs remain the single source of game content.
2. Exactly one implementation is authoritative for a mechanic at a time.
3. Events cross subsystem boundaries; direct calls are allowed inside one focused
   system when they make ordering clearer.
4. Gameplay state never stores Pixi/React/DOM objects.
5. Renderer code never changes authoritative simulation state.
6. Network schemas use explicit fields and versions, never raw component-store
   internals or Pixi objects.
7. Every subscription and GPU resource has an owner and deterministic cleanup.
8. Delete a legacy path only in the phase whose parity gate covers it.

## PixiJS references used for the design

- Application/init: https://pixijs.com/8.x/guides/components/application
- Scene graph: https://pixijs.com/8.x/guides/concepts/scene-graph
- Graphics/GraphicsContext: https://pixijs.com/8.x/guides/components/scene-objects/graphics
- Render groups: https://pixijs.com/8.x/guides/concepts/render-groups
- Cache as texture: https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture
- v8 migration notes: https://pixijs.com/8.x/guides/migrations/v8

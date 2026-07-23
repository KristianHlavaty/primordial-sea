import { EventBus } from '../core/EventBus.js';
import { Engine } from '../engine/Engine.js';
import { Sfx } from '../engine/audio.js';
import { ComponentWorld } from '../engine/components/ComponentWorld.js';
import { LegacyComponentAdapter } from '../engine/components/LegacyComponentMirror.js';
import { GameplayComponentSystems } from '../engine/systems/GameplayComponentSystems.js';
import { attachLegacyCommandHandlers } from '../engine/adapters/legacyCommands.js';
import { GameEvents } from '../engine/events.js';
import { CanvasWorldRenderer } from '../render/canvas/CanvasWorldRenderer.js';
import { PixiWorldRenderer } from '../render/pixi/PixiWorldRenderer.js';
import { attachInput } from '../ui/input.js';
import { AudioPort, attachAudioSubscriber } from './AudioBus.js';
import { PresentationProjector } from './PresentationProjector.js';
import { RuntimeClock, DEFAULT_RENDER_HZ } from './RuntimeClock.js';

export function rendererModeFromLocation(location = window.location) {
  return new URLSearchParams(location.search).get('renderer') === 'pixi' ? 'pixi' : 'canvas';
}

const makeRenderer = (mode, canvas, events) => {
  if (mode === 'canvas') return new CanvasWorldRenderer(canvas);
  if (mode === 'pixi') return new PixiWorldRenderer(canvas, { events });
  throw new Error(`Unknown renderer mode: ${mode}`);
};

/* Composition root for the migration. It owns platform adapters and exposes
   Engine only as a compatibility simulation facade to existing React views. */
export class GameRuntime {
  constructor(canvas, {
    uiRef = null,
    onHud = null,
    getRenderRate = () => DEFAULT_RENDER_HZ,
    rendererMode = 'canvas',
    attachInputHandlers = true,
    autoStartClock = true,
  } = {}) {
    if (!canvas) throw new TypeError('GameRuntime requires a canvas');
    this.canvas = canvas;
    this.events = new EventBus({ errorEvent: GameEvents.RUNTIME_ERROR });
    this.componentWorld = new ComponentWorld({ events: this.events });
    this.audio = new Sfx();
    this.audioPort = new AudioPort(this.events);
    this.componentAdapter = new LegacyComponentAdapter(this.componentWorld);
    this.componentMirror = this.componentAdapter; // compatibility name for Phase 2 debug consumers
    this.componentSystems = new GameplayComponentSystems(this.componentWorld, this.componentAdapter);
    this.coreComponentSystems = this.componentSystems; // compatibility name for early Phase 4 tooling
    this.engine = new Engine({
      events: this.events, componentWorld: this.componentWorld,
      componentSystems: this.componentSystems, audio: this.audioPort,
    });
    this.componentAdapter.syncRuntime(this.engine);
    this.presenter = new PresentationProjector();
    this.rendererMode = rendererMode;
    this.renderer = makeRenderer(rendererMode, canvas, this.events);
    this.rendererReady = false;
    this.destroyed = false;
    this.lastFrame = null;
    this.viewport = { width: 1, height: 1, resolution: 1 };
    this.network = { transport: null, receive: (from, data) => this.receiveNetworkPacket(from, data) };
    const emit = (event, payload) => this.events.emit(event, payload);
    this.commands = Object.freeze({
      setPaused: paused => emit(GameEvents.FLOW_PAUSED_CHANGED, { paused: !!paused }),
      setInputSuppressed: suppressed => emit(GameEvents.FLOW_INPUT_SUPPRESSION_CHANGED, { suppressed: !!suppressed }),
      togglePause: () => emit(GameEvents.INPUT_PAUSE_REQUESTED),
      toggleMute: () => emit(GameEvents.INPUT_MUTE_REQUESTED),
      toggleLevels: () => emit(GameEvents.INPUT_LEVELS_REQUESTED),
      useAbility: index => emit(GameEvents.INPUT_ABILITY_REQUESTED, { index }),
      useItem: slot => emit(GameEvents.INPUT_ITEM_REQUESTED, { slot }),
      dropItem: slot => emit(GameEvents.INPUT_ITEM_DROP_REQUESTED, { slot }),
      toggleVehicle: () => emit(GameEvents.INPUT_VEHICLE_REQUESTED),
      openAscend: () => emit(GameEvents.FLOW_ASCEND_REQUESTED),
      openAdvance: () => emit(GameEvents.FLOW_ADVANCE_REQUESTED),
      dismissAscend: () => emit(GameEvents.FLOW_ASCEND_DISMISSED),
      dismissAdvance: () => emit(GameEvents.FLOW_ADVANCE_DISMISSED),
      chooseEvolution: id => emit(GameEvents.PROGRESSION_EVOLUTION_REQUESTED, { id }),
      spendTalent: (treeId, talentId) => emit(GameEvents.PROGRESSION_TALENT_SPEND_REQUESTED, { treeId, talentId }),
      undoTalent: (treeId, talentId) => emit(GameEvents.PROGRESSION_TALENT_UNDO_REQUESTED, { treeId, talentId }),
      respecTree: treeId => emit(GameEvents.PROGRESSION_TALENT_RESPEC_REQUESTED, { treeId }),
      toggleInvincible: () => emit(GameEvents.CHEAT_INVINCIBILITY_REQUESTED),
      cheatLevelUp: () => emit(GameEvents.CHEAT_LEVEL_REQUESTED),
      dismissAchievement: () => emit(GameEvents.UI_ACHIEVEMENT_DISMISSED),
    });
    this.unsubscribers = [];

    this.unsubscribers.push(attachAudioSubscriber(this.events, this.audio));
    this.unsubscribers.push(this.componentSystems.attachInput(this.events, this.engine));
    this.unsubscribers.push(attachLegacyCommandHandlers(this.engine, this.events, { resize: () => this.resize() }));
    this.unsubscribers.push(this.events.subscribe(GameEvents.RENDER_CAPTURE_REQUESTED, () => this.capturePresentation()));
    this.unsubscribers.push(this.events.subscribe(GameEvents.RENDER_FRAME_REQUESTED, ({ alpha }) => this.render(alpha)));
    this.unsubscribers.push(this.events.subscribe(GameEvents.RENDER_OBJECT_SNAPPED, ({ object, fields }) => this.presenter.snap(object, fields)));
    this.unsubscribers.push(this.events.subscribe(GameEvents.RUNTIME_RESIZED, viewport => this.onResize(viewport)));
    if (onHud) this.unsubscribers.push(this.events.subscribe(GameEvents.UI_HUD_UPDATED, onHud));

    this.detachInput = attachInputHandlers && uiRef ? attachInput(this.events, canvas, uiRef) : null;
    this.clock = new RuntimeClock(this, { getRenderRate });
    this.resize();
    this.ready = this.initializeRenderer();
    if (autoStartClock) this.clock.start();
  }

  async initializeRenderer() {
    await this.renderer.init(this.viewport);
    if (this.destroyed) { this.renderer.destroy(); return this; }
    this.rendererReady = true;
    this.renderer.resize(this.viewport.width, this.viewport.height, this.viewport.resolution);
    this.events.emit(GameEvents.RUNTIME_READY, { runtime: this, rendererMode: this.rendererMode });
    return this;
  }

  resize(width = window.innerWidth, height = window.innerHeight, resolution = window.devicePixelRatio || 1) {
    this.engine.resize(width, height, resolution);
  }

  onResize({ width, height, resolution }) {
    this.viewport = { width, height, resolution };
    if (this.rendererReady) this.renderer.resize(width, height, resolution);
  }

  canStep() {
    const engine = this.engine;
    return engine.playing && !engine.paused && !engine.dead && !engine.pendingEvolve;
  }

  step(dt) {
    if (this.engine.mp && this.engine.mp.role === 'client') this.engine.updateReplica(dt);
    else this.engine.update(dt);
    this.engine.prepareMultiplayerSnapshot();
    this.componentMirror.sync(this.engine);
    this.engine.broadcastMultiplayer(dt);
    this.componentWorld.update(dt, { runtime: this, engine: this.engine });
  }

  capturePresentation() { this.presenter.capture(this.engine); }

  render(alpha = 1) {
    this.componentMirror.sync(this.engine);
    const frame = this.presenter.createFrame(this.engine, alpha);
    this.lastFrame = frame;
    if (this.rendererReady) this.renderer.render(frame);
    return frame;
  }

  receiveNetworkPacket(from, data) {
    this.events.emit(GameEvents.NET_PACKET_RECEIVED, { from, data });
  }

  attachNetwork(transport) { this.network.transport = transport || null; }
  startRun(options) { this.engine.start(options); this.componentAdapter.sync(this.engine); }
  startAt(speciesId, options) { this.engine.startAt(speciesId, options); this.componentAdapter.sync(this.engine); }
  startMpHost(options) { this.attachNetwork(options.lobby); this.engine.startMpHost(options); this.componentAdapter.sync(this.engine); }
  startMpClient(options) { this.attachNetwork(options.lobby); this.engine.startMpClient(options); this.componentAdapter.sync(this.engine); }
  setRoster(roster) { this.engine.mpSetRoster(roster); }
  returnToMenu() { this.attachNetwork(null); this.engine.returnToMenu(); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clock.stop();
    if (this.detachInput) this.detachInput();
    this.componentSystems.destroy();
    this.componentAdapter.destroy();
    for (const unsubscribe of this.unsubscribers.splice(0).reverse()) unsubscribe();
    if (this.rendererReady) this.renderer.destroy();
    this.componentWorld.destroy();
    this.events.clear();
  }
}

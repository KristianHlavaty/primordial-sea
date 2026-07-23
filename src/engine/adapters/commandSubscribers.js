import { GameEvents } from '../events.js';

/* Translates public command events into the simulation API. Keeping this
   boundary event-driven prevents UI and input adapters from owning Engine. */
export function attachCommandSubscribers(engine, events, { resize = null } = {}) {
  const on = (event, listener) => events.subscribe(event, listener);
  const unsubscribers = [
    on(GameEvents.INPUT_RESIZE_REQUESTED, () => resize && resize()),
    on(GameEvents.INPUT_ABILITY_REQUESTED, ({ index }) => engine.useAbility(index)),
    on(GameEvents.INPUT_ITEM_REQUESTED, ({ slot }) => engine.useItem(slot)),
    on(GameEvents.INPUT_ITEM_DROP_REQUESTED, ({ slot }) => engine.dropItem(slot)),
    on(GameEvents.INPUT_VEHICLE_REQUESTED, () => engine.toggleVehicle()),
    on(GameEvents.INPUT_PAUSE_REQUESTED, () => engine.togglePause()),
    on(GameEvents.INPUT_MUTE_REQUESTED, () => engine.toggleMute()),
    on(GameEvents.INPUT_LEVELS_REQUESTED, () => engine.toggleLevels()),
    on(GameEvents.FLOW_PAUSED_CHANGED, ({ paused }) => engine.setPaused(paused)),
    on(GameEvents.FLOW_ASCEND_REQUESTED, () => engine.openAscend()),
    on(GameEvents.FLOW_ADVANCE_REQUESTED, () => engine.openAdvance()),
    on(GameEvents.FLOW_ASCEND_DISMISSED, () => engine.dismissAscend()),
    on(GameEvents.FLOW_ADVANCE_DISMISSED, () => engine.dismissAdvance()),
    on(GameEvents.PROGRESSION_EVOLUTION_REQUESTED, ({ id }) => engine.chooseEvolution(id)),
    on(GameEvents.PROGRESSION_TALENT_SPEND_REQUESTED, ({ treeId, talentId }) => engine.spendTalent(treeId, talentId)),
    on(GameEvents.PROGRESSION_TALENT_UNDO_REQUESTED, ({ treeId, talentId }) => engine.undoTalent(treeId, talentId)),
    on(GameEvents.PROGRESSION_TALENT_RESPEC_REQUESTED, ({ treeId }) => engine.respecTree(treeId)),
    on(GameEvents.CHEAT_INVINCIBILITY_REQUESTED, () => engine.toggleInvincible()),
    on(GameEvents.CHEAT_LEVEL_REQUESTED, () => engine.cheatLevelUp()),
    on(GameEvents.UI_ACHIEVEMENT_DISMISSED, () => engine.dismissAchievement()),
    on(GameEvents.NET_PACKET_RECEIVED, ({ from, data }) => engine.onNetPacket(from, data)),
  ];
  return () => { for (const unsubscribe of unsubscribers) unsubscribe(); };
}

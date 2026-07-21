/* Headless-friendly debug API on window.__game (rAF is throttled in
   background tabs, so step() advances the sim manually). Not used by the
   game itself — it exists for testing from the console. */
import { ABILITIES, ACTIVE_TIMER } from '../data/abilities.js';
import { xpNeed } from '../data/progression.js';

export function installDebugApi(runtime, ui) {
  const engine = runtime.engine;
  window.__game = {
    eng: engine,
    runtime,
    start: () => runtime.startRun(),
    startAt: id => runtime.startAt(id),
    step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) runtime.step(dt); runtime.render(); },
    render: () => runtime.render(),
    choose: id => engine.chooseEvolution(id),
    ascend: () => engine.openAscend(),
    stay: () => engine.dismissAscend(),
    stayDevonian: () => engine.dismissAdvance(),
    advance: () => engine.openAdvance(),
    loadMap: (id, via) => engine.loadMap(id, via),
    addXp: v => { engine.player && engine.player.addXp(engine, v); },
    key: (k, v) => engine.setKey(k, v), bite: v => engine.setBite(v), mouse: (x, y) => engine.setMouse(x, y),
    ability: i => engine.useAbility(i),
    bosses: () => engine.creatures.filter(c => c.boss).map(c => ({ kind: c.bossKind, hp: Math.round(c.hp), maxHp: c.maxHp, engaged: c.engaged, hardenT: +(c.hardenT || 0).toFixed(1), x: Math.round(c.x), y: Math.round(c.y) })),
    killBoss: kind => {
      const b = engine.creatures.find(c => c.boss && c.bossKind === kind); if (!b) return 'none';
      b.hardenT = 0; engine.debugDamage(b, b.hp + 1000); return 'killed';
    },
    perks: () => ({ dmgReduce: engine.perks.dmgReduce, dodge: engine.perks.dodge, webResist: engine.perks.webResist, shockAfterglow: engine.perks.shockAfterglow, list: engine.perks.list.map(x => x.id) }),
    talents: () => engine.talentInfo(),
    talentBonus: () => engine.talentBonus,
    spendTalent: (tree, id) => { engine.spendTalent(tree, id); return engine.talentBonus; },
    undoTalent: (tree, id) => engine.undoTalent(tree, id),
    respecTree: tree => engine.respecTree(tree),
    // multiplayer inspection + test hooks
    mp: () => engine.mp ? { role: engine.mp.role, self: engine.mp.self, remotes: engine.remotePlayers.length, creatures: engine.creatures.length, era: engine.era, stage: engine.stage, map: engine.mapId } : null,
    mpPlayers: () => {
      const own = engine.player ? [{ self: true, connId: engine.mp && engine.mp.self, sp: engine.player.speciesId, x: Math.round(engine.player.x), y: Math.round(engine.player.y), hp: Math.round(engine.player.hp), lv: engine.player.level }] : [];
      return own.concat(engine.remotePlayers.map(r => ({ self: false, connId: r.connId, name: r.name, sp: r.species || r.speciesId, x: Math.round(r.x), y: Math.round(r.y), hp: Math.round(r.hp), lv: r.level, bite: +(r.biteAnim || 0).toFixed(2) })));
    },
    mpFeed: data => runtime.receiveNetworkPacket(engine.mp ? engine.mp.host : 0, data),
    mpPacket: (from, data) => runtime.receiveNetworkPacket(from, data),
    mpTestClient: room => runtime.startMpClient({ room, profile: { id: 't', name: 'Tester', color: '#8affd0' }, lobby: null, selfConn: 99, hostConn: 1, roster: {} }),
    mpTestHost: room => runtime.startMpHost({ room, profile: { id: 'h', name: 'Host', color: '#8affd0' }, lobby: room.lobby || null, selfConn: 1, roster: room.roster || {} }),
    renderer: () => ({ mode: runtime.rendererMode, ready: runtime.rendererReady, entities: runtime.componentMirror.size(), resources: runtime.renderer.stats ? runtime.renderer.stats() : null }),
    components: (...types) => runtime.componentWorld.query(...types).map(entity => ({ entity, components: Object.fromEntries(types.map(type => [type, runtime.componentWorld.getComponent(entity, type)])) })),
    abState: () => {
      const p = engine.player;
      return p && p.abilities.map((id, i) => ({ i, id, cd: +(p.acd[id] || 0).toFixed(2), active: +((p[ACTIVE_TIMER[id]] || 0)).toFixed(2), passive: ABILITIES[id].passive }));
    },
    state: () => {
      const p = engine.player;
      return {
        phase: ui.current.phase, playing: engine.playing, dead: engine.dead, paused: engine.paused,
        pendingEvolve: engine.pendingEvolve, evolveMode: engine.evolveMode, choices: engine.choices.slice(), era: engine.era,
        stage: engine.stage, mapId: engine.mapId, nearEdge: engine.nearEdge,
        canAscend: engine.isSeaApex(), ascendAvailable: engine.ascendAvailable, advanceAvailable: engine.advanceAvailable,
        species: p && p.species.name, tier: p && p.species.tier, hp: p && Math.round(p.hp), maxHp: p && p.maxHp, x: p && Math.round(p.x), y: p && Math.round(p.y),
        abilities: p && p.abilities.slice(), shield: p && Math.round(p.shield),
        level: p && p.level, xp: p && Math.round(p.xp), xpNeed: p && xpNeed(p.level), atkMul: p && +p.atkMul.toFixed(2),
        showLevels: engine.showLevels, floaters: engine.floaters.length,
        talentUnspent: engine.talentUnspent(), talentBonus: engine.talentBonus,
        perks: engine.perks.list.map(x => x.id), perkVals: { dmgReduce: engine.perks.dmgReduce, dodge: engine.perks.dodge, webResist: engine.perks.webResist, shockAfterglow: engine.perks.shockAfterglow },
        bossesDefeated: [...engine.bossesDefeated], achievement: engine.achievement && engine.achievement.perk,
        creatures: engine.creatures.length, plants: engine.plants.length, food: engine.food.length, kills: engine.kills
      };
    }
  };
  return () => { delete window.__game; };
}

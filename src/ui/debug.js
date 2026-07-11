/* Headless-friendly debug API on window.__game (rAF is throttled in
   background tabs, so step() advances the sim manually). Not used by the
   game itself — it exists for testing from the console. */
import { ABILITIES } from '../data/abilities.js';
import { xpNeed } from '../data/progression.js';

export function installDebugApi(engine, ui) {
  window.__game = {
    eng: engine,
    start: () => engine.start(),
    step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) engine.update(dt); engine.render(); },
    render: () => engine.render(),
    choose: id => engine.chooseEvolution(id),
    addXp: v => { engine.player && engine.player.addXp(engine, v); },
    key: (k, v) => engine.setKey(k, v), bite: v => engine.setBite(v), mouse: (x, y) => engine.setMouse(x, y),
    ability: i => engine.useAbility(i),
    bosses: () => engine.creatures.filter(c => c.boss).map(c => ({ kind: c.bossKind, hp: Math.round(c.hp), maxHp: c.maxHp, engaged: c.engaged, hardenT: +(c.hardenT || 0).toFixed(1), x: Math.round(c.x), y: Math.round(c.y) })),
    killBoss: kind => {
      const b = engine.creatures.find(c => c.boss && c.bossKind === kind); if (!b) return 'none';
      b.hardenT = 0; engine.debugDamage(b, b.hp + 1000); return 'killed';
    },
    perks: () => ({ dmgReduce: engine.perks.dmgReduce, dodge: engine.perks.dodge, list: engine.perks.list.map(x => x.id) }),
    abState: () => {
      const p = engine.player; const T = { harden: 'shieldT', enroll: 'enrollT', burst: 'burstT', frenzy: 'frenzyT' };
      return p && p.abilities.map((id, i) => ({ i, id, cd: +(p.acd[id] || 0).toFixed(2), active: +((p[T[id]] || 0)).toFixed(2), passive: ABILITIES[id].passive }));
    },
    state: () => {
      const p = engine.player;
      return {
        phase: ui.current.phase, playing: engine.playing, dead: engine.dead, paused: engine.paused,
        pendingEvolve: engine.pendingEvolve, choices: engine.choices.slice(), era: engine.era,
        species: p && p.species.name, tier: p && p.species.tier, hp: p && Math.round(p.hp), maxHp: p && p.maxHp, x: p && Math.round(p.x), y: p && Math.round(p.y),
        abilities: p && p.abilities.slice(), shield: p && Math.round(p.shield),
        level: p && p.level, xp: p && Math.round(p.xp), xpNeed: p && xpNeed(p.level), atkMul: p && +p.atkMul.toFixed(2),
        showLevels: engine.showLevels, floaters: engine.floaters.length,
        perks: engine.perks.list.map(x => x.id), perkVals: { dmgReduce: engine.perks.dmgReduce, dodge: engine.perks.dodge },
        bossesDefeated: [...engine.bossesDefeated], achievement: engine.achievement && engine.achievement.perk,
        creatures: engine.creatures.length, plants: engine.plants.length, food: engine.food.length, kills: engine.kills
      };
    }
  };
  return () => { delete window.__game; };
}

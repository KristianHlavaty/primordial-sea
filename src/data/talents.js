/* Per-stage talent trees. You bank 1 point per level-up into the tree for the
   stage you're currently in (sea / devonian / carboniferous). Points and
   unlocks RESET each run.

   Each tree has 3 deep "paths" (Predation / Resilience / Instinct) plus a
   boss-gated "Trophies" column. A path is a chain of small multi-rank boosts
   ending in a ★ CAPSTONE — a strong signature passive gated behind investing
   in that path (`reqPath`), so you must OPT IN to one path to earn its capstone.
   The trees are deliberately bigger than a run's point budget, so you can't max
   everything: specialize.

   Effect keys fold into Engine.talentBonus (computeTalentBonus). Multiplicative
   (applied as 1 + sum): dmgMul, hpMul, spdMul, dashCdMul (neg = faster),
   powerCdMul (neg), xpMul. Additive: dodge, dmgReduce, regen (hp/s),
   killHeal (hp/kill), startShieldPct, webResist, shockEchoPower.
   `req` = needs >=1 rank in that talent (chains a path). `reqPath` = needs that
   many points spent in the same column first (opt-in gate for a capstone).
   `gate` = boss id that must be defeated. `display` overrides the auto value
   text (used by multi-effect capstones). */

const REQ_PATH = 10;   // points a capstone needs invested in its own path

export const TALENT_TREES = [
  {
    id: 'sea', stage: 'sea', name: 'Sea', color: '#5ee0f2',
    paths: ['Predation', 'Resilience', 'Instinct', 'Trophies'],
    talents: [
      // Predation
      { id: 'sea_p1', col: 0, row: 0, name: 'Sharpened Fang', icon: 'fang',    max: 5, effect: { dmgMul: 0.03 } },
      { id: 'sea_p2', col: 0, row: 1, req: 'sea_p1', name: 'Quick Strike', icon: 'quick', max: 4, effect: { dashCdMul: -0.03 } },
      { id: 'sea_p3', col: 0, row: 2, req: 'sea_p2', name: 'Feeding Instinct', icon: 'bloodscent', max: 4, effect: { killHeal: 2 } },
      { id: 'sea_pC', col: 0, row: 3, req: 'sea_p3', reqPath: REQ_PATH, capstone: true, name: 'Apex Predator', icon: 'frenzy', max: 1, effect: { dmgMul: 0.12, killHeal: 6 }, display: '+12% bite · +6 HP/kill' },
      // Resilience
      { id: 'sea_r1', col: 1, row: 0, name: 'Thick Membrane', icon: 'toughhp', max: 5, effect: { hpMul: 0.04 } },
      { id: 'sea_r2', col: 1, row: 1, req: 'sea_r1', name: 'Mending', icon: 'regen', max: 4, effect: { regen: 0.6 } },
      { id: 'sea_r3', col: 1, row: 2, req: 'sea_r2', name: 'Tough Hide', icon: 'thickhide', max: 4, effect: { dmgReduce: 0.02 } },
      { id: 'sea_rC', col: 1, row: 3, req: 'sea_r3', reqPath: REQ_PATH, capstone: true, name: 'Living Fortress', icon: 'harden', max: 1, effect: { hpMul: 0.12, dmgReduce: 0.05, startShieldPct: 0.2 }, display: '+12% HP · +5% resist · shield' },
      // Instinct
      { id: 'sea_i1', col: 2, row: 0, name: 'Voracious', icon: 'metabolism', max: 5, effect: { xpMul: 0.06 } },
      { id: 'sea_i2', col: 2, row: 1, req: 'sea_i1', name: 'Streamlined', icon: 'burst', max: 4, effect: { spdMul: 0.03 } },
      { id: 'sea_i3', col: 2, row: 2, req: 'sea_i2', name: 'Adrenal Glands', icon: 'adrenal', max: 4, effect: { powerCdMul: -0.04 } },
      { id: 'sea_iC', col: 2, row: 3, req: 'sea_i3', reqPath: REQ_PATH, capstone: true, name: 'Perfect Instinct', icon: 'sprint', max: 1, effect: { spdMul: 0.08, powerCdMul: -0.12, xpMul: 0.1 }, display: '+8% speed · -12% power CD · +10% XP' },
      // Trophies (boss-gated)
      { id: 'sea_ironhide', col: 3, row: 0, gate: 'bulwark', name: 'Ironhide Mastery', icon: 'thickhide', max: 3, effect: { dmgReduce: 0.03 }, gateLabel: 'Slay Kolossos, the Bulwark' },
      { id: 'sea_reflex',  col: 3, row: 1, gate: 'render',  name: 'Honed Reflexes',  icon: 'evasion',   max: 3, effect: { dodge: 0.03 },     gateLabel: 'Slay Xiphos, the Render' },
      { id: 'sea_afterglow', col: 3, row: 2, gate: 'lumenara', name: 'Abyssal Resonance', icon: 'shock', max: 3, effect: { shockEchoPower: 0.2 }, gateLabel: 'Slay Lumenara, the Abyssal Crown' },
    ],
  },
  {
    id: 'devonian', stage: 'devonian', name: 'Devonian', color: '#8fce6a',
    paths: ['Predation', 'Resilience', 'Instinct', 'Trophies'],
    talents: [
      { id: 'dev_p1', col: 0, row: 0, name: 'Rending Jaws', icon: 'fang', max: 5, effect: { dmgMul: 0.03 } },
      { id: 'dev_p2', col: 0, row: 1, req: 'dev_p1', name: 'Savage Tempo', icon: 'quick', max: 4, effect: { dashCdMul: -0.03 } },
      { id: 'dev_p3', col: 0, row: 2, req: 'dev_p2', name: 'Carnivore', icon: 'bloodscent', max: 4, effect: { killHeal: 3 } },
      { id: 'dev_pC', col: 0, row: 3, req: 'dev_p3', reqPath: REQ_PATH, capstone: true, name: 'Devonian Apex', icon: 'frenzy', max: 1, effect: { dmgMul: 0.14, killHeal: 8 }, display: '+14% bite · +8 HP/kill' },
      { id: 'dev_r1', col: 1, row: 0, name: 'Cornified Hide', icon: 'toughhp', max: 5, effect: { hpMul: 0.04 } },
      { id: 'dev_r2', col: 1, row: 1, req: 'dev_r1', name: 'Amphibian Regrowth', icon: 'regen', max: 4, effect: { regen: 0.7 } },
      { id: 'dev_r3', col: 1, row: 2, req: 'dev_r2', name: 'Bony Plates', icon: 'thickhide', max: 4, effect: { dmgReduce: 0.02 } },
      { id: 'dev_rC', col: 1, row: 3, req: 'dev_r3', reqPath: REQ_PATH, capstone: true, name: 'Bulwark of Bone', icon: 'harden', max: 1, effect: { hpMul: 0.14, dmgReduce: 0.06, startShieldPct: 0.22 }, display: '+14% HP · +6% resist · shield' },
      { id: 'dev_i1', col: 2, row: 0, name: 'Ravenous', icon: 'metabolism', max: 5, effect: { xpMul: 0.06 } },
      { id: 'dev_i2', col: 2, row: 1, req: 'dev_i1', name: 'Loping Stride', icon: 'sprint', max: 4, effect: { spdMul: 0.03 } },
      { id: 'dev_i3', col: 2, row: 2, req: 'dev_i2', name: 'Adrenal Surge', icon: 'adrenal', max: 4, effect: { powerCdMul: -0.04 } },
      { id: 'dev_iC', col: 2, row: 3, req: 'dev_i3', reqPath: REQ_PATH, capstone: true, name: 'Primal Instinct', icon: 'sprint', max: 1, effect: { spdMul: 0.09, powerCdMul: -0.14, xpMul: 0.1 }, display: '+9% speed · -14% power CD · +10% XP' },
      { id: 'dev_plate', col: 3, row: 0, gate: 'tidewarden',       name: 'Tidewarden Plate', icon: 'thickhide', max: 3, effect: { dmgReduce: 0.03 }, gateLabel: 'Slay Ambulos, the Tidewarden' },
      { id: 'dev_silk',  col: 3, row: 1, gate: 'gilboa_matriarch', name: 'Silk Strider',     icon: 'websnare',  max: 3, effect: { webResist: 0.12 }, gateLabel: 'Slay Arachne, the Matriarch' },
    ],
  },
  {
    id: 'carboniferous', stage: 'carboniferous', name: 'Carboniferous', color: '#c9873f',
    paths: ['Predation', 'Resilience', 'Instinct', 'Trophies'],
    talents: [
      { id: 'carb_p1', col: 0, row: 0, name: 'Apex Bite', icon: 'fang', max: 5, effect: { dmgMul: 0.035 } },
      { id: 'carb_p2', col: 0, row: 1, req: 'carb_p1', name: 'Killing Speed', icon: 'quick', max: 4, effect: { dashCdMul: -0.035 } },
      { id: 'carb_p3', col: 0, row: 2, req: 'carb_p2', name: 'Devour', icon: 'bloodscent', max: 4, effect: { killHeal: 4 } },
      { id: 'carb_pC', col: 0, row: 3, req: 'carb_p3', reqPath: REQ_PATH, capstone: true, name: 'Coalborn Apex', icon: 'frenzy', max: 1, effect: { dmgMul: 0.16, killHeal: 10 }, display: '+16% bite · +10 HP/kill' },
      { id: 'carb_r1', col: 1, row: 0, name: 'Ironscale', icon: 'toughhp', max: 5, effect: { hpMul: 0.045 } },
      { id: 'carb_r2', col: 1, row: 1, req: 'carb_r1', name: 'Deep Regrowth', icon: 'regen', max: 4, effect: { regen: 0.8 } },
      { id: 'carb_r3', col: 1, row: 2, req: 'carb_r2', name: 'Living Plate', icon: 'thickhide', max: 4, effect: { dmgReduce: 0.025 } },
      { id: 'carb_rC', col: 1, row: 3, req: 'carb_r3', reqPath: REQ_PATH, capstone: true, name: 'Living Bulwark', icon: 'harden', max: 1, effect: { hpMul: 0.16, dmgReduce: 0.07, startShieldPct: 0.25 }, display: '+16% HP · +7% resist · shield' },
      { id: 'carb_i1', col: 2, row: 0, name: 'Insatiable', icon: 'metabolism', max: 5, effect: { xpMul: 0.07 } },
      { id: 'carb_i2', col: 2, row: 1, req: 'carb_i1', name: 'Powerful Gait', icon: 'sprint', max: 4, effect: { spdMul: 0.035 } },
      { id: 'carb_i3', col: 2, row: 2, req: 'carb_i2', name: 'Overclock', icon: 'adrenal', max: 4, effect: { powerCdMul: -0.045 } },
      { id: 'carb_iC', col: 2, row: 3, req: 'carb_i3', reqPath: REQ_PATH, capstone: true, name: 'Perfect Predator', icon: 'sprint', max: 1, effect: { spdMul: 0.1, powerCdMul: -0.16, xpMul: 0.12 }, display: '+10% speed · -16% power CD · +12% XP' },
      { id: 'carb_swift', col: 3, row: 0, gate: 'sovereign',  name: "Sovereign's Grace", icon: 'sprint', max: 3, effect: { dodge: 0.03 },     gateLabel: 'Slay Titanopod, the Sovereign' },
      { id: 'carb_mire',  col: 3, row: 1, gate: 'marshqueen', name: 'Mireblood',         icon: 'regen',  max: 3, effect: { dmgReduce: 0.03 }, gateLabel: 'Slay Gorgona, the Marsh Queen' },
    ],
  },
];

export const TREE_BY_ID = {};
export const TALENT_BY_ID = {};
export const TALENT_TREE_OF = {};
for (const tree of TALENT_TREES) {
  TREE_BY_ID[tree.id] = tree;
  for (const t of tree.talents) { TALENT_BY_ID[t.id] = t; TALENT_TREE_OF[t.id] = tree.id; }
}

/* Human-readable value of a talent at a given rank, so the UI can show the
   accumulated bonus so far AND the full bonus at max rank ("+6% → +15%").
   Multi-effect capstones supply their own `display` string. */
const EFFECT_FMT = {
  dmgMul:        { label: 'bite dmg',       kind: 'pct' },
  hpMul:         { label: 'max HP',         kind: 'pct' },
  spdMul:        { label: 'speed',          kind: 'pct' },
  xpMul:         { label: 'XP',             kind: 'pct' },
  dashCdMul:     { label: 'bite CD',        kind: 'pct' },
  powerCdMul:    { label: 'power CD',       kind: 'pct' },
  dodge:         { label: 'dodge',          kind: 'pct' },
  dmgReduce:     { label: 'resist',         kind: 'pct' },
  webResist:     { label: 'web resist',     kind: 'pct' },
  shockEchoPower:{ label: 'Afterglow power',kind: 'pct' },
  startShieldPct:{ label: 'shield',         kind: 'pct' },
  regen:         { label: 'regen',          kind: 'flat', dp: 1, unit: ' HP/s' },
  killHeal:      { label: 'lifesteal',      kind: 'flat', dp: 0, unit: ' HP/kill' },
};
export function talentValue(talent, rank) {
  if (talent.display) return { text: talent.display, label: '', full: true };
  const k = Object.keys(talent.effect)[0], e = EFFECT_FMT[k] || { label: '', kind: 'pct' };
  const v = (talent.effect[k] || 0) * rank;
  const text = e.kind === 'flat'
    ? (v >= 0 ? '+' : '') + (e.dp ? v.toFixed(e.dp) : Math.round(v)) + e.unit
    : (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
  return { text, label: e.label, full: false };
}

/* A fresh, empty talent state for a new run. Sea starts unlocked; land trees
   unlock when you first enter that stage. */
export function freshTalentState() {
  const trees = {};
  for (const tree of TALENT_TREES) trees[tree.id] = { earned: 0, ranks: {}, spentAt: {}, respecUsed: false, unlocked: tree.stage === 'sea' };
  return { trees };
}

/* Sum every spent talent into one bonus object the game reads each frame. */
export function computeTalentBonus(trees) {
  const a = {};
  for (const id in trees) {
    const ranks = trees[id].ranks;
    for (const tid in ranks) {
      const r = ranks[tid]; if (!r) continue;
      const t = TALENT_BY_ID[tid]; if (!t) continue;
      for (const k in t.effect) a[k] = (a[k] || 0) + t.effect[k] * r;
    }
  }
  return {
    dmgMul: 1 + (a.dmgMul || 0), hpMul: 1 + (a.hpMul || 0), spdMul: 1 + (a.spdMul || 0),
    dashCdMul: Math.max(0.4, 1 + (a.dashCdMul || 0)), powerCdMul: Math.max(0.4, 1 + (a.powerCdMul || 0)), xpMul: 1 + (a.xpMul || 0),
    dodge: a.dodge || 0, dmgReduce: a.dmgReduce || 0, regen: a.regen || 0, killHeal: a.killHeal || 0,
    startShieldPct: a.startShieldPct || 0, webResist: a.webResist || 0, shockEchoPower: a.shockEchoPower || 0,
  };
}

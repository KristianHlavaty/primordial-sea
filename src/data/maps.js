/* Stages and maps. A "stage" is a broad biome (sea, land) the lineage lives
   in; a "map" is one playable area within a stage with its own size, visual
   theme, dedicated boss(es) and walk-between-edges neighbors.

   Scales up cleanly: add a map by adding a MAPS entry (+ its boss in
   data/bosses.js); add a stage by adding a STAGES entry, some land/sea species
   with that `stage`, and at least one map. The whole engine, atlas overlay and
   tree wiki read from here, so no other wiring is needed.

   Neighbors connect maps by marked edge passages; leaving the sea stage itself
   still happens only by evolving ashore. */

export const STAGES = {
  sea:  { name: 'Sea',  order: 0, blurb: 'the ancient ocean where all life began' },
  devonian: { name: 'Devonian', order: 1, blurb: 'mudflats and river margins where life establishes itself ashore' },
  carboniferous: { name: 'Carboniferous', order: 2, blurb: 'humid coal forests reached after completing a Devonian lineage' },
};

export const MAPS = {
  // --- sea stage ---
  sea_shallows: {
    stage: 'sea', name: 'The Primordial Sea', theme: 'sea',
    W: 4400, H: 2700, bosses: ['bulwark', 'render'],
    neighbors: { bottom: 'starless_bloom', right: 'fangwall_trench' },
    passages: { bottom: { center: 0.5, width: 680 }, right: { center: 0.5, width: 760 } },
  },
  starless_bloom: {
    stage: 'sea', name: 'The Starless Bloom', theme: 'abyss',
    W: 4200, H: 3000, bosses: ['lumenara'],
    neighbors: { top: 'sea_shallows' },
    passages: { top: { center: 0.5, width: 680 } },
    npcPool: ['abyss_jelly', 'jelly', 'plankton'], creatureCap: 14, preyTarget: 3, starterPrey: 3, plantCap: 6, bubbleCount: 65,
  },
  fangwall_trench: {
    stage: 'sea', name: 'The Fangwall Trench', theme: 'abyss',
    W: 4800, H: 2800, bosses: ['panderodus'],
    neighbors: { left: 'sea_shallows' },
    passages: { left: { center: 0.5, width: 760 } },
    bossLanes: [0.28, 0.5, 0.72],
    npcPool: ['silverfish', 'jelly', 'plankton'], creatureCap: 12, preyTarget: 4, starterPrey: 4, plantCap: 5, bubbleCount: 80,
  },

  // --- Devonian landfall ---
  tidal_coast: {
    stage: 'devonian', name: 'The Devonian Tidal Coast', theme: 'coast',
    W: 4200, H: 2600, bosses: ['tidewarden'], neighbors: { right: 'silken_grove' },
  },
  silken_grove: {
    stage: 'devonian', name: 'The Silken Grove', theme: 'webgrove',
    W: 4300, H: 2650, bosses: ['gilboa_matriarch'], neighbors: { left: 'tidal_coast' },
    webFields: 18,
  },
  coal_forest: {
    stage: 'carboniferous', name: 'The Coal Forest', theme: 'swamp',
    W: 4400, H: 2700, bosses: ['sovereign'], neighbors: { right: 'spore_marsh' },
  },
  spore_marsh: {
    stage: 'carboniferous', name: 'The Spore Marsh', theme: 'marsh',
    W: 4300, H: 2650, bosses: ['marshqueen'], neighbors: { left: 'coal_forest' },
  },
};

/* Where each stage begins when you first arrive in it. */
export const STAGE_FIRST_MAP = { sea: 'sea_shallows', devonian: 'tidal_coast', carboniferous: 'coal_forest' };

export function firstMapOf(stage) { return STAGE_FIRST_MAP[stage]; }
export function mapsOfStage(stage) { return Object.keys(MAPS).filter(id => MAPS[id].stage === stage); }

/* Passage tuning: a little overlap around a creature's body makes gates easy
   to enter, while a brief hold still prevents accidental map changes. */
export const EDGE_TRIGGER_PAD = 18;
export const EDGE_PASSAGE_ASSIST = 28;
export const EDGE_DWELL_TIME = 0.18;

/* The opposite edge — used to place the player when they cross a map border. */
export const OPPOSITE_EDGE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

/* Stages and maps. A "stage" is a broad biome (sea, land) the lineage lives
   in; a "map" is one playable area within a stage with its own size, visual
   theme, dedicated boss(es) and walk-between-edges neighbors.

   Scales up cleanly: add a map by adding a MAPS entry (+ its boss in
   data/bosses.js); add a stage by adding a STAGES entry, some land/sea species
   with that `stage`, and at least one map. The whole engine, atlas overlay and
   tree wiki read from here, so no other wiring is needed.

   Neighbors connect land maps by their edges; the sea is left only by evolving
   ashore (a stage change), never by walking off an edge. */

export const STAGES = {
  sea:  { name: 'Sea',  order: 0, blurb: 'the ancient ocean where all life began' },
  land: { name: 'Land', order: 1, blurb: 'the raw shore where lineages first crawled from the water' },
};

export const MAPS = {
  // --- sea stage (one map, the original world) ---
  sea_shallows: {
    stage: 'sea', name: 'The Primordial Sea', theme: 'sea',
    W: 4400, H: 2700, bosses: ['bulwark', 'render'],
    neighbors: {},
  },

  // --- land stage ---
  tidal_coast: {
    stage: 'land', name: 'The Tidal Coast', theme: 'coast',
    W: 4200, H: 2600, bosses: ['tidewarden'],
    neighbors: { right: 'fern_lowlands' },
  },
  fern_lowlands: {
    stage: 'land', name: 'The Fern Lowlands', theme: 'swamp',
    W: 4400, H: 2700, bosses: ['sovereign'],
    neighbors: { left: 'tidal_coast' },
  },
};

/* Where each stage begins when you first arrive in it. */
export const STAGE_FIRST_MAP = { sea: 'sea_shallows', land: 'tidal_coast' };

export function firstMapOf(stage) { return STAGE_FIRST_MAP[stage]; }
export function mapsOfStage(stage) { return Object.keys(MAPS).filter(id => MAPS[id].stage === stage); }

/* The opposite edge — used to place the player when they cross a map border. */
export const OPPOSITE_EDGE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

/* Static, collidable obstacles for the land maps — period- and zone-appropriate
   blockers you have to steer around. Each land map picks from a small kind list
   (weighted by repetition); the sea has none. Add a zone by adding an entry.
   Render code for each kind lives in render/drawObstacle.js.

   Period notes: the Devonian had no true woody logs yet (first forests are only
   mid/late Devonian), so its big land obstacle is Prototaxites — a giant fungus.
   The Carboniferous is dominated by lycopsids (Lepidodendron/Sigillaria), whose
   bark was green and diamond-scarred, so its logs/stumps are the lycopsid kind. */

export const OBSTACLE_SETS = {
  // Devonian
  tidal_coast:  { n: 9,  kinds: ['boulder', 'boulder', 'prototaxites'] },       // tide-worn rocks + giant fungi
  silken_grove: { n: 11, kinds: ['boulder', 'prototaxites', 'silk_bundle'] },   // rocks, fungi, silk-wrapped bundles
  // Carboniferous
  coal_forest:  { n: 12, kinds: ['stump', 'lyco_log', 'boulder'] },             // lycopsid stumps + fallen lycopsid trunks
  spore_marsh:  { n: 10, kinds: ['fungus', 'lyco_log', 'boulder'] },            // giant fungi + fallen lycopsid trunks
};

/* Collision-radius range per kind (px). Visuals may extend a little past it. */
export const OBSTACLE_R = {
  boulder: [26, 46], lyco_log: [24, 34], stump: [30, 44], silk_bundle: [24, 38], fungus: [26, 40], prototaxites: [26, 42],
};

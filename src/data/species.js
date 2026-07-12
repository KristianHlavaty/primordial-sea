/* Player evolution tree. A species entry is pure data:
   - stats drive the Player entity
   - plan drives the shared creature renderer
   - evolvesTo defines the tree edges (empty = apex form)
   Add a new form by adding an entry here, wiring it into some `evolvesTo`,
   and giving it powers in data/abilities.js (ABILITY_SETS). */
import { P } from './plans.js';

export const SPECIES = {
  protocell: {
    name: 'Protocell', tier: 0, branch: '-',
    desc: 'A humble speck of life adrift in the warm dark. Everything begins here.',
    stats: { hp: 45, accel: 1000, maxSpeed: 215, dmg: 7, reach: 9, radius: 13, dashCd: 0.5, dashPow: 270, turn: 11 },
    plan: P({ kind: 'microbe', len: 15, wid: 11, body: '#7fe3c0', accent: '#c9fff0', eyes: 1 }),
    evolvesTo: ['arthropod_larva', 'chordate_larva', 'cnidarian_polyp', 'mollusc_larva']
  },

  arthropod_larva: {
    name: 'Arthropod Larva', tier: 1, branch: 'arth',
    desc: 'Segmented, shelled, deliberate. The armored road toward the trilobites.',
    stats: { hp: 80, accel: 980, maxSpeed: 220, dmg: 12, reach: 10, radius: 15, dashCd: 0.5, dashPow: 300, turn: 10 },
    plan: P({ kind: 'arthro', len: 18, wid: 12, body: '#c98a5a', accent: '#ffd9a8', segments: 4, legs: 6, eyes: 2, stalks: true }),
    evolvesTo: ['trilobite', 'anomalocarid']
  },

  chordate_larva: {
    name: 'Chordate Larva', tier: 1, branch: 'chord',
    desc: 'A flexible nerve cord and a whipping tail. The swift road toward the fish.',
    stats: { hp: 58, accel: 1180, maxSpeed: 290, dmg: 9, reach: 11, radius: 13, dashCd: 0.4, dashPow: 365, turn: 13 },
    plan: P({ kind: 'fish', len: 21, wid: 8, body: '#6aa6ff', accent: '#d9ecff', tail: 1.1, eyes: 1, teeth: false }),
    evolvesTo: ['swift_fish', 'jawed_fish']
  },

  trilobite: {
    name: 'Trilobite', tier: 2, branch: 'arth',
    desc: 'An armored bottom-walker of overlapping plates and stalked eyes. Tough and unhurried.',
    stats: { hp: 165, accel: 900, maxSpeed: 215, dmg: 21, reach: 12, radius: 20, dashCd: 0.55, dashPow: 330, turn: 9 },
    plan: P({ kind: 'arthro', len: 27, wid: 20, body: '#9b6b3f', accent: '#e8b57a', segments: 8, spikes: 5, legs: 10, eyes: 2, stalks: true }),
    evolvesTo: ['sea_scorpion', 'spiny_trilobite']
  },

  swift_fish: {
    name: 'Swift Darter', tier: 2, branch: 'chord',
    desc: 'A streamlined, glassy swimmer built for blistering bursts and sharp turns.',
    stats: { hp: 95, accel: 1330, maxSpeed: 335, dmg: 17, reach: 13, radius: 16, dashCd: 0.34, dashPow: 430, turn: 15 },
    plan: P({ kind: 'fish', len: 26, wid: 9, body: '#4bd0e0', accent: '#dbfbff', tail: 1.35, eyes: 1 }),
    evolvesTo: ['predator_fish', 'cladoselache']
  },

  jawed_fish: {
    name: 'Jawed Fish', tier: 2, branch: 'chord',
    desc: 'The first true jaws in the sea. An armored head-shield and a hard, biting mouth.',
    stats: { hp: 125, accel: 1060, maxSpeed: 275, dmg: 27, reach: 14, radius: 18, dashCd: 0.44, dashPow: 360, turn: 12 },
    plan: P({ kind: 'fish', len: 25, wid: 12, body: '#5a76c8', accent: '#bccdff', tail: 1.05, teeth: true, eyes: 1 }),
    evolvesTo: ['predator_fish', 'cladoselache']
  },

  sea_scorpion: {
    name: 'Sea Scorpion', tier: 3, branch: 'arth',
    desc: 'A eurypterid — apex arthropod. Grasping claws, a paddling tail, and real speed.',
    stats: { hp: 245, accel: 1060, maxSpeed: 275, dmg: 35, reach: 17, radius: 26, dashCd: 0.4, dashPow: 470, turn: 11 },
    plan: P({ kind: 'scorpion', len: 34, wid: 15, body: '#4f6b3a', accent: '#a7d17a', segments: 8, claws: true, spikes: 3, legs: 8, eyes: 2 }),
    evolvesTo: ['jaekelopterus']
  },

  spiny_trilobite: {
    name: 'Giant Spiny Trilobite', tier: 3, branch: 'arth',
    desc: 'A walking fortress bristling with defensive spines. Immense health, immovable will.',
    stats: { hp: 320, accel: 820, maxSpeed: 205, dmg: 27, reach: 13, radius: 25, dashCd: 0.55, dashPow: 340, turn: 9 },
    plan: P({ kind: 'arthro', len: 31, wid: 24, body: '#6b4a2f', accent: '#d8a066', segments: 9, spikes: 9, legs: 12, eyes: 2, stalks: true }),
    evolvesTo: []
  },

  predator_fish: {
    name: 'Apex Placoderm', tier: 3, branch: 'chord',
    desc: 'A giant armored predator fish with self-sharpening bony jaws. The terror of the reef.',
    stats: { hp: 200, accel: 1210, maxSpeed: 320, dmg: 41, reach: 17, radius: 24, dashCd: 0.4, dashPow: 460, turn: 13 },
    plan: P({ kind: 'fish', len: 33, wid: 15, body: '#38507e', accent: '#a6bbe6', tail: 1.2, teeth: true, eyes: 1 }),
    evolvesTo: ['dunkleosteus']
  },

  anomalocarid: {
    name: 'Anomalocarid', tier: 2, branch: 'arth',
    desc: 'A fast, grasping apex hunter of the early seas — rippling swim-lobes and raptorial arms.',
    stats: { hp: 110, accel: 1160, maxSpeed: 285, dmg: 24, reach: 14, radius: 18, dashCd: 0.42, dashPow: 405, turn: 13 },
    plan: P({ kind: 'anomalo', len: 29, wid: 14, body: '#c07a5a', accent: '#ffcfa0', sideFlaps: true, eyes: 2, stalks: true }),
    evolvesTo: ['sea_scorpion']
  },

  cnidarian_polyp: {
    name: 'Cnidarian Polyp', tier: 1, branch: 'cnid',
    desc: 'A drifting polyp trailing stinging tentacles — the soft-bodied cnidarian road.',
    stats: { hp: 62, accel: 900, maxSpeed: 210, dmg: 8, reach: 12, radius: 14, dashCd: 0.5, dashPow: 280, turn: 11 },
    plan: P({ kind: 'jelly', len: 15, wid: 15, body: '#a98fe0', accent: '#ece0ff', glow: '#b79fff', tentacles: 6 }),
    evolvesTo: ['medusa', 'box_jelly']
  },

  medusa: {
    name: 'Medusa', tier: 2, branch: 'cnid',
    desc: 'A pulsing bell of paralytic nematocysts. Its Shock stuns whole shoals at once.',
    stats: { hp: 120, accel: 950, maxSpeed: 225, dmg: 12, reach: 14, radius: 19, dashCd: 0.5, dashPow: 300, turn: 11 },
    plan: P({ kind: 'jelly', len: 22, wid: 22, body: '#7fa8ff', accent: '#eaf2ff', glow: '#8fd0ff', tentacles: 8 }),
    evolvesTo: ['giant_medusa']
  },

  giant_medusa: {
    name: 'Colossal Medusa', tier: 3, branch: 'cnid',
    desc: 'A vast drifting medusa. Its Shock paralyzes shoals and staggers even minibosses.',
    stats: { hp: 230, accel: 900, maxSpeed: 215, dmg: 16, reach: 16, radius: 27, dashCd: 0.5, dashPow: 320, turn: 10 },
    plan: P({ kind: 'jelly', len: 32, wid: 32, body: '#6f86e0', accent: '#f0f6ff', glow: '#9fd6ff', tentacles: 10 }),
    evolvesTo: ['siphonophore']
  },

  /* ---------------- mollusc branch ---------------- */

  mollusc_larva: {
    name: 'Mollusc Larva', tier: 1, branch: 'moll',
    desc: 'A tiny shelled veliger riding the currents — the cunning road toward the cephalopods.',
    stats: { hp: 65, accel: 950, maxSpeed: 235, dmg: 10, reach: 10, radius: 14, dashCd: 0.48, dashPow: 310, turn: 11 },
    plan: P({ kind: 'shell', len: 15, wid: 9, body: '#c9b6d9', accent: '#f0e6ff', tentacles: 4, eyes: 1 }),
    evolvesTo: ['ammonite', 'proto_squid']
  },

  ammonite: {
    name: 'Ammonite', tier: 2, branch: 'moll',
    desc: 'A coiled fortress of chambered pearl. Withdraw inside and nothing can pry you out.',
    stats: { hp: 150, accel: 880, maxSpeed: 225, dmg: 18, reach: 11, radius: 19, dashCd: 0.5, dashPow: 330, turn: 10 },
    plan: P({ kind: 'ammonite', len: 22, wid: 13, body: '#b98d4f', accent: '#ffe2a8', tentacles: 6, eyes: 1 }),
    evolvesTo: ['great_orthocone']
  },

  proto_squid: {
    name: 'Proto-Squid', tier: 2, branch: 'moll',
    desc: 'A soft-bodied jet of the open water — the first ink, the first cunning.',
    stats: { hp: 105, accel: 1250, maxSpeed: 310, dmg: 16, reach: 13, radius: 16, dashCd: 0.38, dashPow: 420, turn: 14 },
    plan: P({ kind: 'squid', len: 24, wid: 9, body: '#d98aa8', accent: '#ffd6e8', tentacles: 8, eyes: 1 }),
    evolvesTo: ['elder_kraken']
  },

  great_orthocone: {
    name: 'Great Orthocone', tier: 3, branch: 'moll',
    desc: 'A living battering ram in a cone of shell — the largest hunter of its age.',
    stats: { hp: 290, accel: 950, maxSpeed: 255, dmg: 33, reach: 15, radius: 27, dashCd: 0.5, dashPow: 390, turn: 9 },
    plan: P({ kind: 'shell', len: 38, wid: 15, body: '#d9b16a', accent: '#fff0c0', tentacles: 8, eyes: 1 }),
    evolvesTo: ['cameroceras']
  },

  elder_kraken: {
    name: 'Elder Kraken', tier: 3, branch: 'moll',
    desc: 'A grasping, colour-shifting terror — arms like nooses, skin like the sea itself.',
    stats: { hp: 210, accel: 1150, maxSpeed: 290, dmg: 34, reach: 16, radius: 24, dashCd: 0.42, dashPow: 440, turn: 13 },
    plan: P({ kind: 'squid', len: 32, wid: 13, body: '#8a5ac8', accent: '#e0c8ff', tentacles: 10, eyes: 1 }),
    evolvesTo: ['cameroceras']
  },

  cameroceras: {
    name: 'Cameroceras', tier: 4, branch: 'moll',
    desc: 'A shell the length of a whale — the tide itself bends around its siphon.',
    stats: { hp: 400, accel: 1000, maxSpeed: 265, dmg: 45, reach: 18, radius: 34, dashCd: 0.46, dashPow: 430, turn: 9 },
    plan: P({ kind: 'shell', len: 46, wid: 18, body: '#e0b96a', accent: '#fff4d0', tentacles: 10, eyes: 1 }),
    evolvesTo: []
  },

  /* ---------------- expansion: new branch tips ---------------- */

  box_jelly: {
    name: 'Box Jelly', tier: 2, branch: 'cnid',
    desc: 'A cube of glass trailing wires of pure venom — almost invisible, entirely lethal.',
    stats: { hp: 110, accel: 1000, maxSpeed: 245, dmg: 14, reach: 13, radius: 17, dashCd: 0.46, dashPow: 320, turn: 12 },
    plan: P({ kind: 'jelly', len: 18, wid: 17, body: '#9fd8e8', accent: '#eafcff', glow: '#b0f0ff', tentacles: 4 }),
    evolvesTo: ['siphonophore']
  },

  cladoselache: {
    name: 'Cladoselache', tier: 3, branch: 'chord',
    desc: 'The first shark-shape — naked skin, blade fins, and a nose full of blood.',
    stats: { hp: 170, accel: 1300, maxSpeed: 345, dmg: 30, reach: 15, radius: 21, dashCd: 0.36, dashPow: 470, turn: 14 },
    plan: P({ kind: 'fish', len: 30, wid: 11, body: '#7a94a8', accent: '#d8ecf8', tail: 1.45, teeth: true, eyes: 1 }),
    evolvesTo: []
  },

  jaekelopterus: {
    name: 'Jaekelopterus', tier: 4, branch: 'arth',
    desc: 'The terror scorpion — the largest arthropod that ever lived, claws like man-traps.',
    stats: { hp: 380, accel: 1100, maxSpeed: 290, dmg: 48, reach: 19, radius: 30, dashCd: 0.38, dashPow: 500, turn: 11 },
    plan: P({ kind: 'scorpion', len: 42, wid: 18, body: '#6b4a58', accent: '#ffb08a', segments: 9, claws: true, spikes: 5, legs: 8, eyes: 2 }),
    evolvesTo: []
  },

  dunkleosteus: {
    name: 'Dunkleosteus', tier: 4, branch: 'chord',
    desc: 'A bus-sized placoderm whose jaws shear bone — the sea\'s final answer.',
    stats: { hp: 330, accel: 1250, maxSpeed: 330, dmg: 55, reach: 19, radius: 29, dashCd: 0.42, dashPow: 480, turn: 12 },
    plan: P({ kind: 'fish', len: 38, wid: 18, body: '#4a5a72', accent: '#b8c8dd', tail: 1.15, headPlate: true, boneShears: true, eyes: 1 }),
    evolvesTo: []
  },

  siphonophore: {
    name: 'Siphonophore Colony', tier: 4, branch: 'cnid',
    desc: 'Not one animal but a chained city of stingers — kill it and it rebuilds itself.',
    stats: { hp: 360, accel: 900, maxSpeed: 230, dmg: 22, reach: 18, radius: 32, dashCd: 0.5, dashPow: 340, turn: 10 },
    plan: P({ kind: 'jelly', len: 36, wid: 30, body: '#7a9fe8', accent: '#f4f8ff', glow: '#a8e0ff', tentacles: 14 }),
    evolvesTo: []
  },

  /* ============================================================
     LAND STAGE — reached by "crawling ashore" from any sea apex.
     Land tiers restart at 1..3 (each stage has its own tier space).
     Two branches: tetrapods (the amphibian road) and myriapods
     (the land-arthropod road). Power steps are deliberately small —
     many more land tiers can slot in later without a difficulty cliff.
     ============================================================ */

  // --- tetrapods (from the chordate/fish lineages) ---
  tiktaalik: {
    name: 'Tiktaalik', tier: 1, branch: 'tetra', stage: 'devonian', landfall: true, seaBranches: ['chord'],
    desc: 'A fish that learned to prop itself up and gulp air — the first lurch onto the mudflats.',
    stats: { hp: 230, accel: 980, maxSpeed: 250, dmg: 36, reach: 15, radius: 22, dashCd: 0.42, dashPow: 430, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 26, wid: 12, body: '#7a8f5a', accent: '#cfe0a0', teeth: true, tail: 1.1 }),
    evolvesTo: ['acanthostega']
  },
  acanthostega: {
    name: 'Acanthostega', tier: 2, branch: 'tetra', stage: 'devonian',
    desc: 'An eight-toed stem tetrapod still at home in weed-choked water.',
    stats: { hp: 265, accel: 990, maxSpeed: 255, dmg: 40, reach: 16, radius: 24, dashCd: 0.42, dashPow: 435, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 29, wid: 13, body: '#71885a', accent: '#c8dda2', teeth: true, tail: 1.08 }), evolvesTo: ['ichthyostega']
  },
  ichthyostega: {
    name: 'Ichthyostega', tier: 3, branch: 'tetra', stage: 'devonian',
    desc: 'A stout early amphibian with real limbs and ribs — equally at home in mud and shallows.',
    stats: { hp: 285, accel: 980, maxSpeed: 255, dmg: 43, reach: 16, radius: 25, dashCd: 0.42, dashPow: 440, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 30, wid: 14, body: '#6f8a4f', accent: '#c8dc95', teeth: true, tail: 1 }),
    evolvesTo: ['hynerpeton_player']
  },
  hynerpeton_player: {
    name: 'Hynerpeton', tier: 4, branch: 'tetra', stage: 'devonian',
    desc: 'A robust late-Devonian tetrapod with stronger shoulders and air-breathing lungs.',
    stats: { hp: 340, accel: 1010, maxSpeed: 265, dmg: 51, reach: 18, radius: 28, dashCd: 0.4, dashPow: 465, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 35, wid: 17, body: '#61794b', accent: '#bad18c', teeth: true, tail: 0.98 }), evolvesTo: ['eryops']
  },
  eryops: {
    name: 'Anthracosaurus', tier: 1, branch: 'tetra', stage: 'carboniferous',
    desc: 'A heavy, wide-jawed amphibian ambush predator — the apex of the coastal swamps.',
    stats: { hp: 360, accel: 960, maxSpeed: 250, dmg: 54, reach: 18, radius: 29, dashCd: 0.4, dashPow: 470, turn: 11 },
    plan: P({ kind: 'tetrapod', len: 36, wid: 18, body: '#5f7a45', accent: '#bcd08a', teeth: true, tail: 0.95 }),
    evolvesTo: []
  },

  // --- myriapods (from the arthropod lineages) ---
  kampecaris: {
    name: 'Kampecaris', tier: 1, branch: 'myria', stage: 'devonian', landfall: true, seaBranches: ['arth'],
    desc: 'An armored little myriapod — among the very first animals to breathe air and walk the shore.',
    stats: { hp: 250, accel: 940, maxSpeed: 235, dmg: 33, reach: 13, radius: 21, dashCd: 0.46, dashPow: 400, turn: 11 },
    plan: P({ kind: 'arthro', len: 26, wid: 12, body: '#b57a3f', accent: '#e8bd7a', segments: 10, legs: 14, eyes: 2 }),
    evolvesTo: ['pneumodesmus']
  },
  pneumodesmus: { name: 'Pneumodesmus', tier: 2, branch: 'myria', stage: 'devonian', desc: 'A tiny air-breathing millipede whose spiracles permit permanent life ashore.', stats: { hp: 275, accel: 950, maxSpeed: 240, dmg: 36, reach: 14, radius: 22, dashCd: .45, dashPow: 410, turn: 11 }, plan: P({ kind: 'arthro', len: 29, wid: 12, body: '#aa7139', accent: '#e7b66f', segments: 11, legs: 16, eyes: 2 }), evolvesTo: ['devonian_trigonotarbid'] },
  devonian_trigonotarbid: { name: 'Trigonotarbid', tier: 3, branch: 'myria', stage: 'devonian', desc: 'An early terrestrial arachnid hunting among damp floodplain litter.', stats: { hp: 305, accel: 1010, maxSpeed: 255, dmg: 44, reach: 16, radius: 25, dashCd: .42, dashPow: 440, turn: 12 }, plan: P({ kind: 'arthro', len: 32, wid: 17, body: '#87552f', accent: '#d9a060', segments: 7, legs: 8, eyes: 2 }), evolvesTo: ['devonian_scorpion'] },
  devonian_scorpion: { name: 'Early Land Scorpion', tier: 4, branch: 'myria', stage: 'devonian', desc: 'A late-Devonian arachnid committed to hunting across wet ground.', stats: { hp: 350, accel: 1030, maxSpeed: 265, dmg: 51, reach: 18, radius: 27, dashCd: .4, dashPow: 465, turn: 12 }, plan: P({ kind: 'scorpion', len: 37, wid: 16, body: '#74472a', accent: '#dcaa67', segments: 8, claws: true, spikes: 2, legs: 8, eyes: 2 }), evolvesTo: ['arthropleura'] },
  arthropleura: {
    name: 'Arthropleura', tier: 1, branch: 'myria', stage: 'carboniferous',
    desc: 'A millipede the length of a canoe, armored in overlapping plates that shrug off blows.',
    stats: { hp: 320, accel: 900, maxSpeed: 230, dmg: 40, reach: 15, radius: 27, dashCd: 0.48, dashPow: 410, turn: 10 },
    plan: P({ kind: 'arthro', len: 40, wid: 16, body: '#9c6836', accent: '#d8a35c', segments: 14, legs: 20, spikes: 3, eyes: 2 }),
    evolvesTo: ['pulmonoscorpius']
  },
  pulmonoscorpius: {
    name: 'Pulmonoscorpius', tier: 2, branch: 'myria', stage: 'carboniferous',
    desc: 'A metre-long land scorpion with lungs and a stinger — the terror of the fern forests.',
    stats: { hp: 370, accel: 1000, maxSpeed: 260, dmg: 52, reach: 18, radius: 28, dashCd: 0.4, dashPow: 470, turn: 12 },
    plan: P({ kind: 'scorpion', len: 40, wid: 17, body: '#7a5a2f', accent: '#e0b070', segments: 9, claws: true, spikes: 3, legs: 8, eyes: 2 }),
    evolvesTo: []
  },
  // Optional speculative bridges for lineages with no real land descendants.
  shore_polyp: { name: 'Shore Polyp', tier: 1, branch: 'terracnid', stage: 'devonian', landfall: true, fantasy: true, seaBranches: ['cnid'], desc: 'Fantasy: a cnidarian colony sealed against drying tides.', stats: { hp: 225, accel: 900, maxSpeed: 225, dmg: 34, reach: 16, radius: 22, dashCd: .48, dashPow: 390, turn: 11 }, plan: P({ kind: 'jelly', len: 23, wid: 22, body: '#a47bd1', accent: '#ecd8ff', glow: '#d0a8ff', tentacles: 7 }), evolvesTo: ['walking_medusa'] },
  walking_medusa: { name: 'Walking Medusa', tier: 2, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: muscular tentacles carry a moisture-hoarding bell over wet ground.', stats: { hp: 265, accel: 940, maxSpeed: 235, dmg: 40, reach: 17, radius: 24, dashCd: .46, dashPow: 410, turn: 11 }, plan: P({ kind: 'jelly', len: 27, wid: 25, body: '#936fc5', accent: '#f0dcff', glow: '#c695ff', tentacles: 8 }), evolvesTo: ['grove_anemone'] },
  grove_anemone: { name: 'Grove Anemone', tier: 3, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: a roaming anemone hunting beneath primitive woodland shade.', stats: { hp: 310, accel: 950, maxSpeed: 240, dmg: 47, reach: 19, radius: 27, dashCd: .44, dashPow: 430, turn: 11 }, plan: P({ kind: 'jelly', len: 31, wid: 29, body: '#815eb4', accent: '#e7caff', glow: '#bd88ff', tentacles: 10 }), evolvesTo: ['storm_jelly'] },
  storm_jelly: { name: 'Storm Jelly', tier: 4, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: a rain-storing land medusa that discharges static through its tendrils.', stats: { hp: 350, accel: 980, maxSpeed: 250, dmg: 53, reach: 20, radius: 29, dashCd: .42, dashPow: 450, turn: 12 }, plan: P({ kind: 'jelly', len: 35, wid: 32, body: '#7254a8', accent: '#f3e4ff', glow: '#aee8ff', tentacles: 12 }), evolvesTo: ['coal_colony'] },
  coal_colony: { name: 'Coal-Forest Colony', tier: 1, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a sprawling colonial hunter of the rain-soaked coal forest.', stats: { hp: 380, accel: 950, maxSpeed: 245, dmg: 56, reach: 21, radius: 31, dashCd: .43, dashPow: 450, turn: 11 }, plan: P({ kind: 'jelly', len: 38, wid: 34, body: '#67479c', accent: '#ead8ff', glow: '#9edfff', tentacles: 14 }), evolvesTo: [] },
  mud_octopus: { name: 'Mud Octopus', tier: 1, branch: 'terramoll', stage: 'devonian', landfall: true, fantasy: true, seaBranches: ['moll'], desc: 'Fantasy: a cephalopod that traps water around its gills while crawling between pools.', stats: { hp: 220, accel: 1000, maxSpeed: 245, dmg: 35, reach: 16, radius: 22, dashCd: .43, dashPow: 420, turn: 13 }, plan: P({ kind: 'squid', len: 25, wid: 12, body: '#b36f8e', accent: '#ffd1e3', tentacles: 8, eyes: 1 }), evolvesTo: ['lung_octopus'] },
  lung_octopus: { name: 'Lung Octopus', tier: 2, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: a mantle chamber repurposed for breathing humid air.', stats: { hp: 260, accel: 1050, maxSpeed: 255, dmg: 41, reach: 17, radius: 24, dashCd: .41, dashPow: 435, turn: 13 }, plan: P({ kind: 'squid', len: 29, wid: 13, body: '#a25f82', accent: '#f4c3db', tentacles: 8, eyes: 1 }), evolvesTo: ['grove_cephalopod'] },
  grove_cephalopod: { name: 'Grove Cephalopod', tier: 3, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: chromatophores and grasping arms create a floodplain ambusher.', stats: { hp: 305, accel: 1100, maxSpeed: 265, dmg: 48, reach: 19, radius: 27, dashCd: .39, dashPow: 455, turn: 14 }, plan: P({ kind: 'squid', len: 33, wid: 15, body: '#8f5277', accent: '#eeb8d3', tentacles: 10, eyes: 1 }), evolvesTo: ['canopy_kraken'] },
  canopy_kraken: { name: 'Canopy Kraken', tier: 4, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: a terrestrial cephalopod adapted to the damp Devonian understory.', stats: { hp: 345, accel: 1130, maxSpeed: 275, dmg: 54, reach: 21, radius: 29, dashCd: .38, dashPow: 470, turn: 14 }, plan: P({ kind: 'squid', len: 37, wid: 17, body: '#7d466b', accent: '#e7a8c8', tentacles: 10, eyes: 1 }), evolvesTo: ['coal_kraken'] },
  coal_kraken: { name: 'Coal-Forest Kraken', tier: 1, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a giant camouflage hunter among lycopsid roots.', stats: { hp: 385, accel: 1120, maxSpeed: 275, dmg: 58, reach: 22, radius: 31, dashCd: .38, dashPow: 475, turn: 14 }, plan: P({ kind: 'squid', len: 40, wid: 18, body: '#693b5d', accent: '#df9abd', tentacles: 12, eyes: 1 }), evolvesTo: [] },
};

/* The land-stage "pioneers" — the tier-1 forms you can crawl ashore into,
   and the roster the start screen's "skip to land" offers. */
export const LAND_PIONEERS = Object.keys(SPECIES).filter(id => SPECIES[id].stage === 'devonian' && SPECIES[id].tier === 1);
export const landPioneers = fantasy => LAND_PIONEERS.filter(id => fantasy || !SPECIES[id].fantasy);

/* The stage a species belongs to (sea species omit the field). */
export const speciesStage = id => (SPECIES[id] && SPECIES[id].stage) || 'sea';

/* Highest value of each display stat across all species — the UI scales its
   stat bars against these, so new species never overflow the bars. */
export const STAT_MAX = Object.values(SPECIES).reduce((m, s) => ({
  hp: Math.max(m.hp, s.stats.hp),
  maxSpeed: Math.max(m.maxSpeed, s.stats.maxSpeed),
  dmg: Math.max(m.dmg, s.stats.dmg),
  radius: Math.max(m.radius, s.stats.radius),
}), { hp: 0, maxSpeed: 0, dmg: 0, radius: 0 });

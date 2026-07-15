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
    evolvesTo: ['cladoselache']
  },

  jawed_fish: {
    name: 'Jawed Fish', tier: 2, branch: 'chord',
    desc: 'The first true jaws in the sea. An armored head-shield and a hard, biting mouth.',
    stats: { hp: 125, accel: 1060, maxSpeed: 275, dmg: 27, reach: 14, radius: 18, dashCd: 0.44, dashPow: 360, turn: 12 },
    plan: P({ kind: 'fish', len: 25, wid: 12, body: '#5a76c8', accent: '#bccdff', tail: 1.05, teeth: true, eyes: 1 }),
    evolvesTo: ['predator_fish']
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
    evolvesTo: ['isotelus_rex']
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
    evolvesTo: ['hurdiid_hunter']
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
    evolvesTo: ['abyssal_kraken']
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
    evolvesTo: ['sea_wasp']
  },

  cladoselache: {
    name: 'Cladoselache', tier: 3, branch: 'chord',
    desc: 'The first shark-shape — naked skin, blade fins, and a nose full of blood.',
    stats: { hp: 170, accel: 1300, maxSpeed: 345, dmg: 30, reach: 15, radius: 21, dashCd: 0.36, dashPow: 470, turn: 14 },
    plan: P({ kind: 'fish', len: 30, wid: 11, body: '#7a94a8', accent: '#d8ecf8', tail: 1.45, teeth: true, eyes: 1 }),
    evolvesTo: ['xenacanthus']
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

  // Every sea route finishes at its own tier-4 apex.
  isotelus_rex: {
    name: 'Isotelus Rex', tier: 4, branch: 'arth',
    desc: 'A colossal smooth-shelled trilobite, broad as a shield and almost impossible to overturn.',
    stats: { hp: 430, accel: 780, maxSpeed: 200, dmg: 38, reach: 15, radius: 33, dashCd: .58, dashPow: 350, turn: 8 },
    plan: P({ kind: 'arthro', len: 42, wid: 31, body: '#52412f', accent: '#d3a967', segments: 12, legs: 18, eyes: 2, stalks: true, armorRidges: 8, horns: .4 }), evolvesTo: []
  },
  hurdiid_hunter: {
    name: 'Hurdiid Hunter', tier: 3, branch: 'arth',
    desc: 'A wide-headed radiodont whose great frontal appendages comb and seize the open water.',
    stats: { hp: 215, accel: 1120, maxSpeed: 300, dmg: 35, reach: 18, radius: 25, dashCd: .4, dashPow: 455, turn: 12 },
    plan: P({ kind: 'anomalo', len: 35, wid: 19, body: '#9e6645', accent: '#f0bd73', sideFlaps: true, eyes: 2, stalks: true }), evolvesTo: ['aegirocassis']
  },
  aegirocassis: {
    name: 'Aegirocassis', tier: 4, branch: 'arth',
    desc: 'A giant radiodont with twin rows of swimming flaps and a vast filtering basket.',
    stats: { hp: 390, accel: 930, maxSpeed: 270, dmg: 42, reach: 21, radius: 34, dashCd: .46, dashPow: 440, turn: 9 },
    plan: P({ kind: 'anomalo', len: 47, wid: 24, body: '#7b5262', accent: '#f0b89b', sideFlaps: true, eyes: 2, stalks: true, filterCrown: true }), evolvesTo: []
  },
  sea_wasp: {
    name: 'Pelagic Sea Wasp', tier: 3, branch: 'cnid',
    desc: 'A fast four-cornered hunter with long venom lines and clusters of lens-bearing eyes.',
    stats: { hp: 205, accel: 1080, maxSpeed: 270, dmg: 22, reach: 18, radius: 24, dashCd: .42, dashPow: 365, turn: 13 },
    plan: P({ kind: 'jelly', len: 28, wid: 24, body: '#6bc6ce', accent: '#d6ffff', glow: '#70f2ff', tentacles: 4, crown: 4, colonyNodes: 4 }), evolvesTo: ['crowned_sea_wasp']
  },
  crowned_sea_wasp: {
    name: 'Crowned Sea Wasp', tier: 4, branch: 'cnid',
    desc: 'A towering box medusa ringed with sensory crowns, trailing four lethal cables through the blue.',
    stats: { hp: 325, accel: 1100, maxSpeed: 280, dmg: 35, reach: 22, radius: 31, dashCd: .4, dashPow: 390, turn: 13 },
    plan: P({ kind: 'jelly', len: 38, wid: 29, body: '#387d9b', accent: '#b9fbff', glow: '#4ae7ff', tentacles: 4, crown: 8, colonyNodes: 8 }), evolvesTo: []
  },
  xenacanthus: {
    name: 'Xenacanthus', tier: 4, branch: 'chord', swiftLineage: true,
    desc: 'A long, swift shark with a backward-pointing head spine and ribbon-like dorsal fin.',
    stats: { hp: 285, accel: 1370, maxSpeed: 365, dmg: 46, reach: 18, radius: 27, dashCd: .33, dashPow: 510, turn: 15 },
    plan: P({ kind: 'fish', len: 43, wid: 13, body: '#526f75', accent: '#b9e4dc', tail: 1.5, teeth: true, eyes: 1, dorsalSpike: 1.3, bodyStripes: 7, wingFins: true }), evolvesTo: []
  },
  abyssal_kraken: {
    name: 'Abyssal Kraken', tier: 4, branch: 'moll',
    desc: 'A colossal soft-bodied hunter whose hooked arms and living camouflage rule the open darkness.',
    stats: { hp: 350, accel: 1210, maxSpeed: 310, dmg: 49, reach: 23, radius: 32, dashCd: .38, dashPow: 480, turn: 13 },
    plan: P({ kind: 'squid', len: 43, wid: 18, body: '#492f72', accent: '#d987dd', tentacles: 14, eyes: 1, mantleSpots: 10 }), evolvesTo: []
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
    plan: P({ kind: 'tetrapod', len: 27, wid: 10, body: '#788b52', accent: '#b7cf77', teeth: true, tail: 1.28, tailFin: .9, limb: .58, headScale: .72, snout: 1.22, marks: 0 }),
    evolvesTo: ['acanthostega', 'elpistostege']
  },
  acanthostega: {
    name: 'Acanthostega', tier: 2, branch: 'tetra', stage: 'devonian',
    desc: 'An eight-toed stem tetrapod still at home in weed-choked water.',
    stats: { hp: 265, accel: 990, maxSpeed: 255, dmg: 40, reach: 16, radius: 24, dashCd: 0.42, dashPow: 435, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 29, wid: 12, body: '#657f70', accent: '#a9cfb8', teeth: true, tail: 1.18, tailFin: .62, limb: .78, headScale: .82, snout: 1.08, marks: 7, eyeScale: 1.15 }), evolvesTo: ['ichthyostega']
  },
  ichthyostega: {
    name: 'Ichthyostega', tier: 3, branch: 'tetra', stage: 'devonian',
    desc: 'A stout early amphibian with real limbs and ribs — equally at home in mud and shallows.',
    stats: { hp: 285, accel: 980, maxSpeed: 255, dmg: 43, reach: 16, radius: 25, dashCd: 0.42, dashPow: 440, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 31, wid: 15, body: '#7b8248', accent: '#d1c979', teeth: true, tail: 1.02, tailFin: .28, limb: 1.02, headScale: 1.02, snout: .94, marks: 5, stripes: true }),
    evolvesTo: ['hynerpeton_player']
  },
  hynerpeton_player: {
    name: 'Hynerpeton', tier: 4, branch: 'tetra', stage: 'devonian',
    desc: 'A robust late-Devonian tetrapod with stronger shoulders and air-breathing lungs.',
    stats: { hp: 340, accel: 1010, maxSpeed: 265, dmg: 51, reach: 18, radius: 28, dashCd: 0.4, dashPow: 465, turn: 12 },
    plan: P({ kind: 'tetrapod', len: 35, wid: 16, body: '#496b42', accent: '#9bc17c', teeth: true, tail: .88, limb: 1.32, headScale: .9, snout: 1.18, marks: 3, patternColor: '#263f2e' }), evolvesTo: ['eryops']
  },
  eryops: {
    name: 'Anthracosaurus', tier: 1, branch: 'tetra', stage: 'carboniferous',
    desc: 'A heavy, wide-jawed reptiliomorph — the coal-forest stock from which amphibians, reptiles and synapsids all radiate.',
    stats: { hp: 380, accel: 960, maxSpeed: 250, dmg: 55, reach: 18, radius: 29, dashCd: 0.4, dashPow: 470, turn: 11 },
    plan: P({ kind: 'tetrapod', len: 40, wid: 17, body: '#3f5238', accent: '#9db06a', teeth: true, tail: 1.2, limb: .95, headScale: 1.18, snout: 1.3, marks: 6, patternColor: '#213222' }),
    evolvesTo: ['eryops_temno', 'hylonomus', 'archaeothyris']
  },

  // Alternate Tiktaalik route: late-Devonian stem tetrapods.
  elpistostege: { name: 'Elpistostege', tier: 2, branch: 'tetra', stage: 'devonian', desc: 'A broad-headed elpistostegalian whose fin skeleton already contains the bones of a weight-bearing hand.', stats: { hp: 255, accel: 1030, maxSpeed: 265, dmg: 39, reach: 17, radius: 23, dashCd: .4, dashPow: 445, turn: 13 }, plan: P({ kind: 'tetrapod', len: 32, wid: 11, body: '#4f7771', accent: '#92c4ae', teeth: true, tail: 1.3, tailFin: .82, limb: .64, headScale: .72, snout: 1.32, marks: 6, stripes: true, gillFrills: 3 }), evolvesTo: ['tulerpeton'] },
  tulerpeton: { name: 'Tulerpeton', tier: 3, branch: 'tetra', stage: 'devonian', desc: 'A six-toed late-Devonian tetrapod with powerful limbs suited to brackish shallows and exposed banks.', stats: { hp: 300, accel: 1060, maxSpeed: 270, dmg: 46, reach: 18, radius: 26, dashCd: .39, dashPow: 460, turn: 13 }, plan: P({ kind: 'tetrapod', len: 32, wid: 14, body: '#596d43', accent: '#b6ca74', teeth: true, tail: .86, tailFin: .18, limb: 1.38, headScale: .86, snout: 1.08, marks: 4, digits: 3 }), evolvesTo: ['metaxygnathus'] },
  metaxygnathus: { name: 'Metaxygnathus', tier: 4, branch: 'tetra', stage: 'devonian', desc: 'A massive flat-headed river predator from the final Devonian floodplains.', stats: { hp: 365, accel: 970, maxSpeed: 250, dmg: 57, reach: 21, radius: 30, dashCd: .42, dashPow: 475, turn: 11 }, plan: P({ kind: 'tetrapod', len: 38, wid: 20, body: '#4c5736', accent: '#c49a5c', teeth: true, tail: .92, limb: 1.05, headScale: 1.3, snout: 1.38, marks: 8, patternColor: '#28341f', dorsalRidge: 5 }), evolvesTo: ['eryops'] },
  crassigyrinus: { name: 'Crassigyrinus', tier: 4, branch: 'tetra', stage: 'carboniferous', desc: 'A long-bodied Carboniferous ambush hunter with tiny limbs, an immense skull and a powerful swimming tail.', stats: { hp: 530, accel: 940, maxSpeed: 260, dmg: 80, reach: 23, radius: 34, dashCd: .43, dashPow: 480, turn: 10 }, plan: P({ kind: 'tetrapod', len: 45, wid: 19, body: '#303f35', accent: '#8ca56c', teeth: true, tail: 1.42, tailFin: .38, limb: .48, headScale: 1.28, snout: 1.42, marks: 5, stripes: true }), evolvesTo: ['eogyrinus'] },

  // --- myriapods (from the arthropod lineages) ---
  kampecaris: {
    name: 'Kampecaris', tier: 1, branch: 'myria', stage: 'devonian', landfall: true, seaBranches: ['arth'],
    desc: 'An armored little myriapod — among the very first animals to breathe air and walk the shore.',
    stats: { hp: 250, accel: 940, maxSpeed: 235, dmg: 33, reach: 13, radius: 21, dashCd: 0.46, dashPow: 400, turn: 11 },
    plan: P({ kind: 'arthro', len: 24, wid: 10, body: '#bd8547', accent: '#f0ca83', segments: 8, legs: 12, eyes: 2, armorRidges: 3 }),
    evolvesTo: ['pneumodesmus', 'rhyniella']
  },
  pneumodesmus: { name: 'Pneumodesmus', tier: 2, branch: 'myria', stage: 'devonian', desc: 'A tiny air-breathing millipede whose spiracles permit permanent life ashore.', stats: { hp: 275, accel: 950, maxSpeed: 240, dmg: 36, reach: 14, radius: 22, dashCd: .45, dashPow: 410, turn: 11 }, plan: P({ kind: 'arthro', len: 31, wid: 9, body: '#8c6138', accent: '#d7a760', segments: 13, legs: 20, eyes: 2, armorRidges: 9 }), evolvesTo: ['devonian_trigonotarbid'] },
  devonian_trigonotarbid: { name: 'Trigonotarbid', tier: 3, branch: 'myria', stage: 'devonian', desc: 'An early terrestrial arachnid hunting among damp floodplain litter.', stats: { hp: 305, accel: 1010, maxSpeed: 255, dmg: 44, reach: 16, radius: 25, dashCd: .42, dashPow: 440, turn: 12 }, plan: P({ kind: 'arthro', len: 27, wid: 18, body: '#57392e', accent: '#bc7958', segments: 4, legs: 8, eyes: 2, horns: 1.2, spikes: 2 }), evolvesTo: ['devonian_scorpion'] },
  devonian_scorpion: { name: 'Early Land Scorpion', tier: 4, branch: 'myria', stage: 'devonian', desc: 'A late-Devonian arachnid committed to hunting across wet ground.', stats: { hp: 350, accel: 1030, maxSpeed: 265, dmg: 51, reach: 18, radius: 27, dashCd: .4, dashPow: 465, turn: 12 }, plan: P({ kind: 'scorpion', len: 37, wid: 16, body: '#74472a', accent: '#dcaa67', segments: 8, claws: true, spikes: 2, legs: 8, eyes: 2 }), evolvesTo: ['eophrynus'] },
  arthropleura: {
    name: 'Arthropleura', tier: 3, branch: 'myria', stage: 'carboniferous',
    desc: 'A millipede the length of a canoe, armored in overlapping plates that shrug off blows.',
    stats: { hp: 500, accel: 900, maxSpeed: 232, dmg: 70, reach: 16, radius: 30, dashCd: 0.48, dashPow: 415, turn: 10 },
    plan: P({ kind: 'arthro', len: 44, wid: 17, body: '#72502e', accent: '#c99750', segments: 16, legs: 26, spikes: 6, eyes: 2, armorRidges: 12 }),
    evolvesTo: ['carbon_centipede']
  },
  pulmonoscorpius: {
    name: 'Pulmonoscorpius', tier: 2, branch: 'myria', stage: 'carboniferous',
    desc: 'A metre-long land scorpion with lungs and a stinger — the terror of the fern forests.',
    stats: { hp: 425, accel: 1000, maxSpeed: 262, dmg: 62, reach: 18, radius: 28, dashCd: 0.4, dashPow: 470, turn: 12 },
    plan: P({ kind: 'scorpion', len: 40, wid: 17, body: '#7a5a2f', accent: '#e0b070', segments: 9, claws: true, spikes: 3, legs: 8, eyes: 2 }),
    evolvesTo: ['megarachne']
  },
  // Alternate Kampecaris route: springtails and early silk-producing arachnids.
  rhyniella: { name: 'Rhyniella', tier: 2, branch: 'myria', stage: 'devonian', desc: 'A minute springtail from the Rhynie ecosystem, quick-footed and able to launch itself from danger.', stats: { hp: 245, accel: 1120, maxSpeed: 285, dmg: 34, reach: 14, radius: 20, dashCd: .35, dashPow: 470, turn: 15 }, plan: P({ kind: 'arthro', len: 22, wid: 9, body: '#827251', accent: '#d9d18c', segments: 6, legs: 6, eyes: 2, stalks: true, horns: .6 }), evolvesTo: ['attercopus'] },
  attercopus: { name: 'Attercopus', tier: 3, branch: 'myria', stage: 'devonian', desc: 'A spider-relative with silk-producing plates but no true spinnerets, stalking the damp forest floor.', stats: { hp: 290, accel: 1080, maxSpeed: 275, dmg: 45, reach: 18, radius: 25, dashCd: .37, dashPow: 465, turn: 14 }, plan: P({ kind: 'arachnid', len: 29, wid: 15, body: '#674939', accent: '#cf9364', legs: 8, eyes: 6, abdomen: .9, pedipalps: .7, silkPlates: 3 }), evolvesTo: ['gilboa_arachnid'] },
  gilboa_arachnid: { name: 'Gilboa Arachnid', tier: 4, branch: 'myria', stage: 'devonian', desc: 'A true spider-like hunter with a narrow waist, grasping pedipalps and precise silk control.', stats: { hp: 335, accel: 1150, maxSpeed: 290, dmg: 53, reach: 20, radius: 28, dashCd: .34, dashPow: 490, turn: 15 }, plan: P({ kind: 'arachnid', len: 33, wid: 17, body: '#3d3533', accent: '#d46f54', legs: 8, eyes: 8, abdomen: 1.2, pedipalps: 1.05, spinnerets: 2, abdomenMarks: 5 }), evolvesTo: ['eophrynus'] },
  eophrynus: { name: 'Eophrynus', tier: 1, branch: 'myria', stage: 'carboniferous', desc: 'A heavily plated trigonotarbid — the base stock of the coal-forest arthropods, radiating into arachnids, myriapods and winged insects.', stats: { hp: 380, accel: 1080, maxSpeed: 275, dmg: 57, reach: 21, radius: 29, dashCd: .37, dashPow: 485, turn: 13 }, plan: P({ kind: 'arachnid', len: 37, wid: 21, body: '#342d2a', accent: '#b77b45', legs: 8, eyes: 6, abdomen: 1.35, pedipalps: 1.2, armorRidges: 6, abdomenMarks: 7 }), evolvesTo: ['pulmonoscorpius', 'euphoberia', 'stenodictya'] },

  // Optional swift-fish future: an amphibious fish-descendant lineage.
  mudfin_strider: { name: 'Mudfin Strider', tier: 1, branch: 'tideborn', stage: 'devonian', landfall: true, fantasy: true, seaBranches: ['chord'], seaSpecies: ['xenacanthus'], desc: 'Fantasy: a swift shark-descendant using reinforced paired fins to scramble between shrinking pools.', stats: { hp: 225, accel: 1120, maxSpeed: 275, dmg: 36, reach: 16, radius: 22, dashCd: .38, dashPow: 455, turn: 14 }, plan: P({ kind: 'fishwalker', len: 28, wid: 12, body: '#477f83', accent: '#9fe5d5', tail: 1.2, limb: .7, upright: .15, crest: 2, stripes: 5 }), evolvesTo: ['reedscale_stalker'] },
  reedscale_stalker: { name: 'Reedscale Stalker', tier: 2, branch: 'tideborn', stage: 'devonian', fantasy: true, desc: 'Fantasy: webbed grasping forelimbs and stronger hips turn a pool-hopper into an alert reed-bed hunter.', stats: { hp: 270, accel: 1140, maxSpeed: 280, dmg: 42, reach: 18, radius: 24, dashCd: .37, dashPow: 465, turn: 14 }, plan: P({ kind: 'fishwalker', len: 30, wid: 14, body: '#356e68', accent: '#a4d98a', tail: .95, limb: .9, upright: .4, crest: 3, stripes: 4 }), evolvesTo: ['gillrunner'] },
  gillrunner: { name: 'Gillrunner', tier: 3, branch: 'tideborn', stage: 'devonian', fantasy: true, desc: 'Fantasy: long weight-bearing legs, dexterous forefins and protected gills support sustained travel over mud.', stats: { hp: 315, accel: 1170, maxSpeed: 290, dmg: 49, reach: 20, radius: 27, dashCd: .35, dashPow: 485, turn: 14 }, plan: P({ kind: 'fishwalker', len: 33, wid: 15, body: '#315b52', accent: '#d0bb69', tail: .72, limb: 1.14, upright: .7, crest: 5, stripes: 3 }), evolvesTo: ['tide_hunter'] },
  tide_hunter: { name: 'Tide Hunter', tier: 4, branch: 'tideborn', stage: 'devonian', fantasy: true, desc: 'Fantasy: a powerful amphibious fish-descendant with a raised torso, gripping hands and a finned crown.', stats: { hp: 355, accel: 1200, maxSpeed: 300, dmg: 56, reach: 22, radius: 29, dashCd: .34, dashPow: 500, turn: 15 }, plan: P({ kind: 'fishwalker', len: 36, wid: 17, body: '#294b47', accent: '#e18e63', tail: .5, limb: 1.35, upright: 1, crest: 7, stripes: 2 }), evolvesTo: ['bog_tide_hunter'] },
  bog_tide_hunter: { name: 'Coal-Marsh Tide Hunter', tier: 1, branch: 'tideborn', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a mature swamp hunter adapted to humid coal forests and deep, root-tangled channels.', stats: { hp: 395, accel: 1190, maxSpeed: 300, dmg: 60, reach: 23, radius: 31, dashCd: .34, dashPow: 505, turn: 14 }, plan: P({ kind: 'fishwalker', len: 39, wid: 19, body: '#203e38', accent: '#db725e', tail: .42, limb: 1.45, upright: 1, crest: 8, stripes: 2 }), evolvesTo: ['mire_lurker'] },

  // Optional speculative bridges for lineages with no real land descendants.
  shore_polyp: { name: 'Shore Polyp', tier: 1, branch: 'terracnid', stage: 'devonian', landfall: true, fantasy: true, seaBranches: ['cnid'], desc: 'Fantasy: a cnidarian colony sealed against drying tides.', stats: { hp: 225, accel: 900, maxSpeed: 225, dmg: 34, reach: 16, radius: 22, dashCd: .48, dashPow: 390, turn: 11 }, plan: P({ kind: 'jelly', len: 21, wid: 19, body: '#b58add', accent: '#f2d6ff', glow: '#d0a8ff', tentacles: 6, landForm: true, footPads: 1, colonyNodes: 3 }), evolvesTo: ['walking_medusa'] },
  walking_medusa: { name: 'Walking Medusa', tier: 2, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: muscular tentacles carry a moisture-hoarding bell over wet ground.', stats: { hp: 265, accel: 940, maxSpeed: 235, dmg: 40, reach: 17, radius: 24, dashCd: .46, dashPow: 410, turn: 11 }, plan: P({ kind: 'jelly', len: 27, wid: 23, body: '#8b70cb', accent: '#e9d7ff', glow: '#b995ff', tentacles: 8, landForm: true, footPads: 2, crown: 3 }), evolvesTo: ['grove_anemone'] },
  grove_anemone: { name: 'Grove Anemone', tier: 3, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: a roaming anemone hunting beneath primitive woodland shade.', stats: { hp: 310, accel: 950, maxSpeed: 240, dmg: 47, reach: 19, radius: 27, dashCd: .44, dashPow: 430, turn: 11 }, plan: P({ kind: 'jelly', len: 29, wid: 31, body: '#6b4c91', accent: '#df9bd1', glow: '#bd88ff', tentacles: 12, landForm: true, footPads: 1, crown: 9, colonyNodes: 5 }), evolvesTo: ['storm_jelly'] },
  storm_jelly: { name: 'Storm Jelly', tier: 4, branch: 'terracnid', stage: 'devonian', fantasy: true, desc: 'Fantasy: a rain-storing land medusa that discharges static through its tendrils.', stats: { hp: 350, accel: 980, maxSpeed: 250, dmg: 53, reach: 20, radius: 29, dashCd: .42, dashPow: 450, turn: 12 }, plan: P({ kind: 'jelly', len: 36, wid: 28, body: '#405f9b', accent: '#b9ecff', glow: '#65d9ff', tentacles: 10, landForm: true, footPads: 3, crown: 5, colonyNodes: 7 }), evolvesTo: ['coal_colony'] },
  coal_colony: { name: 'Coal-Forest Colony', tier: 1, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a sprawling colonial hunter of the rain-soaked coal forest.', stats: { hp: 380, accel: 950, maxSpeed: 245, dmg: 56, reach: 21, radius: 31, dashCd: .43, dashPow: 450, turn: 11 }, plan: P({ kind: 'jelly', len: 40, wid: 35, body: '#3f684f', accent: '#a5e0a4', glow: '#9edfff', tentacles: 16, landForm: true, footPads: 2, crown: 7, colonyNodes: 12 }), evolvesTo: ['spore_medusa'] },
  mud_octopus: { name: 'Mud Octopus', tier: 1, branch: 'terramoll', stage: 'devonian', landfall: true, fantasy: true, seaBranches: ['moll'], desc: 'Fantasy: a cephalopod that traps water around its gills while crawling between pools.', stats: { hp: 220, accel: 1000, maxSpeed: 245, dmg: 35, reach: 16, radius: 22, dashCd: .43, dashPow: 420, turn: 13 }, plan: P({ kind: 'squid', len: 23, wid: 14, body: '#b46f91', accent: '#ffd1e3', tentacles: 8, eyes: 1, landForm: true, fins: false, mantleSpots: 2 }), evolvesTo: ['lung_octopus'] },
  lung_octopus: { name: 'Lung Octopus', tier: 2, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: a mantle chamber repurposed for breathing humid air.', stats: { hp: 260, accel: 1050, maxSpeed: 255, dmg: 41, reach: 17, radius: 24, dashCd: .41, dashPow: 435, turn: 13 }, plan: P({ kind: 'squid', len: 27, wid: 16, body: '#8b586f', accent: '#eeb5c9', tentacles: 8, eyes: 1, landForm: true, fins: false, mantleSpots: 5 }), evolvesTo: ['grove_cephalopod'] },
  grove_cephalopod: { name: 'Grove Cephalopod', tier: 3, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: chromatophores and grasping arms create a floodplain ambusher.', stats: { hp: 305, accel: 1100, maxSpeed: 265, dmg: 48, reach: 19, radius: 27, dashCd: .39, dashPow: 455, turn: 14 }, plan: P({ kind: 'squid', len: 32, wid: 17, body: '#496b55', accent: '#9ac78e', tentacles: 10, eyes: 1, landForm: true, fins: false, mantleSpots: 7 }), evolvesTo: ['canopy_kraken'] },
  canopy_kraken: { name: 'Canopy Kraken', tier: 4, branch: 'terramoll', stage: 'devonian', fantasy: true, desc: 'Fantasy: a terrestrial cephalopod adapted to the damp Devonian understory.', stats: { hp: 345, accel: 1130, maxSpeed: 275, dmg: 54, reach: 21, radius: 29, dashCd: .38, dashPow: 470, turn: 14 }, plan: P({ kind: 'squid', len: 38, wid: 15, body: '#365448', accent: '#d39ac2', tentacles: 12, eyes: 1, landForm: true, fins: false, mantleSpots: 10 }), evolvesTo: ['coal_kraken'] },
  coal_kraken: { name: 'Coal-Forest Kraken', tier: 1, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a giant camouflage hunter among lycopsid roots.', stats: { hp: 385, accel: 1120, maxSpeed: 275, dmg: 58, reach: 22, radius: 31, dashCd: .38, dashPow: 475, turn: 14 }, plan: P({ kind: 'squid', len: 43, wid: 20, body: '#263f34', accent: '#dc7e9e', tentacles: 14, eyes: 1, landForm: true, fins: false, mantleSpots: 12 }), evolvesTo: ['mire_octopus'] },

  /* ============================================================
     CARBONIFEROUS — full 5-tier trees. Non-fantasy lineages branch;
     the tetrapods (from the Anthracosaurus base) split into amphibians,
     reptiles and synapsids, and the arthropods (from the Eophrynus base)
     split into arachnids, myriapods and winged insects. Fantasy lines run
     as single 5-tier lineages.
     ============================================================ */

  // --- tetrapods: amphibian branch (eryops base -> eryops_temno -> cochleosaurus -> crassigyrinus -> eogyrinus) ---
  eryops_temno: { name: 'Eryops', tier: 2, branch: 'tetra', stage: 'carboniferous', desc: 'A heavy, wide-jawed temnospondyl ambush predator lurking in the coal-swamp shallows.', stats: { hp: 430, accel: 950, maxSpeed: 248, dmg: 62, reach: 18, radius: 30, dashCd: .42, dashPow: 465, turn: 11 }, plan: P({ kind: 'tetrapod', len: 41, wid: 18, body: '#4a5f3a', accent: '#9ab06e', teeth: true, tail: 1.3, tailFin: .22, limb: .82, headScale: 1.22, snout: 1.35, marks: 7, stripes: true, patternColor: '#233520' }), evolvesTo: ['cochleosaurus'] },
  cochleosaurus: { name: 'Cochleosaurus', tier: 3, branch: 'tetra', stage: 'carboniferous', desc: 'A large flat-headed temnospondyl with a cavernous gulping mouth.', stats: { hp: 485, accel: 945, maxSpeed: 250, dmg: 70, reach: 19, radius: 31, dashCd: .42, dashPow: 460, turn: 11 }, plan: P({ kind: 'tetrapod', len: 43, wid: 19, body: '#45573a', accent: '#a6ba72', teeth: true, tail: 1.25, tailFin: .2, limb: .8, headScale: 1.3, snout: 1.4, marks: 6, stripes: true, patternColor: '#213018' }), evolvesTo: ['crassigyrinus'] },
  eogyrinus: { name: 'Eogyrinus', tier: 5, branch: 'tetra', stage: 'carboniferous', desc: 'An eel-like embolomere four metres long — the great serpent of the coal swamps.', stats: { hp: 640, accel: 930, maxSpeed: 258, dmg: 92, reach: 22, radius: 37, dashCd: .44, dashPow: 490, turn: 10 }, plan: P({ kind: 'tetrapod', len: 54, wid: 20, body: '#2c3d34', accent: '#7e9862', teeth: true, tail: 1.55, tailFin: .5, limb: .4, headScale: 1.15, snout: 1.35, marks: 8, stripes: true }), evolvesTo: [] },

  // --- tetrapods: reptile branch (eryops -> hylonomus -> paleothyris -> petrolacosaurus -> carbonodraco) ---
  hylonomus: { name: 'Hylonomus', tier: 2, branch: 'tetra', stage: 'carboniferous', desc: 'The first true reptile — a nimble, scaly insect-hunter darting through the leaf litter.', stats: { hp: 420, accel: 1120, maxSpeed: 300, dmg: 60, reach: 16, radius: 27, dashCd: .36, dashPow: 490, turn: 14 }, plan: P({ kind: 'tetrapod', len: 32, wid: 12, body: '#6a6a3a', accent: '#c8c07a', teeth: true, tail: 1.15, limb: 1.2, headScale: .9, snout: 1.05, marks: 6, stripes: true }), evolvesTo: ['paleothyris'] },
  paleothyris: { name: 'Paleothyris', tier: 3, branch: 'tetra', stage: 'carboniferous', desc: 'A quick, large-eyed early amniote with keen senses for twilight hunting.', stats: { hp: 470, accel: 1150, maxSpeed: 308, dmg: 68, reach: 17, radius: 28, dashCd: .35, dashPow: 495, turn: 14 }, plan: P({ kind: 'tetrapod', len: 34, wid: 13, body: '#726a3e', accent: '#d0c07e', teeth: true, tail: 1.1, limb: 1.25, headScale: .95, snout: 1.02, marks: 7, eyeScale: 1.2 }), evolvesTo: ['petrolacosaurus'] },
  petrolacosaurus: { name: 'Petrolacosaurus', tier: 4, branch: 'tetra', stage: 'carboniferous', desc: 'The earliest diapsid reptile — long-limbed, long-necked and built for speed.', stats: { hp: 540, accel: 1180, maxSpeed: 320, dmg: 80, reach: 18, radius: 30, dashCd: .34, dashPow: 505, turn: 14 }, plan: P({ kind: 'tetrapod', len: 38, wid: 14, body: '#6e5f3a', accent: '#c9b070', teeth: true, tail: 1.25, limb: 1.35, headScale: .95, snout: 1.15, marks: 5, stripes: true }), evolvesTo: ['carbonodraco'] },
  carbonodraco: { name: 'Carbonodraco', tier: 5, branch: 'tetra', stage: 'carboniferous', desc: 'The apex reptile of the coal forests — armored jaws and a whip-fast strike.', stats: { hp: 615, accel: 1200, maxSpeed: 322, dmg: 92, reach: 19, radius: 33, dashCd: .34, dashPow: 500, turn: 14 }, plan: P({ kind: 'tetrapod', len: 42, wid: 16, body: '#5a4a30', accent: '#c0985c', teeth: true, tail: 1.2, limb: 1.32, headScale: 1.05, snout: 1.25, marks: 6, stripes: true, patternColor: '#2f2416' }), evolvesTo: [] },

  // --- tetrapods: synapsid branch (eryops -> archaeothyris -> echinerpeton -> ophiacodon -> ianthasaurus) ---
  archaeothyris: { name: 'Archaeothyris', tier: 2, branch: 'tetra', stage: 'carboniferous', desc: 'The first synapsid — sharp-toothed forerunner of the mammals, warming a low dorsal ridge in the sun.', stats: { hp: 440, accel: 1010, maxSpeed: 268, dmg: 64, reach: 17, radius: 28, dashCd: .4, dashPow: 470, turn: 12 }, plan: P({ kind: 'tetrapod', len: 34, wid: 15, body: '#6b4a3a', accent: '#c98a6a', teeth: true, tail: 1.1, limb: 1.05, headScale: 1.05, snout: 1.18, marks: 5, sail: .5 }), evolvesTo: ['echinerpeton'] },
  echinerpeton: { name: 'Echinerpeton', tier: 3, branch: 'tetra', stage: 'carboniferous', desc: 'An early sailed synapsid whose tall spines thermoregulate its hunting muscles.', stats: { hp: 495, accel: 1000, maxSpeed: 268, dmg: 72, reach: 18, radius: 30, dashCd: .4, dashPow: 470, turn: 12 }, plan: P({ kind: 'tetrapod', len: 38, wid: 16, body: '#5f4234', accent: '#bd7d5e', teeth: true, tail: 1.05, limb: 1.1, headScale: 1.08, snout: 1.2, marks: 4, sail: .9 }), evolvesTo: ['ophiacodon'] },
  ophiacodon: { name: 'Ophiacodon', tier: 4, branch: 'tetra', stage: 'carboniferous', desc: 'A large semi-aquatic pelycosaur with a long, tooth-lined snout for seizing prey.', stats: { hp: 555, accel: 1030, maxSpeed: 275, dmg: 84, reach: 19, radius: 32, dashCd: .4, dashPow: 480, turn: 12 }, plan: P({ kind: 'tetrapod', len: 43, wid: 18, body: '#5a3d30', accent: '#b87356', teeth: true, tail: 1.15, limb: 1.05, headScale: 1.1, snout: 1.5, marks: 4, sail: .7 }), evolvesTo: ['ianthasaurus'] },
  ianthasaurus: { name: 'Ianthasaurus', tier: 5, branch: 'tetra', stage: 'carboniferous', desc: 'A tall-sailed edaphosaur — the apex synapsid, basking its metabolism into overdrive.', stats: { hp: 625, accel: 1050, maxSpeed: 280, dmg: 90, reach: 20, radius: 34, dashCd: .38, dashPow: 490, turn: 12 }, plan: P({ kind: 'tetrapod', len: 45, wid: 18, body: '#503527', accent: '#c07a4e', teeth: true, tail: 1.1, limb: 1.1, headScale: 1.05, snout: 1.3, marks: 4, sail: 1.35 }), evolvesTo: [] },

  // --- arthropods: arachnid branch (eophrynus -> pulmonoscorpius -> megarachne -> graeophonus -> gigantoscorpio) ---
  megarachne: { name: 'Megarachne', tier: 3, branch: 'myria', stage: 'carboniferous', desc: 'A dinner-plate spider-relative that lassos prey in sheets of silk before the bite.', stats: { hp: 480, accel: 1050, maxSpeed: 260, dmg: 70, reach: 18, radius: 30, dashCd: .38, dashPow: 470, turn: 13 }, plan: P({ kind: 'arachnid', len: 40, wid: 24, body: '#3a2e2c', accent: '#c98a5a', legs: 8, eyes: 8, abdomen: 1.4, pedipalps: 1.0, spinnerets: 2, abdomenMarks: 6 }), evolvesTo: ['graeophonus'] },
  graeophonus: { name: 'Graeophonus', tier: 4, branch: 'myria', stage: 'carboniferous', desc: 'A whip-spider with grasping raptorial pedipalps and a lightning seize-and-crush.', stats: { hp: 545, accel: 1080, maxSpeed: 268, dmg: 82, reach: 19, radius: 31, dashCd: .37, dashPow: 480, turn: 13 }, plan: P({ kind: 'arachnid', len: 42, wid: 22, body: '#443230', accent: '#d09060', legs: 8, eyes: 4, abdomen: 1.1, pedipalps: 1.5, abdomenMarks: 5 }), evolvesTo: ['gigantoscorpio'] },
  gigantoscorpio: { name: 'Gigantoscorpio', tier: 5, branch: 'myria', stage: 'carboniferous', desc: 'A colossal land scorpion — pincers like man-traps and a venom-loaded tail arched to strike.', stats: { hp: 630, accel: 1060, maxSpeed: 268, dmg: 96, reach: 21, radius: 35, dashCd: .38, dashPow: 490, turn: 12 }, plan: P({ kind: 'scorpion', len: 50, wid: 22, body: '#6b4630', accent: '#e8a860', segments: 9, claws: true, spikes: 4, legs: 8, eyes: 2 }), evolvesTo: [] },

  // --- arthropods: myriapod branch (eophrynus -> euphoberia -> arthropleura -> coal centipede -> titan arthropleura) ---
  euphoberia: { name: 'Euphoberia', tier: 2, branch: 'myria', stage: 'carboniferous', desc: 'A spine-fringed millipede that curls into a ring of barbs when threatened.', stats: { hp: 435, accel: 900, maxSpeed: 232, dmg: 60, reach: 15, radius: 28, dashCd: .48, dashPow: 415, turn: 11 }, plan: P({ kind: 'arthro', len: 34, wid: 12, body: '#8a5c34', accent: '#d8a860', segments: 14, legs: 22, spikes: 5, eyes: 2, armorRidges: 8 }), evolvesTo: ['arthropleura'] },
  carbon_centipede: { name: 'Coal Centipede', tier: 4, branch: 'myria', stage: 'carboniferous', desc: 'A metre-long predatory centipede — forcipules dripping venom, impossibly fast.', stats: { hp: 540, accel: 1080, maxSpeed: 285, dmg: 84, reach: 18, radius: 30, dashCd: .36, dashPow: 480, turn: 13 }, plan: P({ kind: 'arthro', len: 46, wid: 13, body: '#7a3a2a', accent: '#d87050', segments: 18, legs: 30, spikes: 2, eyes: 2 }), evolvesTo: ['arthropleura_titan'] },
  arthropleura_titan: { name: 'Titan Arthropleura', tier: 5, branch: 'myria', stage: 'carboniferous', desc: 'The largest land invertebrate that ever lived — a two-and-a-half metre armored juggernaut.', stats: { hp: 660, accel: 900, maxSpeed: 236, dmg: 88, reach: 17, radius: 39, dashCd: .5, dashPow: 430, turn: 9 }, plan: P({ kind: 'arthro', len: 56, wid: 22, body: '#5c4026', accent: '#c99045', segments: 20, legs: 34, spikes: 8, eyes: 2, armorRidges: 16 }), evolvesTo: [] },

  // --- arthropods: winged-insect branch (eophrynus -> stenodictya -> meganeura -> bojophlebia -> meganeuropsis) ---
  stenodictya: { name: 'Stenodictya', tier: 2, branch: 'myria', stage: 'carboniferous', desc: 'A primitive winged insect with six spread wings and a piercing beak — among the first fliers.', stats: { hp: 415, accel: 1150, maxSpeed: 300, dmg: 60, reach: 15, radius: 26, dashCd: .34, dashPow: 500, turn: 15 }, plan: P({ kind: 'winged', len: 30, wid: 9, body: '#5a6b4a', accent: '#c8e0a0', segments: 8, eyes: 2 }), evolvesTo: ['meganeura_player'] },
  meganeura_player: { name: 'Meganeura', tier: 3, branch: 'myria', stage: 'carboniferous', desc: 'A hawk-sized griffinfly hunting on the wing over the coal swamps.', stats: { hp: 465, accel: 1200, maxSpeed: 320, dmg: 68, reach: 16, radius: 27, dashCd: .32, dashPow: 515, turn: 15 }, plan: P({ kind: 'winged', len: 38, wid: 11, body: '#4a5f6b', accent: '#a8d0e0', segments: 9, eyes: 2 }), evolvesTo: ['bojophlebia'] },
  bojophlebia: { name: 'Bojophlebia', tier: 4, branch: 'myria', stage: 'carboniferous', desc: 'A giant Carboniferous palaeodictyopteran, wings broad as a raptor and half again as fast.', stats: { hp: 530, accel: 1230, maxSpeed: 330, dmg: 80, reach: 18, radius: 29, dashCd: .32, dashPow: 520, turn: 15 }, plan: P({ kind: 'winged', len: 44, wid: 13, body: '#5a4a6b', accent: '#c0a8e0', segments: 10, eyes: 2 }), evolvesTo: ['meganeuropsis'] },
  meganeuropsis: { name: 'Meganeuropsis', tier: 5, branch: 'myria', stage: 'carboniferous', desc: 'The largest insect that ever flew — a 70cm wingspan apex predator of the primeval air.', stats: { hp: 600, accel: 1260, maxSpeed: 340, dmg: 90, reach: 19, radius: 31, dashCd: .3, dashPow: 525, turn: 15 }, plan: P({ kind: 'winged', len: 52, wid: 15, body: '#4a3f5f', accent: '#b09ad0', segments: 11, eyes: 2 }), evolvesTo: [] },

  // --- fantasy: tideborn (single lineage) ---
  mire_lurker: { name: 'Mire Lurker', tier: 2, branch: 'tideborn', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a heavier coal-swamp fish-descendant ambushing from the root tangles.', stats: { hp: 430, accel: 1150, maxSpeed: 295, dmg: 64, reach: 18, radius: 27, dashCd: .35, dashPow: 500, turn: 14 }, plan: P({ kind: 'fishwalker', len: 30, wid: 14, body: '#3a5a48', accent: '#9fd5b8', tail: .9, limb: .95, upright: .5, crest: 4, stripes: 4 }), evolvesTo: ['swamp_strider'] },
  swamp_strider: { name: 'Swamp Strider', tier: 3, branch: 'tideborn', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: long-legged and tireless, striding the mudflats between coal-forest pools.', stats: { hp: 485, accel: 1180, maxSpeed: 305, dmg: 72, reach: 19, radius: 28, dashCd: .34, dashPow: 505, turn: 14 }, plan: P({ kind: 'fishwalker', len: 33, wid: 15, body: '#356050', accent: '#a0d8ba', tail: .7, limb: 1.15, upright: .75, crest: 5, stripes: 3 }), evolvesTo: ['coal_leviathan'] },
  coal_leviathan: { name: 'Coal Leviathan', tier: 4, branch: 'tideborn', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a bus-sized amphibious hunter whose bite shears through armor and bone.', stats: { hp: 555, accel: 1200, maxSpeed: 312, dmg: 86, reach: 21, radius: 31, dashCd: .34, dashPow: 510, turn: 14 }, plan: P({ kind: 'fishwalker', len: 38, wid: 18, body: '#2c4a40', accent: '#8fc8aa', tail: .6, limb: 1.3, upright: 1, crest: 7, stripes: 2 }), evolvesTo: ['tar_sovereign'] },
  tar_sovereign: { name: 'Tar Sovereign', tier: 5, branch: 'tideborn', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: the crowned apex of the tar pits — an armored, upright amphibious titan.', stats: { hp: 640, accel: 1210, maxSpeed: 316, dmg: 96, reach: 22, radius: 34, dashCd: .33, dashPow: 515, turn: 14 }, plan: P({ kind: 'fishwalker', len: 42, wid: 20, body: '#233d36', accent: '#7fb89a', tail: .5, limb: 1.45, upright: 1, crest: 8, stripes: 2 }), evolvesTo: [] },

  // --- fantasy: terracnid (single lineage) ---
  spore_medusa: { name: 'Spore Medusa', tier: 2, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a walking bell that puffs stinging spores across the marsh.', stats: { hp: 425, accel: 950, maxSpeed: 240, dmg: 62, reach: 18, radius: 28, dashCd: .46, dashPow: 415, turn: 11 }, plan: P({ kind: 'jelly', len: 27, wid: 23, body: '#8b70cb', accent: '#e9d7ff', glow: '#b995ff', tentacles: 8, landForm: true, footPads: 2, crown: 3 }), evolvesTo: ['grove_hydra'] },
  grove_hydra: { name: 'Grove Hydra', tier: 3, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a many-mouthed colonial cnidarian creeping through the fern understory.', stats: { hp: 480, accel: 955, maxSpeed: 242, dmg: 70, reach: 19, radius: 30, dashCd: .44, dashPow: 425, turn: 11 }, plan: P({ kind: 'jelly', len: 30, wid: 26, body: '#7a5cb8', accent: '#e0c8ff', glow: '#b088ff', tentacles: 10, landForm: true, footPads: 2, crown: 5 }), evolvesTo: ['thunder_colony'] },
  thunder_colony: { name: 'Thunder Colony', tier: 4, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a static-charged colony that stuns whole clearings with a discharge.', stats: { hp: 545, accel: 975, maxSpeed: 248, dmg: 82, reach: 20, radius: 32, dashCd: .43, dashPow: 445, turn: 12 }, plan: P({ kind: 'jelly', len: 34, wid: 28, body: '#5f6bc0', accent: '#cdd0ff', glow: '#8fa8ff', tentacles: 12, landForm: true, footPads: 3, crown: 6, colonyNodes: 6 }), evolvesTo: ['stormcrown_colony'] },
  stormcrown_colony: { name: 'Stormcrown Colony', tier: 5, branch: 'terracnid', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a towering crowned colony wreathed in lightning — the apex of the marsh.', stats: { hp: 625, accel: 985, maxSpeed: 252, dmg: 92, reach: 22, radius: 35, dashCd: .42, dashPow: 455, turn: 12 }, plan: P({ kind: 'jelly', len: 38, wid: 31, body: '#4a5fb0', accent: '#c0d8ff', glow: '#7fd0ff', tentacles: 14, landForm: true, footPads: 3, crown: 8, colonyNodes: 9 }), evolvesTo: [] },

  // --- fantasy: terramoll (single lineage) ---
  mire_octopus: { name: 'Mire Octopus', tier: 2, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: an ink-shrouded land octopus slinking through the coal-forest shallows.', stats: { hp: 425, accel: 1120, maxSpeed: 270, dmg: 62, reach: 17, radius: 27, dashCd: .4, dashPow: 470, turn: 14 }, plan: P({ kind: 'squid', len: 27, wid: 16, body: '#8b586f', accent: '#eeb5c9', tentacles: 8, eyes: 1, landForm: true, fins: false, mantleSpots: 5 }), evolvesTo: ['bog_cephalopod'] },
  bog_cephalopod: { name: 'Bog Cephalopod', tier: 3, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a colour-shifting ambusher blending into the root tangles of the bog.', stats: { hp: 480, accel: 1150, maxSpeed: 278, dmg: 70, reach: 18, radius: 29, dashCd: .39, dashPow: 480, turn: 14 }, plan: P({ kind: 'squid', len: 32, wid: 17, body: '#6b4c6a', accent: '#d0a0c8', tentacles: 10, eyes: 1, landForm: true, fins: false, mantleSpots: 7 }), evolvesTo: ['tar_kraken'] },
  tar_kraken: { name: 'Tar Kraken', tier: 4, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: a hooked-armed hunter dragging prey down into the tar pools.', stats: { hp: 550, accel: 1180, maxSpeed: 288, dmg: 84, reach: 20, radius: 31, dashCd: .38, dashPow: 490, turn: 14 }, plan: P({ kind: 'squid', len: 38, wid: 18, body: '#4a3a58', accent: '#c090c0', tentacles: 12, eyes: 1, landForm: true, fins: false, mantleSpots: 9 }), evolvesTo: ['deep_coalkraken'] },
  deep_coalkraken: { name: 'Deep Coal Kraken', tier: 5, branch: 'terramoll', stage: 'carboniferous', fantasy: true, desc: 'Fantasy: the colossal apex of the terrestrial molluscs — arms like nooses, skin like the dark.', stats: { hp: 630, accel: 1200, maxSpeed: 296, dmg: 94, reach: 22, radius: 34, dashCd: .37, dashPow: 495, turn: 14 }, plan: P({ kind: 'squid', len: 44, wid: 20, body: '#3a2f4a', accent: '#b080c0', tentacles: 14, eyes: 1, landForm: true, fins: false, mantleSpots: 12 }), evolvesTo: [] },
};

/* The land-stage "pioneers" — the tier-1 forms you can crawl ashore into,
   and the roster the start screen's "skip to land" offers. */
export const LAND_PIONEERS = Object.keys(SPECIES).filter(id => SPECIES[id].stage === 'devonian' && SPECIES[id].tier === 1);
export const landPioneers = fantasy => LAND_PIONEERS.filter(id => fantasy || !SPECIES[id].fantasy);

/* The tier-1 "entry" forms of any stage — what the start screen's "skip ahead"
   offers for each stage (Devonian pioneers, Carboniferous entrants, …). */
export const stagePioneers = (stage, fantasy) =>
  Object.keys(SPECIES).filter(id => SPECIES[id].stage === stage && SPECIES[id].tier === 1 && (fantasy || !SPECIES[id].fantasy));

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

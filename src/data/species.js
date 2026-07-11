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
    evolvesTo: ['arthropod_larva', 'chordate_larva', 'cnidarian_polyp']
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
    evolvesTo: ['predator_fish']
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
    evolvesTo: []
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
    evolvesTo: []
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
    evolvesTo: ['medusa']
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
    evolvesTo: []
  },
};

/* NPC species (role, era gate, base stats) and edible plants.
   `stage` ('sea' default) confines a species to its biome; minEra gates when it
   starts appearing within that stage; weight biases the spawn roll. Stats scale
   up with era in Creature.spawn(). */
import { P } from './plans.js';

export const npcStage = k => NPCS[k].stage || 'sea';
export const plantStage = k => PLANTS[k].stage || 'sea';

export const NPCS = {
  plankton: {
    role: 'prey', weight: 4.0, minEra: 0, hp: 10, dmg: 0, accel: 420, maxSpeed: 95, radius: 7, sense: 110, meat: 1, value: 4, floaty: 0.25,
    plan: P({ kind: 'microbe', len: 8, wid: 6, body: '#a7e8b0', accent: '#e6ffe9', eyes: 1 })
  },
  amoeba: {
    role: 'predator', weight: 1.6, minEra: 0, hp: 24, dmg: 5, accel: 700, maxSpeed: 130, radius: 11, sense: 250, meat: 2, value: 6, aggro: true,
    plan: P({ kind: 'microbe', len: 13, wid: 11, body: '#c8b6f0', accent: '#f0e9ff', eyes: 1 })
  },
  sea_worm: {
    role: 'prey', weight: 2.6, minEra: 1, hp: 42, dmg: 4, accel: 900, maxSpeed: 170, radius: 12, sense: 260, meat: 3, value: 7,
    plan: P({ kind: 'worm', len: 26, wid: 6, body: '#e08a9a', accent: '#ffd2dc', segments: 8 })
  },
  jelly: {
    role: 'drifter', weight: 2.0, minEra: 1, hp: 34, dmg: 9, accel: 260, maxSpeed: 70, radius: 16, sense: 0, meat: 3, value: 7, floaty: 0.6,
    plan: P({ kind: 'jelly', len: 16, wid: 16, body: '#8fb8ff', accent: '#e6f0ff', glow: '#9fd0ff', tentacles: 6 })
  },
  baby_trilo: {
    role: 'prey', weight: 1.8, minEra: 1, hp: 58, dmg: 8, accel: 820, maxSpeed: 160, radius: 14, sense: 250, meat: 4, value: 9,
    plan: P({ kind: 'arthro', len: 18, wid: 14, body: '#b98a55', accent: '#f0cd95', segments: 6, legs: 8, eyes: 2, stalks: true })
  },
  silverfish: {
    role: 'prey', weight: 2.6, minEra: 1, hp: 34, dmg: 6, accel: 1500, maxSpeed: 300, radius: 12, sense: 320, meat: 2, value: 6,
    plan: P({ kind: 'fish', len: 18, wid: 6, body: '#bcd6e8', accent: '#ffffff', tail: 1.2, eyes: 1 })
  },
  nautiloid: {
    role: 'predator', weight: 1.3, minEra: 2, hp: 120, dmg: 18, accel: 850, maxSpeed: 205, radius: 20, sense: 340, meat: 5, value: 12, aggro: true,
    plan: P({ kind: 'shell', len: 24, wid: 16, body: '#d9c27a', accent: '#fff0c0', tentacles: 6, eyes: 2 })
  },
  anomalo: {
    role: 'predator', weight: 1.0, minEra: 2, hp: 180, dmg: 26, accel: 1000, maxSpeed: 250, radius: 24, sense: 420, meat: 7, value: 16, aggro: true,
    plan: P({ kind: 'anomalo', len: 30, wid: 14, body: '#d97a6a', accent: '#ffd2b0', sideFlaps: true, eyes: 2, stalks: true })
  },
  orthocone: {
    role: 'predator', weight: 0.8, minEra: 3, hp: 260, dmg: 34, accel: 900, maxSpeed: 235, radius: 30, sense: 470, meat: 9, value: 20, aggro: true,
    plan: P({ kind: 'shell', len: 40, wid: 16, body: '#c9a15a', accent: '#ffe0a0', tentacles: 8, eyes: 2 })
  },
  eurypterid: {
    role: 'predator', weight: 0.8, minEra: 3, hp: 230, dmg: 31, accel: 1050, maxSpeed: 275, radius: 26, sense: 470, meat: 8, value: 18, aggro: true,
    plan: P({ kind: 'scorpion', len: 32, wid: 14, body: '#5a6b3a', accent: '#b7d17a', segments: 8, claws: true, legs: 8, eyes: 2 })
  },

  // ---------------- land creatures ----------------
  springtail: {
    role: 'prey', stage: 'land', weight: 4.0, minEra: 0, hp: 14, dmg: 0, accel: 460, maxSpeed: 120, radius: 8, sense: 120, meat: 1, value: 4, floaty: 0,
    plan: P({ kind: 'microbe', len: 9, wid: 6, body: '#c8d98a', accent: '#f0ffcf', eyes: 1 })
  },
  mudskipper: {
    role: 'prey', stage: 'land', weight: 2.8, minEra: 0, hp: 40, dmg: 4, accel: 1100, maxSpeed: 230, radius: 12, sense: 300, meat: 3, value: 7,
    plan: P({ kind: 'tetrapod', len: 18, wid: 8, body: '#8a9a5a', accent: '#d8e6a8', teeth: false, tail: 1.1 })
  },
  millipede: {
    role: 'prey', stage: 'land', weight: 2.4, minEra: 0, hp: 60, dmg: 6, accel: 820, maxSpeed: 170, radius: 14, sense: 240, meat: 4, value: 9,
    plan: P({ kind: 'arthro', len: 24, wid: 9, body: '#a9713c', accent: '#e0b072', segments: 12, legs: 16, eyes: 2 })
  },
  meganeura: {
    role: 'predator', stage: 'land', weight: 1.4, minEra: 0, hp: 90, dmg: 16, accel: 1150, maxSpeed: 285, radius: 16, sense: 400, meat: 4, value: 12, aggro: true,
    plan: P({ kind: 'anomalo', len: 26, wid: 10, body: '#5a8a6a', accent: '#c0f0c8', sideFlaps: true, eyes: 2, stalks: true })
  },
  hynerpeton: {
    role: 'predator', stage: 'land', weight: 1.1, minEra: 0, hp: 170, dmg: 26, accel: 980, maxSpeed: 235, radius: 22, sense: 420, meat: 7, value: 16, aggro: true,
    plan: P({ kind: 'tetrapod', len: 30, wid: 15, body: '#6a7a4a', accent: '#c2d090', teeth: true, tail: 1 })
  },
  land_scorpion: {
    role: 'predator', stage: 'land', weight: 1.0, minEra: 0, hp: 190, dmg: 30, accel: 1020, maxSpeed: 250, radius: 22, sense: 450, meat: 8, value: 18, aggro: true,
    plan: P({ kind: 'scorpion', len: 30, wid: 13, body: '#6b4a28', accent: '#d8a860', segments: 8, claws: true, spikes: 2, legs: 8, eyes: 2 })
  },
};

export const PLANTS = {
  // sea flora
  algae: { max: 4, value: 3, minEra: 0, weight: 3, h: 34 },
  kelp: { max: 6, value: 4, minEra: 0, weight: 1.4, h: 150 },
  // land flora
  moss: { max: 4, value: 3, minEra: 0, weight: 3, h: 26, stage: 'land' },
  fern: { max: 6, value: 4, minEra: 0, weight: 1.6, h: 120, stage: 'land' },
};

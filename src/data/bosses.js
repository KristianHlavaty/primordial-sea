/* Minibosses & perks. Two edge-of-map guardians per age. Big, power-using,
   dangerous; they drop a huge meat payout and, on death, grant a tiny
   PERMANENT passive (a showoff trophy) plus an achievement popup.
   Extensible: add a BOSS_AGE entry (age -> [ids]) plus BOSSES entries. */
import { P } from './plans.js';

export const PERKS = {
  ironhide: { name: 'Ironhide', icon: 'harden',  color: '#7fd8ff', dmgReduce: 0.06, blurb: '+6% damage resistance' },
  reflexes: { name: 'Reflexes', icon: 'evasion', color: '#8affd0', dodge: 0.08,     blurb: '+8% dodge chance' },
};

export const BOSSES = {
  bulwark: {
    title: 'Kolossos, the Bulwark', short: 'Bulwark', kind: 'arthro', at: { x: 0.10, y: 0.85 },
    radius: 46, hp: 820, dmg: 30, accel: 720, maxSpeed: 150, sense: 560, leash: 840, perk: 'ironhide', meat: 120,
    plan: P({ kind: 'arthro', len: 52, wid: 40, body: '#6f4a29', accent: '#e8ad5c', segments: 11, spikes: 9, legs: 16, eyes: 2, stalks: true })
  },
  render: {
    title: 'Xiphos, the Render', short: 'Render', kind: 'scorpion', at: { x: 0.90, y: 0.18 },
    radius: 42, hp: 660, dmg: 37, accel: 1150, maxSpeed: 305, sense: 660, leash: 900, perk: 'reflexes', meat: 110,
    plan: P({ kind: 'scorpion', len: 58, wid: 24, body: '#5a2c38', accent: '#ff8676', segments: 9, claws: true, spikes: 4, legs: 8, eyes: 2 })
  },
};

export const BOSS_AGE = { 0: ['bulwark', 'render'] };  // age 0 = sea stage (add age 1 = land later)

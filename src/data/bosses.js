/* Minibosses & perks. Each map lists its dedicated boss(es) in data/maps.js.
   Bosses are big, power-using, leashed guardians; they drop a huge meat payout
   and, on death, grant a tiny PERMANENT passive (a showoff trophy) plus an
   achievement popup. Extensible: add a BOSSES entry and reference its id from
   a map's `bosses` array. Boss ids must be unique across the whole game. */
import { P } from './plans.js';

export const PERKS = {
  ironhide:  { name: 'Ironhide',   icon: 'harden',    color: '#7fd8ff', dmgReduce: 0.06, blurb: '+6% damage resistance' },
  reflexes:  { name: 'Reflexes',   icon: 'evasion',   color: '#8affd0', dodge: 0.08,     blurb: '+8% dodge chance' },
  thickskin: { name: 'Thick Skin', icon: 'thickhide', color: '#c9a06a', dmgReduce: 0.06, blurb: '+6% damage resistance' },
  swiftstep: { name: 'Swift Step', icon: 'sprint',    color: '#9ce0a0', dodge: 0.08,     blurb: '+8% dodge chance' },
  mireblood: { name: 'Mireblood', icon: 'regen', color: '#9bd47a', dmgReduce: 0.05, blurb: '+5% damage resistance' },
  webwalker: { name: 'Web Walker', icon: 'websnare', color: '#e8d9df', webResist: 0.5, blurb: '+50% resistance to web slowing' },
  afterglow: { name: 'Afterglow', icon: 'shock', color: '#82f7ff', shockAfterglow: 1, blurb: 'Shock blooms again after a short delay, damaging and repelling nearby enemies' },
};

export const BOSSES = {
  // --- sea (The Primordial Sea) ---
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
  lumenara: {
    title: 'Lumenara, the Abyssal Crown', short: 'Abyssal Crown', kind: 'jelly', at: { x: 0.5, y: 0.58 },
    radius: 72, scale: 1.45, hp: 1280, dmg: 44, accel: 480, maxSpeed: 125, sense: 880, leash: 1250, perk: 'afterglow', meat: 175,
    plan: P({ kind: 'jelly', len: 82, wid: 70, body: '#214b88', accent: '#a6fbff', glow: '#49eaff', tentacles: 14, crown: 7, colonyNodes: 9 })
  },

  // --- land: The Tidal Coast ---
  tidewarden: {
    title: 'Ambulos, the Tidewarden', short: 'Tidewarden', kind: 'tetrapod', at: { x: 0.14, y: 0.5 },
    radius: 46, hp: 950, dmg: 42, accel: 820, maxSpeed: 200, sense: 620, leash: 940, perk: 'thickskin', meat: 140,
    plan: P({ kind: 'tetrapod', len: 60, wid: 30, body: '#556b3a', accent: '#c2d488', teeth: true, tail: 1 })
  },
  // --- land: The Fern Lowlands ---
  sovereign: {
    title: 'Titanopod, the Sovereign', short: 'Sovereign', kind: 'arthro', at: { x: 0.86, y: 0.5 },
    radius: 48, hp: 1050, dmg: 46, accel: 900, maxSpeed: 235, sense: 660, leash: 980, perk: 'swiftstep', meat: 150,
    plan: P({ kind: 'arthro', len: 64, wid: 30, body: '#8a5c2e', accent: '#e0aa5e', segments: 16, spikes: 5, legs: 24, eyes: 2, stalks: true })
  },
  gilboa_matriarch: {
    title: 'Arachne of Gilboa, the Matriarch', short: 'Gilboa Matriarch', kind: 'arachnid', at: { x: 0.78, y: 0.34 },
    radius: 48, hp: 1020, dmg: 45, accel: 1020, maxSpeed: 260, sense: 690, leash: 980, perk: 'webwalker', meat: 150,
    plan: P({ kind: 'arachnid', len: 55, wid: 29, body: '#302a2d', accent: '#e08b9f', legs: 8, eyes: 8, abdomen: 1.3, pedipalps: 1.25, spinnerets: 3, abdomenMarks: 7 })
  },
  marshqueen: {
    title: 'Gorgona, the Marsh Queen', short: 'Marsh Queen', kind: 'tetrapod', at: { x: 0.82, y: 0.72 },
    radius: 49, hp: 1120, dmg: 48, accel: 940, maxSpeed: 240, sense: 680, leash: 980, perk: 'mireblood', meat: 155,
    plan: P({ kind: 'tetrapod', len: 62, wid: 31, body: '#435c36', accent: '#a8d17b', teeth: true, tail: .9 })
  },
};

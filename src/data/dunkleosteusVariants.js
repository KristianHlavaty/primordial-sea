/* Side-profile Dunkleosteus art directions for model-lab.html.
   None replaces the live top-down game plan until a direction is selected. */
import { P } from './plans.js';

const hex = color => color && color.startsWith('#') && color.length === 7
  ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)) : null;
const mix = (color, target, amount) => {
  const from = hex(color), to = hex(target); if (!from || !to) return color;
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
};
const colorKeys = ['body', 'backColor', 'bellyColor', 'bellyLight', 'accent', 'plate', 'plateEdge', 'blade', 'eyeColor', 'glow'];
const palette = (name, plan, targets, amount) => {
  const result = { name };
  for (const key of colorKeys) if (plan[key]) result[key] = amount ? mix(plan[key], targets[key] || targets.body, amount) : plan[key];
  result.swatch = result.plate || result.body; return result;
};
const makePalettes = plan => [
  palette('Original', plan, {}, 0),
  palette('Deep Water', plan, { body: '#102b43', backColor: '#071a29', bellyColor: '#456779', bellyLight: '#7292a0', accent: '#71c9d2', plate: '#345a70', plateEdge: '#07141e', blade: '#cadbd5', eyeColor: '#79e5dc', glow: '#5ef3eb' }, .58),
  palette('Kelp', plan, { body: '#3e5638', backColor: '#1d3828', bellyColor: '#778066', bellyLight: '#abb38c', accent: '#9ab76b', plate: '#637052', plateEdge: '#24301f', blade: '#ddd5ac', eyeColor: '#dce87b', glow: '#a9ef7d' }, .58),
  palette('Ember', plan, { body: '#64352f', backColor: '#391c24', bellyColor: '#9b6250', bellyLight: '#d49a72', accent: '#eb7750', plate: '#8e4c3e', plateEdge: '#32151a', blade: '#f0d0a6', eyeColor: '#ffcc68', glow: '#ff674c' }, .58),
  palette('Pale Fossil', plan, { body: '#9b9b8e', backColor: '#666d6a', bellyColor: '#c8c2aa', bellyLight: '#eee2be', accent: '#d7c88f', plate: '#cec6ad', plateEdge: '#5c5a50', blade: '#fff4d2', eyeColor: '#b84c46', glow: '#f6dc8c' }, .65),
];

const concept = (id, name, direction, description, tags, sourcePlan) => {
  const plan = P({ kind: 'dunkleosteus', view: 'side', len: 48, wid: 18, eyes: 1, ...sourcePlan, conceptId: id });
  return { id, name, direction, description, tags, plan, palettes: makePalettes(plan) };
};

export const DUNKLEOSTEUS_VARIANTS = [
  concept(
    'living-reconstruction', 'Living Reconstruction', 'Field-guide side profile',
    'A grounded living-animal interpretation: deep armored shoulders, a compact skull, countershaded skin and an unequal tail inspired by other early jawed fishes.',
    ['side profile', 'naturalistic', 'field guide'],
    {
      body: '#526c70', accent: '#a8b9a5', plate: '#738981', plateEdge: '#263b3e', blade: '#eee2bf',
      headLength: .43, headDepth: 1.04, bodyDepth: .9, backArch: .18, bellyDepth: .9,
      snout: 'sloped', armor: 'field', tailStyle: 'heterocercal', tailLength: 1.02,
      finStyle: 'rounded', finScale: .9, dorsalScale: .9, jawScale: .94,
      pattern: 'countershade', eyeColor: '#b8dfa5', eyeSize: .94, sway: .7,
    },
  ),
  concept(
    'cleveland-crusher', 'Cleveland Crusher', 'Armor-first fossil reconstruction',
    'The famous skull fossils drive the whole silhouette: an enormous steep helmet, heavy cheek plates and a relatively short speculative body behind them.',
    ['side profile', 'huge skull', 'fossil-led'],
    {
      len: 44, wid: 21, body: '#3c4242', accent: '#a16f49', plate: '#777168', plateEdge: '#242120', blade: '#ead7ad',
      headLength: .61, headDepth: 1.4, bodyDepth: 1.0, backArch: .38, bellyDepth: 1.06,
      snout: 'blunt', armor: 'fossil', tailStyle: 'paddle', tailLength: .76,
      finStyle: 'reduced', finScale: .64, dorsalScale: .65, jawScale: 1.25,
      pattern: 'plate-rivets', eyeColor: '#ffad59', eyeSize: .78, sway: .36,
    },
  ),
  concept(
    'razor-jaw', 'Razor Jaw', 'Low-slung blade-headed hunter',
    'A long, low skull and oversized shearing plates produce a knife-like profile. The narrow trunk and spear tail keep every line aimed forward.',
    ['side profile', 'long jaw', 'low silhouette'],
    {
      len: 55, wid: 15, body: '#512f39', accent: '#d77868', plate: '#98756e', plateEdge: '#301b24', blade: '#fff0ce',
      headLength: .55, headDepth: .74, bodyDepth: .67, backArch: .04, bellyDepth: .7,
      snout: 'blade', armor: 'split', tailStyle: 'spear', tailLength: 1.3,
      finStyle: 'swept', finScale: .72, dorsalScale: .65, jawScale: 1.48,
      pattern: 'slashes', eyeColor: '#ffe39a', eyeSize: .7, sway: 1.16,
    },
  ),
  concept(
    'highback-titan', 'Highback Titan', 'Deep-bodied power swimmer',
    'A strongly arched back, deep belly and tall dorsal fin make this version tower vertically. The armor flows into the body instead of looking bolted onto a generic fish.',
    ['side profile', 'deep body', 'high dorsal'],
    {
      len: 46, wid: 21, body: '#315b68', accent: '#87c9bd', plate: '#568b8c', plateEdge: '#18363f', blade: '#e8edcf',
      headLength: .46, headDepth: 1.2, bodyDepth: 1.3, backArch: .62, bellyDepth: 1.18,
      snout: 'hooked', armor: 'saddle', tailStyle: 'diamond', tailLength: .94,
      finStyle: 'sail', finScale: 1.04, dorsalScale: 1.55, jawScale: 1.0,
      pattern: 'shoulder-bars', eyeColor: '#caffeb', eyeSize: .9, sway: .55,
    },
  ),
  concept(
    'oceanic-torpedo', 'Oceanic Torpedo', 'Streamlined pelagic pursuit form',
    'The smallest close-fitting helmet in the set sits on a long tuna-like body with a narrow peduncle, swept fins and a fast crescent tail.',
    ['side profile', 'streamlined', 'pelagic'],
    {
      len: 57, wid: 16, body: '#4c6685', accent: '#9ed5dc', plate: '#6688a2', plateEdge: '#243b52', blade: '#f2ebcf',
      headLength: .34, headDepth: .82, bodyDepth: .77, backArch: .12, bellyDepth: .74,
      snout: 'wedge', armor: 'fitted', tailStyle: 'crescent', tailLength: 1.22,
      finStyle: 'tuna', finScale: .92, dorsalScale: .76, jawScale: .9,
      pattern: 'lateral-line', eyeColor: '#d8ffff', eyeSize: .78, sway: 1.0,
    },
  ),
  concept(
    'midnight-armor', 'Midnight Armor', 'Abyssal luminous side profile',
    'Near-black plates overlap like a deep-sea knight’s visor. Cyan sutures, a luminous lateral line and broad black fins keep the model readable in dark water.',
    ['side profile', 'abyssal', 'luminous seams'],
    {
      len: 48, wid: 20, body: '#111c2b', accent: '#4fe0db', plate: '#25384a', plateEdge: '#07111b', blade: '#bde7dc', glow: '#5affef',
      headLength: .51, headDepth: 1.15, bodyDepth: 1.02, backArch: .24, bellyDepth: 1.02,
      snout: 'visor', armor: 'layered', tailStyle: 'lance', tailLength: .96,
      finStyle: 'blade', finScale: 1.02, dorsalScale: 1.0, jawScale: 1.08,
      pattern: 'glow-line', eyeColor: '#7ffff3', eyeSize: 1.02, sway: .58,
    },
  ),
  concept(
    'reef-ambusher', 'Reef Ambusher', 'Camouflaged bottom-water bruiser',
    'A low dorsal line, heavy belly, rounded fins and irregular algae-like mottling suggest a patient animal that waits beside reefs before lunging.',
    ['side profile', 'camouflage', 'ambush'],
    {
      len: 45, wid: 20, body: '#596149', accent: '#aa9b62', plate: '#77745a', plateEdge: '#34372c', blade: '#ddd0a2',
      headLength: .48, headDepth: 1.05, bodyDepth: 1.08, backArch: .05, bellyDepth: 1.28,
      snout: 'flat', armor: 'low', tailStyle: 'fan', tailLength: .84,
      finStyle: 'fan', finScale: 1.34, dorsalScale: .52, jawScale: .94,
      pattern: 'mottle', eyeColor: '#dac966', eyeSize: .9, sway: .42,
    },
  ),
  concept(
    'bone-helm', 'Bone Helm', 'Crested ceremonial predator',
    'Pale fossil-like plates rise into a high rear crest and pointed brow. The black trunk, red eye and forked tail make the bone helmet dominate the profile.',
    ['side profile', 'crested', 'bone plates'],
    {
      len: 46, wid: 20, body: '#2e343b', accent: '#c4b487', plate: '#d9ceb0', plateEdge: '#534d42', blade: '#fff7d9',
      headLength: .5, headDepth: 1.22, bodyDepth: .93, backArch: .22, bellyDepth: .92,
      snout: 'beak', armor: 'crested', tailStyle: 'fork', tailLength: .94,
      finStyle: 'spined', finScale: 1.0, dorsalScale: 1.05, jawScale: 1.18,
      pattern: 'bone-bands', eyeColor: '#dc5145', eyeSize: .82, sway: .62,
    },
  ),
  concept(
    'sunfire-royal', 'Sunfire Royal', 'Ornate high-contrast showpiece',
    'Cobalt skin, nested gold cheek plates, a crown-like dorsal and long lower fin create a regal display profile while retaining the placoderm jaw mechanics.',
    ['side profile', 'ornate', 'royal'],
    {
      len: 52, wid: 18, body: '#153d75', accent: '#f1c453', plate: '#326d9a', plateEdge: '#102642', blade: '#fff0bd', glow: '#ffda63',
      headLength: .45, headDepth: 1.02, bodyDepth: .82, backArch: .2, bellyDepth: .82,
      snout: 'beak', armor: 'royal', tailStyle: 'lyre', tailLength: 1.24,
      finStyle: 'banner', finScale: 1.22, dorsalScale: 1.2, jawScale: 1.05,
      pattern: 'royal-bars', eyeColor: '#fff079', eyeSize: .86, sway: .82,
    },
  ),
  concept(
    'scarback-veteran', 'Scarback Veteran', 'Battle-damaged old survivor',
    'A broken brow plate, blind scarred eye socket, torn dorsal and ragged tail create a visibly asymmetrical history that only works in a readable side profile.',
    ['side profile', 'scarred', 'weathered'],
    {
      len: 49, wid: 20, body: '#414750', accent: '#a24745', plate: '#697077', plateEdge: '#25282d', blade: '#d8c49e',
      headLength: .53, headDepth: 1.14, bodyDepth: .98, backArch: .24, bellyDepth: 1.0,
      snout: 'broken', armor: 'scarred', tailStyle: 'ragged', tailLength: 1.0,
      finStyle: 'torn', finScale: 1.04, dorsalScale: .92, jawScale: 1.2,
      pattern: 'scars', eyeColor: '#ff6f5c', eyeSize: .84, sway: .72,
    },
  ),

  // --- Crusher family: heavy skulls, short bodies, massive cheek armor ---
  concept(
    'basalt-bastion', 'Basalt Bastion', 'Crusher family · volcanic fortress',
    'A near-black, extremely deep helmet sits ahead of a compact body and broad paddle tail. Layered basalt plates make this the heaviest-looking option in the study.',
    ['side profile', 'crusher family', 'basalt armor'],
    {
      len: 43, wid: 22, body: '#292e30', accent: '#8a5d45', plate: '#505456', plateEdge: '#17191a', blade: '#d9c7a1',
      headLength: .64, headDepth: 1.5, bodyDepth: 1.08, backArch: .34, bellyDepth: 1.15,
      snout: 'blunt', armor: 'fossil', crestStyle: 'knobs', tailStyle: 'paddle', tailLength: .7,
      finStyle: 'reduced', finScale: .55, dorsalScale: .5, jawScale: 1.28,
      pattern: 'plate-rivets', eyeColor: '#ff9256', eyeSize: .7, sway: .28,
    },
  ),
  concept(
    'copper-ram', 'Copper Ram', 'Crusher family · bronze battering ram',
    'Swept copper sutures divide a sloped helmet while a more active unequal tail gives this armored bruiser a little more forward momentum.',
    ['side profile', 'crusher family', 'bronze plates'],
    {
      len: 46, wid: 21, body: '#3d4947', accent: '#cf7d3e', plate: '#8e684b', plateEdge: '#332319', blade: '#f0d5a5',
      headLength: .58, headDepth: 1.28, bodyDepth: 1.02, backArch: .22, bellyDepth: 1.05,
      snout: 'sloped', armor: 'fossil', crestStyle: 'rear-horn', tailStyle: 'heterocercal', tailLength: .9,
      finStyle: 'rounded', finScale: .76, dorsalScale: .72, jawScale: 1.17,
      pattern: 'shoulder-bars', eyeColor: '#ffe074', eyeSize: .82, sway: .45,
    },
  ),
  concept(
    'glacier-bulwark', 'Glacier Bulwark', 'Crusher family · ice-plated giant',
    'Broad blue-white plates overlap above a thick slate body. A diamond tail and cold glowing seams keep the massive form readable against dark water.',
    ['side profile', 'crusher family', 'ice armor'],
    {
      len: 45, wid: 21, body: '#3e5664', accent: '#aee6eb', plate: '#a9c5ce', plateEdge: '#304b5a', blade: '#f5f1d9', glow: '#bffaff',
      headLength: .56, headDepth: 1.36, bodyDepth: 1.12, backArch: .3, bellyDepth: 1.1,
      snout: 'blunt', armor: 'layered', crestStyle: 'ice-ridge', tailStyle: 'diamond', tailLength: .86,
      finStyle: 'reduced', finScale: .7, dorsalScale: .74, jawScale: 1.2,
      pattern: 'glow-line', eyeColor: '#d9ffff', eyeSize: .82, sway: .38,
    },
  ),
  concept(
    'black-anvil', 'Black Anvil', 'Crusher family · elongated shear jaw',
    'The armor stays deep at the shoulder but stretches into a long flat cutting face, combining the Crusher’s weight with a much more pronounced jaw mechanism.',
    ['side profile', 'crusher family', 'long shear'],
    {
      len: 48, wid: 20, body: '#202b36', accent: '#8499ab', plate: '#3c4854', plateEdge: '#111820', blade: '#e8d5ad',
      headLength: .66, headDepth: 1.2, bodyDepth: .9, backArch: .14, bellyDepth: .96,
      snout: 'flat', armor: 'split', crestStyle: 'brow-horn', tailStyle: 'spear', tailLength: 1.0,
      finStyle: 'blade', finScale: .78, dorsalScale: .7, jawScale: 1.42,
      pattern: 'lateral-line', eyeColor: '#f19b59', eyeSize: .7, sway: .55,
    },
  ),
  concept(
    'rust-citadel', 'Rust Citadel', 'Crusher family · towering iron plates',
    'A rust-red saddle of armor climbs into a high shoulder wall, with stubby spined fins and a compact rudder tail reinforcing the siege-engine silhouette.',
    ['side profile', 'crusher family', 'rusted citadel'],
    {
      len: 44, wid: 22, body: '#463a34', accent: '#d06e3d', plate: '#8b4f38', plateEdge: '#342119', blade: '#e7cb9b',
      headLength: .57, headDepth: 1.46, bodyDepth: 1.18, backArch: .48, bellyDepth: 1.12,
      snout: 'hooked', armor: 'saddle', crestStyle: 'square-ridge', tailStyle: 'paddle', tailLength: .8,
      finStyle: 'spined', finScale: .76, dorsalScale: .84, jawScale: 1.2,
      pattern: 'plate-rivets', eyeColor: '#ffca55', eyeSize: .76, sway: .33,
    },
  ),
  concept(
    'granite-cheek', 'Granite Cheek', 'Crusher family · weathered stone armor',
    'Rounded granite-colored cheek plates, subdued mottling and a wide fan tail create a slower, older-looking cousin of Cleveland Crusher.',
    ['side profile', 'crusher family', 'granite plates'],
    {
      len: 45, wid: 22, body: '#535653', accent: '#aaa083', plate: '#85837a', plateEdge: '#373733', blade: '#e7dbbb',
      headLength: .59, headDepth: 1.3, bodyDepth: 1.16, backArch: .18, bellyDepth: 1.24,
      snout: 'blunt', armor: 'fossil', crestStyle: 'knobs', tailStyle: 'fan', tailLength: .78,
      finStyle: 'rounded', finScale: .9, dorsalScale: .7, jawScale: 1.12,
      pattern: 'stone-mottle', eyeColor: '#d9c36e', eyeSize: .8, sway: .3,
    },
  ),
  concept(
    'ember-ram', 'Ember Ram', 'Crusher family · furnace-lit armor',
    'A red luminous seam cuts through soot-dark overlapping plates. The visor snout and short lance tail make it feel aggressive without losing the Crusher proportions.',
    ['side profile', 'crusher family', 'ember seams'],
    {
      len: 46, wid: 21, body: '#251f25', accent: '#e2533f', plate: '#473238', plateEdge: '#160f14', blade: '#e7c79e', glow: '#ff5d42',
      headLength: .61, headDepth: 1.34, bodyDepth: 1.04, backArch: .24, bellyDepth: 1.08,
      snout: 'visor', armor: 'layered', crestStyle: 'brow-horn', tailStyle: 'lance', tailLength: .88,
      finStyle: 'blade', finScale: .82, dorsalScale: .78, jawScale: 1.26,
      pattern: 'glow-line', eyeColor: '#ff8b5c', eyeSize: .78, sway: .43,
    },
  ),

  // --- Ambusher family: low backs, deep bellies, disruptive camouflage ---
  concept(
    'kelp-stalker', 'Kelp Stalker', 'Ambusher family · weed-bed camouflage',
    'Long green blotches break up a low helmet and soft fan fins. The trailing fin edges resemble torn kelp when the animal cruises slowly.',
    ['side profile', 'ambusher family', 'kelp camouflage'],
    {
      len: 47, wid: 20, body: '#344b3e', accent: '#829c62', plate: '#52674f', plateEdge: '#223128', blade: '#d6c99c',
      headLength: .48, headDepth: 1.0, bodyDepth: 1.06, backArch: .02, bellyDepth: 1.22,
      snout: 'flat', armor: 'low', crestStyle: 'kelp-fringe', tailStyle: 'fan', tailLength: .9,
      finStyle: 'torn', finScale: 1.22, dorsalScale: .52, jawScale: .93,
      pattern: 'kelp-blotches', eyeColor: '#ced66f', eyeSize: .86, sway: .48,
    },
  ),
  concept(
    'sand-burrower', 'Sand Burrower', 'Ambusher family · seabed concealment',
    'A nearly flat back, pale belly and dense sand speckles make this the most bottom-hugging option, supported by small fins and a broad digging tail.',
    ['side profile', 'ambusher family', 'sand camouflage'],
    {
      len: 44, wid: 19, body: '#9a835c', accent: '#d6c58f', plate: '#b29c72', plateEdge: '#55452f', blade: '#efe2bd',
      headLength: .46, headDepth: .9, bodyDepth: .9, backArch: 0, bellyDepth: 1.32,
      snout: 'flat', armor: 'low', tailStyle: 'paddle', tailLength: .8,
      finStyle: 'reduced', finScale: .68, dorsalScale: .38, jawScale: .88,
      pattern: 'sand-speckle', eyeColor: '#f4e28e', eyeSize: .78, sway: .32,
    },
  ),
  concept(
    'lichenback', 'Lichenback', 'Ambusher family · encrusted reef mimic',
    'Pale green lichen clusters spread across a rounded body while small armor knobs imitate stones and shell growth on a reef wall.',
    ['side profile', 'ambusher family', 'lichen camouflage'],
    {
      len: 45, wid: 21, body: '#4d5b45', accent: '#a7ad6d', plate: '#69735a', plateEdge: '#30382b', blade: '#ded5ae',
      headLength: .5, headDepth: 1.12, bodyDepth: 1.18, backArch: .1, bellyDepth: 1.2,
      snout: 'sloped', armor: 'low', crestStyle: 'knobs', tailStyle: 'fan', tailLength: .84,
      finStyle: 'fan', finScale: 1.12, dorsalScale: .58, jawScale: .95,
      pattern: 'lichen', eyeColor: '#dce58b', eyeSize: .9, sway: .38,
    },
  ),
  concept(
    'mangrove-shade', 'Mangrove Shade', 'Ambusher family · shadow-water stalker',
    'Dark olive countershading and a hooked snout suit murky root-filled water. Unlike the flatter ambushers, this one keeps an active unequal tail for short lunges.',
    ['side profile', 'ambusher family', 'shadow camouflage'],
    {
      len: 49, wid: 19, body: '#405343', backColor: '#172a22', bellyColor: '#78836b', bellyLight: '#aeb792',
      accent: '#74835b', plate: '#46574a', plateEdge: '#18251f', blade: '#d2c597',
      headLength: .45, headDepth: .98, bodyDepth: .9, backArch: .05, bellyDepth: 1.12,
      snout: 'hooked', armor: 'low', tailStyle: 'heterocercal', tailLength: 1.02,
      finStyle: 'rounded', finScale: .9, dorsalScale: .56, jawScale: .98,
      pattern: 'dark-back', bellyPatch: .78, gillSlits: 3, eyeColor: '#d7bd59', eyeSize: .88, sway: .7,
    },
  ),
  concept(
    'coral-cryptic', 'Coral Cryptic', 'Ambusher family · coral-rubble mimic',
    'Muted coral spots and broken crest points disguise the armor as reef rubble, while a fork tail keeps the silhouette compact between rocks.',
    ['side profile', 'ambusher family', 'coral camouflage'],
    {
      len: 45, wid: 20, body: '#66504b', accent: '#c48670', plate: '#84665d', plateEdge: '#3c2928', blade: '#e9d7b5',
      headLength: .47, headDepth: 1.08, bodyDepth: 1.02, backArch: .08, bellyDepth: 1.16,
      snout: 'beak', armor: 'crested', crestStyle: 'coral-knobs', tailStyle: 'fork', tailLength: .88,
      finStyle: 'spined', finScale: .92, dorsalScale: .68, jawScale: 1.0,
      pattern: 'coral-spots', eyeColor: '#ffe095', eyeSize: .84, sway: .44,
    },
  ),
  concept(
    'mudstone-lurker', 'Mudstone Lurker', 'Ambusher family · heavy silt predator',
    'A blunt mud-colored helmet hangs over an unusually deep belly. Large rounded fins and a short paddle tail make it look adapted for precise movement near the bottom.',
    ['side profile', 'ambusher family', 'silt camouflage'],
    {
      len: 43, wid: 22, body: '#574c3d', accent: '#98805a', plate: '#75644d', plateEdge: '#332b21', blade: '#d9c59a',
      headLength: .52, headDepth: 1.15, bodyDepth: 1.12, backArch: .02, bellyDepth: 1.4,
      snout: 'blunt', armor: 'fossil', crestStyle: 'knobs', tailStyle: 'paddle', tailLength: .74,
      finStyle: 'fan', finScale: 1.18, dorsalScale: .5, jawScale: 1.02,
      pattern: 'stone-mottle', eyeColor: '#d5b967', eyeSize: .8, sway: .25,
    },
  ),

  // --- Bone Helm family: pale crests, brow weapons, ceremonial silhouettes ---
  concept(
    'ivory-rampart', 'Ivory Rampart', 'Bone Helm family · monumental white crest',
    'A towering ivory skull and double rear crest dominate a very short charcoal body, pushing Bone Helm toward the same monumental weight as the Crusher family.',
    ['side profile', 'bone helm family', 'ivory crest'],
    {
      len: 43, wid: 22, body: '#303238', accent: '#bcae87', plate: '#e2d9bf', plateEdge: '#5a5348', blade: '#fff9df',
      headLength: .58, headDepth: 1.42, bodyDepth: 1.04, backArch: .32, bellyDepth: 1.05,
      snout: 'beak', armor: 'crested', crestStyle: 'double-crown', tailStyle: 'fork', tailLength: .78,
      finStyle: 'spined', finScale: .88, dorsalScale: .9, jawScale: 1.22,
      pattern: 'bone-bands', eyeColor: '#c9453e', eyeSize: .72, sway: .35,
    },
  ),
  concept(
    'obsidian-helm', 'Obsidian Helm', 'Bone Helm family · black ceremonial skull',
    'Glossy black plates with pale seams invert the Bone Helm palette. A single white brow horn and red eye make the compact profile immediately recognizable.',
    ['side profile', 'bone helm family', 'obsidian crest'],
    {
      len: 47, wid: 20, body: '#262a31', accent: '#a7a6a1', plate: '#30343a', plateEdge: '#080a0d', blade: '#f0e4c6',
      headLength: .51, headDepth: 1.2, bodyDepth: .92, backArch: .18, bellyDepth: .94,
      snout: 'visor', armor: 'crested', crestStyle: 'brow-horn', tailStyle: 'lance', tailLength: .96,
      finStyle: 'blade', finScale: .94, dorsalScale: .82, jawScale: 1.18,
      pattern: 'bone-bands', eyeColor: '#ff4944', eyeSize: .8, sway: .55,
    },
  ),
  concept(
    'sawcrest', 'Sawcrest', 'Bone Helm family · serrated dorsal crown',
    'A continuous row of pale triangular plates runs from the helmet onto the back, giving this slimmer variant a long saw-toothed silhouette.',
    ['side profile', 'bone helm family', 'saw crest'],
    {
      len: 50, wid: 18, body: '#3c4143', accent: '#d0bf91', plate: '#d8c9a5', plateEdge: '#4d493f', blade: '#fff3d1',
      headLength: .48, headDepth: 1.08, bodyDepth: .82, backArch: .12, bellyDepth: .86,
      snout: 'wedge', armor: 'crested', crestStyle: 'saw', tailStyle: 'crescent', tailLength: 1.08,
      finStyle: 'spined', finScale: .82, dorsalScale: .72, jawScale: 1.12,
      pattern: 'lateral-line', eyeColor: '#d55746', eyeSize: .78, sway: .72,
    },
  ),
  concept(
    'antler-brow', 'Antler Brow', 'Bone Helm family · backward horned skull',
    'A long rear-facing brow horn and smaller shoulder spike turn the pale helmet into a sweeping antler-like shape above a naturalistic unequal tail.',
    ['side profile', 'bone helm family', 'horned brow'],
    {
      len: 48, wid: 20, body: '#39413e', accent: '#c7b783', plate: '#d5c7a3', plateEdge: '#504a3c', blade: '#fff0c8',
      headLength: .53, headDepth: 1.18, bodyDepth: .94, backArch: .2, bellyDepth: .96,
      snout: 'beak', armor: 'crested', crestStyle: 'antler', tailStyle: 'heterocercal', tailLength: .96,
      finStyle: 'spined', finScale: .95, dorsalScale: .8, jawScale: 1.16,
      pattern: 'countershade', eyeColor: '#cc4f3e', eyeSize: .8, sway: .56,
    },
  ),
  concept(
    'cathedral-skull', 'Cathedral Skull', 'Bone Helm family · vaulted gold tracery',
    'Tall arched armor, a central crown and thin gold seams create a cathedral-like profile with long banner fins and a ceremonial lyre tail.',
    ['side profile', 'bone helm family', 'ornate crest'],
    {
      len: 49, wid: 21, body: '#34394c', accent: '#d7b75d', plate: '#c9c3ae', plateEdge: '#4e4a43', blade: '#fff5d0', glow: '#f2cc67',
      headLength: .54, headDepth: 1.36, bodyDepth: .96, backArch: .34, bellyDepth: .98,
      snout: 'beak', armor: 'royal', crestStyle: 'cathedral', tailStyle: 'lyre', tailLength: 1.08,
      finStyle: 'banner', finScale: 1.1, dorsalScale: 1.06, jawScale: 1.18,
      pattern: 'royal-bars', eyeColor: '#ffde71', eyeSize: .78, sway: .58,
    },
  ),
  concept(
    'crimson-reliquary', 'Crimson Reliquary', 'Bone Helm family · red war regalia',
    'Ivory blades and crest plates sit over a crimson body, with a high diamond tail and repeated bone bands giving it a martial heraldic rhythm.',
    ['side profile', 'bone helm family', 'crimson regalia'],
    {
      len: 47, wid: 20, body: '#6a2830', accent: '#d9b77d', plate: '#d8c8a7', plateEdge: '#573c35', blade: '#fff2cd',
      headLength: .5, headDepth: 1.2, bodyDepth: .98, backArch: .16, bellyDepth: 1.0,
      snout: 'hooked', armor: 'crested', crestStyle: 'double-crown', tailStyle: 'diamond', tailLength: .94,
      finStyle: 'spined', finScale: 1.02, dorsalScale: .94, jawScale: 1.2,
      pattern: 'bone-bands', eyeColor: '#ffdc66', eyeSize: .82, sway: .6,
    },
  ),
  concept(
    'fossil-king', 'Fossil King', 'Bone Helm family · crown of preserved plates',
    'Weathered tan plates combine fossil rivets with a broad crown. The body stays dark and restrained so the huge archaeological-looking skull remains the focus.',
    ['side profile', 'bone helm family', 'fossil crown'],
    {
      len: 45, wid: 22, body: '#343638', accent: '#b79661', plate: '#bca982', plateEdge: '#51483a', blade: '#f4e4bd',
      headLength: .6, headDepth: 1.38, bodyDepth: 1.06, backArch: .3, bellyDepth: 1.08,
      snout: 'blunt', armor: 'fossil', crestStyle: 'crown', tailStyle: 'fork', tailLength: .82,
      finStyle: 'spined', finScale: .86, dorsalScale: .82, jawScale: 1.24,
      pattern: 'plate-rivets', eyeColor: '#b83d38', eyeSize: .72, sway: .34,
    },
  ),

  // --- Mangrove Shade studies: two-tone backs, light bellies, visible gills ---
  concept(
    'blackwater-shade', 'Blackwater Shade', 'Mangrove study · black dorsal mantle',
    'The Mangrove Shade anatomy pushed darker: a nearly black back, blue-grey lower body, three visible gill slits and a long pale belly patch.',
    ['side profile', 'mangrove study', 'two-tone'],
    {
      len: 50, wid: 19, body: '#384d4e', backColor: '#101c24', bellyColor: '#71848a', bellyLight: '#b7c4b5',
      accent: '#78928c', plate: '#41585a', plateEdge: '#101d22', blade: '#ddd4ad',
      headLength: .46, headDepth: 1.0, bodyDepth: .91, backArch: .06, bellyDepth: 1.14,
      snout: 'hooked', armor: 'low', tailStyle: 'heterocercal', tailLength: 1.04,
      finStyle: 'rounded', finScale: .9, dorsalScale: .58, jawScale: 1.0,
      pattern: 'dark-back', bellyPatch: .84, gillSlits: 3, eyeColor: '#e5d46d', eyeSize: .86, sway: .72,
    },
  ),
  concept(
    'reedwater-stripe', 'Reedwater Stripe', 'Mangrove study · reed-green countershade',
    'An olive-black back sits over a yellow-green belly, interrupted by soft reed-like flank bars and a compact group of four gill slits.',
    ['side profile', 'mangrove study', 'reed pattern'],
    {
      len: 48, wid: 19, body: '#53634b', backColor: '#223526', bellyColor: '#8e956b', bellyLight: '#c6c995',
      accent: '#99a96b', plate: '#61705a', plateEdge: '#253327', blade: '#e2d6a7',
      headLength: .44, headDepth: .96, bodyDepth: .88, backArch: .03, bellyDepth: 1.1,
      snout: 'flat', armor: 'low', crestStyle: 'kelp-fringe', tailStyle: 'fan', tailLength: .94,
      finStyle: 'rounded', finScale: .96, dorsalScale: .5, jawScale: .94,
      pattern: 'shoulder-bars', bellyPatch: .72, gillSlits: 4, eyeColor: '#e2d96f', eyeSize: .88, sway: .58,
    },
  ),
  concept(
    'peatback-lurker', 'Peatback Lurker', 'Mangrove study · brownwater ambusher',
    'Peat-brown dorsal coloring fades into a warm clay belly. The deeper lower body and broad tail make this the slowest, heaviest Mangrove descendant.',
    ['side profile', 'mangrove study', 'peat water'],
    {
      len: 46, wid: 21, body: '#604f3d', backColor: '#2c251f', bellyColor: '#8d7254', bellyLight: '#c6ad7d',
      accent: '#99805c', plate: '#6e5b46', plateEdge: '#30271e', blade: '#ddc99e',
      headLength: .49, headDepth: 1.08, bodyDepth: 1.04, backArch: .04, bellyDepth: 1.28,
      snout: 'blunt', armor: 'low', crestStyle: 'knobs', tailStyle: 'paddle', tailLength: .82,
      finStyle: 'fan', finScale: 1.08, dorsalScale: .5, jawScale: .98,
      pattern: 'stone-mottle', bellyPatch: .76, gillSlits: 3, eyeColor: '#d9bc61', eyeSize: .82, sway: .36,
    },
  ),
  concept(
    'moonbelly-stalker', 'Moonbelly Stalker', 'Mangrove study · silver underside',
    'A navy dorsal mantle meets a bright silver belly that remains visible beneath the cheek armor. Thin cyan gill slits sell the transition between skull and trunk.',
    ['side profile', 'mangrove study', 'silver belly'],
    {
      len: 51, wid: 18, body: '#3c5665', backColor: '#142737', bellyColor: '#8da0a5', bellyLight: '#d4ded3',
      accent: '#79aeb0', plate: '#506b73', plateEdge: '#172b34', blade: '#e8e1bf', glow: '#8ce8df',
      headLength: .43, headDepth: .92, bodyDepth: .83, backArch: .06, bellyDepth: 1.02,
      snout: 'wedge', armor: 'fitted', tailStyle: 'crescent', tailLength: 1.08,
      finStyle: 'tuna', finScale: .88, dorsalScale: .58, jawScale: .94,
      pattern: 'dark-back', bellyPatch: .9, gillSlits: 4, eyeColor: '#caffef', eyeSize: .84, sway: .82,
    },
  ),
  concept(
    'copperroot-hunter', 'Copperroot Hunter', 'Mangrove study · bronze dorsal plates',
    'Copper-brown armor and a dark root-colored back contrast with a pale ochre belly. Its hooked nose and active unequal tail preserve direction 21’s lunge profile.',
    ['side profile', 'mangrove study', 'copper back'],
    {
      len: 50, wid: 19, body: '#665043', backColor: '#30251f', bellyColor: '#a17a58', bellyLight: '#ddb982',
      accent: '#c07a47', plate: '#805841', plateEdge: '#35231c', blade: '#ecd0a0',
      headLength: .47, headDepth: 1.01, bodyDepth: .9, backArch: .08, bellyDepth: 1.12,
      snout: 'hooked', armor: 'field', tailStyle: 'heterocercal', tailLength: 1.06,
      finStyle: 'swept', finScale: .86, dorsalScale: .6, jawScale: 1.02,
      pattern: 'dark-back', bellyPatch: .78, gillSlits: 3, eyeColor: '#ffd267', eyeSize: .84, sway: .72,
    },
  ),
  concept(
    'algae-lantern', 'Algae Lantern', 'Mangrove study · luminous lower flank',
    'A forest-dark back hides the body from above while a soft chartreuse belly glow spreads behind the gills like reflected algae light.',
    ['side profile', 'mangrove study', 'luminous belly'],
    {
      len: 49, wid: 19, body: '#3c5544', backColor: '#15291d', bellyColor: '#789064', bellyLight: '#c0d77a',
      accent: '#91bd63', plate: '#4e6a50', plateEdge: '#192b1d', blade: '#dfe0aa', glow: '#b4ed72',
      headLength: .45, headDepth: .97, bodyDepth: .9, backArch: .04, bellyDepth: 1.1,
      snout: 'visor', armor: 'layered', crestStyle: 'kelp-fringe', tailStyle: 'lance', tailLength: .98,
      finStyle: 'rounded', finScale: .92, dorsalScale: .56, jawScale: .98,
      pattern: 'glow-line', bellyPatch: .86, gillSlits: 5, eyeColor: '#ddf781', eyeSize: .9, sway: .66,
    },
  ),
  concept(
    'silt-runner', 'Silt Runner', 'Mangrove study · fast pale-bottom form',
    'A slimmer tan body keeps the Mangrove two-tone layout but replaces the broad fins with swept surfaces and a spear tail for rapid movement over open silt.',
    ['side profile', 'mangrove study', 'silt runner'],
    {
      len: 53, wid: 17, body: '#75694f', backColor: '#3d3a2c', bellyColor: '#a99b75', bellyLight: '#ded0a2',
      accent: '#b4a36e', plate: '#81775b', plateEdge: '#3a3529', blade: '#eee0ba',
      headLength: .4, headDepth: .86, bodyDepth: .78, backArch: .04, bellyDepth: .96,
      snout: 'blade', armor: 'fitted', tailStyle: 'spear', tailLength: 1.18,
      finStyle: 'swept', finScale: .8, dorsalScale: .52, jawScale: .92,
      pattern: 'sand-speckle', bellyPatch: .82, gillSlits: 3, eyeColor: '#efe08b', eyeSize: .76, sway: .96,
    },
  ),
  concept(
    'rootshadow', 'Rootshadow', 'Mangrove study · violet-black roots',
    'Purple-black dorsal armor breaks into muted mauve on the sides and a grey belly below, producing a strange but still natural shadow-water palette.',
    ['side profile', 'mangrove study', 'root shadow'],
    {
      len: 48, wid: 20, body: '#514753', backColor: '#211b29', bellyColor: '#827685', bellyLight: '#b9aeb2',
      accent: '#8b6f83', plate: '#5e5260', plateEdge: '#241c27', blade: '#dec9af',
      headLength: .48, headDepth: 1.04, bodyDepth: .96, backArch: .09, bellyDepth: 1.16,
      snout: 'hooked', armor: 'low', crestStyle: 'brow-horn', tailStyle: 'diamond', tailLength: .9,
      finStyle: 'blade', finScale: .88, dorsalScale: .62, jawScale: 1.06,
      pattern: 'dark-back', bellyPatch: .74, gillSlits: 4, eyeColor: '#e5c66a', eyeSize: .84, sway: .56,
    },
  ),
  concept(
    'brackish-ghost', 'Brackish Ghost', 'Mangrove study · pale murkwater morph',
    'The same darker-back construction rendered in desaturated grey-green, with an almost white underside and dark gill cuts for maximum anatomical clarity.',
    ['side profile', 'mangrove study', 'pale morph'],
    {
      len: 49, wid: 19, body: '#78817a', backColor: '#46534f', bellyColor: '#aeb5a7', bellyLight: '#e5e4c9',
      accent: '#a5aa83', plate: '#89928a', plateEdge: '#414b47', blade: '#f5e9c6',
      headLength: .46, headDepth: .98, bodyDepth: .9, backArch: .05, bellyDepth: 1.1,
      snout: 'flat', armor: 'field', tailStyle: 'fan', tailLength: .94,
      finStyle: 'rounded', finScale: .94, dorsalScale: .54, jawScale: .98,
      pattern: 'dark-back', bellyPatch: .88, gillSlits: 4, eyeColor: '#a9463e', eyeSize: .84, sway: .6,
    },
  ),
  concept(
    'estuary-phantom', 'Estuary Phantom', 'Mangrove study · apex two-tone profile',
    'The most polished direction-21 descendant combines a charcoal-teal back, long ivory belly light, clean gill slits and a balanced active tail.',
    ['side profile', 'mangrove study', 'refined two-tone'],
    {
      len: 51, wid: 19, body: '#3c5e5b', backColor: '#142f31', bellyColor: '#77938b', bellyLight: '#cbd3ad',
      accent: '#7ba79a', plate: '#4d716d', plateEdge: '#173335', blade: '#eee1b8',
      headLength: .46, headDepth: 1.0, bodyDepth: .9, backArch: .07, bellyDepth: 1.12,
      snout: 'hooked', armor: 'field', tailStyle: 'heterocercal', tailLength: 1.08,
      finStyle: 'rounded', finScale: .92, dorsalScale: .58, jawScale: 1.02,
      pattern: 'dark-back', bellyPatch: .94, gillSlits: 4, eyeColor: '#f0da6c', eyeSize: .88, sway: .74,
    },
  ),
];

export const DUNKLEOSTEUS_VARIANT_MAP = Object.fromEntries(DUNKLEOSTEUS_VARIANTS.map(variant => [variant.id, variant]));

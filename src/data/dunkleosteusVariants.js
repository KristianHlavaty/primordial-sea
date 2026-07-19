/* Ten SIDE-PROFILE Dunkleosteus art directions for model-lab.html.
   None replaces the live top-down game plan until a direction is selected. */
import { P } from './plans.js';

const concept = (id, name, direction, description, tags, plan) => ({
  id, name, direction, description, tags,
  plan: P({ kind: 'dunkleosteus', view: 'side', len: 48, wid: 18, eyes: 1, ...plan, conceptId: id }),
});

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
];

export const DUNKLEOSTEUS_VARIANT_MAP = Object.fromEntries(DUNKLEOSTEUS_VARIANTS.map(variant => [variant.id, variant]));

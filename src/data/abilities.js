/* Grounded, creature-appropriate powers (no fantasy). The player starts with
   none and gains one slot per evolution (cap 3). Arthropods lean defense and
   control, fish lean agility and offense. Passives are always-on; actives fire
   on keys 1/2/3 (bound by KeyboardEvent.code = Digit1/2/3 so Czech +/ě/š work
   too) or by clicking the icon.
   The effects themselves live in engine/systems/abilities.js. */

export const ABILITIES = {
  harden:  { name: 'Harden',  passive: false, cd: 12, dur: 7,   color: '#7fd8ff', desc: 'Raise a heavy shield that stores incoming force, then detonates it when the shell breaks or expires.' },
  enroll:  { name: 'Enroll',  passive: false, cd: 11, dur: 2.2, color: '#ffcf6a', desc: 'Become an invulnerable living pinball that damages, launches and rebounds from each new target.' },
  barbs:   { name: 'Barbs',   passive: true,  cd: 0,  dur: 0,   color: '#ff9a5e', desc: 'Hits charge defensive spines; your next bite scatters their stored damage through nearby enemies.' },
  burst:   { name: 'Burst',   passive: false, cd: 9,  dur: 3.5, color: '#5ee0f2', desc: 'Explode into a streaming dash; your first bite during the wake becomes an armor-breaching impact.' },
  frenzy:  { name: 'Frenzy',  passive: false, cd: 12, dur: 5,   color: '#f0637a', desc: 'Swell into a crimson feeding frenzy with wider, heavier bites and much faster attacks.' },
  evasion: { name: 'Evasion', passive: true,  cd: 0,  dur: 0,   color: '#8affd0', desc: 'Dodging leaves a visible afterimage and briefly accelerates your next bite.' },
  engulf:  { name: 'Engulf',  passive: false, cd: 6,  dur: .78, color: '#8fe6c8', desc: 'Open a feeding cone that drags prey inward, swallows the smallest victim, then spits it out.' },
  bloom:   { name: 'Tentacle Bloom', passive: false, cd: 9, dur: 3, color: '#c79bff', desc: 'Grow four independent stinging arms that pull the nearest prey in and swat other threats away.' },
  shock:   { name: 'Shock',   passive: false, cd: 16, dur: .65, color: '#9fdcff', desc: 'A paralytic discharge that chains through clustered targets and leaves them conductive.' },
  nettle:  { name: 'Nettle',  passive: true,  cd: 0,  dur: 0,   color: '#b9a0ff', desc: 'Anything that bites you is stung, slowed and left vulnerable to follow-up damage.' },
  // --- mollusc / expansion powers ---
  jet:        { name: 'Jet',            passive: false, cd: 7,  dur: .5,  color: '#7fe6d8', desc: 'Detonate the siphon to launch forward while the backwash blasts anything behind you away.' },
  withdraw:   { name: 'Withdraw',       passive: false, cd: 14, dur: 4,   color: '#e8c98a', desc: 'Hide and mend in the shell, storing absorbed force; activate again or wait to release it as a shockwave.' },
  ink:        { name: 'Ink Cloud',      passive: false, cd: 12, dur: 6,   color: '#8a93b8', desc: 'Leave a drifting decoy in a persistent ink cloud; predators attack it while the cloud conceals you.' },
  grasp:      { name: 'Grasp',          passive: false, cd: 10, dur: .62, color: '#c98ae0', desc: 'Fire a long living tentacle that seizes prey or rival creatures and reels them into biting distance. Bosses are only wounded and nudged.' },
  ram:        { name: 'Ram',            passive: false, cd: 9,  dur: 0.95,color: '#ffb36a', desc: 'Lock your heading and become a living torpedo; impacts crush, launch and shake your view.' },
  filter:     { name: 'Filter Feed',    passive: true,  cd: 0,  dur: 0,   color: '#9fe0b0', desc: 'Pull food from afar and chain rapid meals into a five-step nourishment and XP combo.' },
  impale:     { name: 'Impale',         passive: false, cd: 11, dur: .72, color: '#ffd27a', desc: 'Skewer prey on your claws and carry it forward; colliding it into another victim hurts both.' },
  crush:      { name: 'Crush',          passive: false, cd: 12, dur: .44, color: '#ff8a5e', desc: 'Telegraph a guillotine bite that executes weakened prey and cracks armor on survivors.' },
  rebirth:    { name: 'Colony Rebirth', passive: true,  cd: 0,  dur: 0,   color: '#a0ffd8', desc: 'A colony never truly dies — once per life, a killing blow leaves enough survivors to rebuild you.' },
  bloodscent: { name: 'Blood Scent',    passive: true,  cd: 0,  dur: 0,   color: '#ff7a8a', desc: 'Taste blood in the water — wounded prey takes far heavier bites, and every kill mends you.' },
  venom:      { name: 'Venom',          passive: true,  cd: 0,  dur: 0,   color: '#b0e05e', desc: 'Bites stack venom; the third stack ruptures and poisons everything around the victim.' },
  camo:       { name: 'Chromatophores', passive: true,  cd: 0,  dur: 0,   color: '#9bb8c8', desc: 'Keeping still fades you into the terrain and charges a powerful first-strike ambush.' },
  whirlpool:  { name: 'Whirlpool',      passive: false, cd: 15, dur: 2.6, color: '#6fd0e8', desc: 'Place a grinding vortex ahead; when it collapses, everything trapped inside is violently expelled.' },
  // --- land powers ---
  pounce:     { name: 'Pounce',    passive: false, cd: 8,  dur: .58, color: '#ffb04e', desc: 'Leap over danger and slam down ahead, pinning the nearest prey beneath you.' },
  burrow:     { name: 'Burrow',    passive: false, cd: 13, dur: 2.4, color: '#c79a5e', desc: 'Dig underground, move unseen, then activate again or wait to erupt beneath nearby prey.' },
  stomp:      { name: 'Stomp',     passive: false, cd: 10, dur: 1.05,color: '#e0a060', desc: 'Send two expanding ground waves through the area, staggering every target they cross.' },
  tailsweep:  { name: 'Tail Sweep',passive: false, cd: 9,  dur: .72, color: '#9fd0a0', desc: 'Wind up a full-circle tail whip that launches enemies and reflects hostile projectiles.' },
  sprint:     { name: 'Sprint',    passive: false, cd: 8,  dur: 3,   color: '#9ce0a0', desc: 'Build momentum during a bounding sprint; at full speed you trample anything in your path.' },
  regen:      { name: 'Regenerate',passive: true,  cd: 0,  dur: 0,   color: '#8affb0', desc: 'After a short damage-free pause, regrowth switches on as powerful rapid healing.' },
  thickhide:  { name: 'Thick Hide',passive: true,  cd: 0,  dur: 0,   color: '#c9a06a', desc: 'Three visible armor plates blunt hits, then regrow one by one while you survive.' },
  bastion:    { name: 'Living Bastion', passive: true, cd: 0, dur: 0, color: '#d6ad67', desc: 'Standing your ground interlocks your shell and steadily builds damage and knockback resistance.' },
  ampullae:   { name: 'Electric Sense', passive: true, cd: 0, dur: 0, color: '#7de4e8', desc: 'A recharging electric sense guarantees one predictive dodge when it is ready.' },
  hypervenom: { name: 'Venom Reservoir', passive: true, cd: 0, dur: 0, color: '#57e6b1', desc: 'Stronger venom stacks rupture into a larger, more damaging toxic outbreak.' },
  hookarms:   { name: 'Hooked Arms', passive: true, cd: 0, dur: 0, color: '#e48ddb', desc: 'Long arms extend each bite and hook surviving prey back toward your mouth.' },
  airbreath:  { name: 'Air Breathing', passive: true, cd: 0, dur: 0, color: '#9edbb2', desc: 'Sustained movement ashore fills an oxygen meter that releases a restorative second wind.' },
  websnare:   { name: 'Silk Snare', passive: false, cd: 11, dur: 7, color: '#d9e6df', desc: 'Cast a persistent silk arena; prey struck inside it becomes tightly bound again.' },
  silksense:  { name: 'Silk Sense', passive: true, cd: 0, dur: 0, color: '#e8cbd8', desc: 'A recharging vibration sense guarantees a dodge and tangles the attacker when triggered.' },
  // --- Carboniferous powers ---
  dive:       { name: 'Dive Bomb',    passive: false, cd: 9,  dur: .7, color: '#ffd27a', desc: 'Rise beyond reach, cross a long distance, then crash down in a wide, violent impact.' },
  venomsting: { name: 'Venom Sting',  passive: false, cd: 11, dur: 0, color: '#b6e05a', desc: 'Drive concentrated venom into one target, adding a stack that can rupture into a toxic outbreak.' },
  sail:       { name: 'Basking Sail', passive: true,  cd: 0,  dur: 0, color: '#ff9f6a', desc: 'Bask while still to store heat for stronger healing and a searing empowered bite.' },
};

/* Which powers each player form carries (length grows with tier; capped at 3).
   Every form's kit is unique; the first-listed power is its signature. */
export const ABILITY_SETS = {
  protocell: ['engulf'], arthropod_larva: ['harden'], chordate_larva: ['burst'], cnidarian_polyp: ['bloom'],
  mollusc_larva: ['jet'],
  trilobite: ['harden', 'enroll'], anomalocarid: ['frenzy', 'harden'], swift_fish: ['burst', 'evasion'],
  jawed_fish: ['frenzy', 'evasion'], medusa: ['shock', 'nettle'],
  ammonite: ['withdraw', 'jet'], proto_squid: ['ink', 'jet'], box_jelly: ['venom', 'bloom'],
  sea_scorpion: ['frenzy', 'harden', 'enroll'], spiny_trilobite: ['harden', 'enroll', 'barbs'],
  predator_fish: ['burst', 'frenzy', 'evasion'], giant_medusa: ['shock', 'bloom', 'nettle'],
  great_orthocone: ['ram', 'withdraw', 'filter'], elder_kraken: ['grasp', 'ink', 'camo'],
  cladoselache: ['bloodscent', 'burst', 'frenzy'],
  jaekelopterus: ['impale', 'harden', 'barbs'], dunkleosteus: ['crush', 'frenzy', 'evasion'],
  siphonophore: ['rebirth', 'shock', 'bloom'], cameroceras: ['whirlpool', 'ram', 'grasp'],
  isotelus_rex: ['bastion', 'enroll', 'barbs'],
  hurdiid_hunter: ['grasp', 'burst', 'evasion'], aegirocassis: ['filter', 'ram', 'bastion'],
  sea_wasp: ['venom', 'burst', 'nettle'], crowned_sea_wasp: ['hypervenom', 'shock', 'evasion'],
  xenacanthus: ['ampullae', 'burst', 'bloodscent'], abyssal_kraken: ['hookarms', 'ink', 'camo'],
  // land forms
  tiktaalik: ['pounce', 'regen'], ichthyostega: ['pounce', 'regen', 'tailsweep'], eryops: ['crush', 'engulf', 'thickhide'],
  kampecaris: ['burrow', 'thickhide'], arthropleura: ['stomp', 'enroll', 'thickhide'], pulmonoscorpius: ['venomsting', 'impale', 'sprint'],
  mudfin_strider: ['burst', 'regen'], reedscale_stalker: ['pounce', 'grasp', 'regen'],
  gillrunner: ['sprint', 'pounce', 'ampullae'], tide_hunter: ['frenzy', 'pounce', 'ampullae'], bog_tide_hunter: ['bloodscent', 'pounce', 'regen'],
  acanthostega: ['pounce', 'regen', 'burst'], hynerpeton_player: ['pounce', 'tailsweep', 'thickhide'],
  elpistostege: ['airbreath', 'tailsweep'], tulerpeton: ['airbreath', 'pounce', 'sprint'],
  metaxygnathus: ['crush', 'pounce', 'airbreath'], crassigyrinus: ['crush', 'regen', 'bloodscent'],
  pneumodesmus: ['burrow', 'enroll', 'thickhide'], devonian_trigonotarbid: ['pounce', 'burrow', 'thickhide'], devonian_scorpion: ['impale', 'burrow', 'thickhide'],
  rhyniella: ['evasion', 'burrow'], attercopus: ['websnare', 'evasion', 'venom'],
  gilboa_arachnid: ['websnare', 'silksense', 'venom'], eophrynus: ['websnare', 'bastion', 'venom'],
  shore_polyp: ['nettle', 'bloom'], walking_medusa: ['bloom', 'grasp', 'nettle'], grove_anemone: ['bloom', 'nettle', 'venom'], storm_jelly: ['shock', 'bloom', 'venom'], coal_colony: ['rebirth', 'shock', 'venom'],
  mud_octopus: ['camo', 'grasp'], lung_octopus: ['grasp', 'camo', 'airbreath'], grove_cephalopod: ['grasp', 'camo', 'venom'], canopy_kraken: ['grasp', 'ink', 'sprint'], coal_kraken: ['grasp', 'camo', 'sprint'],

  // ===== Carboniferous — tetrapods (amphibians / reptiles / synapsids) =====
  // eryops (Anthracosaurus base) kit set above with the land forms
  eryops_temno: ['engulf', 'regen', 'frenzy'], cochleosaurus: ['engulf', 'regen', 'crush'], eogyrinus: ['crush', 'frenzy', 'regen'],
  hylonomus: ['pounce', 'evasion', 'sprint'], paleothyris: ['pounce', 'evasion', 'ampullae'], petrolacosaurus: ['pounce', 'sprint', 'bloodscent'], carbonodraco: ['crush', 'pounce', 'evasion'],
  archaeothyris: ['sail', 'pounce', 'frenzy'], echinerpeton: ['sail', 'frenzy', 'thickhide'], ophiacodon: ['sail', 'crush', 'bloodscent'], ianthasaurus: ['sail', 'crush', 'frenzy'],
  // ===== Carboniferous — arthropods (arachnids / myriapods / winged insects) =====
  megarachne: ['websnare', 'venomsting', 'evasion'], graeophonus: ['venomsting', 'grasp', 'venom'], gigantoscorpio: ['venomsting', 'impale', 'bastion'],
  euphoberia: ['enroll', 'barbs', 'thickhide'], carbon_centipede: ['impale', 'venom', 'sprint'], arthropleura_titan: ['stomp', 'enroll', 'bastion'],
  stenodictya: ['dive', 'burst', 'evasion'], meganeura_player: ['dive', 'burst', 'bloodscent'], bojophlebia: ['dive', 'frenzy', 'evasion'], meganeuropsis: ['dive', 'frenzy', 'ampullae'],
  // ===== Carboniferous — fantasy lines (single lineages) =====
  mire_lurker: ['pounce', 'frenzy', 'regen'], swamp_strider: ['sprint', 'frenzy', 'ampullae'], coal_leviathan: ['crush', 'pounce', 'bloodscent'], tar_sovereign: ['crush', 'frenzy', 'thickhide'],
  spore_medusa: ['bloom', 'nettle', 'sprint'], grove_hydra: ['shock', 'nettle', 'venom'], thunder_colony: ['rebirth', 'bloom', 'nettle'], stormcrown_colony: ['shock', 'rebirth', 'nettle'],
  mire_octopus: ['ink', 'camo', 'sprint'], bog_cephalopod: ['ink', 'camo', 'bloodscent'], tar_kraken: ['grasp', 'camo', 'bloodscent'], deep_coalkraken: ['grasp', 'ink', 'bloodscent'],
};

/* Maps a duration-based ability to the Player timer field that tracks it
   (used by the HUD to show the "active" state). */
export const ACTIVE_TIMER = {
  harden: 'shieldT', enroll: 'enrollT', burst: 'burstT', frenzy: 'frenzyT', engulf: 'engulfT', bloom: 'bloomT', shock: 'shockVisualT',
  jet: 'jetT', withdraw: 'withdrawT', ink: 'inkCloudT', grasp: 'graspT', ram: 'ramT', impale: 'impaleT', crush: 'crushT',
  whirlpool: 'vortexT', pounce: 'leapT', burrow: 'burrowT', stomp: 'stompT', tailsweep: 'tailSweepT', sprint: 'sprintT',
  websnare: 'webT', dive: 'leapT',
};

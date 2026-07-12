/* Grounded, creature-appropriate powers (no fantasy). The player starts with
   none and gains one slot per evolution (cap 3). Arthropods lean defense and
   control, fish lean agility and offense. Passives are always-on; actives fire
   on keys 1/2/3 (bound by KeyboardEvent.code = Digit1/2/3 so Czech +/ě/š work
   too) or by clicking the icon.
   The effects themselves live in engine/systems/abilities.js. */

export const ABILITIES = {
  harden:  { name: 'Harden',  passive: false, cd: 12, dur: 6,   color: '#7fd8ff', desc: 'Stiffen the carapace into a shield that soaks damage before your health.' },
  enroll:  { name: 'Enroll',  passive: false, cd: 11, dur: 2.2, color: '#ffcf6a', desc: 'Curl into an armored ball — briefly invulnerable, shoving nearby attackers back.' },
  barbs:   { name: 'Barbs',   passive: true,  cd: 0,  dur: 0,   color: '#ff9a5e', desc: 'Defensive spines reflect part of every bite back at the attacker.' },
  burst:   { name: 'Burst',   passive: false, cd: 9,  dur: 3,   color: '#5ee0f2', desc: 'A surge of burst-swimming — much greater speed and acceleration.' },
  frenzy:  { name: 'Frenzy',  passive: false, cd: 12, dur: 4,   color: '#f0637a', desc: 'Feeding frenzy — heavier bites and far faster attacks.' },
  evasion: { name: 'Evasion', passive: true,  cd: 0,  dur: 0,   color: '#8affd0', desc: 'Agile reflexes — a chance to completely dodge an incoming bite.' },
  engulf:  { name: 'Engulf',  passive: false, cd: 6,  dur: 0,   color: '#8fe6c8', desc: 'A ciliary feeding current — draws in nearby food and tiny prey, and mends a little.' },
  bloom:   { name: 'Tentacle Bloom', passive: false, cd: 9, dur: 3, color: '#c79bff', desc: 'Sprout stinging tentacles that lash and shove everything around you.' },
  shock:   { name: 'Shock',   passive: false, cd: 16, dur: 0,   color: '#9fdcff', desc: 'A paralytic nerve-discharge: stuns nearby animals for a few seconds (minor damage). Minibosses are only slowed.' },
  nettle:  { name: 'Nettle',  passive: true,  cd: 0,  dur: 0,   color: '#b9a0ff', desc: 'Venomous skin — anything that bites you is stung and briefly slowed.' },
  // --- mollusc / expansion powers ---
  jet:        { name: 'Jet',            passive: false, cd: 7,  dur: 0,   color: '#7fe6d8', desc: 'Fire the siphon — a violent jet of water hurls you forward.' },
  withdraw:   { name: 'Withdraw',       passive: false, cd: 14, dur: 4,   color: '#e8c98a', desc: 'Pull into the shell — take a fraction of damage and slowly mend, but you cannot bite.' },
  ink:        { name: 'Ink Cloud',      passive: false, cd: 12, dur: 3.5, color: '#8a93b8', desc: 'Vanish in a cloud of ink — prey and hunters alike lose all track of you while it lingers.' },
  grasp:      { name: 'Grasp',          passive: false, cd: 10, dur: 0,   color: '#c98ae0', desc: 'Lash out an arm — seize the nearest animal, drag it close, crush it and leave it reeling.' },
  ram:        { name: 'Ram',            passive: false, cd: 9,  dur: 0.55,color: '#ffb36a', desc: 'A shell-first charge that batters everything in your path aside.' },
  filter:     { name: 'Filter Feed',    passive: true,  cd: 0,  dur: 0,   color: '#9fe0b0', desc: 'Ciliary filter feeding — food drifts to you from much farther away and nourishes you more.' },
  impale:     { name: 'Impale',         passive: false, cd: 11, dur: 0,   color: '#ffd27a', desc: 'A skewering lunge of the claws — heavy damage that leaves prey reeling.' },
  crush:      { name: 'Crush',          passive: false, cd: 12, dur: 0,   color: '#ff8a5e', desc: 'The guillotine bite — one devastating shear in front of you that staggers even the great.' },
  rebirth:    { name: 'Colony Rebirth', passive: true,  cd: 0,  dur: 0,   color: '#a0ffd8', desc: 'A colony never truly dies — once per life, a killing blow leaves enough survivors to rebuild you.' },
  bloodscent: { name: 'Blood Scent',    passive: true,  cd: 0,  dur: 0,   color: '#ff7a8a', desc: 'Taste blood in the water — wounded prey takes far heavier bites, and every kill mends you.' },
  venom:      { name: 'Venom',          passive: true,  cd: 0,  dur: 0,   color: '#b0e05e', desc: 'Nematocyst-laced bites — everything you sting keeps burning after you let go.' },
  camo:       { name: 'Chromatophores', passive: true,  cd: 0,  dur: 0,   color: '#9bb8c8', desc: 'Skin that mimics the sea itself — other animals must come twice as close to notice you.' },
  whirlpool:  { name: 'Whirlpool',      passive: false, cd: 15, dur: 2.6, color: '#6fd0e8', desc: 'Spin the siphon into a raging vortex that drags the sea itself toward you and grinds it.' },
  // --- land powers ---
  pounce:     { name: 'Pounce',    passive: false, cd: 8,  dur: 0,   color: '#ffb04e', desc: 'Leap onto prey ahead — a heavy landing that wounds and knocks down whatever you hit.' },
  burrow:     { name: 'Burrow',    passive: false, cd: 13, dur: 2.4, color: '#c79a5e', desc: 'Dig underground — untouchable and quick, but unable to bite until you surface.' },
  stomp:      { name: 'Stomp',     passive: false, cd: 10, dur: 0,   color: '#e0a060', desc: 'Slam the ground — a shockwave that damages, staggers and hurls back everything around you.' },
  tailsweep:  { name: 'Tail Sweep',passive: false, cd: 9,  dur: 0,   color: '#9fd0a0', desc: 'Whip your tail in a full circle, battering every animal near you off their feet.' },
  sprint:     { name: 'Sprint',    passive: false, cd: 8,  dur: 3,   color: '#9ce0a0', desc: 'A bounding land-sprint — a burst of much greater speed and acceleration.' },
  regen:      { name: 'Regenerate',passive: true,  cd: 0,  dur: 0,   color: '#8affb0', desc: 'Amphibian regrowth — you knit wounds back together quickly, even mid-fight.' },
  thickhide:  { name: 'Thick Hide',passive: true,  cd: 0,  dur: 0,   color: '#c9a06a', desc: 'Cornified armored skin — every blow that lands on you is blunted.' },
  bastion:    { name: 'Living Bastion', passive: true, cd: 0, dur: 0, color: '#d6ad67', desc: 'Interlocked shell plates permanently blunt incoming damage.' },
  ampullae:   { name: 'Electric Sense', passive: true, cd: 0, dur: 0, color: '#7de4e8', desc: 'Sense muscle impulses before prey moves, granting an extra chance to evade attacks.' },
  hypervenom: { name: 'Venom Reservoir', passive: true, cd: 0, dur: 0, color: '#57e6b1', desc: 'Enlarged toxin reservoirs make every bite inflict a stronger, longer-burning venom.' },
  hookarms:   { name: 'Hooked Arms', passive: true, cd: 0, dur: 0, color: '#e48ddb', desc: 'Long hook-lined arms increase the reach and force of every basic attack.' },
  airbreath:  { name: 'Air Breathing', passive: true, cd: 0, dur: 0, color: '#9edbb2', desc: 'Efficient lungs keep oxygen flowing ashore, steadily restoring health even during combat.' },
  websnare:   { name: 'Silk Snare', passive: false, cd: 11, dur: 0, color: '#d9e6df', desc: 'Cast adhesive silk around nearby animals, rooting prey and heavily slowing bosses.' },
  silksense:  { name: 'Silk Sense', passive: true, cd: 0, dur: 0, color: '#e8cbd8', desc: 'Read vibrations through silk and ground contact, granting an extra chance to evade attacks.' },
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
  tiktaalik: ['pounce', 'regen'], ichthyostega: ['pounce', 'regen', 'tailsweep'], eryops: ['frenzy', 'pounce', 'thickhide'],
  kampecaris: ['burrow', 'thickhide'], arthropleura: ['stomp', 'enroll', 'thickhide'], pulmonoscorpius: ['impale', 'stomp', 'sprint'],
  mudfin_strider: ['burst', 'regen'], reedscale_stalker: ['pounce', 'regen', 'tailsweep'],
  gillrunner: ['sprint', 'pounce', 'ampullae'], tide_hunter: ['frenzy', 'pounce', 'ampullae'], bog_tide_hunter: ['bloodscent', 'pounce', 'regen'],
  acanthostega: ['regen', 'pounce'], hynerpeton_player: ['pounce', 'tailsweep', 'regen'],
  elpistostege: ['airbreath', 'tailsweep'], tulerpeton: ['airbreath', 'pounce', 'sprint'],
  metaxygnathus: ['crush', 'pounce', 'airbreath'], crassigyrinus: ['crush', 'regen', 'thickhide'],
  pneumodesmus: ['burrow', 'thickhide'], devonian_trigonotarbid: ['pounce', 'burrow', 'thickhide'], devonian_scorpion: ['impale', 'burrow', 'thickhide'],
  rhyniella: ['evasion', 'burrow'], attercopus: ['websnare', 'evasion', 'venom'],
  gilboa_arachnid: ['websnare', 'silksense', 'venom'], eophrynus: ['websnare', 'bastion', 'venom'],
  shore_polyp: ['nettle', 'bloom'], walking_medusa: ['bloom', 'nettle'], grove_anemone: ['shock', 'bloom', 'nettle'], storm_jelly: ['shock', 'bloom', 'venom'], coal_colony: ['rebirth', 'shock', 'venom'],
  mud_octopus: ['camo', 'grasp'], lung_octopus: ['grasp', 'camo'], grove_cephalopod: ['ink', 'grasp', 'camo'], canopy_kraken: ['grasp', 'ink', 'sprint'], coal_kraken: ['grasp', 'camo', 'sprint'],
};

/* Maps a duration-based ability to the Player timer field that tracks it
   (used by the HUD to show the "active" state). */
export const ACTIVE_TIMER = { harden: 'shieldT', enroll: 'enrollT', burst: 'burstT', frenzy: 'frenzyT', bloom: 'bloomT', withdraw: 'withdrawT', ink: 'stealthT', ram: 'ramT', whirlpool: 'vortexT', burrow: 'burrowT', sprint: 'sprintT' };

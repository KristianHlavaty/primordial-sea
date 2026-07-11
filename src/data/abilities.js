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
};

/* Which powers each player form carries (length grows with tier; capped at 3). */
export const ABILITY_SETS = {
  protocell: ['engulf'], arthropod_larva: ['harden'], chordate_larva: ['burst'], cnidarian_polyp: ['bloom'],
  trilobite: ['harden', 'enroll'], anomalocarid: ['frenzy', 'harden'], swift_fish: ['burst', 'evasion'],
  jawed_fish: ['frenzy', 'evasion'], medusa: ['shock', 'nettle'],
  sea_scorpion: ['harden', 'enroll', 'barbs'], spiny_trilobite: ['harden', 'enroll', 'barbs'],
  predator_fish: ['burst', 'frenzy', 'evasion'], giant_medusa: ['shock', 'bloom', 'nettle'],
};

/* Maps a duration-based ability to the Player timer field that tracks it
   (used by the HUD to show the "active" state). */
export const ACTIVE_TIMER = { harden: 'shieldT', enroll: 'enrollT', burst: 'burstT', frenzy: 'frenzyT', bloom: 'bloomT' };

/* Collectible items and weapons. The base pool fits the prehistoric world; fun mode adds
   deliberately anachronistic modern weapons. Combat logic
   lives in engine/systems/items.js and both HUD/world art read this catalog. */
export const ITEMS = {
  bone_club: {
    name: 'Bone Club', icon: 'club', color: '#e6c996', modern: false, uses: 10, cooldown: 0.75,
    desc: 'A heavy close-range sweep that sends enemies flying.', kind: 'melee', damage: 75, range: 155, spread: 0.86, knockback: 520,
  },
  fossil_spear: {
    name: 'Fossil Spear', icon: 'spear', color: '#9fe7dc', modern: false, uses: 7, cooldown: 0.7,
    desc: 'Throws a fast piercing shard in the direction you face.', kind: 'projectile', damage: 64, speed: 920, life: 1.3, radius: 8, knockback: 340,
  },
  venom_pod: {
    name: 'Venom Pod', icon: 'pod', color: '#b5df61', modern: false, uses: 4, cooldown: 1.25,
    desc: 'Lobs a toxic pod that bursts, poisons and shoves creatures away.', kind: 'grenade', damage: 48, speed: 490, fuse: 0.8, blast: 180, poison: 4.5, shockRadius: 245, shockwave: 400,
  },
  shock_pearl: {
    name: 'Shock Pearl', icon: 'pearl', color: '#82eaff', modern: false, uses: 3, cooldown: 2.8,
    desc: 'Releases a stunning electrical shockwave that blasts enemies back.', kind: 'pulse', damage: 35, blast: 250, stun: 2, shockRadius: 285, shockwave: 620,
  },
  ak47: {
    name: 'AK-47', icon: 'rifle', color: '#ffbd69', modern: true, uses: 30, cooldown: 0.13,
    desc: 'Rapid, long-range rifle fire. Completely evolutionarily inaccurate.', kind: 'hitscan', damage: 35, range: 1020, spread: 0.025,
  },
  shotgun: {
    name: 'Shotgun', icon: 'shotgun', color: '#ff9f7b', modern: true, uses: 8, cooldown: 0.9,
    desc: 'A brutal short-range blast that strikes and launches several targets.', kind: 'cone', damage: 115, range: 365, spread: 0.52, knockback: 680,
  },
  grenade: {
    name: 'Grenade', icon: 'grenade', color: '#a9cf78', modern: true, uses: 3, cooldown: 1.35,
    desc: 'A timed explosive with a fiery blast and powerful pressure wave.', kind: 'grenade', damage: 165, speed: 530, fuse: 1.1, blast: 300, shockRadius: 390, shockwave: 720,
  },
  rocket_launcher: {
    name: 'Rocket Launcher', icon: 'rocket', color: '#ff6575', modern: true, uses: 2, cooldown: 1.7,
    desc: 'Launches an impact rocket with an enormous fiery shockwave.', kind: 'rocket', damage: 225, speed: 760, life: 1.9, blast: 285, radius: 11, shockRadius: 410, shockwave: 880,
  },
  orbital_strike: {
    name: 'Orbital Strike', icon: 'orbital', color: '#ff58e6', modern: true, uses: 1, cooldown: 2.5,
    desc: 'Marks the ground for a delayed orbital laser with catastrophic impact.', kind: 'orbital', damage: 480, range: 620,
    delay: 1.45, beamLife: 1.05, blast: 340, shockRadius: 520, shockwave: 1200,
  },
  shield_generator: {
    name: 'Force Field', icon: 'shield', color: '#62d9ff', modern: true, uses: 1, cooldown: 1,
    desc: 'Projects a powerful energy shield until it breaks or 20 seconds pass.', kind: 'shield',
    duration: 20, shieldPct: 1.15, spawnWeight: 1.25,
  },
  black_hole_generator: {
    name: 'Black Hole', icon: 'blackhole', color: '#b66cff', modern: true, rare: true, uses: 1, cooldown: 2.5,
    desc: 'Throws a rare generator that arms, collapses space and drags enemies into a damaging singularity.', kind: 'black_hole',
    speed: 500, delay: 1.8, duration: 6, radius: 12, field: 430, damage: 36, pull: 980, spawnWeight: 0.6,
  },
  underwater_mine: {
    name: 'Underwater Mine', icon: 'mine', color: '#62e4f5', modern: true, waterOnly: true, uses: 2, cooldown: 1.4,
    desc: 'Deploys an anchored proximity mine that arms after a short delay and unleashes a crushing pressure wave.', kind: 'mine',
    speed: 330, armDelay: 1.35, duration: 24, radius: 18, triggerRadius: 125,
    damage: 210, blast: 250, shockRadius: 380, shockwave: 860, spawnWeight: 0.75,
  },
  vehicle_torpedo: {
    name: 'Torpedo', icon: 'torpedo', color: '#72e7ff', modern: true, vehicleOnly: true, uses: 0, cooldown: 0.82,
    desc: 'A submarine-launched homing-free torpedo with a crushing underwater pressure wave.', kind: 'rocket',
    damage: 185, speed: 720, life: 3.2, blast: 205, radius: 13, shockRadius: 305, shockwave: 720,
  },
  vehicle_missile: {
    name: 'Attack Missile', icon: 'missile', color: '#ffad55', modern: true, vehicleOnly: true, uses: 0, cooldown: 0.48,
    desc: 'A fast helicopter missile that detonates on impact.', kind: 'rocket',
    damage: 155, speed: 920, life: 2.4, blast: 180, radius: 11, shockRadius: 270, shockwave: 660,
  },
};

export const NATURAL_ITEMS = Object.keys(ITEMS).filter(id => !ITEMS[id].modern && !ITEMS[id].vehicleOnly);
export const MODERN_ITEMS = Object.keys(ITEMS).filter(id => ITEMS[id].modern && !ITEMS[id].vehicleOnly);
export const ITEM_KEYS = ['Q', 'E', 'F'];
export const ITEM_SLOT_COUNT = ITEM_KEYS.length;

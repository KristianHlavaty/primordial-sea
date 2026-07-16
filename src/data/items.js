/* Multiplayer collectible weapons. The base pool fits the prehistoric world;
   fun-mode rooms add deliberately anachronistic modern weapons. Combat logic
   lives in engine/systems/items.js and both HUD/world art read this catalog. */
export const ITEMS = {
  bone_club: {
    name: 'Bone Club', icon: 'club', color: '#e6c996', modern: false, uses: 10, cooldown: 0.75,
    desc: 'A heavy close-range sweep that knocks enemies away.', kind: 'melee', damage: 68, range: 145, spread: 0.82, knockback: 430,
  },
  fossil_spear: {
    name: 'Fossil Spear', icon: 'spear', color: '#9fe7dc', modern: false, uses: 7, cooldown: 0.7,
    desc: 'Throws a fast piercing shard in the direction you face.', kind: 'projectile', damage: 58, speed: 880, life: 1.25, radius: 7,
  },
  venom_pod: {
    name: 'Venom Pod', icon: 'pod', color: '#b5df61', modern: false, uses: 4, cooldown: 1.25,
    desc: 'Lobs a toxic pod that bursts and poisons creatures.', kind: 'grenade', damage: 42, speed: 470, fuse: 0.8, blast: 165, poison: 4,
  },
  shock_pearl: {
    name: 'Shock Pearl', icon: 'pearl', color: '#82eaff', modern: false, uses: 3, cooldown: 2.8,
    desc: 'Releases a stunning electrical pulse around you.', kind: 'pulse', damage: 30, blast: 225, stun: 1.8,
  },
  ak47: {
    name: 'AK-47', icon: 'rifle', color: '#ffbd69', modern: true, uses: 30, cooldown: 0.13,
    desc: 'Rapid, long-range rifle fire. Completely evolutionarily inaccurate.', kind: 'hitscan', damage: 32, range: 980, spread: 0.025,
  },
  shotgun: {
    name: 'Shotgun', icon: 'shotgun', color: '#ff9f7b', modern: true, uses: 8, cooldown: 0.9,
    desc: 'A brutal short-range cone that can strike several targets.', kind: 'cone', damage: 104, range: 340, spread: 0.5, knockback: 520,
  },
  grenade: {
    name: 'Grenade', icon: 'grenade', color: '#a9cf78', modern: true, uses: 3, cooldown: 1.35,
    desc: 'A timed explosive with a large damage radius.', kind: 'grenade', damage: 150, speed: 520, fuse: 1.1, blast: 270,
  },
  rocket_launcher: {
    name: 'Rocket Launcher', icon: 'rocket', color: '#ff6575', modern: true, uses: 2, cooldown: 1.7,
    desc: 'Launches an impact rocket with an enormous explosion.', kind: 'rocket', damage: 205, speed: 720, life: 1.8, blast: 245, radius: 10,
  },
};

export const NATURAL_ITEMS = Object.keys(ITEMS).filter(id => !ITEMS[id].modern);
export const MODERN_ITEMS = Object.keys(ITEMS).filter(id => ITEMS[id].modern);
export const ITEM_KEYS = ['Q', 'E', 'F'];
export const ITEM_SLOT_COUNT = ITEM_KEYS.length;

/* Fun-mode vehicles are stage-specific world objects, not inventory items.
   The host owns their movement, armor and weapon cooldowns. */
export const VEHICLES = {
  submarine: {
    name: 'Attack Submarine', weaponName: 'Torpedoes', projectile: 'vehicle_torpedo',
    color: '#58d6e8', accent: '#c4fbff', radius: 48, hp: 620,
    accel: 1050, maxSpeed: 345, turn: 6.2, drag: 1.75, duration: 20,
  },
  helicopter: {
    name: 'Attack Helicopter', weaponName: 'Missiles', projectile: 'vehicle_missile',
    color: '#8fa665', accent: '#ffd06a', radius: 52, hp: 520,
    accel: 1220, maxSpeed: 410, turn: 7.2, drag: 1.65, duration: 20,
  },
};

export const vehicleForStage = stage => stage === 'sea' ? 'submarine' : 'helicopter';

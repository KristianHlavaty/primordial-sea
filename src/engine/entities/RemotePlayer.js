/* A player controlled by someone else, simulated on the HOST. It is a normal
   Player in every way (stats, bite, taking hits, leveling) except that its
   movement/bite come from `this.input` — the latest packet that player's
   browser sent — instead of the local keyboard/mouse.

   Only the host creates these. Clients render remote players as plain
   interpolated objects rebuilt from snapshots (see engine/mp.js). */
import { Player } from './Player.js';
import { rand } from '../../core/math.js';

export class RemotePlayer extends Player {
  constructor(speciesId, world, meta) {
    super(speciesId, null, world);
    this.connId = meta.connId;
    this.name = meta.name || 'Player';
    this.color = meta.color || '#8affd0';
    this.input = { tx: 0, ty: 0, moving: false, bite: false };
    // spread arrivals out so players don't stack on the exact centre
    this.x = world.W * (0.35 + rand(0, 0.3));
    this.y = world.H * (0.35 + rand(0, 0.3));
  }

  steer() { const i = this.input; return { tx: i.tx || 0, ty: i.ty || 0, moving: !!i.moving }; }
  wantsBite() { return !!this.input.bite; }
}

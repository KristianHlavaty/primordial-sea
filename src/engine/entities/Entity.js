/* Base class for everything that swims: position, velocity, facing,
   drag-based integration and soft world-edge bounce. */
import { hyp } from '../../core/math.js';

export class Entity {
  constructor(x = 0, y = 0) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = 0; this.faceTarget = 0;
    this.radius = 10;
  }

  /* Apply drag, clamp speed to `cap` (defaults to maxSpeed) and move,
     bouncing softly off the world edges. `world` provides W/H. */
  integrate(world, dt, drag, cap) {
    world.componentSystems.integrate(this, world, dt, drag, cap);
  }

  /* Impulse pushing this entity directly away from a point. */
  knockbackFrom(fromx, fromy, force) {
    const dx = this.x - fromx, dy = this.y - fromy, d = hyp(dx, dy) || 1;
    this.vx += dx / d * force; this.vy += dy / d * force;
  }
}

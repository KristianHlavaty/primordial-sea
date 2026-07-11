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
    cap = cap || this.maxSpeed || 99999;
    this.vx *= Math.exp(-dt * drag); this.vy *= Math.exp(-dt * drag);
    const sp = hyp(this.vx, this.vy);
    if (sp > cap) { this.vx = this.vx / sp * cap; this.vy = this.vy / sp * cap; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > world.W - this.radius) { this.x = world.W - this.radius; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy) * 0.3; }
    if (this.y > world.H - this.radius) { this.y = world.H - this.radius; this.vy = -Math.abs(this.vy) * 0.3; }
  }

  /* Impulse pushing this entity directly away from a point. */
  knockbackFrom(fromx, fromy, force) {
    const dx = this.x - fromx, dy = this.y - fromy, d = hyp(dx, dy) || 1;
    this.vx += dx / d * force; this.vy += dy / d * force;
  }
}

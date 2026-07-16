/* Shared visual-feedback helpers: particle bursts and floating combat text. */
import { rand, TAU } from '../../core/math.js';

/* Radial particle burst at (x,y). Oldest particles are recycled past the cap. */
export function burst(game, x, y, color, n, spd) {
  if (game.backgrounded) return;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    if (game.particles.length > 320) game.particles.shift();
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, size: rand(1.5, 4), color });
  }
}

/* Floating damage/heal text; silently dropped when too many are alive. */
export function addFloater(game, f) {
  if (!game.backgrounded && game.floaters.length < 70) game.floaters.push(f);
}

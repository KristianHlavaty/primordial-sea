/* Shared visual-feedback helpers: particle bursts and floating combat text. */
import { rand, TAU } from '../../core/math.js';
import { GameEvents } from '../events.js';

/* Radial particle burst at (x,y). Oldest particles are recycled past the cap. */
export function burst(game, x, y, color, n, spd) {
  if (game.backgrounded) return;
  game.events?.emit(GameEvents.FX_BURST_CREATED, { x, y, color, count: n, speed: spd });
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    if (game.particles.length > 320) game.particles.shift();
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, size: rand(1.5, 4), color });
  }
}

/* Floating damage/heal text; silently dropped when too many are alive. */
export function addFloater(game, f) {
  if (!game.backgrounded && game.floaters.length < 70) {
    game.floaters.push(f); game.events?.emit(GameEvents.FX_FLOATER_CREATED, { ...f });
  }
}

/* Camera impact belongs to the player who caused it. On the authoritative
   multiplayer host, remote players receive a tiny sequenced event in their
   next snapshot instead of shaking the host's camera. */
export function shakeForPlayer(game, actor, amount) {
  if (!game || !actor || !(amount > 0)) return;
  if (game.mp && game.mp.role === 'host' && actor !== game.player) {
    actor.cameraShakeSeq = (actor.cameraShakeSeq || 0) + 1;
    actor.cameraShakePower = amount;
    game.events?.emit(GameEvents.FX_SHAKE_APPLIED, { entity: game.componentSystems?.registry?.entityFor(actor) || null, amount, remote: true });
    return;
  }
  game.shake = Math.min(22, game.shake + amount);
  game.events?.emit(GameEvents.FX_SHAKE_APPLIED, { entity: game.componentSystems?.registry?.entityFor(actor) || null, amount, remote: false });
}

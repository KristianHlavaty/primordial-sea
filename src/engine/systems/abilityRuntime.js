/* Runtime mechanics shared by the richer active and passive abilities.
   Ability activation lives in abilities.js; this module advances delayed
   attacks, persistent fields, carried targets and visible passive meters. */
import { clamp, hyp, rand } from '../../core/math.js';
import { burst, shakeForPlayer } from './effects.js';

export const abilityBody = target => target && (target.vehicle || target);

export function abilityTargets(game, owner) {
  const result = game.creatures.slice();
  if (game.mp && game.mp.role === 'host') {
    for (const player of game.allPlayers()) {
      if (player !== owner && player && player.deadT <= 0 && player.spawnProtT <= 0 && !player.mpInvincible && !(player.mpEvolveChoices && player.mpEvolveChoices.length)) result.push(player);
    }
  }
  return result;
}

export function abilityHit(game, owner, target, damage, fromX = owner.x, fromY = owner.y) {
  if (!target || target.hp <= 0) return false;
  if (target.speciesId) target.takeHit(game, damage, fromX, fromY, owner);
  else target.takeDamage(game, damage, fromX, fromY, true);
  return target.hp > 0;
}

const targetRadius = target => {
  const body = abilityBody(target);
  return body ? (body.radius || target.radius || 12) : 12;
};

function radialTargets(game, owner, x, y, radius) {
  return abilityTargets(game, owner).filter(target => {
    const body = abilityBody(target);
    return hyp(body.x - x, body.y - y) <= radius + targetRadius(target);
  });
}

export function releaseShellEnergy(game, player, kind = 'withdraw') {
  const storedField = kind === 'harden' ? 'hardenStored' : 'withdrawStored';
  const stored = player[storedField] || 0; player[storedField] = 0;
  if (kind === 'harden') player.hardenActive = 0;
  const radius = player.radius + 105, damage = Math.max(player.species.stats.dmg * player.atkMul * .55, stored * .42);
  for (const target of radialTargets(game, player, player.x, player.y, radius)) {
    const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy) || 1;
    abilityHit(game, player, target, damage, player.x, player.y);
    const force = (kind === 'harden' ? 520 : 400) * (target.boss ? .35 : 1);
    body.vx += dx / d * force; body.vy += dy / d * force;
  }
  const color = kind === 'harden' ? '#9fe8ff' : '#e8c98a';
  game.fx.push({ x: player.x, y: player.y, t: 0, max: .58, R: radius, color, dir: 'out', width: 7 });
  burst(game, player.x, player.y, color, 24 + Math.min(24, stored * .08), 300);
  shakeForPlayer(game, player, Math.min(8, 3 + stored * .02));
}

export function emergeBurrow(game, player) {
  if (!player.burrowActive) return;
  player.burrowActive = 0; player.burrowT = 0;
  const radius = player.radius + 95, damage = player.species.stats.dmg * player.atkMul * 1.35;
  for (const target of radialTargets(game, player, player.x, player.y, radius)) {
    const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy) || 1;
    abilityHit(game, player, target, damage, player.x, player.y);
    if (!target.boss) target.stunT = Math.max(target.stunT || 0, 1.1);
    body.vx += dx / d * (target.boss ? 180 : 560); body.vy += dy / d * (target.boss ? 180 : 560);
  }
  game.fx.push({ x: player.x, y: player.y, t: 0, max: .6, R: radius, color: '#c79a5e', dir: 'out', width: 7 });
  burst(game, player.x, player.y, '#8a6037', 34, 330); shakeForPlayer(game, player, 7);
}

export function applyVenomStacks(game, owner, target, power = 1) {
  if (!target || target.hp <= 0) return;
  target.venomStacks = Math.min(3, (target.venomStacks || 0) + 1);
  target.venomMarkT = 6; target.poisonT = Math.max(target.poisonT || 0, 4 + power);
  target.poisonOwner = owner;
  target.poisonDps = Math.max(target.poisonDps || 0, owner.species.stats.dmg * owner.atkMul * (.22 + power * .08));
  if (target.venomStacks < 3) return;
  target.venomStacks = 0; target.venomMarkT = 0;
  const body = abilityBody(target), radius = 115;
  burst(game, body.x, body.y, '#81ef85', 28, 260);
  game.fx.push({ x: body.x, y: body.y, t: 0, max: .55, R: radius, color: '#72e68b', dir: 'out', width: 5 });
  for (const nearby of radialTargets(game, owner, body.x, body.y, radius)) {
    abilityHit(game, owner, nearby, owner.species.stats.dmg * owner.atkMul * (.65 + power * .2), body.x, body.y);
    nearby.poisonT = Math.max(nearby.poisonT || 0, 3.5); nearby.poisonDps = Math.max(nearby.poisonDps || 0, target.poisonDps * .7);
  }
}

export function biteAbilityMultiplier(player, target) {
  let multiplier = 1;
  if (player.camoCharge >= .9) multiplier *= 1.65;
  if (player.sailHeat >= .8) multiplier *= 1.4;
  if ((target.armorBreakT || 0) > 0) multiplier *= 1.22;
  if ((target.vulnerableT || 0) > 0) multiplier *= 1.15;
  return multiplier;
}

export function afterAbilityBite(game, player, target) {
  if (!target) return;
  if (player.camoCharge >= .9) {
    player.camoCharge = 0; player.camoFlashT = .55;
    burst(game, target.x, target.y, '#a9d8e8', 16, 190);
  }
  if (player.sailHeat >= .8) {
    player.sailHeat = 0; burst(game, target.x, target.y, '#ffad62', 18, 210);
  }
  if (player.hasAbility('venom') || player.hasAbility('hypervenom')) applyVenomStacks(game, player, target, player.hasAbility('hypervenom') ? 1.7 : 1);
  if (player.hasAbility('hookarms') && target.hp > 0) {
    player.hookTarget = target; player.hookT = target.boss ? .35 : .75;
  }
  if ((player.barbCharge || 0) > 0) {
    const charges = player.barbCharge; player.barbCharge = 0;
    const body = abilityBody(target), radius = 85 + charges * 12;
    for (const nearby of radialTargets(game, player, body.x, body.y, radius)) if (nearby !== target)
      abilityHit(game, player, nearby, player.species.stats.dmg * player.atkMul * (.25 + charges * .14), body.x, body.y);
    burst(game, body.x, body.y, '#ffb060', 10 + charges * 5, 190);
  }
  for (const web of game.webs) {
    if (!web.abilityWeb || web.owner !== player) continue;
    if (hyp(target.x - web.x, target.y - web.y) < web.r + targetRadius(target)) {
      if (target.boss) target.slowT = Math.max(target.slowT || 0, 2);
      else target.stunT = Math.max(target.stunT || 0, 1.25);
      web.pulseT = .45;
    }
  }
}

function resolveCrush(game, player) {
  const angle = player.crushAngle, fx = Math.cos(angle), fy = Math.sin(angle);
  const reach = player.radius + player.species.stats.reach + 50;
  for (const target of abilityTargets(game, player)) {
    const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy);
    if (d > reach + targetRadius(target) || (dx * fx + dy * fy) / (d || 1) < .12) continue;
    let damage = player.species.stats.dmg * player.atkMul * 3.1;
    if (!target.boss && target.hp < target.maxHp * .2) damage = Math.max(damage, target.hp + 1);
    abilityHit(game, player, target, damage, player.x, player.y);
    target.armorBreakT = Math.max(target.armorBreakT || 0, target.boss ? 5 : 3);
    body.vx += fx * 340; body.vy += fy * 340;
    burst(game, body.x, body.y, '#ff8a5e', 22, 260);
  }
  game.fx.push({ x: player.x + fx * player.radius, y: player.y + fy * player.radius, t: 0, max: .5, R: reach, color: '#ff8a5e', dir: 'out', width: 7 });
  shakeForPlayer(game, player, 7);
}

function resolveLeap(game, player, kind) {
  const radius = player.radius + (kind === 'dive' ? 120 : 85);
  const damage = player.species.stats.dmg * player.atkMul * (kind === 'dive' ? 2.15 : 1.8);
  let pin = null, pinD = Infinity;
  for (const target of radialTargets(game, player, player.x, player.y, radius)) {
    const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy) || 1;
    abilityHit(game, player, target, damage, player.x, player.y);
    body.vx += dx / d * (target.boss ? 180 : 420); body.vy += dy / d * (target.boss ? 180 : 420);
    if (!target.boss && d < pinD) { pin = target; pinD = d; }
  }
  if (kind === 'pounce' && pin && pin.hp > 0) { pin.stunT = Math.max(pin.stunT || 0, 1.35); player.pinnedTarget = pin; player.pinT = .7; }
  game.fx.push({ x: player.x, y: player.y, t: 0, max: .6, R: radius, color: kind === 'dive' ? '#ffd27a' : '#ffb04e', dir: 'out', width: 7 });
  burst(game, player.x, player.y, kind === 'dive' ? '#ffe9a8' : '#d69b4c', 32, 330); shakeForPlayer(game, player, kind === 'dive' ? 8 : 6);
}

function updateCarriedTarget(player, target, distance) {
  if (!target || target.hp <= 0) return;
  const body = abilityBody(target), x = player.x + Math.cos(player.angle) * distance, y = player.y + Math.sin(player.angle) * distance;
  body.x = x; body.y = y; body.vx = player.vx; body.vy = player.vy;
  if (body !== target) { target.x = x; target.y = y; target.vx = body.vx; target.vy = body.vy; }
}

export function updateAbilityRuntime(game, player, dt) {
  const speed = hyp(player.vx, player.vy), stats = player.species.stats;
  const tick = field => { player[field] = Math.max(0, (player[field] || 0) - dt); return player[field]; };
  tick('engulfT'); tick('shockVisualT'); tick('evasionFlashT'); tick('evasionBoostT'); tick('camoFlashT'); tick('rebirthT'); tick('pinT');
  player.senseCd = Math.max(0, (player.senseCd || 0) - dt);
  player.regenDelay = Math.max(0, (player.regenDelay || 0) - dt);
  player.filterComboT = Math.max(0, (player.filterComboT || 0) - dt);
  if (player.filterComboT <= 0) player.filterCombo = 0;
  player.venomMarkT = Math.max(0, (player.venomMarkT || 0) - dt);
  if (player.venomMarkT <= 0) player.venomStacks = 0;

  if (player.hardenActive && (!(player.shield > 0) || !(player.shieldT > 0))) releaseShellEnergy(game, player, 'harden');

  if ((player.engulfSwallowT || 0) > 0) {
    player.engulfSwallowT -= dt;
    if (player.engulfTarget) updateCarriedTarget(player, player.engulfTarget, player.radius + targetRadius(player.engulfTarget) * .35);
    if (player.engulfSwallowT <= 0) {
      if (player.engulfTarget && player.engulfTarget.hp > 0) {
        const body = abilityBody(player.engulfTarget); body.vx = Math.cos(player.angle) * 760; body.vy = Math.sin(player.angle) * 760;
        abilityHit(game, player, player.engulfTarget, stats.dmg * player.atkMul * .8, player.x, player.y);
      }
      player.engulfTarget = null;
    }
  }

  if ((player.inkCloudT || 0) > 0) {
    player.inkCloudT -= dt;
    if (hyp(player.x - player.inkX, player.y - player.inkY) < 175) player.stealthT = Math.max(player.stealthT, .14);
    player.decoyX += Math.cos(player.decoyAngle) * 170 * dt; player.decoyY += Math.sin(player.decoyAngle) * 170 * dt;
  }

  if (player.vortexActive && !(player.vortexT > 0) && !player.vortexReleased) {
    player.vortexReleased = 1; player.vortexActive = 0;
    const x = player.vortexX || player.x, y = player.vortexY || player.y, radius = 270;
    for (const target of radialTargets(game, player, x, y, radius)) {
      const body = abilityBody(target), dx = body.x - x, dy = body.y - y, d = hyp(dx, dy) || 1;
      abilityHit(game, player, target, stats.dmg * player.atkMul * .72, x, y);
      body.vx += dx / d * (target.boss ? 260 : 820); body.vy += dy / d * (target.boss ? 260 : 820);
    }
    game.fx.push({ x, y, t: 0, max: .72, R: radius, color: '#9eeeff', dir: 'out', width: 8 });
    burst(game, x, y, '#b7f4ff', 36, 360); shakeForPlayer(game, player, 7);
  }

  if ((player.crushT || 0) > 0) {
    player.crushT -= dt;
    if (player.crushT <= 0) resolveCrush(game, player);
  }

  if ((player.impaleT || 0) > 0) {
    player.impaleT -= dt;
    if (player.impaleTarget) updateCarriedTarget(player, player.impaleTarget, player.radius + targetRadius(player.impaleTarget) + 6);
    if (player.impaleTarget && player.impaleTarget.hp > 0) {
      const carried = abilityBody(player.impaleTarget);
      const collision = abilityTargets(game, player).find(target => target !== player.impaleTarget && hyp(abilityBody(target).x - carried.x, abilityBody(target).y - carried.y) < targetRadius(target) + targetRadius(player.impaleTarget));
      if (collision) {
        abilityHit(game, player, collision, stats.dmg * player.atkMul * 1.1, carried.x, carried.y);
        abilityHit(game, player, player.impaleTarget, stats.dmg * player.atkMul * .8, collision.x, collision.y); player.impaleT = 0;
      }
    }
    if (player.impaleT <= 0) player.impaleTarget = null;
  }

  if ((player.leapT || 0) > 0) {
    player.leapT -= dt;
    const progress = clamp(1 - player.leapT / player.leapMax, 0, 1), eased = progress < .5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
    player.x = player.leapStartX + (player.leapX - player.leapStartX) * eased;
    player.y = player.leapStartY + (player.leapY - player.leapStartY) * eased; player.vx = 0; player.vy = 0;
    if (player.leapT <= 0) resolveLeap(game, player, player.leapKind);
  }
  if (player.pinT > 0 && player.pinnedTarget && player.pinnedTarget.hp > 0) {
    updateCarriedTarget(player, player.pinnedTarget, Math.max(2, player.radius * .2));
    player.pinnedTarget.stunT = Math.max(player.pinnedTarget.stunT || 0, .18);
  } else player.pinnedTarget = null;

  if (player.burrowActive && !(player.burrowT > 0)) emergeBurrow(game, player);
  if (player.burrowActive && game.particles.length < 300 && Math.random() < dt * 18)
    game.particles.push({ x: player.x + rand(-player.radius, player.radius), y: player.y + rand(-player.radius, player.radius), vx: rand(-35, 35), vy: rand(-35, 10), life: .5, max: .5, size: rand(3, 7), color: 'rgba(106,78,44,.72)' });

  if ((player.stompT || 0) > 0) {
    player.stompT -= dt;
    const progress = 1 - player.stompT / 1.05;
    const strikeWave = (radius, hitSet, damage, stun) => {
      if (!hitSet) return;
      for (const target of abilityTargets(game, player)) {
        if (hitSet.has(target)) continue;
        const body = abilityBody(target), dx = body.x - player.stompX, dy = body.y - player.stompY, d = hyp(dx, dy);
        if (Math.abs(d - radius) > 28 + targetRadius(target)) continue;
        hitSet.add(target); abilityHit(game, player, target, stats.dmg * player.atkMul * damage, player.stompX, player.stompY);
        if (!target.boss) target.stunT = Math.max(target.stunT || 0, stun);
        const force = target.boss ? 120 : 360; body.vx += dx / (d || 1) * force; body.vy += dy / (d || 1) * force;
      }
    };
    strikeWave(35 + progress * 210, player.stompHit, .48, .7);
    if (progress > .38) strikeWave(35 + (progress - .38) / .62 * 180, player.stompHit2, .72, 1.2);
  }

  if ((player.tailSweepT || 0) > 0) {
    const before = player.tailSweepT; player.tailSweepT -= dt;
    if (before > .34 && player.tailSweepT <= .34) {
      const radius = player.radius + 90;
      for (const target of radialTargets(game, player, player.x, player.y, radius)) {
        const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy) || 1;
        abilityHit(game, player, target, stats.dmg * player.atkMul * .82, player.x, player.y);
        body.vx += dx / d * (target.boss ? 220 : 520); body.vy += dy / d * (target.boss ? 220 : 520);
      }
      for (const projectile of game.itemProjectiles) if (projectile.visual === 'projectile' && projectile.owner !== player && hyp(projectile.x - player.x, projectile.y - player.y) < radius) {
        projectile.vx *= -1.2; projectile.vy *= -1.2; projectile.angle = Math.atan2(projectile.vy, projectile.vx); projectile.owner = player;
        projectile.ownerConn = game.mp ? (player === game.player ? game.mp.self : player.connId) : null;
      }
      shakeForPlayer(game, player, 5);
    }
  }

  if (player.enrollT > 0) {
    if (!player.enrollHit) player.enrollHit = new Set();
    for (const target of abilityTargets(game, player)) {
      if (player.enrollHit.has(target)) continue;
      const body = abilityBody(target), dx = body.x - player.x, dy = body.y - player.y, d = hyp(dx, dy);
      if (d > player.radius * 1.18 + targetRadius(target)) continue;
      player.enrollHit.add(target); const impact = clamp(speed / 700, .55, 1.8);
      abilityHit(game, player, target, stats.dmg * player.atkMul * impact, player.x, player.y);
      body.vx += dx / (d || 1) * 620 * impact; body.vy += dy / (d || 1) * 620 * impact;
      const nx = dx / (d || 1), ny = dy / (d || 1), intoTarget = Math.max(0, player.vx * nx + player.vy * ny);
      const rebound = Math.max(360, intoTarget * 1.38); player.vx -= nx * rebound; player.vy -= ny * rebound;
      burst(game, body.x, body.y, '#ffcf6a', 18, 240);
    }
  } else player.enrollHit = null;

  if (player.sprintT > 0) {
    player.sprintMomentum = clamp((player.sprintMomentum || 0) + dt * (speed > stats.maxSpeed ? .7 : .3), 0, 1);
    if (!player.sprintHit) player.sprintHit = new Set();
    if (player.sprintMomentum > .72) for (const target of abilityTargets(game, player)) {
      if (player.sprintHit.has(target)) continue;
      const body = abilityBody(target), d = hyp(body.x - player.x, body.y - player.y);
      if (d > player.radius + targetRadius(target) + 8) continue;
      player.sprintHit.add(target); abilityHit(game, player, target, stats.dmg * player.atkMul * .7, player.x, player.y);
      body.vx += player.vx * (target.boss ? .12 : .45); body.vy += player.vy * (target.boss ? .12 : .45);
    }
  } else { player.sprintMomentum = Math.max(0, (player.sprintMomentum || 0) - dt * 1.4); player.sprintHit = null; }

  if ((player.hookT || 0) > 0 && player.hookTarget && player.hookTarget.hp > 0) {
    player.hookT -= dt; const body = abilityBody(player.hookTarget), dx = player.x - body.x, dy = player.y - body.y, d = hyp(dx, dy) || 1;
    body.vx += dx / d * (player.hookTarget.boss ? 120 : 520) * dt * 4; body.vy += dy / d * (player.hookTarget.boss ? 120 : 520) * dt * 4;
  } else player.hookTarget = null;

  if (player.hasAbility('camo')) {
    const calm = speed < 24 && game.time - (player.lastHurtT || 0) > 1.2;
    player.camoCharge = clamp((player.camoCharge || 0) + dt * (calm ? .42 : -1.4), 0, 1);
  }
  if (player.hasAbility('thickhide')) {
    player.plateRegenT = Math.max(0, (player.plateRegenT || 0) - dt);
    if (player.plateRegenT <= 0 && (player.armorPlates || 0) < 3) { player.armorPlates = (player.armorPlates || 0) + 1; player.plateRegenT = 5; }
  }
  if (player.hasAbility('bastion')) player.fortify = clamp((player.fortify || 0) + dt * (speed < 28 ? .55 : -1.2), 0, 1);
  if (player.hasAbility('sail')) player.sailHeat = clamp((player.sailHeat || 0) + dt * (game.stage !== 'sea' && speed < stats.maxSpeed * .45 ? .2 : -.08), 0, 1);
  if (player.hasAbility('airbreath') && game.stage !== 'sea' && speed > 45) {
    player.airStride = (player.airStride || 0) + dt;
    if (player.airStride >= 3) { player.airStride = 0; player.hp = Math.min(player.maxHp, player.hp + player.maxHp * .07); burst(game, player.x, player.y, '#b8f0ca', 12, 130); }
  } else player.airStride = Math.max(0, (player.airStride || 0) - dt * .4);

  if ((player.poisonT || 0) > 0) {
    player.poisonT -= dt; player.poisonTick = (player.poisonTick || 0) - dt;
    if (player.poisonTick <= 0) {
      player.poisonTick = .5;
      player.takeHit(game, (player.poisonDps || 0) * .5, player.x, player.y, player.poisonOwner);
    }
    if (player.poisonT <= 0) { player.poisonDps = 0; player.poisonOwner = null; }
  }
}

export function notePlayerDamage(player, damage) {
  player.regenDelay = 2.5;
  if (player.withdrawT > 0) player.withdrawStored = (player.withdrawStored || 0) + damage;
  if (player.hardenActive) player.hardenStored = (player.hardenStored || 0) + damage;
  if (player.hasAbility('barbs')) player.barbCharge = Math.min(3, (player.barbCharge || 0) + 1);
  if (player.hasAbility('thickhide') && (player.armorPlates || 0) > 0) { player.armorPlates--; player.plateRegenT = 5; }
}

export function beginLeap(game, player, kind, distance, duration) {
  const margin = player.radius + 20;
  player.leapKind = kind; player.leapMax = duration; player.leapT = duration;
  player.leapStartX = player.x; player.leapStartY = player.y;
  player.leapX = clamp(player.x + Math.cos(player.angle) * distance, margin, game.W - margin);
  player.leapY = clamp(player.y + Math.sin(player.angle) * distance, margin, game.H - margin);
}

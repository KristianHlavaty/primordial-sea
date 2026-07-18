/* Procedural top-down vehicle art. Kept in canvas code so vehicles inherit the
   game's lighting, camera interpolation and multiplayer snapshot rendering. */
import { VEHICLES } from '../data/vehicles.js';
import { TAU, clamp } from '../core/math.js';
import { shade, withA } from '../core/color.js';

function drawSubmarine(ctx, vehicle, def, time) {
  const hurt = clamp(vehicle.hurt || 0, 0, 1), pulse = .5 + .5 * Math.sin(time * 3.4);
  ctx.save(); ctx.rotate(vehicle.angle);

  ctx.fillStyle = 'rgba(0,8,18,.28)'; ctx.beginPath(); ctx.ellipse(-5, 8, 59, 24, 0, 0, TAU); ctx.fill();
  const glow = ctx.createRadialGradient(15, 0, 2, 0, 0, 75);
  glow.addColorStop(0, withA(def.color, .1 + pulse * .06)); glow.addColorStop(1, withA(def.color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, 78, 42, 0, 0, TAU); ctx.fill();

  // Tail fins and propeller.
  ctx.fillStyle = shade(def.color, -.28); ctx.strokeStyle = shade(def.color, -.48); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-47, -7); ctx.lineTo(-70, -28); ctx.lineTo(-58, -3); ctx.lineTo(-58, 3); ctx.lineTo(-70, 28); ctx.lineTo(-47, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(-65, 0); ctx.rotate(time * 7);
  ctx.strokeStyle = def.accent; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, 8, 0, 15); ctx.stroke(); }
  ctx.restore();

  // Pressure hull.
  const hull = ctx.createLinearGradient(0, -26, 0, 26);
  hull.addColorStop(0, shade(def.color, .32)); hull.addColorStop(.38, def.color); hull.addColorStop(1, shade(def.color, -.42));
  ctx.fillStyle = hurt > 0 && Math.sin(time * 35) > 0 ? '#ffb36d' : hull;
  ctx.strokeStyle = shade(def.color, -.56); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(57, 0); ctx.quadraticCurveTo(44, -25, 3, -25); ctx.quadraticCurveTo(-42, -23, -55, 0); ctx.quadraticCurveTo(-42, 23, 3, 25); ctx.quadraticCurveTo(44, 25, 57, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = withA('#ffffff', .25); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-35, -16); ctx.quadraticCurveTo(5, -28, 41, -11); ctx.stroke();

  // Diving planes, conning tower and periscope.
  ctx.fillStyle = shade(def.color, -.12); ctx.strokeStyle = shade(def.color, -.5);
  ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(17, -39); ctx.lineTo(29, -35); ctx.lineTo(23, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, 19); ctx.lineTo(17, 39); ctx.lineTo(29, 35); ctx.lineTo(23, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade(def.color, .08); ctx.beginPath(); ctx.roundRect(-9, -14, 28, 28, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = def.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(2, -29); ctx.lineTo(11, -29); ctx.stroke();

  // Portholes and bow torpedo doors.
  for (let i = 0; i < 3; i++) {
    const x = -19 + i * 18, light = ctx.createRadialGradient(x - 2, -2, 0, x, 0, 6);
    light.addColorStop(0, '#efffff'); light.addColorStop(.38, def.accent); light.addColorStop(1, '#176273');
    ctx.fillStyle = light; ctx.strokeStyle = '#123944'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 0, 6, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#102d38'; ctx.beginPath(); ctx.arc(44, -7, 4.5, 0, TAU); ctx.arc(44, 7, 4.5, 0, TAU); ctx.fill();
  ctx.restore();

  // Moving bubbles trail behind the hull.
  ctx.fillStyle = withA('#c9fbff', .45);
  for (let i = 0; i < 7; i++) {
    const phase = (time * (1.2 + i * .07) + i * .31) % 1, bx = -Math.cos(vehicle.angle) * (50 + phase * 70), by = -Math.sin(vehicle.angle) * (50 + phase * 70);
    ctx.beginPath(); ctx.arc(bx + Math.sin(i * 2.1) * 8, by + Math.cos(i * 1.7) * 8, 1.5 + (i % 3), 0, TAU); ctx.fill();
  }
}

function drawHelicopter(ctx, vehicle, def, time) {
  const hurt = clamp(vehicle.hurt || 0, 0, 1);
  ctx.save(); ctx.rotate(vehicle.angle);

  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(12, 13, 70, 28, 0, 0, TAU); ctx.fill();
  // Tail boom and stabilizers.
  ctx.fillStyle = shade(def.color, -.2); ctx.strokeStyle = shade(def.color, -.5); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(-70, -6); ctx.lineTo(-77, 0); ctx.lineTo(-70, 6); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-60, -5); ctx.lineTo(-77, -22); ctx.lineTo(-69, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-60, 5); ctx.lineTo(-77, 22); ctx.lineTo(-69, 3); ctx.closePath(); ctx.fill(); ctx.stroke();

  // Missile pylons and loaded missiles.
  ctx.strokeStyle = shade(def.color, -.55); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-5, -16); ctx.lineTo(6, -35); ctx.moveTo(-5, 16); ctx.lineTo(6, 35); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#414b3b'; ctx.strokeStyle = '#20271d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-14, side * 37 - 6, 35, 12, 5); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = def.accent; ctx.beginPath(); ctx.arc(-5 + i * 9, side * 37, 2.2, 0, TAU); ctx.fill(); }
  }

  // Armored fuselage and canopy.
  const body = ctx.createLinearGradient(0, -25, 0, 25);
  body.addColorStop(0, shade(def.color, .25)); body.addColorStop(.5, def.color); body.addColorStop(1, shade(def.color, -.35));
  ctx.fillStyle = hurt > 0 && Math.sin(time * 35) > 0 ? '#ff9b55' : body;
  ctx.strokeStyle = shade(def.color, -.58); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(49, 0); ctx.quadraticCurveTo(35, -25, -10, -22); ctx.quadraticCurveTo(-29, -15, -31, 0); ctx.quadraticCurveTo(-29, 15, -10, 22); ctx.quadraticCurveTo(35, 25, 49, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  const canopy = ctx.createLinearGradient(10, -18, 34, 15); canopy.addColorStop(0, '#d9fbff'); canopy.addColorStop(.3, '#68aeba'); canopy.addColorStop(1, '#173c49');
  ctx.fillStyle = canopy; ctx.strokeStyle = '#18343a'; ctx.beginPath(); ctx.moveTo(42, 0); ctx.quadraticCurveTo(30, -17, 7, -15); ctx.lineTo(7, 15); ctx.quadraticCurveTo(30, 17, 42, 0); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = withA('#ffffff', .5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, -12); ctx.quadraticCurveTo(29, -10, 36, -2); ctx.stroke();

  // Tail rotor spins on top for top-down readability.
  ctx.save(); ctx.translate(-74, 0); ctx.rotate(-time * 13); ctx.strokeStyle = '#d8e5c4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke(); ctx.restore();

  // Main rotor: blurred disk plus crisp rotating blades.
  ctx.fillStyle = 'rgba(205,235,220,.055)'; ctx.beginPath(); ctx.arc(-1, 0, 67, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(-1, 0); ctx.rotate(time * 8.5); ctx.strokeStyle = 'rgba(220,242,228,.48)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-68, 0); ctx.lineTo(68, 0); ctx.moveTo(0, -68); ctx.lineTo(0, 68); ctx.stroke();
  ctx.fillStyle = '#2d3528'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
}

export function drawVehicle(E, vehicle) {
  const def = VEHICLES[vehicle.type]; if (!def) return;
  const ctx = E.ctx, x = vehicle.x - E.cam.x, y = vehicle.y - E.cam.y;
  if (x < -150 || y < -150 || x > E.vw + 150 || y > E.vh + 150) return;
  ctx.save(); ctx.translate(x, y);
  if (vehicle.type === 'submarine') drawSubmarine(ctx, vehicle, def, E.time);
  else drawHelicopter(ctx, vehicle, def, E.time);
  ctx.restore();

  const occupiedBySelf = vehicle.occupant === E.player || (E.mp && String(vehicle.occupantConn) === String(E.mp.self));
  const occupied = !!vehicle.occupant || vehicle.occupantConn != null;
  if (occupied || vehicle.hurt > 0) {
    const width = 90, fraction = clamp(vehicle.hp / (vehicle.maxHp || 1), 0, 1), by = y - vehicle.radius - 24;
    ctx.fillStyle = 'rgba(2,10,14,.85)'; ctx.fillRect(x - width / 2, by, width, 7);
    ctx.fillStyle = fraction > .5 ? '#62e0b1' : fraction > .22 ? '#ffc45c' : '#ff605e'; ctx.fillRect(x - width / 2 + 1, by + 1, (width - 2) * fraction, 5);
    ctx.strokeStyle = withA(def.accent, .55); ctx.lineWidth = 1; ctx.strokeRect(x - width / 2, by, width, 7);
  }

  const distance = E.player ? Math.hypot(vehicle.x - E.player.x, vehicle.y - E.player.y) : Infinity;
  if (occupiedBySelf || (!occupied && !E.player.vehicleType && distance < 190)) {
    const time = Number.isFinite(vehicle.timeLeft) ? `  ·  ${Math.max(0, Math.ceil(vehicle.timeLeft))}s` : '';
    const label = occupiedBySelf ? `V EXIT  ·  CLICK / SPACE ${def.weaponName.toUpperCase()}${time}` : `V ENTER ${def.name.toUpperCase()}${time}`;
    ctx.textAlign = 'center'; ctx.font = '900 11px "Segoe UI",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(label, x, y + vehicle.radius + 30); ctx.fillStyle = def.accent; ctx.fillText(label, x, y + vehicle.radius + 30); ctx.textAlign = 'left';
  }
}

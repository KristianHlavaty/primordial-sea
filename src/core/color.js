/* Color helpers — all creature/plant tinting goes through these. */
import { clamp } from './math.js';

export function hx(h) {
  h = h.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

/* Lighten (amt > 0) or darken (amt < 0) a hex color. */
export function shade(hex, amt) {
  let [r, g, b] = hx(hex);
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* Hex color with alpha, as an rgba() string. */
export function withA(hex, a) {
  const [r, g, b] = hx(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* Randomly perturb each channel by up to ±amt — gives NPCs individual coloring. */
export function jitter(hex, amt) {
  let [r, g, b] = hx(hex);
  const j = () => (Math.random() * 2 - 1) * amt;
  r = clamp(r + j(), 0, 255); g = clamp(g + j(), 0, 255); b = clamp(b + j(), 0, 255);
  return `#${[r, g, b].map(v => (v | 0).toString(16).padStart(2, '0')).join('')}`;
}

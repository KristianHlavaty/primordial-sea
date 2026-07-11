/* A "plan" is the parametric description of a creature's body.
   One renderer (render/drawCreature.js) draws every species from its plan. */
export function P(o) {
  return Object.assign({
    kind: 'fish', len: 16, wid: 9, body: '#6aa6ff', accent: '#d6ecff', glow: null,
    segments: 6, spikes: 0, teeth: false, claws: false, tentacles: 0, sideFlaps: false,
    tail: 1, eyes: 2, legs: 0, stalks: false
  }, o);
}

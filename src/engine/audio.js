/* Tiny WebAudio synth — every game sound is a one-shot pitched beep.
   The AudioContext is created lazily and resumed on the first user gesture
   (Engine.start calls unlock()). */
export class Sfx {
  constructor() { this.ac = null; this.muted = false; }

  unlock() {
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) { /* no audio available — play silently */ }
  }

  play(type) {
    if (this.muted) return;
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = this.ac.currentTime;
      const beep = (f, d, vol, wave, slideTo) => {
        const o = this.ac.createOscillator(), g = this.ac.createGain();
        o.type = wave; o.frequency.setValueAtTime(f, now);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + d);
        g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
        o.connect(g); g.connect(this.ac.destination); o.start(now); o.stop(now + d);
      };
      if (type === 'bite') beep(200, 0.09, 0.05, 'square', 120);
      else if (type === 'eat') beep(480, 0.1, 0.06, 'triangle', 720);
      else if (type === 'plant') beep(360, 0.1, 0.05, 'sine', 520);
      else if (type === 'hurt') beep(160, 0.2, 0.09, 'sawtooth', 70);
      else if (type === 'kill') beep(300, 0.16, 0.07, 'square', 90);
      else if (type === 'evolve') { [330, 440, 554, 740].forEach((f, i) => setTimeout(() => beep(f, 0.25, 0.06, 'triangle', f * 1.3), i * 90)); }
      else if (type === 'egg') beep(520, 0.3, 0.05, 'sine', 300);
      else if (type === 'power') beep(300, 0.14, 0.06, 'triangle', 620);
      else if (type === 'dodge') beep(760, 0.08, 0.045, 'sine', 1180);
      else if (type === 'shieldhit') beep(240, 0.09, 0.05, 'triangle', 380);
    } catch (e) { /* ignore audio errors */ }
  }
}

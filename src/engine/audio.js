/* Tiny WebAudio synth — every game sound is a one-shot pitched beep.
   The AudioContext is created lazily and resumed on the first user gesture
   (Engine.start calls unlock()). */
export class Sfx {
  constructor() { this.ac = null; this.muted = false; this.backgrounded = false; }

  setBackgrounded(value) { this.backgrounded = !!value; }

  unlock() {
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) { /* no audio available — play silently */ }
  }

  play(type) {
    if (this.muted || this.backgrounded) return;
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
      else if (type === 'shot') { beep(185, 0.07, 0.045, 'square', 82); beep(920, 0.035, 0.025, 'triangle', 380); }
      else if (type === 'shotgun') { beep(120, 0.16, 0.09, 'sawtooth', 45); beep(520, 0.07, 0.045, 'square', 110); }
      else if (type === 'rocket') { beep(150, 0.2, 0.055, 'sawtooth', 62); beep(420, 0.08, 0.028, 'triangle', 140); }
      else if (type === 'explosion') { beep(95, 0.48, 0.12, 'sawtooth', 28); beep(210, 0.2, 0.065, 'square', 48); }
      else if (type === 'orbital_lock') { beep(520, 0.38, 0.045, 'sine', 980); beep(260, 0.42, 0.025, 'triangle', 520); }
      else if (type === 'orbital_strike') { beep(1400, 0.72, 0.1, 'sawtooth', 85); beep(88, 0.85, 0.12, 'sawtooth', 28); beep(320, 0.35, 0.07, 'square', 52); }
      else if (type === 'vehicle_enter') { beep(220, 0.18, 0.04, 'square', 440); beep(520, 0.22, 0.035, 'triangle', 760); }
      else if (type === 'vehicle_exit') beep(480, 0.18, 0.035, 'triangle', 190);
      else if (type === 'vehicle_hit') { beep(115, 0.16, 0.055, 'square', 62); beep(540, 0.08, 0.025, 'sawtooth', 170); }
      else if (type === 'vehicle_destroy') { beep(82, 0.65, 0.13, 'sawtooth', 24); beep(260, 0.25, 0.07, 'square', 42); }
      else if (type === 'torpedo') { beep(175, 0.28, 0.055, 'sine', 72); beep(620, 0.08, 0.024, 'triangle', 230); }
      else if (type === 'torpedo_hit') { beep(78, 0.48, 0.11, 'sine', 26); beep(330, 0.18, 0.045, 'square', 68); }
      else if (type === 'missile') { beep(260, 0.16, 0.05, 'sawtooth', 88); beep(700, 0.06, 0.025, 'square', 210); }
      else if (type === 'swing') beep(260, 0.11, 0.04, 'sawtooth', 95);
      else if (type === 'throw') beep(430, 0.08, 0.028, 'triangle', 210);
      else if (type === 'dodge') beep(760, 0.08, 0.045, 'sine', 1180);
      else if (type === 'shieldhit') beep(240, 0.09, 0.05, 'triangle', 380);
    } catch (e) { /* ignore audio errors */ }
  }
}

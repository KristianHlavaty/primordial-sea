import { GameEvents } from '../engine/events.js';

/* Simulation-facing audio port. Legacy gameplay calls remain `game.sfx.play()`
   for now, but those calls publish commands instead of touching WebAudio. */
export class AudioPort {
  constructor(events) {
    this.events = events;
    this._muted = false;
    this.backgrounded = false;
  }

  get muted() { return this._muted; }
  set muted(value) {
    const muted = !!value; if (muted === this._muted) return;
    this._muted = muted;
    this.events.emit(GameEvents.AUDIO_MUTED_CHANGED, { muted });
  }

  play(type) { this.events.emit(GameEvents.AUDIO_PLAY_REQUESTED, { type }); }
  unlock() { this.events.emit(GameEvents.AUDIO_UNLOCK_REQUESTED); }
  setBackgrounded(value) {
    const backgrounded = !!value; if (backgrounded === this.backgrounded) return;
    this.backgrounded = backgrounded;
    this.events.emit(GameEvents.AUDIO_BACKGROUND_CHANGED, { backgrounded });
  }
}

export function attachAudioSubscriber(events, audio) {
  const unsubscribers = [
    events.subscribe(GameEvents.AUDIO_PLAY_REQUESTED, ({ type }) => audio.play(type)),
    events.subscribe(GameEvents.AUDIO_UNLOCK_REQUESTED, () => audio.unlock()),
    events.subscribe(GameEvents.AUDIO_MUTED_CHANGED, ({ muted }) => { audio.muted = muted; }),
    events.subscribe(GameEvents.AUDIO_BACKGROUND_CHANGED, ({ backgrounded }) => audio.setBackgrounded(backgrounded)),
  ];
  return () => { for (const unsubscribe of unsubscribers) unsubscribe(); };
}


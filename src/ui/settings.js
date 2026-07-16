/* Small, versioned UI preferences. Keep this separate from the game engine so
   rendering choices persist without becoming part of save/progression state. */
const STORAGE_KEY = 'primordial-sea-settings-v1';

export const FRAME_RATE_OPTIONS = [
  { value: 30, label: '30 FPS', detail: 'Power saver' },
  { value: 60, label: '60 FPS', detail: 'Recommended' },
  { value: 120, label: '120 FPS', detail: 'High refresh' },
  { value: 0, label: 'Unlimited', detail: 'Match display' },
];

export const DEFAULT_SETTINGS = Object.freeze({ frameRate: 60 });

const validFrameRate = value => FRAME_RATE_OPTIONS.some(option => option.value === value);

export function normalizeSettings(value) {
  const frameRate = value && value.frameRate != null ? Number(value.frameRate) : NaN;
  return { frameRate: validFrameRate(frameRate) ? frameRate : DEFAULT_SETTINGS.frameRate };
}

export function loadSettings() {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(value) {
  const settings = normalizeSettings(value);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { }
  return settings;
}

export function frameRateLabel(value) {
  const option = FRAME_RATE_OPTIONS.find(item => item.value === value);
  return option ? option.label : FRAME_RATE_OPTIONS[1].label;
}

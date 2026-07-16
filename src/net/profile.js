/* Local player profile — a name and a colour, saved in localStorage.

   Purely client-side: there is no account and no password, nothing is sent to
   a server here. The profile just labels you in multiplayer (name tag) and
   tints your creature. A stable random `id` lets a host recognise you as the
   same player across a reconnect. */

const KEY = 'primordial-sea/profile';

/* A spread of distinct, readable tints (reused for name tags + creature glow). */
export const PROFILE_COLORS = ['#5ec8f2', '#f0637a', '#8fce6a', '#f2c15e', '#b79bff', '#4fd6b8', '#e0a34f', '#ff8fbf'];

function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* The saved profile, or null if none exists yet (first run). */
export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.name && p.id && p.color) return p;
  } catch { /* corrupt / unavailable storage — treat as first run */ }
  return null;
}

/* Merge `partial` ({name?, color?}) over the current profile (or a fresh one),
   persist, and return the saved profile. The id is created once and preserved. */
export function saveProfile(partial) {
  const cur = loadProfile();
  const name = ((partial.name != null ? partial.name : cur && cur.name) || '').trim().slice(0, 16);
  const p = {
    id: (cur && cur.id) || newId(),
    name: name || 'Nameless',
    color: partial.color || (cur && cur.color) || PROFILE_COLORS[0],
  };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full/blocked — keep going in-memory */ }
  return p;
}

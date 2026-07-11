/* Leveling curve. At MAX_LEVEL the player lays an egg and evolves. */
export const MAX_LEVEL = 10;
export const XP_MULT = 2;                                // food value × this = XP, so leveling feels brisk
export const xpNeed = level => 16 + (level - 1) * 5;     // per-level XP (levels 1..9)

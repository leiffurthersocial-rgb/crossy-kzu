// Global tuning constants. One tile = one world unit.
export const HALF_COLS = 4;            // playable columns are -HALF_COLS..HALF_COLS
export const WRAP = 18;                // moving entities loop over [-WRAP, WRAP)
export const LOOP = WRAP * 2;
export const GROUND_WIDTH = WRAP * 2 + 12;

export const HOP_TIME = 0.13;          // seconds per hop
export const HOP_HEIGHT = 0.42;
export const MAX_QUEUE = 3;            // buffered inputs

export const LANES_AHEAD = 26;
export const LANES_BEHIND = 12;
export const FIRST_ROW = -8;           // rows <= -4 are a solid tree wall

export const WATER_Y = -0.28;          // top of the water surface
export const LOG_TOP = 0.02;
export const PAD_TOP = -0.18;

export const PLAYER_HALF_WIDTH = 0.26;

// Difficulty 0..1 as a function of the lane index.
export function difficulty(row) {
  return Math.max(0, Math.min(1, (row - 4) / 160));
}

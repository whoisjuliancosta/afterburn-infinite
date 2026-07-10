// src/board.js — local leaderboard (pure logic; clock-free, dates passed in)
const BOARD_KEY = 'np-shooter-board';
const MAX = 5;

export function loadBoard() {
  try {
    const raw = globalThis.localStorage?.getItem(BOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveBoard(board) {
  try { globalThis.localStorage?.setItem(BOARD_KEY, JSON.stringify(board)); }
  catch { /* private mode: session-only board */ }
}

// Returns a NEW array sorted desc by score, capped at MAX. Stable on ties:
// existing entries precede the new one, so earlier runs keep the higher rank.
export function recordRun(board, { score, wave, date }) {
  const entry = { score, wave, date };
  return [...board, entry]
    .sort((a, b) => b.score - a.score) // Array.sort is stable → ties preserve order
    .slice(0, MAX);
}

// Index of entry on the board (value match), or -1 if it did not place.
export function placed(board, entry) {
  return board.findIndex(
    (e) => e.score === entry.score && e.wave === entry.wave && e.date === entry.date,
  );
}

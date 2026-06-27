import type { GameDifficulty } from '../types/game';

// Seconds on the clock per difficulty. Mirrors DIFFICULTY_ROUND_SECONDS on the
// server (server/src/config/gameConstants.ts) — the client counts down with
// these, the server scores its speed bonus against the same window. Keep the
// two in sync: a longer clock must also mean a longer window to earn bonus on.
export const DIFFICULTY_SECONDS: Record<GameDifficulty, number> = {
    easy: 10,
    medium: 7,
    hard: 5,
};

export const DEFAULT_ROUND_SECONDS = DIFFICULTY_SECONDS.medium;

export const roundSecondsFor = (difficulty: GameDifficulty | undefined): number =>
    DIFFICULTY_SECONDS[difficulty ?? 'medium'] ?? DEFAULT_ROUND_SECONDS;

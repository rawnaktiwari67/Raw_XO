import type { GameDifficulty } from '../types/game';

// Seconds on the clock per difficulty. Mirrors DIFFICULTY_ROUND_SECONDS on the
// server (server/src/config/gameConstants.ts) — the client counts down with
// these, the server scores its speed bonus against the same window. Keep the
// two in sync: a longer clock must also mean a longer window to earn bonus on.
export const DIFFICULTY_SECONDS: Record<GameDifficulty, number> = {
    easy: 10,
    medium: 7,
    hard: 5,
    pro: 7,
};

// The clip-length bar is the real difficulty control: how much song you hear
// IS how hard the round is. One slider spans the whole range, and the tier is
// derived from wherever it lands — 0.1s is Pro, 10s is Easy.
export const CLIP_MIN_SECONDS = 0.1;
export const CLIP_MAX_SECONDS = 10;

// Upper bound of the Pro tier: anything at or under this is a micro-clip round
// (audio hard-stops early, clock stays at DIFFICULTY_SECONDS.pro, bigger base
// score). Mirrors the 150-point base gate in the server's calculateScorePayload.
export const PRO_CLIP_MAX_SECONDS = 3;

// Where the bar snaps when a difficulty pill is tapped. Easy/medium/hard match
// their round clock (the clip simply fills the round); pro drops to the 0.1s
// flex — players drag it up from there if they want mercy.
export const CLIP_SECONDS_FOR_DIFFICULTY: Record<GameDifficulty, number> = {
    easy: DIFFICULTY_SECONDS.easy,
    medium: DIFFICULTY_SECONDS.medium,
    hard: DIFFICULTY_SECONDS.hard,
    pro: CLIP_MIN_SECONDS,
};

// Inverse mapping: which tier a clip length lands in. Boundaries line up with
// the tier clocks so a snapped pill value always round-trips to the same tier
// (5s → hard, 7s → medium, 10s → easy, ≤3s → pro).
export const difficultyForClipSeconds = (seconds: number): GameDifficulty => {
    if (seconds <= PRO_CLIP_MAX_SECONDS) return 'pro';
    if (seconds <= DIFFICULTY_SECONDS.hard) return 'hard';
    if (seconds <= DIFFICULTY_SECONDS.medium) return 'medium';
    return 'easy';
};

export const DEFAULT_ROUND_SECONDS = DIFFICULTY_SECONDS.medium;

export const roundSecondsFor = (difficulty: GameDifficulty | undefined): number =>
    DIFFICULTY_SECONDS[difficulty ?? 'medium'] ?? DEFAULT_ROUND_SECONDS;

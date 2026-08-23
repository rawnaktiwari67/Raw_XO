import type { GameDifficulty } from '../types/game';
import { DIFFICULTY_SECONDS } from '../config/gameConfig';

// ── Client-side round scoring ────────────────────────────────────────────────
// This is a faithful port of the server's calculateScorePayload + calculateGameXP
// (server/src/utils/gameLogic.ts). A batched round carries its reveal data, so
// the client scores the guess INSTANTLY here for the reveal; the server then
// re-scores authoritatively in the background when the answer is POSTed. The two
// must produce identical numbers or the player sees a score flash then correct
// itself — so this lives in its own module with direct unit tests
// (scoring.test.ts) instead of being buried in the store.

// Round clock per difficulty, in ms. Derived from DIFFICULTY_SECONDS (which
// configDrift.test.ts already pins to the server's DIFFICULTY_ROUND_SECONDS), so
// the speed-bonus window can't drift from the countdown the player actually saw.
export const ROUND_WINDOW_MS: Record<GameDifficulty, number> = {
    easy: DIFFICULTY_SECONDS.easy * 1000,
    medium: DIFFICULTY_SECONDS.medium * 1000,
    hard: DIFFICULTY_SECONDS.hard * 1000,
    pro: DIFFICULTY_SECONDS.pro * 1000,
};

// Each AI hint shaves points off the round's base score before the multiplier.
// Mirrors HINT_POINT_PENALTY / MAX_HINTS_PER_ROUND in the server's gameLogic.ts.
export const HINT_POINT_PENALTY = 15;
export const MAX_HINTS_PER_ROUND = 3;

// Replays: up to MAX_REPLAYS re-listens per round, each shaving points off the
// base (the first auto-play is free). Mirrors REPLAY_POINT_PENALTY /
// MAX_REPLAYS_PER_ROUND in the server's gameLogic.ts.
export const REPLAY_POINT_PENALTY = 10;
export const MAX_REPLAYS = 3;

export interface LocalScore {
    pointsAwarded: number;
    speedBonus: number;
    multiplier: number;
    xpEarned: number;
}

// Score a single answer locally. Any drift from the server here is corrected on
// the next fetch, but the formulas are identical by design, so they won't drift.
export const scoreAnswerLocally = (
    correct: boolean,
    streak: number,
    responseTimeMs: number,
    difficulty: GameDifficulty,
    hintsUsed: number,
    replaysUsed: number
): LocalScore => {
    if (!correct) return { pointsAwarded: 0, speedBonus: 0, multiplier: 1, xpEarned: 5 };

    const windowMs = ROUND_WINDOW_MS[difficulty] ?? ROUND_WINDOW_MS.medium;
    const safeResponseTime = responseTimeMs > 0 ? Math.min(responseTimeMs, windowMs) : windowMs;
    const speedBonus = Math.max(0, Math.round(((windowMs - safeResponseTime) / windowMs) * 60));
    const multiplier = Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
    const hintPenalty = Math.min(MAX_HINTS_PER_ROUND, Math.max(0, hintsUsed)) * HINT_POINT_PENALTY;
    const replayPenalty = Math.min(MAX_REPLAYS, Math.max(0, replaysUsed)) * REPLAY_POINT_PENALTY;
    // Pro rounds pay a bigger base for calling a track off a fraction of a
    // second — mirrors the server's calculateScorePayload.
    const base = difficulty === 'pro' ? 150 : 100;
    const pointsAwarded = Math.round(Math.max(0, base + speedBonus - hintPenalty - replayPenalty) * multiplier);
    const xpEarned = 50 + Math.min(streak * 10, 50) + Math.round(speedBonus * 0.5);

    return { pointsAwarded, speedBonus, multiplier, xpEarned };
};

import { describe, expect, it } from 'vitest';
import {
    scoreAnswerLocally,
    ROUND_WINDOW_MS,
    HINT_POINT_PENALTY,
    REPLAY_POINT_PENALTY,
    MAX_REPLAYS,
    MAX_HINTS_PER_ROUND,
} from './scoring';
import { DIFFICULTY_SECONDS } from '../config/gameConfig';

// The client scores every guess locally for the instant reveal; the server then
// re-scores authoritatively. These tests pin the client formula so it can't
// silently drift from the server's calculateScorePayload / calculateGameXP.

describe('ROUND_WINDOW_MS', () => {
    it('is DIFFICULTY_SECONDS in milliseconds (no independent hardcode to drift)', () => {
        expect(ROUND_WINDOW_MS.easy).toBe(DIFFICULTY_SECONDS.easy * 1000);
        expect(ROUND_WINDOW_MS.medium).toBe(DIFFICULTY_SECONDS.medium * 1000);
        expect(ROUND_WINDOW_MS.hard).toBe(DIFFICULTY_SECONDS.hard * 1000);
        expect(ROUND_WINDOW_MS.pro).toBe(DIFFICULTY_SECONDS.pro * 1000);
    });
});

describe('scoreAnswerLocally — wrong answer', () => {
    it('awards no points/bonus and a flat 5 XP regardless of streak or speed', () => {
        expect(scoreAnswerLocally(false, 9, 100, 'medium', 0, 0)).toEqual({
            pointsAwarded: 0,
            speedBonus: 0,
            multiplier: 1,
            xpEarned: 5,
        });
    });
});

describe('scoreAnswerLocally — speed bonus', () => {
    it('is the full 60 for an effectively instant answer', () => {
        const { speedBonus } = scoreAnswerLocally(true, 0, 1, 'medium', 0, 0);
        expect(speedBonus).toBe(60);
    });

    it('is 0 when the whole window is used', () => {
        const { speedBonus } = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', 0, 0);
        expect(speedBonus).toBe(0);
    });

    it('treats a non-positive response time as "used the whole window" (0 bonus), never a max bonus', () => {
        expect(scoreAnswerLocally(true, 0, 0, 'medium', 0, 0).speedBonus).toBe(0);
        expect(scoreAnswerLocally(true, 0, -50, 'medium', 0, 0).speedBonus).toBe(0);
    });

    it('clamps an over-the-window response time to 0, never negative', () => {
        const { speedBonus } = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium + 5000, 'medium', 0, 0);
        expect(speedBonus).toBe(0);
    });

    it('is ~half at the window midpoint', () => {
        const { speedBonus } = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium / 2, 'medium', 0, 0);
        expect(speedBonus).toBe(30);
    });
});

describe('scoreAnswerLocally — streak multiplier', () => {
    it('is 1x below the first streak tier', () => {
        expect(scoreAnswerLocally(true, 0, 1000, 'medium', 0, 0).multiplier).toBe(1);
        expect(scoreAnswerLocally(true, 2, 1000, 'medium', 0, 0).multiplier).toBe(1);
    });

    it('steps up 0.25x every 3 correct in a row', () => {
        expect(scoreAnswerLocally(true, 3, 1000, 'medium', 0, 0).multiplier).toBe(1.25);
        expect(scoreAnswerLocally(true, 6, 1000, 'medium', 0, 0).multiplier).toBe(1.5);
        expect(scoreAnswerLocally(true, 9, 1000, 'medium', 0, 0).multiplier).toBe(1.75);
    });

    it('caps at 2x no matter how long the streak', () => {
        expect(scoreAnswerLocally(true, 12, 1000, 'medium', 0, 0).multiplier).toBe(2);
        expect(scoreAnswerLocally(true, 99, 1000, 'medium', 0, 0).multiplier).toBe(2);
    });
});

describe('scoreAnswerLocally — base points and pro bonus', () => {
    it('uses a 100 base for non-pro tiers (full window, no streak)', () => {
        // full window → speedBonus 0, multiplier 1 → exactly the base
        expect(scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', 0, 0).pointsAwarded).toBe(100);
        expect(scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.hard, 'hard', 0, 0).pointsAwarded).toBe(100);
    });

    it('uses a 150 base for pro', () => {
        expect(scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.pro, 'pro', 0, 0).pointsAwarded).toBe(150);
    });

    it('applies the multiplier after adding the speed bonus to the base', () => {
        // instant (bonus 60), streak 3 (x1.25): (100 + 60) * 1.25 = 200
        expect(scoreAnswerLocally(true, 3, 1, 'medium', 0, 0).pointsAwarded).toBe(200);
    });
});

describe('scoreAnswerLocally — hint & replay penalties', () => {
    it('subtracts each hint/replay from the base before the multiplier', () => {
        // full window (bonus 0), 1 hint, 1 replay, no streak:
        // (100 - 15 - 10) * 1 = 75
        expect(scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', 1, 1).pointsAwarded).toBe(75);
    });

    it('caps hint and replay counts at their maximums', () => {
        const capped = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', 99, 99).pointsAwarded;
        const atMax = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', MAX_HINTS_PER_ROUND, MAX_REPLAYS).pointsAwarded;
        expect(capped).toBe(atMax);
        // 100 - 3*15 - 3*10 = 25
        expect(atMax).toBe(25);
    });

    it('never drops points below zero even when penalties exceed the base', () => {
        const { pointsAwarded } = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', MAX_HINTS_PER_ROUND, MAX_REPLAYS);
        expect(pointsAwarded).toBeGreaterThanOrEqual(0);
        // sanity: even the theoretical max penalty keeps the floor at 0
        expect(HINT_POINT_PENALTY * 10 + REPLAY_POINT_PENALTY * 10).toBeGreaterThan(100);
    });

    it('ignores negative hint/replay counts (treated as zero)', () => {
        const clean = scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', 0, 0).pointsAwarded;
        expect(scoreAnswerLocally(true, 0, ROUND_WINDOW_MS.medium, 'medium', -3, -3).pointsAwarded).toBe(clean);
    });
});

describe('scoreAnswerLocally — XP', () => {
    it('is 50 + capped streak bonus + half the speed bonus', () => {
        // streak 2 (→ +20), full window (bonus 0): 50 + 20 + 0 = 70
        expect(scoreAnswerLocally(true, 2, ROUND_WINDOW_MS.medium, 'medium', 0, 0).xpEarned).toBe(70);
    });

    it('caps the streak contribution at 50', () => {
        // streak 9 would be +90 uncapped → capped to +50; full window: 50 + 50 = 100
        expect(scoreAnswerLocally(true, 9, ROUND_WINDOW_MS.medium, 'medium', 0, 0).xpEarned).toBe(100);
    });

    it('adds half the speed bonus (rounded)', () => {
        // instant → bonus 60 → +30; streak 0: 50 + 0 + 30 = 80
        expect(scoreAnswerLocally(true, 0, 1, 'medium', 0, 0).xpEarned).toBe(80);
    });
});

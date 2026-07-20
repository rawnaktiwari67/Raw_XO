import { describe, expect, it } from 'vitest';
import { calculateScorePayload, guestNameFromId, roundWindowMs, shuffle, GUEST_ADJECTIVES, GUEST_NOUNS, HINT_POINT_PENALTY, MAX_HINTS_PER_ROUND, REPLAY_POINT_PENALTY, MAX_REPLAYS_PER_ROUND } from './gameLogic';
import { DIFFICULTY_ROUND_SECONDS } from '../config/gameConstants';

describe('calculateScorePayload', () => {
    it('awards nothing for a wrong answer, regardless of streak or speed', () => {
        expect(calculateScorePayload(false, 9, 100, 'hard')).toEqual({
            pointsAwarded: 0,
            speedBonus: 0,
            multiplier: 1,
        });
    });

    it('awards base 100 with no bonus when the whole window is used', () => {
        const windowMs = roundWindowMs('medium');
        expect(calculateScorePayload(true, 0, windowMs, 'medium')).toEqual({
            pointsAwarded: 100,
            speedBonus: 0,
            multiplier: 1,
        });
    });

    it('awards base 150 for a pro-mode answer — the clip is a fraction of a second', () => {
        const windowMs = roundWindowMs('pro');
        expect(calculateScorePayload(true, 0, windowMs, 'pro')).toEqual({
            pointsAwarded: 150,
            speedBonus: 0,
            multiplier: 1,
        });
    });

    it('awards the full 60 speed bonus only for a (theoretical) instant answer', () => {
        // responseTimeMs must be > 0 to count as measured; 1ms is as fast as it gets.
        const { speedBonus } = calculateScorePayload(true, 0, 1, 'easy');
        expect(speedBonus).toBe(60);
    });

    it('scores faster answers higher on the same difficulty', () => {
        const fast = calculateScorePayload(true, 0, 1000, 'medium');
        const slow = calculateScorePayload(true, 0, 6000, 'medium');
        expect(fast.pointsAwarded).toBeGreaterThan(slow.pointsAwarded);
    });

    it('scales the bonus by the fraction of the clock left, not absolute speed', () => {
        // Using 40% of the window earns the same bonus on any difficulty…
        const hard = calculateScorePayload(true, 0, 2000, 'hard'); // 2s of 5s
        const easy = calculateScorePayload(true, 0, 4000, 'easy'); // 4s of 10s
        expect(hard.speedBonus).toBe(easy.speedBonus);
        expect(hard.speedBonus).toBe(36); // 60% of window left → 60 * 0.6

        // …so the same absolute 2s earns less on hard (less of its window remains).
        const sameAbsolute = calculateScorePayload(true, 0, 2000, 'easy');
        expect(sameAbsolute.speedBonus).toBeGreaterThan(hard.speedBonus);
    });

    it('treats missing/negative response times as using the full window (no bonus)', () => {
        expect(calculateScorePayload(true, 0, 0, 'medium').speedBonus).toBe(0);
        expect(calculateScorePayload(true, 0, -500, 'medium').speedBonus).toBe(0);
    });

    it('clamps response times beyond the window instead of going negative', () => {
        const { speedBonus, pointsAwarded } = calculateScorePayload(true, 0, 999999, 'hard');
        expect(speedBonus).toBe(0);
        expect(pointsAwarded).toBe(100);
    });

    it('deducts the hint penalty from the base before the multiplier', () => {
        const windowMs = roundWindowMs('medium');
        // Full window, no bonus: base 100 − 15/hint.
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 1).pointsAwarded).toBe(100 - HINT_POINT_PENALTY);
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 2).pointsAwarded).toBe(100 - 2 * HINT_POINT_PENALTY);
        // The streak multiplier applies AFTER the penalty: (100 − 15) × 1.25.
        expect(calculateScorePayload(true, 3, windowMs, 'medium', 1).pointsAwarded).toBe(Math.round((100 - HINT_POINT_PENALTY) * 1.25));
    });

    it('clamps hint counts to the per-round maximum and never goes negative', () => {
        const windowMs = roundWindowMs('medium');
        const atMax = calculateScorePayload(true, 0, windowMs, 'medium', MAX_HINTS_PER_ROUND);
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 99).pointsAwarded).toBe(atMax.pointsAwarded);
        expect(atMax.pointsAwarded).toBeGreaterThanOrEqual(0);
        // Negative/missing counts behave like zero hints.
        expect(calculateScorePayload(true, 0, windowMs, 'medium', -2).pointsAwarded).toBe(100);
    });

    it('deducts the replay penalty from the base, alongside any hint penalty', () => {
        const windowMs = roundWindowMs('medium');
        // Full window, no bonus, no hints: base 100 − 10/replay.
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 0, 1).pointsAwarded).toBe(100 - REPLAY_POINT_PENALTY);
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 0, 2).pointsAwarded).toBe(100 - 2 * REPLAY_POINT_PENALTY);
        // Hints and replays stack, then the multiplier applies to what's left.
        const both = calculateScorePayload(true, 3, windowMs, 'medium', 1, 2).pointsAwarded;
        expect(both).toBe(Math.round((100 - HINT_POINT_PENALTY - 2 * REPLAY_POINT_PENALTY) * 1.25));
    });

    it('clamps replay counts to the per-round maximum and never goes negative', () => {
        const windowMs = roundWindowMs('medium');
        const atMax = calculateScorePayload(true, 0, windowMs, 'medium', 0, MAX_REPLAYS_PER_ROUND);
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 0, 99).pointsAwarded).toBe(atMax.pointsAwarded);
        expect(atMax.pointsAwarded).toBeGreaterThanOrEqual(0);
        expect(calculateScorePayload(true, 0, windowMs, 'medium', 0, -3).pointsAwarded).toBe(100);
    });

    it('steps the streak multiplier by 0.25 every 3 streak, capped at 2x', () => {
        const windowMs = roundWindowMs('medium');
        expect(calculateScorePayload(true, 0, windowMs, 'medium').multiplier).toBe(1);
        expect(calculateScorePayload(true, 2, windowMs, 'medium').multiplier).toBe(1);
        expect(calculateScorePayload(true, 3, windowMs, 'medium').multiplier).toBe(1.25);
        expect(calculateScorePayload(true, 6, windowMs, 'medium').multiplier).toBe(1.5);
        expect(calculateScorePayload(true, 12, windowMs, 'medium').multiplier).toBe(2);
        expect(calculateScorePayload(true, 100, windowMs, 'medium').multiplier).toBe(2);
    });
});

describe('roundWindowMs', () => {
    it('converts the shared difficulty seconds into milliseconds', () => {
        for (const difficulty of ['easy', 'medium', 'hard'] as const) {
            expect(roundWindowMs(difficulty)).toBe(DIFFICULTY_ROUND_SECONDS[difficulty] * 1000);
        }
    });

    it('falls back to the medium window for unknown difficulties', () => {
        expect(roundWindowMs('nightmare' as never)).toBe(DIFFICULTY_ROUND_SECONDS.medium * 1000);
    });
});

describe('shuffle', () => {
    it('returns a permutation without mutating the input', () => {
        const input = [1, 2, 3, 4];
        const output = shuffle(input);
        expect(input).toEqual([1, 2, 3, 4]);
        expect([...output].sort()).toEqual([1, 2, 3, 4]);
    });

    it('does not favor keeping the first element in slot 0 (the old sort() bias)', () => {
        // With a uniform shuffle of 4 items, element "correct" stays in slot 0
        // 25% of the time. The old biased shuffle kept it there far more often.
        const trials = 20000;
        let stayedFirst = 0;
        for (let i = 0; i < trials; i += 1) {
            if (shuffle(['correct', 'b', 'c', 'd'])[0] === 'correct') stayedFirst += 1;
        }
        const ratio = stayedFirst / trials;
        // Generous statistical bounds — uniform is 0.25; the old bias pushed it well past 0.35.
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(0.3);
    });

    it('handles empty and single-element arrays', () => {
        expect(shuffle([])).toEqual([]);
        expect(shuffle([42])).toEqual([42]);
    });
});

describe('guestNameFromId', () => {
    it('is deterministic for the same id', () => {
        expect(guestNameFromId('abc123xyz789')).toBe(guestNameFromId('abc123xyz789'));
    });

    it('never produces "undefined" in the name (regression: signed >> hash)', () => {
        // Long/high-charcode ids used to overflow into negative indexes.
        const ids = [
            'a'.repeat(64),
            '￿￿￿￿￿￿',
            'zzzzzzzzzzzzzzzzzzzzzzzz',
            crypto.randomUUID?.() ?? 'fallback-id-0001',
        ];
        for (const id of ids) {
            const name = guestNameFromId(id);
            expect(name).not.toContain('undefined');
            const [adjective, noun] = name.split(' ');
            expect(GUEST_ADJECTIVES).toContain(adjective);
            expect(GUEST_NOUNS).toContain(noun);
        }
    });

    it('holds for arbitrary random ids', () => {
        for (let i = 0; i < 500; i += 1) {
            const id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
            expect(guestNameFromId(id)).not.toContain('undefined');
        }
    });
});

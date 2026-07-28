import { describe, it, expect } from 'vitest';
import {
    buildDailySelection,
    dailyPuzzleNumber,
    dailyDateKey,
    DAILY_EPOCH_UTC,
    DAILY_ROUND_COUNT,
    DAILY_OPTION_COUNT,
} from './daily';

describe('daily puzzle numbering', () => {
    it('numbers the epoch day as puzzle #1 and advances by one per UTC day', () => {
        expect(dailyPuzzleNumber(DAILY_EPOCH_UTC)).toBe(1);
        expect(dailyPuzzleNumber(DAILY_EPOCH_UTC + 86_400_000)).toBe(2);
        expect(dailyPuzzleNumber(DAILY_EPOCH_UTC + 41 * 86_400_000)).toBe(42);
    });

    it('is stable across a whole UTC day but flips exactly at UTC midnight', () => {
        const day10 = DAILY_EPOCH_UTC + 9 * 86_400_000;
        expect(dailyPuzzleNumber(day10)).toBe(10);
        expect(dailyPuzzleNumber(day10 + 86_399_999)).toBe(10); // 23:59:59.999
        expect(dailyPuzzleNumber(day10 + 86_400_000)).toBe(11); // next midnight
    });

    it('formats the date key as YYYY-MM-DD (UTC)', () => {
        expect(dailyDateKey(DAILY_EPOCH_UTC)).toBe('2024-01-01');
    });
});

describe('daily selection is deterministic and valid', () => {
    it('produces byte-for-byte identical rounds for the same puzzle number', () => {
        const a = buildDailySelection(142);
        const b = buildDailySelection(142);
        expect(a).toEqual(b);
    });

    it('builds a full, well-formed round set', () => {
        const rounds = buildDailySelection(7);
        expect(rounds).toHaveLength(DAILY_ROUND_COUNT);

        for (const round of rounds) {
            // Four distinct options, and the correct title is one of them.
            expect(round.options).toHaveLength(DAILY_OPTION_COUNT);
            expect(new Set(round.options).size).toBe(DAILY_OPTION_COUNT);
            expect(round.options).toContain(round.correct.title);
            // Real, playable track carried through.
            expect(round.correct.snippetUrl).toMatch(/^https:\/\//);
        }
    });

    it('never repeats a correct answer within a single day', () => {
        const rounds = buildDailySelection(365);
        const correctTitles = rounds.map((r) => r.correct.title);
        expect(new Set(correctTitles).size).toBe(correctTitles.length);
    });

    it('varies day to day (consecutive puzzles are not identical)', () => {
        const day1 = buildDailySelection(500).map((r) => r.correct.title).join('|');
        const day2 = buildDailySelection(501).map((r) => r.correct.title).join('|');
        expect(day1).not.toBe(day2);
    });
});

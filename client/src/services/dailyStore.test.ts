import { beforeEach, describe, expect, it } from 'vitest';
import {
    todayPuzzleNumber,
    getDailyState,
    recordDailyCompletion,
    buildDailyShareText,
    type DailyResult,
} from './dailyStore';

// dailyStore persists the guest streak — the app's core retention hook — in
// localStorage, defensively. vitest runs in a node env with no DOM, so we hand
// it a minimal in-memory localStorage (which is also what lets us exercise the
// streak-roll across multiple calls).
class MemoryStorage {
    private map = new Map<string, string>();
    getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
    setItem(k: string, v: string) { this.map.set(k, String(v)); }
    removeItem(k: string) { this.map.delete(k); }
    clear() { this.map.clear(); }
}

beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('todayPuzzleNumber', () => {
    it('is #1 on the UTC epoch day (2024-01-01)', () => {
        expect(todayPuzzleNumber(Date.UTC(2024, 0, 1))).toBe(1);
    });

    it('advances by one per UTC day', () => {
        expect(todayPuzzleNumber(Date.UTC(2024, 0, 2))).toBe(2);
        expect(todayPuzzleNumber(Date.UTC(2024, 0, 11))).toBe(11);
    });

    it('depends on the UTC day, not the time within it', () => {
        expect(todayPuzzleNumber(Date.UTC(2024, 0, 2, 0, 0, 1))).toBe(2);
        expect(todayPuzzleNumber(Date.UTC(2024, 0, 2, 23, 59, 59))).toBe(2);
    });
});

describe('getDailyState', () => {
    it('returns a clean slate when nothing is stored', () => {
        expect(getDailyState()).toEqual({ lastPuzzle: null, streak: 0, best: 0, lastResult: null });
    });

    it('falls back to a clean slate on corrupt JSON instead of throwing', () => {
        localStorage.setItem('rawxo.daily.v1', '{not valid json');
        expect(getDailyState()).toEqual({ lastPuzzle: null, streak: 0, best: 0, lastResult: null });
    });
});

describe('recordDailyCompletion', () => {
    it('starts a streak at 1 and persists the result grid', () => {
        const state = recordDailyCompletion(100, [true, false, true], '2024-04-10');
        expect(state.streak).toBe(1);
        expect(state.best).toBe(1);
        expect(state.lastPuzzle).toBe(100);
        expect(state.lastResult).toEqual({ puzzle: 100, results: [true, false, true], date: '2024-04-10' });
        // persisted: a fresh read sees the same streak
        expect(getDailyState().streak).toBe(1);
    });

    it('increments the streak when the next puzzle is the consecutive one', () => {
        recordDailyCompletion(100, [true], 'd1');
        const state = recordDailyCompletion(101, [true], 'd2');
        expect(state.streak).toBe(2);
        expect(state.best).toBe(2);
    });

    it('resets the streak to 1 when a puzzle is skipped, but keeps the best', () => {
        recordDailyCompletion(100, [true], 'd1');
        recordDailyCompletion(101, [true], 'd2'); // streak 2, best 2
        const state = recordDailyCompletion(105, [false], 'd6'); // gap → reset
        expect(state.streak).toBe(1);
        expect(state.best).toBe(2);
    });

    it('is idempotent for the same puzzle (replaying today never inflates the streak)', () => {
        recordDailyCompletion(100, [true], 'd1');
        recordDailyCompletion(101, [true], 'd2'); // streak 2
        const again = recordDailyCompletion(101, [true, true, true], 'd2'); // same puzzle
        expect(again.streak).toBe(2);
        // and it did NOT overwrite the stored result with the replay grid
        expect(again.lastResult?.results).toEqual([true]);
    });
});

describe('buildDailyShareText', () => {
    const result: DailyResult = { puzzle: 42, results: [true, false, true, true, false], date: '2024-04-10' };

    it('renders a spoiler-free emoji grid with the correct count and no track names', () => {
        const text = buildDailyShareText(result, 1, 'https://rawxo.app');
        expect(text).toContain('Raw XO Daily #42');
        expect(text).toContain('3/5');
        expect(text).toContain('🟩⬛🟩🟩⬛');
        expect(text).toContain('https://rawxo.app');
        // the grid is emoji-only by construction, so it can't leak a title/artist
        expect(text).toMatch(/[🟩⬛]{5}/u);
    });

    it('shows the streak flame only for a streak above 1', () => {
        expect(buildDailyShareText(result, 5, 'u')).toContain('🔥 5-day streak');
        expect(buildDailyShareText(result, 1, 'u')).not.toContain('streak');
    });
});

// Local, guest-friendly persistence for the daily challenge: the last puzzle you
// completed, your current + best streak, and the last result grid. Kept in
// localStorage so even a signed-out guest builds a streak worth protecting —
// that streak-at-risk is the whole retention hook. Every read/write is defensive:
// a missing, corrupt, or blocked store just falls back to a clean slate instead
// of throwing (private-mode Safari, cleared storage, etc.).

export type DailyResult = {
    puzzle: number;
    results: boolean[]; // per-round correctness, in play order
    date: string;
};

export type DailyState = {
    lastPuzzle: number | null;
    streak: number;
    best: number;
    lastResult: DailyResult | null;
};

const KEY = 'rawxo.daily.v1';
const EMPTY: DailyState = { lastPuzzle: null, streak: 0, best: 0, lastResult: null };

// Today's puzzle number, computed client-side so the card can show "#N" and know
// whether today's puzzle is already done — WITHOUT a network call. Must mirror the
// server's dailyPuzzleNumber (game/daily.ts): UTC days since 2024-01-01, +1. The
// server stays authoritative for the actual songs; this is only the number.
const DAILY_EPOCH_UTC = Date.UTC(2024, 0, 1);
export function todayPuzzleNumber(now: number = Date.now()): number {
    const d = new Date(now);
    const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.floor((midnightUtc - DAILY_EPOCH_UTC) / 86_400_000) + 1;
}

export function getDailyState(): DailyState {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
        if (!raw) return { ...EMPTY };
        const parsed = JSON.parse(raw) as Partial<DailyState>;
        return {
            lastPuzzle: typeof parsed.lastPuzzle === 'number' ? parsed.lastPuzzle : null,
            streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
            best: typeof parsed.best === 'number' ? parsed.best : 0,
            lastResult:
                parsed.lastResult && Array.isArray(parsed.lastResult.results)
                    ? (parsed.lastResult as DailyResult)
                    : null,
        };
    } catch {
        return { ...EMPTY };
    }
}

export function hasPlayedToday(puzzle: number): boolean {
    return getDailyState().lastPuzzle === puzzle;
}

// Record a completed puzzle and roll the streak forward. Idempotent for the same
// puzzle (replaying "today" never inflates the streak). Yesterday → +1; any
// larger gap resets the streak to 1.
export function recordDailyCompletion(puzzle: number, results: boolean[], date: string): DailyState {
    const prev = getDailyState();
    if (prev.lastPuzzle === puzzle) return prev; // already logged today
    const continues = prev.lastPuzzle === puzzle - 1;
    const streak = continues ? prev.streak + 1 : 1;
    const next: DailyState = {
        lastPuzzle: puzzle,
        streak,
        best: Math.max(prev.best, streak),
        lastResult: { puzzle, results, date },
    };
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage blocked/full — non-fatal, streak just won't persist */
    }
    return next;
}

// Spoiler-free share text — a Wordle-style emoji grid that leaks no titles, so
// it's safe to post while friends still have today's puzzle to play.
export function buildDailyShareText(result: DailyResult, streak: number, url: string): string {
    const correct = result.results.filter(Boolean).length;
    const grid = result.results.map((hit) => (hit ? '🟩' : '⬛')).join('');
    const flame = streak > 1 ? `\n🔥 ${streak}-day streak` : '';
    return `🎧 Raw XO Daily #${result.puzzle} — ${correct}/${result.results.length}\n${grid}${flame}\n${url}`;
}

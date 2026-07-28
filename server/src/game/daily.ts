// Daily challenge: one shared puzzle per calendar day, identical for every
// player. The whole point of retention here — a reason to come back tomorrow and
// a streak you're afraid to break — hinges on the puzzle being (a) the SAME for
// everyone on a given date and (b) reproducible without a database. We get both
// by seeding a deterministic PRNG with the day number and drawing from the baked
// FALLBACK_SONG_POOL: no external calls, no cache, cold-start-proof, and byte-for-
// byte identical on every server instance. Difficulty is fixed so scores compare.

import type { SongPreview } from '../utils/songTokens';
import type { GameDifficulty } from './types';
import { normalizeTrackTitleKey } from './songText';
import { distractorScore } from './difficulty';
import { FALLBACK_SONG_POOL } from './fallbackPool';

// Puzzle #1 is this date (UTC). Bumping the epoch renumbers every puzzle, so
// don't — it's the identity players share ("Raw XO Daily #142").
export const DAILY_EPOCH_UTC = Date.UTC(2024, 0, 1); // 2024-01-01
const DAY_MS = 86_400_000;
export const DAILY_ROUND_COUNT = 5;
export const DAILY_OPTION_COUNT = 4;
// Daily is fixed to 'medium' so every player's score is comparable — and so the
// distractors get medium's balance of plausible-but-not-brutal decoys.
const DAILY_DIFFICULTY: GameDifficulty = 'medium';
// Rank distractors, then draw from the top slice with the seeded RNG: quality
// decoys (era/artist-adjacent) without every day serving the same three.
const DAILY_DISTRACTOR_SHORTLIST = 12;

// The UTC date key ("2026-07-24") for a given instant. UTC (not local) so the
// puzzle number is globally single-valued — everyone worldwide shares one #N.
export const dailyDateKey = (now: number = Date.now()): string =>
    new Date(now).toISOString().slice(0, 10);

// Days since the epoch → the puzzle number. Floors on UTC midnight boundaries.
export const dailyPuzzleNumber = (now: number = Date.now()): number => {
    const todayUtcMidnight = Date.UTC(
        new Date(now).getUTCFullYear(),
        new Date(now).getUTCMonth(),
        new Date(now).getUTCDate()
    );
    return Math.floor((todayUtcMidnight - DAILY_EPOCH_UTC) / DAY_MS) + 1;
};

// mulberry32 — a tiny, fast, well-distributed seedable PRNG. Same seed always
// yields the same stream, which is exactly the determinism the daily needs.
const mulberry32 = (seed: number) => {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Fisher–Yates driven by a seeded PRNG. Returns a new array; input untouched.
const seededShuffle = <T>(items: readonly T[], rng: () => number): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

export type DailyRound = { correct: SongPreview; options: string[] };

/**
 * Build the deterministic set of rounds for a puzzle number. Picks
 * DAILY_ROUND_COUNT distinct-titled correct songs from the baked pool, then for
 * each draws DAILY_OPTION_COUNT-1 distractors with distinct titles (never the
 * correct title, never a duplicate title within a round), and shuffles the
 * option order — all from one seeded stream so it reproduces exactly.
 */
export const buildDailySelection = (puzzleNumber: number): DailyRound[] => {
    // Distinct-title candidate pool so options are never "same song, two names".
    const seenTitle = new Set<string>();
    const uniquePool = FALLBACK_SONG_POOL.filter((song) => {
        const key = normalizeTrackTitleKey(song.title);
        if (!key || seenTitle.has(key)) return false;
        seenTitle.add(key);
        return true;
    });

    // One master stream per puzzle; a large multiplier keeps consecutive days
    // from producing near-identical shuffles.
    const rng = mulberry32(puzzleNumber * 2654435761);
    const ordered = seededShuffle(uniquePool, rng);

    const correctSongs = ordered.slice(0, DAILY_ROUND_COUNT);

    return correctSongs.map((correct) => {
        const correctKey = normalizeTrackTitleKey(correct.title);
        // Rank the rest by how plausible a decoy each is for THIS track (same
        // artist / album / era / length), exactly like the live game's picker —
        // distractorScore is pure, so the ranking is deterministic. Then draw
        // from the top slice with the seeded stream for day-to-day variety.
        const shortlist = ordered
            .filter((song) => normalizeTrackTitleKey(song.title) !== correctKey)
            .map((song) => ({ song, score: distractorScore(song, correct, DAILY_DIFFICULTY) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, DAILY_DISTRACTOR_SHORTLIST);
        const distractors = seededShuffle(shortlist, rng)
            .slice(0, DAILY_OPTION_COUNT - 1)
            .map((entry) => entry.song);
        const options = seededShuffle(
            [correct.title, ...distractors.map((song) => song.title)],
            rng
        );
        return { correct, options };
    });
};

import { DIFFICULTY_ROUND_SECONDS } from '../config/gameConstants';

type GameDifficulty = 'easy' | 'medium' | 'hard' | 'pro';

// Fisher–Yates: a uniform shuffle where every element is equally likely to land
// in any position. The old `sort(() => Math.random() - 0.5)` was biased — for a
// 4-item array it left the first element (always the correct answer) in slot 0
// far more than 25% of the time, so the right answer kept showing up as option 1.
export const shuffle = <T>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export const roundWindowMs = (difficulty: GameDifficulty): number =>
    (DIFFICULTY_ROUND_SECONDS[difficulty] ?? DIFFICULTY_ROUND_SECONDS.medium) * 1000;

// Each AI hint (POST /ai/hint) shaves points off the round's base score before
// the streak multiplier. Mirrored by the client's scoreAnswerLocally
// (stores/gameStore.ts) — change both together or reveals will drift from the
// server's authoritative re-score.
export const HINT_POINT_PENALTY = 15;
export const MAX_HINTS_PER_ROUND = 3;

// Replays work the same way: you get up to MAX_REPLAYS_PER_ROUND re-listens of
// the clip, and each one shaves points off the base. The first (auto) play is
// free — only deliberate replays cost. Mirrored client-side; keep in sync.
export const REPLAY_POINT_PENALTY = 10;
export const MAX_REPLAYS_PER_ROUND = 3;

export const calculateScorePayload = (
    correct: boolean,
    streak: number,
    responseTimeMs: number,
    difficulty: GameDifficulty,
    hintsUsed = 0,
    replaysUsed = 0
) => {
    if (!correct) {
        return {
            pointsAwarded: 0,
            speedBonus: 0,
            multiplier: 1,
        };
    }

    // Speed bonus is measured against the clock you actually had: it scales with
    // the fraction of the window left when you answered, not absolute speed. So a
    // 2s answer on a 5s hard clock (60% left) earns less than 2s on a 10s easy
    // clock (80% left) — what's rewarded is leaving time on the table at any level.
    const speedWindowMs = roundWindowMs(difficulty);
    const safeResponseTime = responseTimeMs > 0 ? Math.min(responseTimeMs, speedWindowMs) : speedWindowMs;
    const speedBonus = Math.max(0, Math.round(((speedWindowMs - safeResponseTime) / speedWindowMs) * 60));
    const multiplier = Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
    const hintPenalty = Math.min(MAX_HINTS_PER_ROUND, Math.max(0, hintsUsed)) * HINT_POINT_PENALTY;
    const replayPenalty = Math.min(MAX_REPLAYS_PER_ROUND, Math.max(0, replaysUsed)) * REPLAY_POINT_PENALTY;
    // Pro rounds are guessed off a fraction-of-a-second clip, so a correct call
    // pays a bigger base. Mirrored by the client's scoreAnswerLocally.
    const base = difficulty === 'pro' ? 150 : 100;
    const pointsAwarded = Math.round(Math.max(0, base + speedBonus - hintPenalty - replayPenalty) * multiplier);

    return { pointsAwarded, speedBonus, multiplier };
};

// ─── Guest identity ──────────────────────────────────────────────────────────
// Anonymous players get a friendly display name derived deterministically from
// their stable guest id (stored in a cookie by the controller).
export const GUEST_ADJECTIVES = ['Swift', 'Golden', 'Midnight', 'Electric', 'Velvet', 'Neon', 'Cosmic', 'Silent', 'Crimson', 'Lunar', 'Wild', 'Hidden'];
export const GUEST_NOUNS = ['Listener', 'Crate', 'Vinyl', 'Echo', 'Pulse', 'Tempo', 'Riff', 'Encore', 'Bassline', 'Hook', 'Anthem', 'Groove'];

export const guestNameFromId = (guestId: string): string => {
    let hash = 0;
    for (let i = 0; i < guestId.length; i += 1) {
        hash = (hash * 31 + guestId.charCodeAt(i)) >>> 0;
    }
    // Use unsigned shift (>>>) — a signed >> can go negative for large hashes,
    // producing a negative index and an "undefined" noun.
    const adjective = GUEST_ADJECTIVES[hash % GUEST_ADJECTIVES.length];
    const noun = GUEST_NOUNS[(hash >>> 8) % GUEST_NOUNS.length];
    return `${adjective} ${noun}`;
};

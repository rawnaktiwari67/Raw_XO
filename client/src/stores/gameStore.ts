import { create } from 'zustand';
import type {
    LeaderboardData,
    LeaderboardPeriod,
    SessionSummary,
    GameArtistOption,
    GameFilters,
    GameDifficulty,
    GameGenre,
    GameLanguage,
    GameQuestion,
    GameResult,
    GameSessionBatch,
    GameStats,
    LeaderboardEntry,
    LeaderboardScope,
    RoundLeaderboards,
    GameSession,
} from '../types/game';
import { gameService } from '../services/gameService';
import { useDiaryStore } from './diaryStore';
import {
    CLIP_MAX_SECONDS,
    CLIP_MIN_SECONDS,
    CLIP_SECONDS_FOR_DIFFICULTY,
    difficultyForClipSeconds,
} from '../config/gameConfig';

type Phase = 'idle' | 'playing' | 'answered' | 'result';
const ROUND_LIMIT = 5;

// Round clock per difficulty, in ms — must mirror the server's
// DIFFICULTY_ROUND_SECONDS so client-computed scores match what the server
// re-derives when it persists the answer.
const ROUND_WINDOW_MS: Record<GameDifficulty, number> = { easy: 10_000, medium: 7_000, hard: 5_000, pro: 7_000 };

// Each AI hint shaves points off the round's base score before the multiplier.
// Must mirror HINT_POINT_PENALTY / MAX_HINTS_PER_ROUND in the server's
// utils/gameLogic.ts — same reason as the round clock above. Exported so the
// Hint button can show the real cost.
export const HINT_POINT_PENALTY = 15;
const MAX_HINTS_PER_ROUND = 3;

// Ported from the server's calculateScorePayload + calculateGameXP so a batched
// round can be scored instantly on the client (no network round-trip). The
// server re-scores authoritatively when the answer is POSTed in the background,
// so this only drives the immediate reveal — any drift would be corrected on the
// server, but the formulas are identical, so they won't drift.
const scoreAnswerLocally = (correct: boolean, streak: number, responseTimeMs: number, difficulty: GameDifficulty, hintsUsed: number) => {
    if (!correct) return { pointsAwarded: 0, speedBonus: 0, multiplier: 1, xpEarned: 5 };

    const windowMs = ROUND_WINDOW_MS[difficulty] ?? ROUND_WINDOW_MS.medium;
    const safeResponseTime = responseTimeMs > 0 ? Math.min(responseTimeMs, windowMs) : windowMs;
    const speedBonus = Math.max(0, Math.round(((windowMs - safeResponseTime) / windowMs) * 60));
    const multiplier = Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
    const hintPenalty = Math.min(MAX_HINTS_PER_ROUND, Math.max(0, hintsUsed)) * HINT_POINT_PENALTY;
    // Pro rounds pay a bigger base for calling a track off a fraction of a
    // second — mirrors the server's calculateScorePayload.
    const base = difficulty === 'pro' ? 150 : 100;
    const pointsAwarded = Math.round(Math.max(0, base + speedBonus - hintPenalty) * multiplier);
    const xpEarned = 50 + Math.min(streak * 10, 50) + Math.round(speedBonus * 0.5);

    return { pointsAwarded, speedBonus, multiplier, xpEarned };
};

const getApiData = <T>(response: { data?: { data?: T } }): T | undefined => response.data?.data;
const getApiError = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
        const message = response?.data?.error ?? response?.data?.message;
        if (typeof message === 'string' && message.trim()) return message;
    }

    return fallback;
};

interface GameState {
    question: GameQuestion | null;
    prefetchedQuestion: GameQuestion | null;
    // The remaining rounds of the current batched game, played from memory with
    // no per-round network. prefetchedQuestion mirrors sessionQueue[0] so the UI
    // can buffer the next clip's audio ahead of time.
    sessionQueue: GameQuestion[];
    phase: Phase;
    selectedAnswer: string | null;
    result: GameResult | null;
    filters: GameFilters;
    roundFilters: GameFilters;
    // Pro mode only: how many seconds of the clip actually play (0.1–3.0).
    // Live-adjustable mid-round — the next play/replay uses the new value.
    clipSeconds: number;
    artistOptions: GameArtistOption[];
    recentSongIds: string[];
    streak: number;
    bestSessionStreak: number;
    lastBrokenStreak: number | null;
    sessionScore: number;
    roundsPlayedInSession: number;
    correctAnswersInSession: number;
    sessionSummary: SessionSummary | null;
    isSummaryVisible: boolean;
    roundLeaderboards: RoundLeaderboards;
    leaderboard: LeaderboardEntry[];
    leaderboardPeriod: LeaderboardPeriod;
    leaderboardRank: number | null;
    leaderboardScope: LeaderboardScope;
    leaderboardScopeValue: string;
    leaderboardLoading: boolean;
    history: GameSession[];
    stats: GameStats | null;
    isLoading: boolean;
    error: string | null;
    isRating: boolean;

    setGenre: (genre: GameGenre) => void;
    setLanguage: (language: GameLanguage) => void;
    setDifficulty: (difficulty: GameDifficulty) => void;
    setClipSeconds: (clipSeconds: number) => void;
    setArtist: (artist: string) => void;
    startRound: () => Promise<void>;
    prefetchNextQuestion: () => Promise<void>;
    clearSession: () => void;
    startFreshSession: () => Promise<void>;
    submitAnswer: (answer: string, responseTimeMs?: number, hintsUsed?: number) => Promise<void>;
    rateTrack: (rating: number) => Promise<void>;
    resetRound: () => void;
    revealSessionSummary: () => void;
    dismissSessionSummary: () => void;
    fetchStats: () => Promise<void>;
    fetchLeaderboard: (period?: LeaderboardPeriod, scope?: LeaderboardScope, scopeValue?: string) => Promise<void>;
    fetchRoundLeaderboards: () => Promise<void>;
    fetchHistory: () => Promise<void>;
    fetchArtists: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
    question: null,
    prefetchedQuestion: null,
    sessionQueue: [],
    phase: 'idle',
    selectedAnswer: null,
    result: null,
    filters: { genre: 'all', language: 'english', difficulty: 'medium', artist: 'all' },
    roundFilters: { genre: 'all', language: 'english', difficulty: 'medium', artist: 'all' },
    clipSeconds: CLIP_SECONDS_FOR_DIFFICULTY.medium,
    artistOptions: [],
    recentSongIds: [],
    streak: 0,
    bestSessionStreak: 0,
    lastBrokenStreak: null,
    sessionScore: 0,
    roundsPlayedInSession: 0,
    correctAnswersInSession: 0,
    sessionSummary: null,
    isSummaryVisible: false,
    roundLeaderboards: { daily: null, artist: null, genre: null },
    leaderboard: [],
    leaderboardPeriod: 'all-time',
    leaderboardRank: null,
    leaderboardScope: 'global',
    leaderboardScopeValue: '',
    leaderboardLoading: false,
    history: [],
    stats: null,
    isLoading: false,
    error: null,
    isRating: false,

    // Changing filters invalidates any rounds we prefetched for the old filters.
    setGenre: (genre) => set((state) => ({ filters: { ...state.filters, genre }, prefetchedQuestion: null, sessionQueue: [] })),
    setLanguage: (language) => set((state) => ({ filters: { ...state.filters, language }, prefetchedQuestion: null, sessionQueue: [] })),
    // Tapping a pill also snaps the clip bar to that tier's length — the pills
    // and the bar are two views of the same control.
    setDifficulty: (difficulty) => set((state) => ({
        filters: { ...state.filters, difficulty },
        clipSeconds: CLIP_SECONDS_FOR_DIFFICULTY[difficulty] ?? state.clipSeconds,
        prefetchedQuestion: null,
        sessionQueue: [],
    })),
    // Dragging the bar drives difficulty: the tier is derived from the clip
    // length (0.1s = pro … 10s = easy). Tier changes re-pick the song pool, so
    // they invalidate the prefetched batch — but only on the setup screen.
    // Mid-round the bar just retunes how much of the clip the next replay
    // plays; the live round keeps its difficulty and its queued songs.
    setClipSeconds: (clipSeconds) => set((state) => {
        const clamped = Math.min(CLIP_MAX_SECONDS, Math.max(CLIP_MIN_SECONDS, Math.round(clipSeconds * 10) / 10));
        if (state.phase !== 'idle') return { clipSeconds: clamped };

        const difficulty = difficultyForClipSeconds(clamped);
        if (difficulty === state.filters.difficulty) return { clipSeconds: clamped };
        return {
            clipSeconds: clamped,
            filters: { ...state.filters, difficulty },
            prefetchedQuestion: null,
            sessionQueue: [],
        };
    }),
    setArtist: (artist) => set((state) => ({ filters: { ...state.filters, artist }, prefetchedQuestion: null, sessionQueue: [] })),

    startFreshSession: async () => {
        // Keep any question warmed on the setup screen — startRound will play it
        // instantly. Filter changes already null it out, so it's never stale.
        set({
            question: null,
            phase: 'idle',
            selectedAnswer: null,
            result: null,
            streak: 0,
            bestSessionStreak: 0,
            lastBrokenStreak: null,
            sessionScore: 0,
            roundsPlayedInSession: 0,
            correctAnswersInSession: 0,
            sessionSummary: null,
            isSummaryVisible: false,
            roundLeaderboards: { daily: null, artist: null, genre: null },
            error: null,
        });
        await get().startRound();
    },

    startRound: async () => {
        const { filters, recentSongIds, sessionQueue } = get();

        // Instant start: play the next round straight from the in-memory batch.
        // Rounds 2-5 of a game never touch the network.
        if (sessionQueue.length > 0) {
            const [next, ...rest] = sessionQueue;
            set({
                question: next,
                sessionQueue: rest,
                prefetchedQuestion: rest[0] ?? null,
                roundFilters: next.filters ?? filters,
                result: null,
                selectedAnswer: null,
                error: null,
                lastBrokenStreak: null,
                phase: 'playing',
                isLoading: false,
            });
            return;
        }

        // Empty queue — pull a whole game's worth of rounds in a single request.
        const excludeSongIds = recentSongIds.slice(0, 40);
        set({ isLoading: true, question: null, result: null, selectedAnswer: null, phase: 'idle', error: null, lastBrokenStreak: null });
        try {
            const res = await gameService.getSession(filters, ROUND_LIMIT, excludeSongIds);
            const batch = getApiData<GameSessionBatch>(res);
            const questions = batch?.questions ?? [];
            if (questions.length === 0) throw new Error('Invalid session payload');

            const [first, ...rest] = questions;
            set({
                question: first,
                sessionQueue: rest,
                prefetchedQuestion: rest[0] ?? null,
                roundFilters: first.filters ?? filters,
                phase: 'playing',
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false, error: getApiError(error, 'Could not load a song clip.') });
        }
    },

    // Warm the whole game batch while the player is still on the setup screen, so
    // "Play" starts instantly. No-op once a batch is in hand.
    prefetchNextQuestion: async () => {
        const { filters, recentSongIds, sessionQueue, isLoading } = get();
        if (sessionQueue.length > 0 || isLoading) return; // already warm / fetching

        const excludeSongIds = recentSongIds.slice(0, 40);
        try {
            const res = await gameService.getSession(filters, ROUND_LIMIT, excludeSongIds);
            const batch = getApiData<GameSessionBatch>(res);
            const questions = batch?.questions ?? [];
            // Only keep it if nothing changed meanwhile (filters null the queue and
            // a started round sets question).
            if (questions.length > 0 && get().sessionQueue.length === 0 && !get().question) {
                set({ sessionQueue: questions, prefetchedQuestion: questions[0] ?? null });
            }
        } catch {
            // Best-effort; startRound will fetch on demand.
        }
    },

    // Drop a warmed/partial batch so the next game pulls fresh songs (used by
    // "New Game" and "Back to setup").
    clearSession: () => set({ sessionQueue: [], prefetchedQuestion: null }),

    submitAnswer: async (answer, responseTimeMs = 0, hintsUsed = 0) => {
        const { question, streak, roundFilters } = get();
        if (!question) return;

        // Instant path: batched rounds carry their reveal data, so the result
        // resolves with zero network. The answer is still POSTed in the
        // background (fire-and-forget) where the server re-scores it
        // authoritatively for the leaderboard.
        const reveal = question.reveal;
        if (reveal) {
            const correct = answer === reveal.correctAnswer;
            const { pointsAwarded, speedBonus, multiplier, xpEarned } = scoreAnswerLocally(correct, streak, responseTimeMs, roundFilters.difficulty, hintsUsed);
            const result: GameResult = {
                correct,
                correctAnswer: reveal.correctAnswer,
                correctArtist: reveal.correctArtist,
                album: reveal.album,
                artworkUrl: reveal.artworkUrl,
                trackUrl: reveal.trackUrl,
                trackId: reveal.trackId,
                songKey: reveal.songKey,
                xpEarned,
                pointsAwarded,
                speedBonus,
                multiplier,
                responseTimeMs,
                filters: roundFilters,
            };

            const newStreak = correct ? streak + 1 : 0;
            let shouldShowSummary = false;
            set((s) => {
                const roundsPlayed = s.roundsPlayedInSession + 1;
                const correctAnswers = s.correctAnswersInSession + (correct ? 1 : 0);
                const totalScore = s.sessionScore + pointsAwarded;
                const bestStreak = correct ? Math.max(s.bestSessionStreak, newStreak) : s.bestSessionStreak;
                shouldShowSummary = roundsPlayed >= ROUND_LIMIT;

                return {
                    result,
                    phase: 'result',
                    streak: newStreak,
                    bestSessionStreak: bestStreak,
                    lastBrokenStreak: correct ? null : (streak > 0 ? streak : null),
                    sessionScore: totalScore,
                    roundsPlayedInSession: roundsPlayed,
                    correctAnswersInSession: correctAnswers,
                    sessionSummary: shouldShowSummary
                        ? {
                            roundsPlayed,
                            correctAnswers,
                            accuracy: Math.round((correctAnswers / roundsPlayed) * 100),
                            totalScore,
                            bestStreak,
                        }
                        : s.sessionSummary,
                    isSummaryVisible: shouldShowSummary,
                    recentSongIds: correct && reveal.songKey
                        ? [reveal.songKey, ...s.recentSongIds.filter((item) => item !== reveal.songKey)].slice(0, 60)
                        : s.recentSongIds,
                };
            });

            // Log the heard track into the local listening diary so the culture
            // page auto-fills from play. songKey embeds the real track id as its
            // first segment, which is stable across plays (unlike the per-request
            // token in trackId) and matches the culture catalog's ids.
            const diaryId = reveal.songKey ? decodeURIComponent(reveal.songKey.split('~')[0]) : reveal.trackId;
            if (diaryId && reveal.artworkUrl) {
                useDiaryStore.getState().logPlay({
                    trackId: diaryId,
                    title: reveal.correctAnswer,
                    artist: reveal.correctArtist ?? '',
                    album: reveal.album,
                    albumArt: reveal.artworkUrl,
                    trackUrl: reveal.trackUrl,
                });
            }

            // Persist in the background — the reveal already showed instantly.
            void gameService.submitAnswer(question.songId, answer, streak, responseTimeMs, roundFilters, hintsUsed).catch(() => {});

            if (shouldShowSummary) {
                void get().fetchStats();
                void get().fetchHistory();
                void get().fetchLeaderboard(get().leaderboardPeriod);
                void get().fetchRoundLeaderboards();
            }
            return;
        }

        // Legacy path: no embedded reveal (e.g. the /game/question endpoint) —
        // resolve over the network as before.
        set({ selectedAnswer: answer, phase: 'answered' });
        try {
            const res = await gameService.submitAnswer(question.songId, answer, streak, responseTimeMs, roundFilters, hintsUsed);
            const result = getApiData<GameResult>(res);
            if (!result) throw new Error('Invalid answer payload');

            const newStreak = result.correct ? streak + 1 : 0;
            let shouldShowSummary = false;
            set((s) => {
                const roundsPlayed = s.roundsPlayedInSession + 1;
                const correctAnswers = s.correctAnswersInSession + (result.correct ? 1 : 0);
                const totalScore = s.sessionScore + (result.pointsAwarded ?? 0);
                const bestStreak = result.correct ? Math.max(s.bestSessionStreak, newStreak) : s.bestSessionStreak;
                shouldShowSummary = roundsPlayed >= ROUND_LIMIT;

                return {
                    result,
                    phase: 'result',
                    streak: newStreak,
                    bestSessionStreak: bestStreak,
                    lastBrokenStreak: result.correct ? null : (streak > 0 ? streak : null),
                    sessionScore: totalScore,
                    roundsPlayedInSession: roundsPlayed,
                    correctAnswersInSession: correctAnswers,
                    sessionSummary: shouldShowSummary
                        ? {
                            roundsPlayed,
                            correctAnswers,
                            accuracy: Math.round((correctAnswers / roundsPlayed) * 100),
                            totalScore,
                            bestStreak,
                        }
                        : s.sessionSummary,
                    isSummaryVisible: shouldShowSummary,
                    recentSongIds: result.correct && result.songKey
                        ? [result.songKey, ...s.recentSongIds.filter((item) => item !== result.songKey)].slice(0, 60)
                        : s.recentSongIds,
                };
            });
            // Only hit the network at the end of a session. Firing stats/history/
            // leaderboard on every single answer made each round feel sluggish
            // (3+ serverless round-trips per guess). The live score/streak shown
            // mid-game is already tracked locally above.
            if (shouldShowSummary) {
                void get().fetchStats();
                void get().fetchHistory();
                void get().fetchLeaderboard(get().leaderboardPeriod);
                void get().fetchRoundLeaderboards();
            }
        } catch (error) {
            set({
                phase: 'idle',
                question: null,
                selectedAnswer: null,
                error: getApiError(error, 'Could not submit this guess.'),
            });
        }
    },

    rateTrack: async (rating) => {
        const { result, roundFilters } = get();
        if (!result?.trackId) return;

        set({ isRating: true });
        try {
            await gameService.rateTrack(result.trackId, rating, roundFilters);
            get().fetchStats();
        } finally {
            set({ isRating: false });
        }
    },

    resetRound: () => set({ question: null, phase: 'idle', selectedAnswer: null, result: null, lastBrokenStreak: null, error: null }),
    revealSessionSummary: () => set((state) => ({
        isSummaryVisible: true,
        sessionSummary: state.sessionSummary ?? {
            roundsPlayed: state.roundsPlayedInSession,
            correctAnswers: state.correctAnswersInSession,
            accuracy: state.roundsPlayedInSession > 0
                ? Math.round((state.correctAnswersInSession / state.roundsPlayedInSession) * 100)
                : 0,
            totalScore: state.sessionScore,
            bestStreak: state.bestSessionStreak,
        },
    })),
    dismissSessionSummary: () => set({ isSummaryVisible: false, sessionSummary: null }),

    fetchStats: async () => {
        try {
            const res = await gameService.getStats();
            set({ stats: getApiData<GameStats>(res) ?? null });
        } catch {
            set({ stats: null });
        }
    },

    fetchLeaderboard: async (period, scope, scopeValue) => {
        const requestedPeriod = period ?? get().leaderboardPeriod;
        const requestedScope = scope ?? get().leaderboardScope;
        const requestedScopeValue = scopeValue ?? get().leaderboardScopeValue;
        set({ leaderboardLoading: true });
        try {
            const res = await gameService.getLeaderboard(requestedPeriod, requestedScope, requestedScopeValue);
            const payload = getApiData<LeaderboardData>(res);

            set({
                leaderboard: Array.isArray(payload?.entries) ? payload.entries : [],
                leaderboardRank: payload?.userRank ?? null,
                leaderboardPeriod: payload?.period ?? requestedPeriod,
                leaderboardScope: requestedScope,
                leaderboardScopeValue: requestedScopeValue,
                leaderboardLoading: false,
            });
        } catch {
            set({
                leaderboard: [],
                leaderboardRank: null,
                leaderboardPeriod: requestedPeriod,
                leaderboardScope: requestedScope,
                leaderboardScopeValue: requestedScopeValue,
                leaderboardLoading: false,
            });
        }
    },

    fetchRoundLeaderboards: async () => {
        const { filters, roundFilters, result } = get();
        const activeFilters = result?.filters ?? roundFilters ?? filters;
        const artistValue = activeFilters.artist !== 'all'
            ? activeFilters.artist
            : result?.correctArtist;
        const genreValue = activeFilters.genre !== 'all' ? activeFilters.genre : undefined;

        try {
            const [daily, artist, genre] = await Promise.all([
                gameService.getLeaderboard('daily'),
                artistValue ? gameService.getLeaderboard('daily', 'artist', artistValue) : Promise.resolve(null),
                genreValue ? gameService.getLeaderboard('daily', 'genre', genreValue) : Promise.resolve(null),
            ]);

            set({
                roundLeaderboards: {
                    daily: getApiData<LeaderboardData>(daily) ?? null,
                    artist: artist ? getApiData<LeaderboardData>(artist) ?? null : null,
                    genre: genre ? getApiData<LeaderboardData>(genre) ?? null : null,
                },
            });
        } catch {
            set({ roundLeaderboards: { daily: null, artist: null, genre: null } });
        }
    },

    fetchHistory: async () => {
        try {
            const res = await gameService.getHistory();
            const history = getApiData<GameSession[]>(res);
            set({ history: Array.isArray(history) ? history : [] });
        } catch {
            set({ history: [] });
        }
    },

    fetchArtists: async () => {
        try {
            const res = await gameService.getArtists();
            const artists = getApiData<GameArtistOption[]>(res);
            set({ artistOptions: Array.isArray(artists) ? artists : [] });
        } catch {
            set({ artistOptions: [] });
        }
    },
}));

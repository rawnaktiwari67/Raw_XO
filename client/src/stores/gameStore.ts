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
    GameStats,
    LeaderboardEntry,
    LeaderboardScope,
    RoundLeaderboards,
    GameSession,
} from '../types/game';
import { gameService } from '../services/gameService';

type Phase = 'idle' | 'playing' | 'answered' | 'result';
const ROUND_LIMIT = 5;

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
    phase: Phase;
    selectedAnswer: string | null;
    result: GameResult | null;
    filters: GameFilters;
    roundFilters: GameFilters;
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
    history: GameSession[];
    stats: GameStats | null;
    isLoading: boolean;
    error: string | null;
    isRating: boolean;

    setGenre: (genre: GameGenre) => void;
    setLanguage: (language: GameLanguage) => void;
    setDifficulty: (difficulty: GameDifficulty) => void;
    setArtist: (artist: string) => void;
    startRound: () => Promise<void>;
    prefetchNextQuestion: () => Promise<void>;
    startFreshSession: () => Promise<void>;
    submitAnswer: (answer: string, responseTimeMs?: number) => Promise<void>;
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
    phase: 'idle',
    selectedAnswer: null,
    result: null,
    filters: { genre: 'all', language: 'english', difficulty: 'medium', artist: 'all' },
    roundFilters: { genre: 'all', language: 'english', difficulty: 'medium', artist: 'all' },
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
    history: [],
    stats: null,
    isLoading: false,
    error: null,
    isRating: false,

    // Changing filters invalidates any question we prefetched for the old filters.
    setGenre: (genre) => set((state) => ({ filters: { ...state.filters, genre }, prefetchedQuestion: null })),
    setLanguage: (language) => set((state) => ({ filters: { ...state.filters, language }, prefetchedQuestion: null })),
    setDifficulty: (difficulty) => set((state) => ({ filters: { ...state.filters, difficulty }, prefetchedQuestion: null })),
    setArtist: (artist) => set((state) => ({ filters: { ...state.filters, artist }, prefetchedQuestion: null })),

    startFreshSession: async () => {
        set({
            question: null,
            prefetchedQuestion: null,
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
        const { filters, recentSongIds, prefetchedQuestion } = get();

        // Instant start: if we prefetched the next clip during the result screen,
        // play it immediately instead of waiting on another network round-trip.
        if (prefetchedQuestion) {
            set({
                question: prefetchedQuestion,
                prefetchedQuestion: null,
                roundFilters: prefetchedQuestion.filters ?? filters,
                result: null,
                selectedAnswer: null,
                error: null,
                lastBrokenStreak: null,
                phase: 'playing',
                isLoading: false,
            });
            return;
        }

        const excludeSongIds = recentSongIds.slice(0, 40);
        set({ isLoading: true, question: null, result: null, selectedAnswer: null, phase: 'idle', error: null, lastBrokenStreak: null });
        try {
            const res = await gameService.getQuestion(filters, excludeSongIds);
            const question = getApiData<GameQuestion>(res);
            if (!question) throw new Error('Invalid question payload');

            set({
                question,
                roundFilters: question.filters ?? filters,
                phase: 'playing',
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false, error: getApiError(error, 'Could not load a song clip.') });
        }
    },

    prefetchNextQuestion: async () => {
        const { filters, recentSongIds, prefetchedQuestion } = get();
        if (prefetchedQuestion) return; // already warmed

        const excludeSongIds = recentSongIds.slice(0, 40);
        try {
            const res = await gameService.getQuestion(filters, excludeSongIds);
            const question = getApiData<GameQuestion>(res);
            // Only keep it if the player hasn't already moved on / changed filters.
            if (question && !get().prefetchedQuestion) {
                set({ prefetchedQuestion: question });
            }
        } catch {
            // Prefetch is best-effort; startRound will fetch normally on miss.
        }
    },

    submitAnswer: async (answer, responseTimeMs = 0) => {
        const { question, streak, roundFilters } = get();
        if (!question) return;
        set({ selectedAnswer: answer, phase: 'answered' });
        try {
            const res = await gameService.submitAnswer(question.songId, answer, streak, responseTimeMs, roundFilters);
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

    fetchLeaderboard: async (period, scope = 'global', scopeValue) => {
        const requestedPeriod = period ?? get().leaderboardPeriod;
        try {
            const res = await gameService.getLeaderboard(requestedPeriod, scope, scopeValue);
            const payload = getApiData<LeaderboardData>(res);

            set({
                leaderboard: Array.isArray(payload?.entries) ? payload.entries : [],
                leaderboardRank: payload?.userRank ?? null,
                leaderboardPeriod: payload?.period ?? requestedPeriod,
            });
        } catch {
            set({ leaderboard: [], leaderboardRank: null, leaderboardPeriod: requestedPeriod });
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

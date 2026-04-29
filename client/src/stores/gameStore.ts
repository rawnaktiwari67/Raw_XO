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
    GameSession,
} from '../types/game';
import { gameService } from '../services/gameService';

type Phase = 'idle' | 'playing' | 'answered' | 'result';

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
    submitAnswer: (answer: string, responseTimeMs?: number) => Promise<void>;
    rateTrack: (rating: number) => Promise<void>;
    resetRound: () => void;
    dismissSessionSummary: () => void;
    fetchStats: () => Promise<void>;
    fetchLeaderboard: (period?: LeaderboardPeriod) => Promise<void>;
    fetchHistory: () => Promise<void>;
    fetchArtists: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
    question: null,
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
    leaderboard: [],
    leaderboardPeriod: 'all-time',
    leaderboardRank: null,
    history: [],
    stats: null,
    isLoading: false,
    error: null,
    isRating: false,

    setGenre: (genre) => set((state) => ({ filters: { ...state.filters, genre } })),
    setLanguage: (language) => set((state) => ({ filters: { ...state.filters, language } })),
    setDifficulty: (difficulty) => set((state) => ({ filters: { ...state.filters, difficulty } })),
    setArtist: (artist) => set((state) => ({ filters: { ...state.filters, artist } })),

    startRound: async () => {
        const { filters, recentSongIds } = get();
        const excludeSongIds = recentSongIds.slice(0, 12);
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

    submitAnswer: async (answer, responseTimeMs = 0) => {
        const { question, streak, roundFilters } = get();
        if (!question) return;
        set({ selectedAnswer: answer, phase: 'answered' });
        try {
            const res = await gameService.submitAnswer(question.songId, answer, streak, responseTimeMs, roundFilters);
            const result = getApiData<GameResult>(res);
            if (!result) throw new Error('Invalid answer payload');

            const newStreak = result.correct ? streak + 1 : 0;
            set((s) => ({
                result,
                phase: 'result',
                streak: newStreak,
                bestSessionStreak: result.correct ? Math.max(s.bestSessionStreak, newStreak) : s.bestSessionStreak,
                lastBrokenStreak: result.correct ? null : (streak > 0 ? streak : null),
                sessionScore: s.sessionScore + (result.pointsAwarded ?? 0),
                roundsPlayedInSession: s.roundsPlayedInSession + 1,
                correctAnswersInSession: s.correctAnswersInSession + (result.correct ? 1 : 0),
                recentSongIds: result.songKey ? [result.songKey, ...s.recentSongIds.filter((item) => item !== result.songKey)].slice(0, 18) : s.recentSongIds,
            }));
            const nextState = get();
            if (nextState.roundsPlayedInSession > 0 && nextState.roundsPlayedInSession % 6 === 0) {
                set({
                    isSummaryVisible: true,
                    sessionSummary: {
                        roundsPlayed: nextState.roundsPlayedInSession,
                        correctAnswers: nextState.correctAnswersInSession,
                        accuracy: Math.round((nextState.correctAnswersInSession / nextState.roundsPlayedInSession) * 100),
                        totalScore: nextState.sessionScore,
                        bestStreak: nextState.bestSessionStreak,
                    },
                });
            }
            get().fetchStats();
            get().fetchHistory();
            get().fetchLeaderboard(get().leaderboardPeriod);
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
    dismissSessionSummary: () => set({ isSummaryVisible: false, sessionSummary: null }),

    fetchStats: async () => {
        try {
            const res = await gameService.getStats();
            set({ stats: getApiData<GameStats>(res) ?? null });
        } catch {
            set({ stats: null });
        }
    },

    fetchLeaderboard: async (period) => {
        const requestedPeriod = period ?? get().leaderboardPeriod;
        try {
            const res = await gameService.getLeaderboard(requestedPeriod);
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

import api from './api';
import type { GameFilters, GameLanguage, LeaderboardPeriod } from '../types/game';
import type { LyricGuessRound, MeaningEntry } from '../types/culture';

export const gameService = {
    getQuestion: (filters: GameFilters, excludeSongIds?: string[]) =>
        api.get('/game/question', {
            params: {
                genre: filters.genre,
                language: filters.language,
                difficulty: filters.difficulty,
                artist: filters.artist,
                ...(excludeSongIds && excludeSongIds.length > 0 ? { excludeSongIds: excludeSongIds.join(',') } : {}),
            },
        }),
    submitAnswer: (songId: string, answer: string, streak: number, responseTimeMs: number, filters: GameFilters) =>
        api.post('/game/answer', { songId, answer, streak, responseTimeMs, ...filters }),
    rateTrack: (trackId: string, rating: number, filters: GameFilters) =>
        api.post('/game/rating', { trackId, rating, ...filters }),
    getStats: () => api.get('/game/stats'),
    getLeaderboard: (period: LeaderboardPeriod) =>
        api.get('/game/leaderboard', {
            params: { period },
        }),
    getHistory: () => api.get('/game/history'),
    getArtists: () => api.get('/game/artists'),
    searchArtists: (query: string, language: GameLanguage) =>
        api.get('/game/artists/search', {
            params: { q: query, language },
        }),
    buildLyricGuessRounds: (entries: MeaningEntry[]): LyricGuessRound[] =>
        entries.map((entry, index) => ({
            id: `${entry.trackId}-lyric-round`,
            trackId: entry.trackId,
            title: entry.title,
            artist: entry.artist,
            albumArt: entry.albumArt,
            previewUrl: entry.previewUrl,
            trackUrl: entry.trackUrl,
            snippet: entry.lyricsSnippet,
            meaning: entry.whyItHits,
            options: entries
                .slice(index, index + 1)
                .concat(entries.filter((candidate) => candidate.trackId !== entry.trackId).slice(0, 3))
                .map((candidate) => candidate.title)
                .sort(() => Math.random() - 0.5),
        })),
};

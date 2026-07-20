import api from './api';
import type { GameFilters, GameLanguage, LeaderboardPeriod, LeaderboardScope } from '../types/game';
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
    // Fetch a whole game's rounds in one request so gameplay needs no per-round
    // network calls (see GET /game/session).
    getSession: (filters: GameFilters, count = 5, excludeSongIds?: string[]) =>
        api.get('/game/session', {
            params: {
                genre: filters.genre,
                language: filters.language,
                difficulty: filters.difficulty,
                artist: filters.artist,
                count,
                ...(excludeSongIds && excludeSongIds.length > 0 ? { excludeSongIds: excludeSongIds.join(',') } : {}),
            },
        }),
    submitAnswer: (songId: string, answer: string, streak: number, responseTimeMs: number, filters: GameFilters, hintsUsed = 0, replaysUsed = 0) =>
        api.post('/game/answer', { songId, answer, streak, responseTimeMs, hintsUsed, replaysUsed, ...filters }),
    rateTrack: (trackId: string, rating: number, filters: GameFilters) =>
        api.post('/game/rating', { trackId, rating, ...filters }),
    getStats: () => api.get('/game/stats'),
    getLeaderboard: (period: LeaderboardPeriod, scope: LeaderboardScope = 'global', scopeValue?: string) =>
        api.get('/game/leaderboard', {
            params: {
                period,
                scope,
                ...(scopeValue ? { scopeValue } : {}),
            },
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

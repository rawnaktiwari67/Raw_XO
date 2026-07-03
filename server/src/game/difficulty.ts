// Difficulty-aware song selection: how the pool is filtered per difficulty,
// how the correct track is weighted, and how plausible-but-wrong distractors
// are scored and picked. Pure functions (aside from Math.random in the pickers)
// so the scoring logic can be unit-tested in isolation.

import { shuffle } from '../utils/gameLogic';
import type { SongPreview } from '../utils/songTokens';
import type { GameDifficulty } from './types';
import {
    isAlternateTrackVersion,
    normalizeArtistKey,
    normalizeTitle,
    normalizeTrackTitleKey,
    titleTokens,
} from './songText';

export const applyDifficulty = (songs: SongPreview[], difficulty: GameDifficulty): SongPreview[] => {
    const studioLeaningSongs = songs.filter((song) => !isAlternateTrackVersion(`${song.title} ${song.album}`));
    const source = studioLeaningSongs.length >= 8 ? studioLeaningSongs : songs;
    const byRecent = [...source].sort((a, b) => b.releaseYear - a.releaseYear);
    const byOlderLongCuts = [...source].sort((a, b) => {
        if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
        return b.durationMs - a.durationMs;
    });

    if (difficulty === 'easy') {
        const recent = byRecent.filter((song) => song.releaseYear >= 2018);
        return (recent.length >= 4 ? recent : byRecent).slice(0, Math.min(48, source.length));
    }

    if (difficulty === 'hard') {
        const olderLongCuts = byOlderLongCuts.filter((song) => song.releaseYear <= 2015 && song.durationMs >= 240000);
        return (olderLongCuts.length >= 4 ? olderLongCuts : byOlderLongCuts).slice(0, Math.min(44, source.length));
    }

    const medium = byRecent.filter((song) => song.releaseYear >= 2012);
    return (medium.length >= 4 ? medium : byRecent).slice(0, Math.min(54, source.length));
};

// Stream popularity nudge (0–100 scale). Easy leans toward the hits everyone
// knows, hard toward the deep cuts, medium toward the familiar-but-not-obvious
// middle. Returns 0 when we have no popularity signal (iTunes-only with the rank
// proxy disabled), so selection falls back cleanly to the age/duration heuristic.
export const popularityBoost = (popularity: number, difficulty: GameDifficulty): number => {
    if (popularity < 0) return 0;
    const pop = Math.max(0, Math.min(100, popularity));

    if (difficulty === 'easy') return (pop / 100) * 22;
    if (difficulty === 'hard') return ((100 - pop) / 100) * 22;
    return Math.max(0, 16 - Math.abs(pop - 55) * 0.32);
};

export const songWeight = (song: SongPreview, difficulty: GameDifficulty): number => {
    const currentYear = new Date().getFullYear();
    const age = song.releaseYear > 0 ? Math.max(0, currentYear - song.releaseYear) : 8;
    const durationMinutes = song.durationMs > 0 ? song.durationMs / 60000 : 3.5;
    const popBoost = popularityBoost(song.popularity, difficulty);

    if (difficulty === 'easy') {
        return Math.max(1, 18 - age) + Math.max(0, 5 - Math.abs(durationMinutes - 3.4)) + popBoost;
    }

    if (difficulty === 'hard') {
        return Math.max(1, age + Math.min(durationMinutes, 7)) + popBoost;
    }

    return Math.max(1, 12 - Math.abs(age - 6)) + Math.max(0, 4 - Math.abs(durationMinutes - 3.6)) + popBoost;
};

export const pickWeightedSong = (songs: SongPreview[], difficulty: GameDifficulty): SongPreview => {
    const weights = songs.map((song) => songWeight(song, difficulty));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = Math.random() * total;

    for (let index = 0; index < songs.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return songs[index];
    }

    return songs[songs.length - 1];
};

export const titleOverlapScore = (left: string, right: string): number => {
    const leftTokens = titleTokens(left);
    if (leftTokens.length === 0) return 0;
    const rightTokenSet = new Set(titleTokens(right));
    return leftTokens.filter((token) => rightTokenSet.has(token)).length;
};

export const distractorScore = (candidate: SongPreview, correct: SongPreview, difficulty: GameDifficulty): number => {
    const sameArtist = normalizeArtistKey(candidate.artist) === normalizeArtistKey(correct.artist) ? 14 : 0;
    const sameAlbum = normalizeTitle(candidate.album) && normalizeTitle(candidate.album) === normalizeTitle(correct.album) ? 6 : 0;
    const sameEra = candidate.releaseYear && correct.releaseYear
        ? Math.max(0, 8 - Math.abs(candidate.releaseYear - correct.releaseYear))
        : 1;
    const similarLength = candidate.durationMs && correct.durationMs
        ? Math.max(0, 4 - Math.abs(candidate.durationMs - correct.durationMs) / 45_000)
        : 0;
    const titlePenalty = titleOverlapScore(candidate.title, correct.title) * 8;

    if (difficulty === 'easy') {
        return sameEra + similarLength - sameArtist - sameAlbum - titlePenalty;
    }

    if (difficulty === 'hard') {
        return sameArtist + sameAlbum + sameEra * 1.35 + similarLength - titlePenalty;
    }

    return sameArtist * 0.55 + sameAlbum * 0.35 + sameEra + similarLength - titlePenalty;
};

export const pickDistractors = (songs: SongPreview[], correct: SongPreview, difficulty: GameDifficulty): SongPreview[] => {
    const seenTitles = new Set([normalizeTrackTitleKey(correct.title)]);
    const eligible = songs.filter((song) => {
        if (song.id === correct.id) return false;
        const titleKey = normalizeTrackTitleKey(song.title);
        if (!titleKey || seenTitles.has(titleKey)) return false;
        seenTitles.add(titleKey);
        return true;
    });

    const ranked = shuffle(eligible)
        .map((song) => ({ song, score: distractorScore(song, correct, difficulty) }))
        .sort((a, b) => b.score - a.score);
    const shortlistSize = difficulty === 'hard' ? 10 : difficulty === 'medium' ? 12 : 16;
    const shortlist = ranked.slice(0, Math.min(shortlistSize, ranked.length));
    const picks: SongPreview[] = [];

    while (picks.length < 3 && shortlist.length > 0) {
        const total = shortlist.reduce((sum, item) => sum + Math.max(1, item.score + 12), 0);
        let cursor = Math.random() * total;
        const selectedIndex = shortlist.findIndex((item) => {
            cursor -= Math.max(1, item.score + 12);
            return cursor <= 0;
        });
        const [selected] = shortlist.splice(selectedIndex >= 0 ? selectedIndex : shortlist.length - 1, 1);
        picks.push(selected.song);
    }

    return picks;
};

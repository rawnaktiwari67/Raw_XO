import { describe, it, expect } from 'vitest';
import type { SongPreview } from '../utils/songTokens';
import {
    applyDifficulty,
    popularityBoost,
    songWeight,
    distractorScore,
    pickDistractors,
} from './difficulty';

const song = (over: Partial<SongPreview> & { id: string }): SongPreview => ({
    title: 'Track',
    artist: 'Artist',
    album: 'Album',
    releaseYear: 2020,
    durationMs: 200000,
    snippetUrl: 'https://example.com/p.m4a',
    artworkUrl: 'https://example.com/a.jpg',
    trackUrl: 'https://example.com/t',
    popularity: 50,
    ...over,
});

describe('popularityBoost', () => {
    it('returns 0 when there is no popularity signal', () => {
        expect(popularityBoost(-1, 'easy')).toBe(0);
    });

    it('rewards popular tracks on easy and unpopular tracks on hard', () => {
        expect(popularityBoost(100, 'easy')).toBeGreaterThan(popularityBoost(0, 'easy'));
        expect(popularityBoost(0, 'hard')).toBeGreaterThan(popularityBoost(100, 'hard'));
    });

    it('peaks in the middle for medium difficulty', () => {
        expect(popularityBoost(55, 'medium')).toBeGreaterThan(popularityBoost(0, 'medium'));
        expect(popularityBoost(55, 'medium')).toBeGreaterThan(popularityBoost(100, 'medium'));
    });
});

describe('songWeight', () => {
    it('weights a recent hit higher than an old track on easy', () => {
        const recent = song({ id: 'a', releaseYear: 2023, popularity: 90 });
        const old = song({ id: 'b', releaseYear: 2001, popularity: 20 });
        expect(songWeight(recent, 'easy')).toBeGreaterThan(songWeight(old, 'easy'));
    });

    it('weights an old long cut higher than a recent one on hard', () => {
        const oldLong = song({ id: 'a', releaseYear: 2001, durationMs: 360000, popularity: 20 });
        const recent = song({ id: 'b', releaseYear: 2023, durationMs: 180000, popularity: 90 });
        expect(songWeight(oldLong, 'hard')).toBeGreaterThan(songWeight(recent, 'hard'));
    });
});

describe('applyDifficulty', () => {
    const pool = [
        song({ id: '1', releaseYear: 2023 }),
        song({ id: '2', releaseYear: 2021 }),
        song({ id: '3', releaseYear: 2019 }),
        song({ id: '4', releaseYear: 2016 }),
        song({ id: '5', releaseYear: 2010, durationMs: 300000 }),
        song({ id: '6', releaseYear: 2005, durationMs: 260000 }),
        song({ id: '7', releaseYear: 2000, durationMs: 250000 }),
        song({ id: '8', releaseYear: 1998, durationMs: 280000 }),
    ];

    it('easy skews recent (newest first)', () => {
        const result = applyDifficulty(pool, 'easy');
        expect(result[0].releaseYear).toBeGreaterThanOrEqual(result[result.length - 1].releaseYear);
        expect(result[0].releaseYear).toBe(2023);
    });

    it('hard skews older long cuts (oldest first)', () => {
        const result = applyDifficulty(pool, 'hard');
        expect(result[0].releaseYear).toBeLessThanOrEqual(2015);
    });

    it('never returns more than the source size', () => {
        expect(applyDifficulty(pool, 'medium').length).toBeLessThanOrEqual(pool.length);
    });
});

describe('distractorScore', () => {
    const correct = song({ id: 'c', artist: 'The Weeknd', album: 'After Hours', releaseYear: 2020, durationMs: 200000 });

    it('penalizes title overlap with the correct track', () => {
        const overlapping = song({ id: 'x', title: 'Blinding Lights Reprise', artist: 'Other', album: 'X' });
        const distinct = song({ id: 'y', title: 'Totally Different', artist: 'Other', album: 'X' });
        const correctTitled = song({ ...correct, title: 'Blinding Lights' });
        expect(distractorScore(overlapping, correctTitled, 'medium'))
            .toBeLessThan(distractorScore(distinct, correctTitled, 'medium'));
    });

    it('rewards same-artist candidates on hard but penalizes them on easy', () => {
        const sameArtist = song({ id: 'x', artist: 'The Weeknd', album: 'Starboy', releaseYear: 2016 });
        expect(distractorScore(sameArtist, correct, 'hard')).toBeGreaterThan(0);
        expect(distractorScore(sameArtist, correct, 'easy')).toBeLessThan(0);
    });
});

describe('pickDistractors', () => {
    const correct = song({ id: 'c', title: 'Correct' });
    const pool = Array.from({ length: 10 }, (_, i) =>
        song({ id: String(i), title: `Song ${i}` })
    );

    it('returns 3 distractors, none of which is the correct track', () => {
        const picks = pickDistractors([correct, ...pool], correct, 'medium');
        expect(picks).toHaveLength(3);
        expect(picks.some((p) => p.id === correct.id)).toBe(false);
    });

    it('returns unique tracks', () => {
        const picks = pickDistractors([correct, ...pool], correct, 'hard');
        const ids = new Set(picks.map((p) => p.id));
        expect(ids.size).toBe(picks.length);
    });

    it('dedupes tracks that share a normalized title', () => {
        const dupes = [
            correct,
            song({ id: 'a', title: 'Same Title' }),
            song({ id: 'b', title: 'Same Title (Remastered)' }),
            song({ id: 'd', title: 'Unique One' }),
        ];
        const picks = pickDistractors(dupes, correct, 'medium');
        const titles = picks.map((p) => p.title.includes('Same Title'));
        // At most one of the two "Same Title" variants can appear.
        expect(titles.filter(Boolean).length).toBeLessThanOrEqual(1);
    });
});

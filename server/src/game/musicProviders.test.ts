import { describe, it, expect } from 'vitest';
import { bestSpotifyImage, spotifyReleaseYear } from './musicProviders';

describe('spotifyReleaseYear', () => {
    it('extracts the year from a full or partial Spotify date', () => {
        expect(spotifyReleaseYear('2020-03-20')).toBe(2020);
        expect(spotifyReleaseYear('1999')).toBe(1999);
    });

    it('returns 0 for missing or unparseable dates', () => {
        expect(spotifyReleaseYear(undefined)).toBe(0);
        expect(spotifyReleaseYear('')).toBe(0);
        expect(spotifyReleaseYear('not-a-date')).toBe(0);
    });
});

describe('bestSpotifyImage', () => {
    it('returns empty string when there are no images', () => {
        expect(bestSpotifyImage([])).toBe('');
        expect(bestSpotifyImage()).toBe('');
    });

    it('picks the smallest image that still meets the 300px target', () => {
        const images = [
            { url: 'big', width: 640 },
            { url: 'target', width: 300 },
            { url: 'small', width: 64 },
        ];
        expect(bestSpotifyImage(images)).toBe('target');
    });

    it('falls back to the largest image when none reach the target', () => {
        const images = [
            { url: 'tiny', width: 64 },
            { url: 'mid', width: 160 },
        ];
        expect(bestSpotifyImage(images)).toBe('mid');
    });

    it('ignores images without a url', () => {
        const images = [
            { width: 500 },
            { url: 'only-real', width: 320 },
        ];
        expect(bestSpotifyImage(images)).toBe('only-real');
    });
});

import { describe, it, expect } from 'vitest';
import {
    normalizeTitle,
    normalizeArtistKey,
    normalizeTrackTitleKey,
    isAlternateTrackVersion,
    isLikelySameArtist,
} from './songText';

describe('normalizeTitle', () => {
    it('lowercases and collapses whitespace', () => {
        expect(normalizeTitle('  The   Weeknd  ')).toBe('the weeknd');
    });
});

describe('normalizeArtistKey', () => {
    it('strips featured artists', () => {
        expect(normalizeArtistKey('Drake feat. Rihanna')).toBe('drake');
        expect(normalizeArtistKey('Metro Boomin ft. The Weeknd')).toBe('metro boomin');
    });

    it('keeps ampersands but drops other punctuation', () => {
        expect(normalizeArtistKey('Tyler, the Creator')).toBe('tyler the creator');
        expect(normalizeArtistKey('Simon & Garfunkel')).toBe('simon & garfunkel');
    });
});

describe('normalizeTrackTitleKey', () => {
    it('strips remaster / live / version qualifiers in brackets', () => {
        expect(normalizeTrackTitleKey('Creep (Remastered 2008)')).toBe('creep');
        expect(normalizeTrackTitleKey('Wonderwall - Live')).toBe('wonderwall');
        expect(normalizeTrackTitleKey('Redbone (feat. Someone)')).toBe('redbone');
    });

    it('leaves a clean title untouched', () => {
        expect(normalizeTrackTitleKey('Blinding Lights')).toBe('blinding lights');
    });
});

describe('isAlternateTrackVersion', () => {
    it('detects live / remaster / acoustic markers', () => {
        expect(isAlternateTrackVersion('Song (Live)')).toBe(true);
        expect(isAlternateTrackVersion('Song - Remastered')).toBe(true);
        expect(isAlternateTrackVersion('Song - Acoustic')).toBe(true);
    });

    it('treats a plain studio title as not alternate', () => {
        expect(isAlternateTrackVersion('Blinding Lights')).toBe(false);
    });
});

describe('isLikelySameArtist', () => {
    it('matches despite featured artists and casing', () => {
        expect(isLikelySameArtist('The Weeknd', 'the weeknd feat. daft punk')).toBe(true);
    });

    it('matches on prefix tokens', () => {
        expect(isLikelySameArtist('BTS', 'BTS (방탄소년단)')).toBe(true);
    });

    it('rejects an unrelated artist', () => {
        expect(isLikelySameArtist('Drake', 'Taylor Swift')).toBe(false);
    });

    it('is permissive when the requested artist has no usable tokens', () => {
        expect(isLikelySameArtist('', 'Anyone')).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { env } from '../config/env';
import { createSongToken, decodeSongToken, type SongPreview } from './songTokens';

const sampleSong: SongPreview = {
    id: 'track-123',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    releaseYear: 2020,
    durationMs: 200040,
    snippetUrl: 'https://example.com/preview.m4a',
    artworkUrl: 'https://example.com/art.jpg',
    trackUrl: 'https://example.com/track',
    popularity: 95,
};

// Mirror the token's key derivation so we can forge arbitrary payloads and
// prove the shape guard rejects validly-encrypted-but-wrong-shape tokens.
const tokenKey = () => crypto.createHash('sha256').update(env.GAME_SECRET).digest();

const encryptPayload = (payload: unknown): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
    ]);
    return [
        iv.toString('base64url'),
        encrypted.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
    ].join('.');
};

describe('song reveal tokens', () => {
    it('round-trips a song through encrypt then decrypt', () => {
        const token = createSongToken(sampleSong);
        expect(decodeSongToken(token)).toEqual(sampleSong);
    });

    it('produces a fresh IV each call so tokens are non-deterministic', () => {
        const a = createSongToken(sampleSong);
        const b = createSongToken(sampleSong);
        expect(a).not.toEqual(b);
        // ...but both still decode to the same song.
        expect(decodeSongToken(a)).toEqual(sampleSong);
        expect(decodeSongToken(b)).toEqual(sampleSong);
    });

    // Tampering flips the FIRST character of a segment: it always encodes the
    // top six bits of the first byte, so the decoded bytes are guaranteed to
    // change. (The last character can be pure base64url padding bits, which
    // decoding ignores — flipping it made these tests pass or fail depending
    // on the random IV/tag of the run.)
    it('rejects a token with tampered ciphertext', () => {
        const [iv, ciphertext, tag] = createSongToken(sampleSong).split('.');
        const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
        expect(decodeSongToken([iv, flipped, tag].join('.'))).toBeNull();
    });

    it('rejects a token with a tampered auth tag', () => {
        const [iv, ciphertext, tag] = createSongToken(sampleSong).split('.');
        const flipped = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
        expect(decodeSongToken([iv, ciphertext, flipped].join('.'))).toBeNull();
    });

    it('rejects a token with swapped segments', () => {
        const [iv, ciphertext, tag] = createSongToken(sampleSong).split('.');
        expect(decodeSongToken([tag, ciphertext, iv].join('.'))).toBeNull();
    });

    it('rejects malformed tokens', () => {
        expect(decodeSongToken('')).toBeNull();
        expect(decodeSongToken('not-a-token')).toBeNull();
        expect(decodeSongToken('only.two')).toBeNull();
        expect(decodeSongToken('a.b.c')).toBeNull();
        expect(decodeSongToken('...')).toBeNull();
    });

    it('rejects a validly-encrypted token whose payload has the wrong shape', () => {
        // Correct key and auth tag, but missing required fields — the shape
        // guard must still reject it so partial payloads can't be scored.
        const missingFields = encryptPayload({ id: 'x', title: 'y' });
        expect(decodeSongToken(missingFields)).toBeNull();

        const wrongTypes = encryptPayload({
            ...sampleSong,
            releaseYear: '2020', // string instead of number
        });
        expect(decodeSongToken(wrongTypes)).toBeNull();
    });

    it('accepts a validly-encrypted token with all required fields present', () => {
        const token = encryptPayload(sampleSong);
        expect(decodeSongToken(token)).toEqual(sampleSong);
    });
});

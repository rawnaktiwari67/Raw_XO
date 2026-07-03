import crypto from 'crypto';
import { env } from '../config/env';

/**
 * The song payload carried inside an encrypted reveal token. It is issued with
 * each question and validated on answer submission, so a client can't spoof or
 * tamper with which track it is answering for.
 */
export type SongPreview = {
    id: string;
    title: string;
    artist: string;
    album: string;
    releaseYear: number;
    durationMs: number;
    snippetUrl: string;
    artworkUrl: string;
    trackUrl: string;
    // 0–100 stream popularity. Real value from Spotify when available; a rank-based
    // approximation for iTunes-only results; -1 when we have no signal at all.
    popularity: number;
};

const tokenKey = (): Buffer =>
    crypto.createHash('sha256').update(env.GAME_SECRET).digest();

/**
 * Encrypt a song into a tamper-resistant reveal token (AES-256-GCM). The GCM
 * auth tag makes any modification to the ciphertext detectable on decode.
 */
export const createSongToken = (song: SongPreview): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(song), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        iv.toString('base64url'),
        encrypted.toString('base64url'),
        authTag.toString('base64url'),
    ].join('.');
};

/**
 * Decrypt and validate a reveal token. Returns null for any malformed,
 * tampered, or shape-invalid token rather than throwing.
 */
export const decodeSongToken = (token: string): SongPreview | null => {
    try {
        const [ivValue, encryptedValue, authTagValue] = token.split('.');
        if (!ivValue || !encryptedValue || !authTagValue) return null;

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            tokenKey(),
            Buffer.from(ivValue, 'base64url')
        );
        decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedValue, 'base64url')),
            decipher.final(),
        ]);
        const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<SongPreview>;

        if (
            !parsed.id ||
            !parsed.title ||
            !parsed.artist ||
            !parsed.snippetUrl ||
            typeof parsed.album !== 'string' ||
            typeof parsed.releaseYear !== 'number' ||
            typeof parsed.durationMs !== 'number' ||
            typeof parsed.artworkUrl !== 'string' ||
            typeof parsed.trackUrl !== 'string'
        ) {
            return null;
        }

        return parsed as SongPreview;
    } catch {
        return null;
    }
};

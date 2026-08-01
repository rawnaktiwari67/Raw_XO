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
    // Epoch ms the reveal token was minted. Stamped by createSongToken and read
    // back by decodeSongToken so the answer path can reject stale tokens (see
    // isSongTokenExpired). Absent on pool songs that were never tokenized.
    issuedAt?: number;
};

const tokenKey = (): Buffer =>
    crypto.createHash('sha256').update(env.GAME_SECRET).digest();

// A reveal token is answerable for this long after it's minted. Configurable via
// GAME_TOKEN_TTL_MS; floored at one minute so a misconfiguration can't make every
// token instantly stale.
export const SONG_TOKEN_TTL_MS = Math.max(
    60_000,
    Number.parseInt(env.GAME_TOKEN_TTL_MS, 10) || 60 * 60_000
);

// True when a decoded token is older than the TTL. Tokens minted before this
// field existed (or forged without the secret — impossible, the payload is
// GCM-authenticated) carry no issuedAt and are treated as fresh, so a deploy that
// introduces the TTL never rejects a token already in a player's hand.
export const isSongTokenExpired = (
    song: Pick<SongPreview, 'issuedAt'>,
    now: number = Date.now()
): boolean => typeof song.issuedAt === 'number' && now - song.issuedAt > SONG_TOKEN_TTL_MS;

/**
 * Encrypt a song into a tamper-resistant reveal token (AES-256-GCM). The GCM
 * auth tag makes any modification to the ciphertext detectable on decode.
 */
export const createSongToken = (song: SongPreview): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
    // Stamp the mint time so the answer path can enforce a TTL. Spread first so a
    // re-tokenized song (e.g. the echoed trackId on submit) always gets a fresh
    // issuedAt rather than carrying an older one forward.
    const payload = JSON.stringify({ ...song, issuedAt: Date.now() });
    const encrypted = Buffer.concat([
        cipher.update(payload, 'utf8'),
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

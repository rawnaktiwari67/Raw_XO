import { Request, Response } from 'express';
import crypto from 'crypto';
import GameScore from '../models/GameScore';
import TrackRating from '../models/TrackRating';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from '../utils/devStore';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { calculateLevel, calculateGameXP } from '../utils/xpUtils';
import { env } from '../config/env';
import {
    CURATED_ARTISTS,
    GENRE_QUERY_MAP,
    LANGUAGE_QUERY_MAP,
    INDIA_FOCUSED_LANGUAGES,
    INDIA_FOCUSED_ARTISTS,
    type ArtistProfile,
} from '../config/gameConstants';

type ItunesSearchResult = {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    collectionName?: string;
    releaseDate?: string;
    trackTimeMillis?: number;
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
};

type SongPreview = {
    id: string;
    title: string;
    artist: string;
    album: string;
    releaseYear: number;
    durationMs: number;
    snippetUrl: string;
    artworkUrl: string;
    trackUrl: string;
};

type GameGenre = 'all' | 'hip-hop' | 'pop' | 'rnb' | 'dance';
type GameLanguage = 'all' | 'english' | 'hindi' | 'punjabi' | 'korean' | 'spanish';
type GameDifficulty = 'easy' | 'medium' | 'hard';
type LeaderboardPeriod = 'daily' | 'all-time';
type GameFilters = {
    genre: GameGenre;
    language: GameLanguage;
    difficulty: GameDifficulty;
    artist: string;
};

const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';
const ITUNES_TRACK_LIMIT = Math.min(
    200,
    Math.max(20, Number.parseInt(env.GAME_ITUNES_LIMIT, 10) || 40)
);
const ITUNES_TIMEOUT_MS = Math.min(
    10_000,
    Math.max(1500, Number.parseInt(env.GAME_ITUNES_TIMEOUT_MS, 10) || 4500)
);
const MAX_QUERY_TERMS = Math.min(
    12,
    Math.max(2, Number.parseInt(env.GAME_MAX_QUERY_TERMS, 10) || 6)
);
const TRACK_CACHE_MS = Math.max(
    60_000,
    Number.parseInt(env.GAME_TRACK_CACHE_MS, 10) || 10 * 60_000
);
const SPOTIFY_CACHE_MS = Math.min(TRACK_CACHE_MS, 5 * 60_000);
const SPOTIFY_MARKET = env.GAME_SPOTIFY_MARKET.trim().toUpperCase() || 'US';
const hasSpotifyCredentials = Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
const shouldUseSpotifyTrackSearch = hasSpotifyCredentials && env.GAME_SPOTIFY_TRACK_SEARCH;
const ARTIST_QUERIES = env.GAME_ARTIST_QUERY
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const DEFAULT_ARTIST_QUERIES = ARTIST_QUERIES.length > 0
    ? ARTIST_QUERIES
    : CURATED_ARTISTS.map((artist) => artist.value);

// Override the 'all' bucket to respect the GAME_ARTIST_QUERY env var
GENRE_QUERY_MAP.all = DEFAULT_ARTIST_QUERIES;
type ItunesArtistSearchResult = {
    artistId?: number;
    artistName?: string;
};
type SpotifyImage = {
    url?: string;
    height?: number | null;
    width?: number | null;
};
type SpotifyArtist = {
    id?: string;
    name?: string;
};
type SpotifyAlbum = {
    name?: string;
    release_date?: string;
    images?: SpotifyImage[];
};
type SpotifyTrack = {
    id?: string;
    name?: string;
    artists?: SpotifyArtist[];
    album?: SpotifyAlbum;
    duration_ms?: number;
    preview_url?: string | null;
    external_urls?: { spotify?: string };
    popularity?: number;
};
type SpotifySearchPayload = {
    tracks?: { items?: SpotifyTrack[] };
    artists?: { items?: SpotifyArtist[] };
};
type SpotifyTokenPayload = {
    access_token?: string;
    expires_in?: number;
};

const songPoolCache = new Map<string, { songs: SongPreview[]; fetchedAt: number }>();
const inFlightSongPools = new Map<string, Promise<SongPreview[]>>();
type CorrectSongMemory = {
    id: string;
    titleKey: string;
    artistKey: string;
};

const recentCorrectByCacheKey = new Map<string, CorrectSongMemory[]>();
let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

const hmacSign = (data: string): string =>
    crypto.createHmac('sha256', env.GAME_SECRET).update(data).digest('hex');

const hmacVerify = (data: string, sig: string): boolean => {
    if (!sig) return false;
    const expected = hmacSign(data);
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
};

const tokenKey = (): Buffer =>
    crypto.createHash('sha256').update(env.GAME_SECRET).digest();

const createSongToken = (song: SongPreview): string => {
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

const decodeSongToken = (token: string): SongPreview | null => {
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

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const normalizeTitle = (value: string): string =>
    value.toLowerCase().trim().replace(/\s+/g, ' ');

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeArtistKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeTrackTitleKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/\s*[\(\[]\s*(feat\.?|ft\.?|featuring)\s+.*?[\)\]]/gi, '')
        .replace(/\s*[\(\[].*?(remaster|live|acoustic|version|edit|mix|mono|stereo|deluxe).*?[\)\]]/gi, '')
        .replace(/\s+-\s*(remaster|live|acoustic|version|edit|mix|feat\.?|ft\.?|featuring).*/gi, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const artistTokens = (value: string): string[] =>
    normalizeArtistKey(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && token !== 'the');

const titleTokens = (value: string): string[] =>
    normalizeTrackTitleKey(value)
        .split(' ')
        .filter((token) => token.length >= 3);

const isAlternateTrackVersion = (value: string): boolean =>
    /\b(live|remaster(?:ed)?|acoustic|version|edit|mix|karaoke|instrumental|sped up|slowed|nightcore)\b/i.test(value);

const isLikelySameArtist = (requestedArtist: string, candidateArtist: string): boolean => {
    const requestedTokens = artistTokens(requestedArtist);
    if (requestedTokens.length === 0) return true;

    const candidateTokens = artistTokens(candidateArtist);
    if (candidateTokens.length === 0) return false;

    return requestedTokens.every((requestedToken) =>
        candidateTokens.some(
            (candidateToken) =>
                candidateToken === requestedToken ||
                candidateToken.startsWith(requestedToken) ||
                requestedToken.startsWith(candidateToken)
        )
    );
};

const dedupeQueries = (queries: string[]): string[] => {
    const seen = new Set<string>();

    return queries.filter((query) => {
        const normalized = normalizeTitle(query);
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
};

const selectQueryTerms = (queries: string[]): string[] => {
    const deduped = dedupeQueries(queries);
    if (deduped.length <= MAX_QUERY_TERMS) return deduped;
    return shuffle(deduped).slice(0, MAX_QUERY_TERMS);
};

const parseFilters = (source: Partial<Record<'genre' | 'language' | 'difficulty' | 'artist', unknown>>): GameFilters => {
    const genreValue = typeof source.genre === 'string' ? source.genre.toLowerCase() : 'all';
    const languageValue = typeof source.language === 'string' ? source.language.toLowerCase() : 'all';
    const difficultyValue = typeof source.difficulty === 'string'
        ? String(source.difficulty).toLowerCase()
        : 'medium';
    const artistValue = typeof source.artist === 'string'
        ? normalizeTitle(String(source.artist))
        : 'all';

    const genre = genreValue in GENRE_QUERY_MAP ? genreValue as GameGenre : 'all';
    const language = languageValue in LANGUAGE_QUERY_MAP ? languageValue as GameLanguage : 'all';
    const difficulty = difficultyValue === 'easy' || difficultyValue === 'medium' || difficultyValue === 'hard'
        ? difficultyValue as GameDifficulty
        : 'medium';

    return { genre, language, difficulty, artist: artistValue || 'all' };
};

const getQueryTerms = (filters: GameFilters): string[] => {
    if (filters.artist !== 'all') {
        return [filters.artist, `${filters.artist} songs`];
    }

    const genreTerms = GENRE_QUERY_MAP[filters.genre];
    const languageTerms = LANGUAGE_QUERY_MAP[filters.language];

    if (filters.genre === 'all' && filters.language === 'all') {
        return DEFAULT_ARTIST_QUERIES;
    }

    if (filters.language === 'all') {
        return genreTerms;
    }

    if (filters.genre === 'all') {
        return languageTerms;
    }

    const overlap = languageTerms.filter((term) =>
        genreTerms.some((genreTerm) => normalizeTitle(genreTerm) === normalizeTitle(term))
    );

    return overlap.length > 0 ? overlap : languageTerms;
};

const filtersCacheKey = (filters: GameFilters): string => `${filters.genre}:${filters.language}:${filters.difficulty}:${filters.artist}`;

const songMemory = (song: SongPreview): CorrectSongMemory => ({
    id: song.id,
    titleKey: normalizeTrackTitleKey(song.title),
    artistKey: normalizeArtistKey(song.artist),
});

const encodeSongMemory = (song: SongPreview): string => {
    const memory = songMemory(song);
    return [
        encodeURIComponent(memory.id),
        encodeURIComponent(memory.titleKey),
        encodeURIComponent(memory.artistKey),
    ].join('~');
};

const parseSongMemory = (token: string): CorrectSongMemory | null => {
    const trimmed = token.trim();
    if (!trimmed) return null;

    const [rawId, rawTitleKey = '', rawArtistKey = ''] = trimmed.split('~');
    try {
        return {
            id: decodeURIComponent(rawId || ''),
            titleKey: decodeURIComponent(rawTitleKey),
            artistKey: decodeURIComponent(rawArtistKey),
        };
    } catch {
        return {
            id: rawId,
            titleKey: rawTitleKey,
            artistKey: rawArtistKey,
        };
    }
};

const rememberCorrectSong = (cacheKey: string, song: SongPreview) => {
    const memory = songMemory(song);
    const existing = recentCorrectByCacheKey.get(cacheKey) ?? [];
    const next = [
        memory,
        ...existing.filter((item) =>
            item.id !== memory.id &&
            item.titleKey !== memory.titleKey &&
            `${item.titleKey}::${item.artistKey}` !== `${memory.titleKey}::${memory.artistKey}`
        ),
    ].slice(0, 40);
    recentCorrectByCacheKey.set(cacheKey, next);
};

const shouldUseIndiaCatalog = (filters: GameFilters): boolean => {
    if (INDIA_FOCUSED_LANGUAGES.includes(filters.language)) return true;
    if (filters.artist === 'all') return false;

    const normalizedArtist = normalizeTitle(filters.artist);
    return INDIA_FOCUSED_ARTISTS.some((artist) => normalizedArtist.includes(artist));
};

const getCatalogCountry = (filters: GameFilters): string =>
    shouldUseIndiaCatalog(filters) ? 'in' : env.GAME_ITUNES_COUNTRY;

const getSpotifyMarket = (filters: GameFilters): string =>
    shouldUseIndiaCatalog(filters) ? 'IN' : SPOTIFY_MARKET;

const applyDifficulty = (songs: SongPreview[], difficulty: GameDifficulty): SongPreview[] => {
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

const calculateScorePayload = (correct: boolean, streak: number, responseTimeMs: number) => {
    if (!correct) {
        return {
            pointsAwarded: 0,
            speedBonus: 0,
            multiplier: 1,
        };
    }

    const speedWindowMs = 5000;
    const safeResponseTime = responseTimeMs > 0 ? Math.min(responseTimeMs, speedWindowMs) : speedWindowMs;
    const speedBonus = Math.max(0, Math.round(((speedWindowMs - safeResponseTime) / speedWindowMs) * 60));
    const multiplier = Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
    const pointsAwarded = Math.round((100 + speedBonus) * multiplier);

    return { pointsAwarded, speedBonus, multiplier };
};

const getPeriodStart = (period: LeaderboardPeriod): Date | null => {
    if (period !== 'daily') return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
};

const artworkLarge = (url = ''): string =>
    url.replace(/100x100bb\.(jpg|png|webp)$/i, '600x600bb.$1');

// ─── Guest identity ──────────────────────────────────────────────────────────
// Anonymous players get a stable id stored in a cookie so their scores group
// into a single leaderboard entry across rounds, with a friendly display name
// derived deterministically from that id.
const GUEST_ADJECTIVES = ['Swift', 'Golden', 'Midnight', 'Electric', 'Velvet', 'Neon', 'Cosmic', 'Silent', 'Crimson', 'Lunar', 'Wild', 'Hidden'];
const GUEST_NOUNS = ['Listener', 'Crate', 'Vinyl', 'Echo', 'Pulse', 'Tempo', 'Riff', 'Encore', 'Bassline', 'Hook', 'Anthem', 'Groove'];

const guestNameFromId = (guestId: string): string => {
    let hash = 0;
    for (let i = 0; i < guestId.length; i += 1) {
        hash = (hash * 31 + guestId.charCodeAt(i)) >>> 0;
    }
    const adjective = GUEST_ADJECTIVES[hash % GUEST_ADJECTIVES.length];
    const noun = GUEST_NOUNS[(hash >> 8) % GUEST_NOUNS.length];
    return `${adjective} ${noun}`;
};

const getOrCreateGuest = (req: Request, res: Response): { guestId: string; guestName: string } => {
    const existing = typeof req.cookies?.xo_guest === 'string' ? req.cookies.xo_guest.trim() : '';
    const guestId = existing && existing.length >= 8 ? existing : crypto.randomBytes(12).toString('base64url');

    if (guestId !== existing) {
        res.cookie('xo_guest', guestId, {
            httpOnly: false,
            sameSite: 'lax',
            secure: env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
        });
    }

    return { guestId, guestName: guestNameFromId(guestId) };
};

const matchesGuess = (guess: string, song: SongPreview): boolean => {
    const normalizedGuess = normalizeTitle(guess);
    if (!normalizedGuess) return false;

    const title = normalizeTitle(song.title);
    const artist = normalizeTitle(song.artist);
    return normalizedGuess === title ||
        normalizedGuess === artist ||
        title.includes(normalizedGuess) ||
        artist.includes(normalizedGuess);
};

const getJson = async (url: string): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ITUNES_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`iTunes API request failed (${response.status})`);
        }
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const parseApiError = async (response: globalThis.Response, provider: string): Promise<string> => {
    try {
        const payload = await response.json() as {
            error?: { message?: string; status?: number } | string;
            error_description?: string;
        };
        if (typeof payload.error === 'string') {
            return payload.error_description || payload.error;
        }
        return payload.error?.message || `${provider} API request failed (${response.status})`;
    } catch {
        return `${provider} API request failed (${response.status})`;
    }
};

const getSpotifyAccessToken = async (): Promise<string> => {
    if (!hasSpotifyCredentials) {
        throw new Error('Spotify credentials are not configured');
    }

    if (spotifyTokenCache && Date.now() < spotifyTokenCache.expiresAt) {
        return spotifyTokenCache.token;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ITUNES_TIMEOUT_MS);

    try {
        const credentials = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
        const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ grant_type: 'client_credentials' }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(await parseApiError(response, 'Spotify token'));
        }

        const payload = await response.json() as SpotifyTokenPayload;
        if (!payload.access_token) {
            throw new Error('Spotify token response did not include an access token');
        }

        spotifyTokenCache = {
            token: payload.access_token,
            expiresAt: Date.now() + Math.max(60, (payload.expires_in ?? 3600) - 60) * 1000,
        };

        return spotifyTokenCache.token;
    } finally {
        clearTimeout(timeout);
    }
};

const getSpotifyJson = async (url: string): Promise<unknown> => {
    const token = await getSpotifyAccessToken();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ITUNES_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                signal: controller.signal,
            });

            if (response.ok) {
                return response.json();
            }

            if (response.status === 429 && attempt < 2) {
                const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
                const backoffMs = Number.isFinite(retryAfter)
                    ? Math.max(1000, retryAfter * 1000)
                    : 500 * (2 ** attempt);
                await sleep(backoffMs);
                continue;
            }

            throw new Error(await parseApiError(response, 'Spotify'));
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Spotify API request failed');
            if (attempt >= 2) break;
            await sleep(500 * (2 ** attempt));
        } finally {
            clearTimeout(timeout);
        }
    }

    throw lastError ?? new Error('Spotify API request failed');
};

const bestSpotifyImage = (images: SpotifyImage[] = []): string => {
    const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return sorted.find((image) => image.url)?.url ?? '';
};

const spotifyReleaseYear = (releaseDate?: string): number => {
    const year = Number.parseInt(String(releaseDate ?? '').slice(0, 4), 10);
    return Number.isFinite(year) ? year : 0;
};

const songWeight = (song: SongPreview, difficulty: GameDifficulty): number => {
    const currentYear = new Date().getFullYear();
    const age = song.releaseYear > 0 ? Math.max(0, currentYear - song.releaseYear) : 8;
    const durationMinutes = song.durationMs > 0 ? song.durationMs / 60000 : 3.5;

    if (difficulty === 'easy') {
        return Math.max(1, 18 - age) + Math.max(0, 5 - Math.abs(durationMinutes - 3.4));
    }

    if (difficulty === 'hard') {
        return Math.max(1, age + Math.min(durationMinutes, 7));
    }

    return Math.max(1, 12 - Math.abs(age - 6)) + Math.max(0, 4 - Math.abs(durationMinutes - 3.6));
};

const pickWeightedSong = (songs: SongPreview[], difficulty: GameDifficulty): SongPreview => {
    const weights = songs.map((song) => songWeight(song, difficulty));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = Math.random() * total;

    for (let index = 0; index < songs.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return songs[index];
    }

    return songs[songs.length - 1];
};

const titleOverlapScore = (left: string, right: string): number => {
    const leftTokens = titleTokens(left);
    if (leftTokens.length === 0) return 0;
    const rightTokenSet = new Set(titleTokens(right));
    return leftTokens.filter((token) => rightTokenSet.has(token)).length;
};

const distractorScore = (candidate: SongPreview, correct: SongPreview, difficulty: GameDifficulty): number => {
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

const pickDistractors = (songs: SongPreview[], correct: SongPreview, difficulty: GameDifficulty): SongPreview[] => {
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

const fetchSpotifySongPool = async (
    queries: string[],
    market: string,
    selectedArtist?: string
): Promise<SongPreview[]> => {
    if (!hasSpotifyCredentials) return [];

    const spotifyQueries = selectedArtist ? [selectedArtist] : selectQueryTerms(queries);
    const payloads = await Promise.allSettled(
        spotifyQueries.map(async (term) => {
            const spotifyArtistFilter = selectedArtist
                ? `artist:"${selectedArtist.replace(/"/g, '').trim()}"`
                : term;
            const params = new URLSearchParams({
                q: spotifyArtistFilter,
                type: 'track',
                limit: '50',
                market,
            });

            return getSpotifyJson(`${SPOTIFY_SEARCH_ENDPOINT}?${params.toString()}`) as Promise<SpotifySearchPayload>;
        })
    );

    const results = payloads.flatMap((payload) =>
        payload.status === 'fulfilled' && Array.isArray(payload.value.tracks?.items)
            ? payload.value.tracks.items
            : []
    );
    const seen = new Set<string>();
    const songs: SongPreview[] = [];

    for (const item of results) {
        const artists = item.artists?.map((artist) => artist.name?.trim()).filter(Boolean) as string[] | undefined;
        const primaryArtist = artists?.[0] ?? '';
        if (!item.id || !item.name || !primaryArtist || !item.preview_url) {
            continue;
        }

        const title = item.name.trim();
        const artist = artists?.join(', ') ?? primaryArtist;
        if (selectedArtist && !isLikelySameArtist(selectedArtist, artist)) {
            continue;
        }

        const dedupeKey = `${normalizeTrackTitleKey(title)}::${normalizeArtistKey(artist)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        songs.push({
            id: `spotify:${item.id}`,
            title,
            artist,
            album: item.album?.name?.trim() ?? '',
            releaseYear: spotifyReleaseYear(item.album?.release_date),
            durationMs: item.duration_ms ?? 0,
            snippetUrl: item.preview_url,
            artworkUrl: bestSpotifyImage(item.album?.images),
            trackUrl: item.external_urls?.spotify ?? '',
        });
    }

    return songs;
};

const fetchItunesSongPool = async (
    queries: string[],
    country: string,
    selectedArtist?: string
): Promise<SongPreview[]> => {
    const payloads = await Promise.allSettled(
        selectQueryTerms(queries).map(async (term) => {
            const params = new URLSearchParams({
                term,
                media: 'music',
                entity: 'song',
                limit: String(ITUNES_TRACK_LIMIT),
                country,
            });

            return getJson(`${ITUNES_SEARCH_ENDPOINT}?${params.toString()}`) as Promise<{
                results?: ItunesSearchResult[];
            }>;
        })
    );

    const results = payloads.flatMap((payload) =>
        payload.status === 'fulfilled' && Array.isArray(payload.value.results)
            ? payload.value.results
            : []
    );
    const seen = new Set<string>();
    const songs: SongPreview[] = [];

    for (const item of results) {
        if (!item.trackId || !item.trackName || !item.artistName || !item.previewUrl) {
            continue;
        }

        const title = item.trackName.trim();
        const artist = item.artistName.trim();
        if (selectedArtist && !isLikelySameArtist(selectedArtist, artist)) {
            continue;
        }
        const dedupeKey = `${normalizeTrackTitleKey(title)}::${normalizeArtistKey(artist)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        songs.push({
            id: String(item.trackId),
            title,
            artist,
            album: item.collectionName?.trim() ?? '',
            releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : 0,
            durationMs: item.trackTimeMillis ?? 0,
            snippetUrl: item.previewUrl,
            artworkUrl: artworkLarge(item.artworkUrl100),
            trackUrl: item.trackViewUrl ?? '',
        });
    }

    return songs;
};

const fetchSpotifyArtists = async (query: string, market: string): Promise<ArtistProfile[]> => {
    if (!hasSpotifyCredentials) return [];

    const params = new URLSearchParams({
        q: query,
        type: 'artist',
        limit: '20',
        market,
    });
    const payload = await getSpotifyJson(`${SPOTIFY_SEARCH_ENDPOINT}?${params.toString()}`) as SpotifySearchPayload;
    const rawResults = Array.isArray(payload.artists?.items) ? payload.artists.items : [];
    const seen = new Set<string>();

    return rawResults
        .filter((item) => typeof item.name === 'string' && item.name.trim().length > 0)
        .map((item) => item.name!.trim())
        .filter((name) => isLikelySameArtist(query, name))
        .filter((name) => {
            const key = normalizeArtistKey(name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 15)
        .map((name) => ({
            label: name,
            value: normalizeTitle(name),
            language: 'all' as GameLanguage,
        }));
};

const fetchItunesArtists = async (query: string, country: string): Promise<ArtistProfile[]> => {
    const params = new URLSearchParams({
        term: query,
        entity: 'musicArtist',
        limit: '30',
        country,
    });

    const payload = await getJson(`${ITUNES_SEARCH_ENDPOINT}?${params.toString()}`) as {
        results?: ItunesArtistSearchResult[];
    };
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const seen = new Set<string>();

    return rawResults
        .filter((item) => typeof item.artistName === 'string' && item.artistName.trim().length > 0)
        .map((item) => item.artistName!.trim())
        .filter((name) => isLikelySameArtist(query, name))
        .filter((name) => {
            const key = normalizeArtistKey(name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 15)
        .map((name) => ({
            label: name,
            value: normalizeTitle(name),
            language: 'all' as GameLanguage,
        }));
};

const getSongPool = async (filters: GameFilters): Promise<SongPreview[]> => {
    const cacheKey = filtersCacheKey(filters);
    const cached = songPoolCache.get(cacheKey);
    const cacheTtl = shouldUseSpotifyTrackSearch ? SPOTIFY_CACHE_MS : TRACK_CACHE_MS;
    const isFresh =
        !!cached &&
        cached.songs.length >= 4 &&
        Date.now() - cached.fetchedAt < cacheTtl;

    if (isFresh && cached) return cached.songs;
    if (inFlightSongPools.has(cacheKey)) return inFlightSongPools.get(cacheKey)!;

    const queryTerms = getQueryTerms(filters);
    const country = getCatalogCountry(filters);
    const spotifyMarket = getSpotifyMarket(filters);

    const spotifySongPoolPromise = shouldUseSpotifyTrackSearch
        ? fetchSpotifySongPool(queryTerms, spotifyMarket, filters.artist !== 'all' ? filters.artist : undefined)
        : Promise.resolve([]);
    const nextFetch = Promise.allSettled([
        spotifySongPoolPromise,
        fetchItunesSongPool(queryTerms, country, filters.artist !== 'all' ? filters.artist : undefined),
    ])
        .then((songs) => {
            const spotifySongs = songs[0].status === 'fulfilled' ? songs[0].value : [];
            const itunesSongs = songs[1].status === 'fulfilled' ? songs[1].value : [];
            const mergedSongs = [...spotifySongs, ...itunesSongs].sort((a, b) => {
                const alternateDelta = Number(isAlternateTrackVersion(`${a.title} ${a.album}`)) -
                    Number(isAlternateTrackVersion(`${b.title} ${b.album}`));
                if (alternateDelta !== 0) return alternateDelta;
                return b.releaseYear - a.releaseYear;
            });
            const seen = new Set<string>();
            const uniqueSongs = mergedSongs.filter((song) => {
                const key = `${normalizeTrackTitleKey(song.title)}::${normalizeArtistKey(song.artist)}`;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const preparedSongs = applyDifficulty(uniqueSongs, filters.difficulty);
            if (preparedSongs.length >= 4) {
                songPoolCache.set(cacheKey, { songs: preparedSongs, fetchedAt: Date.now() });
                return preparedSongs;
            }

            if (cached?.songs && cached.songs.length >= 4) {
                return cached.songs;
            }

            if (filters.artist !== 'all') {
                return getSongPool({ ...filters, artist: 'all' });
            }

            return [];
        })
        .catch(() => {
            if (cached?.songs && cached.songs.length >= 4) {
                return cached.songs;
            }

            if (filters.artist !== 'all') {
                return getSongPool({ ...filters, artist: 'all' });
            }

            return [];
        })
        .finally(() => {
            inFlightSongPools.delete(cacheKey);
        });

    inFlightSongPools.set(cacheKey, nextFetch);

    const songs = await nextFetch;
    if (songs.length < 4) {
        throw new Error('Song pool unavailable');
    }
    return songs;
};

const buildQuestionWithExclusion = (songs: SongPreview[], excludeSongIds: string[] = [], cacheKey: string): {
    correct: SongPreview;
    options: string[];
} => {
    const difficulty = (cacheKey.split(':')[2] || 'medium') as GameDifficulty;
    const explicitExcluded = excludeSongIds
        .map(parseSongMemory)
        .filter((item): item is CorrectSongMemory => Boolean(item));
    const excluded = [...explicitExcluded, ...(recentCorrectByCacheKey.get(cacheKey) ?? [])];
    const excludedIds = new Set(excluded.map((item) => item.id).filter(Boolean));
    const excludedTitles = new Set(excluded.map((item) => item.titleKey).filter(Boolean));
    const excludedTitleArtists = new Set(
        excluded
            .filter((item) => item.titleKey && item.artistKey)
            .map((item) => `${item.titleKey}::${item.artistKey}`)
    );
    const candidates = songs.filter((song) => {
        const titleKey = normalizeTrackTitleKey(song.title);
        const artistKey = normalizeArtistKey(song.artist);
        return !excludedIds.has(song.id) &&
            !excludedTitles.has(titleKey) &&
            !excludedTitleArtists.has(`${titleKey}::${artistKey}`);
    });
    const source = candidates.length > 0 ? candidates : songs;
    const correct = pickWeightedSong(source, difficulty);

    let others = pickDistractors(source, correct, difficulty);
    if (others.length < 3) {
        const remaining = shuffle(
            songs.filter((song) =>
                song.id !== correct.id &&
                normalizeTrackTitleKey(song.title) !== normalizeTrackTitleKey(correct.title) &&
                !others.some((other) => other.id === song.id)
            )
        ).slice(0, 3 - others.length);
        others = [...others, ...remaining];
    }

    if (others.length < 3) {
        throw new Error('Not enough unique songs to build options');
    }

    const options = shuffle([correct.title, ...others.map((song) => song.title)]);
    return { correct, options };
};

// GET /game/question
export const getQuestion = async (_req: Request, res: Response): Promise<void> => {
    try {
        const filters = parseFilters({
            genre: _req.query.genre,
            language: _req.query.language,
            difficulty: _req.query.difficulty,
            artist: _req.query.artist,
        });
        const cacheKey = filtersCacheKey(filters);
        const songs = await getSongPool(filters);
        const excludeSongIds = typeof _req.query.excludeSongIds === 'string'
            ? _req.query.excludeSongIds.split(',').map((item) => item.trim()).filter(Boolean)
            : [];
        const { correct, options } = buildQuestionWithExclusion(songs, excludeSongIds, cacheKey);
        res.json(successResponse({
            snippetUrl: correct.snippetUrl,
            options,
            songId: createSongToken(correct),
            artistName: correct.artist,
            filters,
        }));
    } catch {
        res.status(503).json(errorResponse('Game question unavailable'));
    }
};

// POST /game/answer
export const submitAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { songId, answer } = req.body;
        if (!songId || !answer) {
            res.status(400).json(errorResponse('songId and answer are required'));
            return;
        }

        const song = decodeSongToken(String(songId));
        if (!song) {
            res.status(400).json(errorResponse('Invalid song token'));
            return;
        }

        const filters = parseFilters({
            genre: req.body.genre,
            language: req.body.language,
            difficulty: req.body.difficulty,
            artist: req.body.artist,
        });

        const correct = matchesGuess(String(answer), song);
        const streak = Number(req.body.streak) || 0;
        const responseTimeMs = Math.max(0, Math.min(5000, Number(req.body.responseTimeMs) || 0));
        const { pointsAwarded, speedBonus, multiplier } = calculateScorePayload(correct, streak, responseTimeMs);
        const xpEarned = calculateGameXP(correct, streak) + Math.round(speedBonus * 0.5);
        if (correct) {
            rememberCorrectSong(filtersCacheKey(filters), song);
        }

        if (req.userId && isDbConnected()) {
            await GameScore.create({
                user: req.userId,
                trackId: song.id,
                trackName: song.title,
                artistName: song.artist,
                artworkUrl: song.artworkUrl,
                trackUrl: song.trackUrl,
                genre: filters.genre,
                language: filters.language,
                difficulty: filters.difficulty,
                artistFilter: filters.artist,
                correct,
                responseTimeMs,
                score: pointsAwarded,
                correctCount: correct ? 1 : 0,
                totalQuestions: 1,
                xpEarned,
            });

            const user = await User.findByIdAndUpdate(
                req.userId,
                { $inc: { xp: xpEarned } },
                { new: true }
            );

            if (user) {
                const { level, badge } = calculateLevel(user.xp);
                if (level !== user.level || badge !== user.levelBadge) {
                    await User.findByIdAndUpdate(req.userId, { level, levelBadge: badge });
                }
            }
        } else if (req.userId) {
            devStore.saveGameScore({
                user: req.userId ?? '',
                trackId: song.id,
                trackName: song.title,
                artistName: song.artist,
                artworkUrl: song.artworkUrl,
                trackUrl: song.trackUrl,
                genre: filters.genre,
                language: filters.language,
                difficulty: filters.difficulty,
                artistFilter: filters.artist,
                correct,
                responseTimeMs,
                score: pointsAwarded,
                correctCount: correct ? 1 : 0,
                totalQuestions: 1,
                xpEarned,
            });
            devStore.incrementUserXp(req.userId, xpEarned);
        } else if (isDbConnected()) {
            // Anonymous play — persist under a stable guest id so leaderboards populate.
            const { guestId, guestName } = getOrCreateGuest(req, res);
            await GameScore.create({
                guestId,
                guestName,
                trackId: song.id,
                trackName: song.title,
                artistName: song.artist,
                artworkUrl: song.artworkUrl,
                trackUrl: song.trackUrl,
                genre: filters.genre,
                language: filters.language,
                difficulty: filters.difficulty,
                artistFilter: filters.artist,
                correct,
                responseTimeMs,
                score: pointsAwarded,
                correctCount: correct ? 1 : 0,
                totalQuestions: 1,
                xpEarned,
            });
        }

        res.json(successResponse({
            correct,
            correctAnswer: song.title,
            correctArtist: song.artist,
            album: song.album,
            artworkUrl: song.artworkUrl,
            trackUrl: song.trackUrl,
            trackId: createSongToken(song),
            songKey: encodeSongMemory(song),
            xpEarned,
            pointsAwarded,
            speedBonus,
            multiplier,
            responseTimeMs,
            filters,
        }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /game/rating
export const rateTrack = async (req: Request, res: Response): Promise<void> => {
    try {
        const { trackId, rating } = req.body;
        const numericRating = Number(rating);

        if (!trackId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            res.status(400).json(errorResponse('trackId and a 1-5 rating are required'));
            return;
        }

        const song = decodeSongToken(String(trackId));
        if (!song) {
            res.status(400).json(errorResponse('Invalid track token'));
            return;
        }

        if (!req.userId) {
            res.json(successResponse({
                guest: true,
                trackId: song.id,
                rating: numericRating,
            }, 'Guest rating accepted'));
            return;
        }

        const saved = isDbConnected()
            ? await TrackRating.findOneAndUpdate(
                { user: req.userId, trackId: song.id },
                {
                    user: req.userId,
                    trackId: song.id,
                    trackName: song.title,
                    artistName: song.artist,
                    artworkUrl: song.artworkUrl,
                    trackUrl: song.trackUrl,
                    rating: numericRating,
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            )
            : devStore.saveRating({
                user: req.userId ?? '',
                trackId: song.id,
                trackName: song.title,
                artistName: song.artist,
                artworkUrl: song.artworkUrl,
                trackUrl: song.trackUrl,
                rating: numericRating,
            });

        res.json(successResponse(saved, 'Rating saved'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /game/artists
export const getArtists = async (_req: Request, res: Response): Promise<void> => {
    res.json(successResponse(CURATED_ARTISTS));
};

// GET /game/artists/search
export const searchArtists = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = typeof req.query.q === 'string' ? normalizeTitle(req.query.q) : '';
        const language = typeof req.query.language === 'string' ? normalizeTitle(req.query.language) : 'all';

        if (!query || query.length < 2) {
            res.json(successResponse([]));
            return;
        }

        const country = (language === 'hindi' || language === 'punjabi') ? 'in' : env.GAME_ITUNES_COUNTRY;
        const spotifyMarket = (language === 'hindi' || language === 'punjabi') ? 'IN' : SPOTIFY_MARKET;
        const [spotifyResult, itunesResult] = await Promise.allSettled([
            fetchSpotifyArtists(query, spotifyMarket),
            fetchItunesArtists(query, country),
        ]);
        const spotifyArtists = spotifyResult.status === 'fulfilled' ? spotifyResult.value : [];
        const itunesArtists = itunesResult.status === 'fulfilled' ? itunesResult.value : [];
        const seen = new Set<string>();
        const artists = [...spotifyArtists, ...itunesArtists]
            .filter((artist) => {
                const key = normalizeArtistKey(artist.label);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 15);

        res.json(successResponse(artists));
    } catch {
        res.status(500).json(errorResponse('Artist search unavailable'));
    }
};

// GET /game/stats
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.userId) {
            res.json(successResponse({
                totalGamesPlayed: 0,
                totalCorrect: 0,
                accuracy: 0,
                streak: 0,
                bestStreak: 0,
                ratingsCount: 0,
                averageResponseTimeMs: 0,
                fastestCorrectResponseTimeMs: 0,
            }));
            return;
        }
        if (!isDbConnected()) {
            res.json(successResponse(devStore.getStats(req.userId)));
            return;
        }
        const history = await GameScore.find({ user: req.userId })
            .sort({ sessionDate: -1 })
            .limit(250);

        const totalGamesPlayed = history.length;
        const totalCorrect = history.filter((item) => item.correct || item.correctCount > 0).length;
        const accuracy = totalGamesPlayed > 0 ? Math.round((totalCorrect / totalGamesPlayed) * 100) : 0;
        const timedHistory = history.filter((item) => item.responseTimeMs > 0);

        let streak = 0;
        let bestStreak = 0;
        let runningStreak = 0;
        for (const item of history) {
            if (item.correct || item.correctCount > 0) streak += 1;
            else break;
        }
        for (const item of [...history].reverse()) {
            if (item.correct || item.correctCount > 0) {
                runningStreak += 1;
                bestStreak = Math.max(bestStreak, runningStreak);
            } else {
                runningStreak = 0;
            }
        }

        const ratingsCount = await TrackRating.countDocuments({ user: req.userId });
        const averageResponseTimeMs = timedHistory.length > 0
            ? Math.round(timedHistory.reduce((sum, item) => sum + item.responseTimeMs, 0) / timedHistory.length)
            : 0;
        const fastestCorrectResponseTimeMs = history
            .filter((item) => (item.correct || item.correctCount > 0) && item.responseTimeMs > 0)
            .reduce((best, item) => best === 0 ? item.responseTimeMs : Math.min(best, item.responseTimeMs), 0);

        res.json(successResponse({
            totalGamesPlayed,
            totalCorrect,
            accuracy,
            streak,
            bestStreak,
            ratingsCount,
            averageResponseTimeMs,
            fastestCorrectResponseTimeMs,
        }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /game/leaderboard
export const getLeaderboard = async (_req: Request, res: Response): Promise<void> => {
    try {
        const period = _req.query.period === 'daily' ? 'daily' : 'all-time';
        const scope = _req.query.scope === 'artist' || _req.query.scope === 'genre'
            ? _req.query.scope
            : 'global';
        const scopeValue = typeof _req.query.scopeValue === 'string'
            ? normalizeTitle(_req.query.scopeValue)
            : '';

        if (!isDbConnected()) {
            res.json(successResponse(devStore.getLeaderboard(period, _req.userId, scope, scopeValue)));
            return;
        }

        const periodStart = getPeriodStart(period);
        const match: Record<string, unknown> = {};
        if (periodStart) match.sessionDate = { $gte: periodStart };
        if (scope === 'artist' && scopeValue) {
            match.$or = [
                { artistFilter: scopeValue },
                { artistName: { $regex: escapeRegExp(scopeValue), $options: 'i' } },
            ];
        }
        if (scope === 'genre' && scopeValue) {
            match.genre = scopeValue;
        }
        const matchStage = Object.keys(match).length > 0 ? { $match: match } : null;
        const pipeline: object[] = [
            ...(matchStage ? [matchStage] : []),
            {
                $group: {
                    // Group by signed-in user, or fall back to the guest id so anonymous
                    // players still rank. Their rows have no user document.
                    _id: { $ifNull: ['$user', { $concat: ['guest:', { $ifNull: ['$guestId', 'anon'] }] }] },
                    userId: { $first: '$user' },
                    guestName: { $first: '$guestName' },
                    totalScore: { $sum: '$score' },
                    sessions: { $sum: 1 },
                    xpTotal: { $sum: '$xpEarned' },
                },
            },
            { $sort: { totalScore: -1 } },
            { $limit: 100 },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    username: { $ifNull: ['$user.username', { $ifNull: ['$guestName', 'Guest'] }] },
                    avatar: '$user.avatar',
                    levelBadge: { $ifNull: ['$user.levelBadge', 'guest'] },
                    isGuest: { $cond: [{ $ifNull: ['$user', false] }, false, true] },
                    totalScore: 1,
                    sessions: 1,
                    xpTotal: 1,
                },
            },
        ];
        const fullLeaderboard = await GameScore.aggregate(pipeline as any);
        const guestId = !_req.userId && typeof _req.cookies?.xo_guest === 'string'
            ? _req.cookies.xo_guest.trim()
            : '';
        const userRank = _req.userId
            ? fullLeaderboard.findIndex((entry) => String(entry.userId) === String(_req.userId)) + 1 || null
            : guestId
                ? fullLeaderboard.findIndex((entry) => String(entry._id) === `guest:${guestId}`) + 1 || null
                : null;

        res.json(successResponse({
            entries: fullLeaderboard.slice(0, 50),
            userRank,
            period,
            scope,
            scopeValue,
        }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /game/history
export const getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.userId) {
            res.json(successResponse([]));
            return;
        }
        if (!isDbConnected()) {
            res.json(successResponse(devStore.getHistory(req.userId)));
            return;
        }
        const history = await GameScore.find({ user: req.userId })
            .sort({ sessionDate: -1 })
            .limit(20);
        res.json(successResponse(history));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

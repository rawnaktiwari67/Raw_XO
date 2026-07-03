// Music-provider layer: everything that talks HTTP to iTunes and Spotify and
// turns their payloads into our SongPreview / ArtistProfile shapes. Keeps the
// OAuth token cache, timeouts, retries, and per-provider quirks behind one seam
// so the controller's getSongPool orchestrator only deals in typed results.

import { env } from '../config/env';
import { shuffle } from '../utils/gameLogic';
import type { SongPreview } from '../utils/songTokens';
import type { ArtistProfile } from '../config/gameConstants';
import type { GameLanguage } from './types';
import {
    normalizeTitle,
    normalizeArtistKey,
    normalizeTrackTitleKey,
    isLikelySameArtist,
} from './songText';

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

export type SpotifySearchPayload = {
    tracks?: { items?: SpotifyTrack[] };
    artists?: { items?: SpotifyArtist[] };
};

type SpotifyTokenPayload = {
    access_token?: string;
    expires_in?: number;
};

const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';

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
export const SPOTIFY_MARKET = env.GAME_SPOTIFY_MARKET.trim().toUpperCase() || 'US';
export const hasSpotifyCredentials = Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
export const shouldUseSpotifyTrackSearch = hasSpotifyCredentials && env.GAME_SPOTIFY_TRACK_SEARCH;

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

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

// iTunes lets us swap the size segment in the artwork URL. The reveal thumbnail
// peaks around 152px, so 300px is crisp at 2x while downloading ~4x faster than
// the old 600px upscale — the difference between art that snaps in and art that
// lags behind the reveal animation.
const artworkSized = (url = ''): string =>
    url.replace(/100x100bb\.(jpg|png|webp)$/i, '300x300bb.$1');

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

export const getSpotifyJson = async (url: string): Promise<unknown> => {
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

// The reveal card shows art at ~56px (mobile) up to ~152px (desktop), so a
// ~300px source is ample at 2x density. Picking Spotify's smallest image that's
// still >=300px (rather than its largest 640px cover) roughly quarters the bytes,
// so the reveal art appears instantly instead of popping in after the animation.
const SPOTIFY_TARGET_IMAGE_PX = 300;
export const bestSpotifyImage = (images: SpotifyImage[] = []): string => {
    const withUrls = images.filter((image) => image.url);
    if (withUrls.length === 0) return '';

    const bigEnough = withUrls
        .filter((image) => (image.width ?? 0) >= SPOTIFY_TARGET_IMAGE_PX)
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    if (bigEnough.length > 0) return bigEnough[0].url!;

    // Nothing reaches the target — fall back to the largest available.
    return [...withUrls].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url!;
};

export const spotifyReleaseYear = (releaseDate?: string): number => {
    const year = Number.parseInt(String(releaseDate ?? '').slice(0, 4), 10);
    return Number.isFinite(year) ? year : 0;
};

export const fetchSpotifySongPool = async (
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
            // Spotify's popularity is a real, stream-derived 0–100 score — the
            // gold signal for "is this a hit or a deep cut".
            popularity: typeof item.popularity === 'number' ? item.popularity : -1,
        });
    }

    return songs;
};

export const fetchItunesSongPool = async (
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

    // iTunes returns each term's tracks roughly biggest-first, so a track's rank
    // within its own search is a serviceable popularity proxy when we don't have
    // Spotify's real score. Keep the per-term rank instead of flattening blindly.
    const ranked = payloads.flatMap((payload) =>
        payload.status === 'fulfilled' && Array.isArray(payload.value.results)
            ? payload.value.results.map((item, rank) => ({ item, rank }))
            : []
    );
    const seen = new Set<string>();
    const songs: SongPreview[] = [];

    for (const { item, rank } of ranked) {
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
            artworkUrl: artworkSized(item.artworkUrl100),
            trackUrl: item.trackViewUrl ?? '',
            // Rank-based approximation (0–100). Real Spotify popularity, when the
            // pool also has a Spotify entry for this track, wins via the dedupe
            // merge that lists Spotify songs first.
            popularity: Math.max(0, Math.round(100 - rank * 3.5)),
        });
    }

    return songs;
};

export const fetchSpotifyArtists = async (query: string, market: string): Promise<ArtistProfile[]> => {
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

export const fetchItunesArtists = async (query: string, country: string): Promise<ArtistProfile[]> => {
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

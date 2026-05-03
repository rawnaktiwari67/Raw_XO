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

type ArtistProfile = {
    label: string;
    value: string;
    language: GameLanguage;
};

const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
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
const ARTIST_QUERIES = env.GAME_ARTIST_QUERY
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const CURATED_ARTISTS: ArtistProfile[] = [
    { label: 'The Weeknd', value: 'the weeknd', language: 'english' },
    { label: 'Drake', value: 'drake', language: 'english' },
    { label: 'Kanye West', value: 'kanye west', language: 'english' },
    { label: 'Travis Scott', value: 'travis scott', language: 'english' },
    { label: 'Kendrick Lamar', value: 'kendrick lamar', language: 'english' },
    { label: 'Taylor Swift', value: 'taylor swift', language: 'english' },
    { label: 'Billie Eilish', value: 'billie eilish', language: 'english' },
    { label: 'Dua Lipa', value: 'dua lipa', language: 'english' },
    { label: 'SZA', value: 'sza', language: 'english' },
    { label: 'Frank Ocean', value: 'frank ocean', language: 'english' },
    { label: 'Brent Faiyaz', value: 'brent faiyaz', language: 'english' },
    { label: 'Post Malone', value: 'post malone', language: 'english' },
    { label: 'Ariana Grande', value: 'ariana grande', language: 'english' },
    { label: 'Doja Cat', value: 'doja cat', language: 'english' },
    { label: 'Bad Bunny', value: 'bad bunny', language: 'spanish' },
    { label: 'Karol G', value: 'karol g', language: 'spanish' },
    { label: 'Rosalia', value: 'rosalia', language: 'spanish' },
    { label: 'BTS', value: 'bts', language: 'korean' },
    { label: 'BLACKPINK', value: 'blackpink', language: 'korean' },
    { label: 'Jung Kook', value: 'jung kook', language: 'korean' },
    { label: 'Arijit Singh', value: 'arijit singh', language: 'hindi' },
    { label: 'Pritam', value: 'pritam', language: 'hindi' },
    { label: 'Shreya Ghoshal', value: 'shreya ghoshal', language: 'hindi' },
    { label: 'Atif Aslam', value: 'atif aslam', language: 'hindi' },
    { label: 'Diljit Dosanjh', value: 'diljit dosanjh', language: 'punjabi' },
    { label: 'Karan Aujla', value: 'karan aujla', language: 'punjabi' },
    { label: 'AP Dhillon', value: 'ap dhillon', language: 'punjabi' },
    { label: 'Shubh', value: 'shubh', language: 'punjabi' },
];
const DEFAULT_ARTIST_QUERIES = ARTIST_QUERIES.length > 0
    ? ARTIST_QUERIES
    : CURATED_ARTISTS.map((artist) => artist.value);
const GENRE_QUERY_MAP: Record<GameGenre, string[]> = {
    all: DEFAULT_ARTIST_QUERIES,
    'hip-hop': ['kanye west', 'travis scott', 'drake', 'kendrick lamar', 'post malone', 'doja cat'],
    pop: ['the weeknd', 'dua lipa', 'billie eilish', 'taylor swift', 'ariana grande', 'bad bunny'],
    rnb: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'ariana grande', 'drake'],
    dance: ['dua lipa', 'calvin harris', 'david guetta', 'charli xcx', 'the weeknd', 'doja cat'],
};
const LANGUAGE_QUERY_MAP: Record<GameLanguage, string[]> = {
    all: [],
    english: ['the weeknd', 'kanye west', 'travis scott', 'drake', 'sza', 'billie eilish', 'dua lipa', 'ariana grande'],
    hindi: ['arijit singh', 'shreya ghoshal', 'pritam', 'atif aslam'],
    punjabi: ['diljit dosanjh', 'karan aujla', 'ap dhillon', 'shubh'],
    korean: ['bts', 'blackpink', 'newjeans', 'jung kook'],
    spanish: ['bad bunny', 'karol g', 'rosalia', 'rauw alejandro'],
};
type ItunesArtistSearchResult = {
    artistId?: number;
    artistName?: string;
};
const INDIA_FOCUSED_LANGUAGES: GameLanguage[] = ['hindi', 'punjabi'];
const INDIA_FOCUSED_ARTISTS = [
    'arijit singh',
    'pritam',
    'shreya ghoshal',
    'atif aslam',
    'diljit dosanjh',
    'karan aujla',
    'ap dhillon',
    'shubh',
];

const songPoolCache = new Map<string, { songs: SongPreview[]; fetchedAt: number }>();
const inFlightSongPools = new Map<string, Promise<SongPreview[]>>();
const recentCorrectByCacheKey = new Map<string, string[]>();

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

const normalizeArtistKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeTrackTitleKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/\s*[\(\[].*?(remaster|live|acoustic|version|edit|mix|mono|stereo|deluxe).*?[\)\]]/gi, '')
        .replace(/\s+-\s*(remaster|live|acoustic|version|edit|mix).*/gi, '')
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

const rememberCorrectSong = (cacheKey: string, songId: string) => {
    const existing = recentCorrectByCacheKey.get(cacheKey) ?? [];
    const next = [songId, ...existing.filter((id) => id !== songId)].slice(0, 16);
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

const applyDifficulty = (songs: SongPreview[], difficulty: GameDifficulty): SongPreview[] => {
    const byRecent = [...songs].sort((a, b) => b.releaseYear - a.releaseYear);
    const byOlderLongCuts = [...songs].sort((a, b) => {
        if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
        return b.durationMs - a.durationMs;
    });

    if (difficulty === 'easy') {
        const recent = byRecent.filter((song) => song.releaseYear >= 2018);
        return (recent.length >= 4 ? recent : byRecent).slice(0, Math.min(32, songs.length));
    }

    if (difficulty === 'hard') {
        const olderLongCuts = byOlderLongCuts.filter((song) => song.releaseYear <= 2015 && song.durationMs >= 240000);
        return (olderLongCuts.length >= 4 ? olderLongCuts : byOlderLongCuts).slice(0, Math.min(28, songs.length));
    }

    const medium = byRecent.filter((song) => song.releaseYear >= 2012);
    return (medium.length >= 4 ? medium : byRecent).slice(0, Math.min(30, songs.length));
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
    const sameEra = candidate.releaseYear && correct.releaseYear
        ? Math.max(0, 8 - Math.abs(candidate.releaseYear - correct.releaseYear))
        : 1;
    const titlePenalty = titleOverlapScore(candidate.title, correct.title) * 8;

    if (difficulty === 'easy') {
        return sameEra - sameArtist - titlePenalty;
    }

    if (difficulty === 'hard') {
        return sameArtist + sameEra * 1.2 - titlePenalty;
    }

    return sameArtist * 0.4 + sameEra - titlePenalty;
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

    return shuffle(eligible)
        .sort((a, b) => distractorScore(b, correct, difficulty) - distractorScore(a, correct, difficulty))
        .slice(0, 3);
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

const getSongPool = async (filters: GameFilters): Promise<SongPreview[]> => {
    const cacheKey = filtersCacheKey(filters);
    const cached = songPoolCache.get(cacheKey);
    const isFresh =
        !!cached &&
        cached.songs.length >= 4 &&
        Date.now() - cached.fetchedAt < TRACK_CACHE_MS;

    if (isFresh && cached) return cached.songs;
    if (inFlightSongPools.has(cacheKey)) return inFlightSongPools.get(cacheKey)!;

    const queryTerms = getQueryTerms(filters);
    const country = getCatalogCountry(filters);

    const nextFetch = fetchItunesSongPool(queryTerms, country, filters.artist !== 'all' ? filters.artist : undefined)
        .then((songs) => {
            const preparedSongs = applyDifficulty(songs, filters.difficulty);
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
    const explicitExcluded = new Set(
        excludeSongIds
            .map((token) => token.split(':')[0]?.trim())
            .filter(Boolean)
    );
    const recentCorrect = new Set(recentCorrectByCacheKey.get(cacheKey) ?? []);
    const excludedIds = new Set([...explicitExcluded, ...recentCorrect]);
    const candidates = songs.filter((song) => !excludedIds.has(song.id));
    const fallbackWithoutExplicitExclusions = songs.filter((song) => !explicitExcluded.has(song.id));
    const source = candidates.length >= 4
        ? candidates
        : fallbackWithoutExplicitExclusions.length >= 4
            ? fallbackWithoutExplicitExclusions
            : songs;
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
        rememberCorrectSong(cacheKey, correct.id);

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

        if (req.userId && isDbConnected()) {
            await GameScore.create({
                user: req.userId,
                trackId: song.id,
                trackName: song.title,
                artistName: song.artist,
                artworkUrl: song.artworkUrl,
                trackUrl: song.trackUrl,
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
                correct,
                responseTimeMs,
                score: pointsAwarded,
                correctCount: correct ? 1 : 0,
                totalQuestions: 1,
                xpEarned,
            });
            devStore.incrementUserXp(req.userId, xpEarned);
        }

        res.json(successResponse({
            correct,
            correctAnswer: song.title,
            correctArtist: song.artist,
            album: song.album,
            artworkUrl: song.artworkUrl,
            trackUrl: song.trackUrl,
            trackId: createSongToken(song),
            songKey: song.id,
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
        const artists = rawResults
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
        if (!isDbConnected()) {
            res.json(successResponse(devStore.getLeaderboard(period, _req.userId)));
            return;
        }
        const periodStart = getPeriodStart(period);
        const matchStage = periodStart ? { $match: { sessionDate: { $gte: periodStart } } } : null;
        const pipeline: object[] = [
            ...(matchStage ? [matchStage] : []),
            { $group: { _id: '$user', totalScore: { $sum: '$score' }, sessions: { $sum: 1 }, xpTotal: { $sum: '$xpEarned' } } },
            { $sort: { totalScore: -1 } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { username: '$user.username', avatar: '$user.avatar', levelBadge: '$user.levelBadge', totalScore: 1, sessions: 1, xpTotal: 1 } },
        ];
        const fullLeaderboard = await GameScore.aggregate(pipeline as any);
        const userRank = _req.userId
            ? fullLeaderboard.findIndex((entry) => String(entry._id) === String(_req.userId)) + 1 || null
            : null;

        res.json(successResponse({
            entries: fullLeaderboard.slice(0, 50),
            userRank,
            period,
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

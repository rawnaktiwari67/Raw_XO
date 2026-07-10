import { Request, Response } from 'express';
import crypto from 'crypto';
import GameScore from '../models/GameScore';
import TrackRating from '../models/TrackRating';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from '../utils/devStore';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { calculateLevel, calculateGameXP } from '../utils/xpUtils';
import { shuffle, roundWindowMs, calculateScorePayload, guestNameFromId, MAX_HINTS_PER_ROUND } from '../utils/gameLogic';
import { createSongToken, decodeSongToken, type SongPreview } from '../utils/songTokens';
import type {
    GameGenre,
    GameLanguage,
    GameDifficulty,
    LeaderboardPeriod,
    GameFilters,
} from '../game/types';
import {
    normalizeTitle,
    escapeRegExp,
    normalizeArtistKey,
    normalizeTrackTitleKey,
    isAlternateTrackVersion,
} from '../game/songText';
import {
    applyDifficulty,
    pickWeightedSong,
    pickDistractors,
} from '../game/difficulty';
import {
    SPOTIFY_MARKET,
    SPOTIFY_SEARCH_ENDPOINT,
    hasSpotifyCredentials,
    shouldUseSpotifyTrackSearch,
    getSpotifyJson,
    bestSpotifyImage,
    spotifyReleaseYear,
    fetchSpotifySongPool,
    fetchItunesSongPool,
    fetchSpotifyArtists,
    fetchItunesArtists,
    type SpotifySearchPayload,
} from '../game/musicProviders';
import { env } from '../config/env';
import {
    CURATED_ARTISTS,
    GENRE_QUERY_MAP,
    LANGUAGE_QUERY_MAP,
    INDIA_FOCUSED_LANGUAGES,
    INDIA_FOCUSED_ARTISTS,
} from '../config/gameConstants';

const TRACK_CACHE_MS = Math.max(
    60_000,
    Number.parseInt(env.GAME_TRACK_CACHE_MS, 10) || 10 * 60_000
);
const SPOTIFY_CACHE_MS = Math.min(TRACK_CACHE_MS, 5 * 60_000);
const ARTIST_QUERIES = env.GAME_ARTIST_QUERY
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const DEFAULT_ARTIST_QUERIES = ARTIST_QUERIES.length > 0
    ? ARTIST_QUERIES
    : CURATED_ARTISTS.map((artist) => artist.value);

// Override the 'all' bucket to respect the GAME_ARTIST_QUERY env var
GENRE_QUERY_MAP.all = DEFAULT_ARTIST_QUERIES;

const songPoolCache = new Map<string, { songs: SongPreview[]; fetchedAt: number }>();
const inFlightSongPools = new Map<string, Promise<SongPreview[]>>();
type CorrectSongMemory = {
    id: string;
    titleKey: string;
    artistKey: string;
};

const recentCorrectByCacheKey = new Map<string, CorrectSongMemory[]>();

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

const getPeriodStart = (period: LeaderboardPeriod): Date | null => {
    if (period !== 'daily') return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
};

// ─── Guest identity ──────────────────────────────────────────────────────────
// Anonymous players get a stable id stored in a cookie so their scores group
// into a single leaderboard entry across rounds, with a friendly display name
// derived deterministically from that id (see utils/gameLogic).
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
    const itunesSongPoolPromise = fetchItunesSongPool(queryTerms, country, filters.artist !== 'all' ? filters.artist : undefined);

    // Merge, dedupe across providers, and apply the difficulty filter. Shared so
    // both the full (Spotify+iTunes) pool and the iTunes-only fast path below run
    // identical preparation.
    const prepareMergedPool = (spotifySongs: SongPreview[], itunesSongs: SongPreview[]): SongPreview[] => {
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
        return applyDifficulty(uniqueSongs, filters.difficulty);
    };

    const nextFetch = Promise.allSettled([
        spotifySongPoolPromise,
        itunesSongPoolPromise,
    ])
        .then((songs) => {
            const spotifySongs = songs[0].status === 'fulfilled' ? songs[0].value : [];
            const itunesSongs = songs[1].status === 'fulfilled' ? songs[1].value : [];
            const preparedSongs = prepareMergedPool(spotifySongs, itunesSongs);
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

    // Fast path: don't gate the first clip on the slower provider. iTunes needs
    // no OAuth token, so it usually returns first — if it alone gives a playable
    // pool, answer with it now while nextFetch keeps warming the cache with the
    // fuller Spotify+iTunes merge for subsequent rounds. nextFetch is never
    // slower than before, so this only ever helps.
    const itunesOnly = await itunesSongPoolPromise
        .then((itunesSongs) => prepareMergedPool([], itunesSongs))
        .catch(() => [] as SongPreview[]);
    if (itunesOnly.length >= 4) {
        return itunesOnly;
    }

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

// GET /game/session
// Returns a whole game's worth of rounds (with reveal data) in ONE request, so
// the client never has to hit this serverless function per round — the single
// biggest latency win on Vercel, where each request can cold-start. The reveal
// data lets the client show the answer instantly with no network round-trip;
// the score is still POSTed to /game/answer in the background and re-scored
// server-side there, so the leaderboard stays authoritative.
export const getSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = parseFilters({
            genre: req.query.genre,
            language: req.query.language,
            difficulty: req.query.difficulty,
            artist: req.query.artist,
        });
        const cacheKey = filtersCacheKey(filters);
        const songs = await getSongPool(filters);

        const requestedCount = Number.parseInt(String(req.query.count ?? ''), 10);
        const count = Math.min(Math.max(Number.isFinite(requestedCount) ? requestedCount : 5, 1), 10);

        // Seed with the caller's recent correct songs, then keep extending it with
        // each round we build so a single batch never repeats a correct answer.
        const usedKeys = typeof req.query.excludeSongIds === 'string'
            ? req.query.excludeSongIds.split(',').map((item) => item.trim()).filter(Boolean)
            : [];

        const questions = [];
        for (let i = 0; i < count; i += 1) {
            let built;
            try {
                built = buildQuestionWithExclusion(songs, usedKeys, cacheKey);
            } catch {
                break; // pool exhausted — return however many we managed to build
            }
            const { correct, options } = built;
            const token = createSongToken(correct);
            usedKeys.push(encodeSongMemory(correct));
            questions.push({
                snippetUrl: correct.snippetUrl,
                options,
                songId: token,
                artistName: correct.artist,
                filters,
                reveal: {
                    correctAnswer: correct.title,
                    correctArtist: correct.artist,
                    album: correct.album,
                    artworkUrl: correct.artworkUrl,
                    trackUrl: correct.trackUrl,
                    songKey: encodeSongMemory(correct),
                    trackId: token,
                },
            });
        }

        if (questions.length === 0) {
            res.status(503).json(errorResponse('Game session unavailable'));
            return;
        }

        res.json(successResponse({ questions, filters }));
    } catch {
        res.status(503).json(errorResponse('Game session unavailable'));
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
        // AI hints (POST /ai/hint) cost points. The count is client-reported (like
        // streak and responseTimeMs above); re-applying the same clamp and penalty
        // here keeps this persisted score in step with the client's instant reveal.
        const hintsUsed = Math.min(MAX_HINTS_PER_ROUND, Math.max(0, Number(req.body.hintsUsed) || 0));
        // Clamp the reported time to this difficulty's clock, not a fixed 5s — an
        // 8s answer on a 10s easy round is legitimate and must not be capped to 5s.
        const answerWindowMs = roundWindowMs(filters.difficulty);
        const responseTimeMs = Math.max(0, Math.min(answerWindowMs, Number(req.body.responseTimeMs) || 0));
        const { pointsAwarded, speedBonus, multiplier } = calculateScorePayload(correct, streak, responseTimeMs, filters.difficulty, hintsUsed);
        const xpEarned = calculateGameXP(correct, streak) + Math.round(speedBonus * 0.5);
        if (correct) {
            rememberCorrectSong(filtersCacheKey(filters), song);
        }

        // Resolve guest identity up front — it sets a cookie, which has to be on
        // the response headers, so it must run before res.json below.
        const guest = !req.userId && isDbConnected() ? getOrCreateGuest(req, res) : null;

        // Send the reveal immediately. Persisting the score used to sit on this
        // critical path (two sequential DB round-trips before the player saw the
        // answer); now the result flushes first and the writes happen after.
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

        // Persist after the response has flushed. Awaiting here keeps serverless
        // functions alive until the writes complete, but the client already has
        // its answer — so the reveal is instant regardless of DB latency. Errors
        // can't be surfaced now (headers are sent), so they're logged and swallowed.
        try {
            const scoreDoc = {
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
            };

            if (req.userId && isDbConnected()) {
                // Run the score insert and the XP increment in parallel instead of
                // back-to-back. The level/badge recalc only writes on a level-up.
                const [, user] = await Promise.all([
                    GameScore.create({ user: req.userId, ...scoreDoc }),
                    User.findByIdAndUpdate(req.userId, { $inc: { xp: xpEarned } }, { new: true }),
                ]);

                if (user) {
                    const { level, badge } = calculateLevel(user.xp);
                    if (level !== user.level || badge !== user.levelBadge) {
                        await User.findByIdAndUpdate(req.userId, { level, levelBadge: badge });
                    }
                }
            } else if (req.userId) {
                devStore.saveGameScore({ user: req.userId, ...scoreDoc });
                devStore.incrementUserXp(req.userId, xpEarned);
            } else if (guest) {
                // Anonymous play — persist under a stable guest id so leaderboards populate.
                await GameScore.create({ guestId: guest.guestId, guestName: guest.guestName, ...scoreDoc });
            }
        } catch (error) {
            console.error('submitAnswer: failed to persist score', error);
        }
    } catch {
        if (!res.headersSent) {
            res.status(500).json(errorResponse('Server error'));
        }
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
                    correctCount: { $sum: { $cond: ['$correct', 1, 0] } },
                    avgResponseMs: { $avg: '$responseTimeMs' },
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
                    accuracy: {
                        $cond: [
                            { $gt: ['$sessions', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$correctCount', '$sessions'] }, 100] }, 0] },
                            0,
                        ],
                    },
                    avgResponseMs: { $round: [{ $ifNull: ['$avgResponseMs', 0] }, 0] },
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

// The artists whose catalogs seed the Culture archive's browse pool, each tagged
// with a mood bucket. We assign mood from the searched artist rather than the
// track's genres because Spotify's /v1/artists (genres) endpoint is 403 for
// development-mode apps — search is the only reliable surface.
const CULTURE_CATALOG_SEEDS: Array<{ name: string; mood: string; genre: string }> = [
    { name: 'The Weeknd', mood: 'after midnight', genre: 'r&b' },
    { name: 'SZA', mood: 'after midnight', genre: 'r&b' },
    { name: 'Drake', mood: 'pressure', genre: 'hip-hop' },
    { name: 'Kendrick Lamar', mood: 'pressure', genre: 'hip-hop' },
    { name: 'Travis Scott', mood: 'adrenaline', genre: 'hip-hop' },
    { name: 'Doja Cat', mood: 'gloss and damage', genre: 'pop' },
    { name: 'Taylor Swift', mood: 'gloss and damage', genre: 'pop' },
    { name: 'Dua Lipa', mood: 'high pulse', genre: 'dance' },
    { name: 'The Chainsmokers', mood: 'high pulse', genre: 'dance' },
    { name: 'Arijit Singh', mood: 'devotion', genre: 'bollywood' },
    { name: 'Diljit Dosanjh', mood: 'victory lap', genre: 'punjabi' },
    { name: 'AP Dhillon', mood: 'cold heartbreak', genre: 'punjabi' },
    { name: 'Karan Aujla', mood: 'swagger', genre: 'punjabi' },
    { name: 'Shubh', mood: 'late night', genre: 'punjabi' },
];

type CultureCatalogItem = {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    previewUrl: string;
    trackUrl: string;
    lyricsSnippet: string;
    mood: string;
    popularity: number;
    releaseYear: number;
    genre: string;
    artistPhase: string;
    featured: boolean;
};

let cultureCatalogCache: { items: CultureCatalogItem[]; fetchedAt: number } | null = null;
const CULTURE_CATALOG_TTL_MS = 10 * 60_000;

// GET /culture/catalog — Spotify-powered browse pool for the Culture archive.
// Returns [] (not an error) when Spotify isn't configured, so the client falls
// back cleanly to its iTunes catalog.
export const getCultureCatalog = async (_req: Request, res: Response): Promise<void> => {
    try {
        if (!hasSpotifyCredentials) {
            res.json(successResponse([]));
            return;
        }

        if (cultureCatalogCache && Date.now() - cultureCatalogCache.fetchedAt < CULTURE_CATALOG_TTL_MS) {
            res.json(successResponse(cultureCatalogCache.items));
            return;
        }

        const market = SPOTIFY_MARKET;
        const searches = await Promise.all(
            CULTURE_CATALOG_SEEDS.map(async (seed) => {
                try {
                    const url = `${SPOTIFY_SEARCH_ENDPOINT}?q=${encodeURIComponent(seed.name)}&type=track&limit=8&market=${market}`;
                    const payload = (await getSpotifyJson(url)) as SpotifySearchPayload;
                    return (payload.tracks?.items ?? []).map((track) => ({ track, seed }));
                } catch {
                    return [];
                }
            })
        );

        // Spotify omits `popularity` for dev-mode apps, so synthesize a stable
        // score from recency + a per-track hash — enough for Hottest/Newest sorts.
        const currentYear = new Date().getFullYear();
        const hashString = (value: string): number => {
            let hash = 0;
            for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
            return Math.abs(hash);
        };
        const synthPopularity = (id: string, year: number): number => {
            const recency = year > 0 ? Math.min(34, (currentYear - year) * 2) : 20;
            return Math.min(99, Math.max(52, 92 - recency + (hashString(id) % 10)));
        };

        // Normalize each artist's results into its own list (de-duped globally),
        // then round-robin so every mood is represented within the 60-item cap
        // instead of the first few artists filling it.
        const seenIds = new Set<string>();
        const titleSeen = new Set<string>();
        const perSeed: CultureCatalogItem[][] = searches.map((group) => {
            const list: CultureCatalogItem[] = [];
            for (const { track, seed } of group) {
                const id = track.id ?? '';
                const title = track.name ?? '';
                const artistNames = (track.artists ?? []).map((a) => a.name).filter(Boolean) as string[];
                const artist = artistNames.join(', ') || 'Unknown';
                const albumArt = bestSpotifyImage(track.album?.images);
                if (!title || !albumArt || (id && seenIds.has(id))) continue;
                const titleKey = `${title}|${artist}`.toLowerCase();
                if (titleSeen.has(titleKey)) continue;
                if (id) seenIds.add(id);
                titleSeen.add(titleKey);

                const releaseYear = spotifyReleaseYear(track.album?.release_date);
                list.push({
                    trackId: id || titleKey,
                    title,
                    artist,
                    album: track.album?.name ?? '',
                    albumArt,
                    previewUrl: track.preview_url ?? '',
                    trackUrl: track.external_urls?.spotify ?? '',
                    lyricsSnippet: title,
                    mood: seed.mood,
                    popularity: synthPopularity(id || titleKey, releaseYear),
                    releaseYear,
                    genre: seed.genre,
                    artistPhase: 'in rotation',
                    featured: false,
                });
            }
            return list;
        });

        const items: CultureCatalogItem[] = [];
        for (let round = 0; items.length < 60; round += 1) {
            let addedThisRound = false;
            for (const list of perSeed) {
                if (list[round]) {
                    items.push(list[round]);
                    addedThisRound = true;
                    if (items.length >= 60) break;
                }
            }
            if (!addedThisRound) break;
        }

        const result = items;
        cultureCatalogCache = { items: result, fetchedAt: Date.now() };
        res.json(successResponse(result));
    } catch {
        // Never hard-fail — the client treats [] as "use the iTunes fallback".
        res.json(successResponse([]));
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

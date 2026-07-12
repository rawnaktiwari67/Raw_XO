import api from './api';
import type { NormalizedMusicItem } from '../types/culture';

type ItunesTrackResult = {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    collectionName?: string;
    releaseDate?: string;
    primaryGenreName?: string;
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
};

type CuratedTrackSeed = {
    query: string;
    lyricsSnippet: string;
    mood: string;
    artistPhase: string;
};

const SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
const COUNTRY = import.meta.env.VITE_APPLE_MUSIC_COUNTRY || 'IN';
const CURRENT_YEAR = new Date().getFullYear();

// Hand-curated tracks: these carry a real lyric hook and seed meaning in
// lyricsService. They lead the archive and power the Meaning Lab.
const TRENDING_TRACK_SEEDS: CuratedTrackSeed[] = [
    {
        query: 'the hills the weeknd',
        lyricsSnippet: '"When I am fucked up..."',
        mood: 'night drive',
        artistPhase: 'mystique turning mainstream',
    },
    {
        query: 'starboy the weeknd',
        lyricsSnippet: '"Look what you have done..."',
        mood: 'ego rush',
        artistPhase: 'pop peak with villain energy',
    },
    {
        query: 'marvins room drake',
        lyricsSnippet: '"I am just saying..."',
        mood: 'late regret',
        artistPhase: 'confessional flex',
    },
    {
        query: 'runaway kanye west',
        lyricsSnippet: '"Run away from me..."',
        mood: 'public apology',
        artistPhase: 'spectacle and fallout',
    },
    {
        query: 'fein travis scott',
        lyricsSnippet: '"Fein, fein, fein..."',
        mood: 'adrenaline',
        artistPhase: 'arena chaos',
    },
    {
        query: 'tum hi ho arijit singh',
        lyricsSnippet: '"Tum hi ho..."',
        mood: 'devotion',
        artistPhase: 'romantic takeover',
    },
    {
        query: 'born to shine diljit dosanjh',
        lyricsSnippet: '"Born to shine..."',
        mood: 'victory lap',
        artistPhase: 'global Punjabi lift',
    },
    {
        query: 'excuses ap dhillon',
        lyricsSnippet: '"Kehndi hundi si..."',
        mood: 'cold heartbreak',
        artistPhase: 'streaming-era diaspora wave',
    },
];

// Broad catalog searches — each pulls several songs so moods, search, and sort
// have real depth instead of one track per filter. Keyed by artist so the pool
// spans the genres and languages the app cares about.
const CATALOG_QUERIES = [
    'the weeknd',
    'drake',
    'kendrick lamar',
    'travis scott',
    'sza',
    'doja cat',
    'dua lipa',
    'taylor swift',
    'the chainsmokers',
    'arijit singh',
    'diljit dosanjh',
    'ap dhillon',
    'karan aujla',
    'shubh',
];

const catalogCache = new Map<string, Promise<NormalizedMusicItem[]>>();

const hashString = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Map a real iTunes genre onto one of a small set of mood buckets, so every
// catalog track lands in a mood that already has company. Falls back to the
// curated seed mood (or a neutral bucket) when the genre is unknown.
const moodForGenre = (genre: string, fallbackMood: string): string => {
    const g = genre.toLowerCase();
    if (g.includes('hip-hop') || g.includes('rap')) return 'pressure';
    if (g.includes('r&b') || g.includes('soul')) return 'after midnight';
    if (g.includes('pop')) return 'gloss and damage';
    if (g.includes('dance') || g.includes('electronic') || g.includes('house')) return 'high pulse';
    if (g.includes('rock') || g.includes('alternative') || g.includes('metal')) return 'distortion';
    if (g.includes('country') || g.includes('folk')) return 'open road';
    if (g.includes('latin') || g.includes('reggaeton')) return 'fuego';
    if (g.includes('indian') || g.includes('bolly') || g.includes('punjabi') || g.includes('desi') || g.includes('worldwide'))
        return 'devotion';
    return fallbackMood || 'late night';
};

// Synthesize a popularity score (iTunes gives none) that's stable per track and
// leans on recency, so the "Hottest" / "Newest" sorts actually differ.
const synthPopularity = (trackId: string, releaseYear: number): number =>
    clamp(92 - Math.min(34, (CURRENT_YEAR - releaseYear) * 2) + (hashString(trackId) % 10), 52, 99);

const baseFromResult = (result: ItunesTrackResult): NormalizedMusicItem | null => {
    if (
        !result.trackId ||
        !result.trackName ||
        !result.artistName ||
        !result.collectionName ||
        !result.previewUrl ||
        !result.artworkUrl100 ||
        !result.trackViewUrl
    ) {
        return null;
    }

    const releaseYear = result.releaseDate ? new Date(result.releaseDate).getFullYear() : CURRENT_YEAR;
    const genre = result.primaryGenreName || 'Music';

    return {
        trackId: String(result.trackId),
        title: result.trackName,
        artist: result.artistName,
        album: result.collectionName,
        albumArt: result.artworkUrl100.replace('100x100bb', '600x600bb'),
        previewUrl: result.previewUrl,
        trackUrl: result.trackViewUrl,
        lyricsSnippet: result.trackName,
        mood: moodForGenre(genre, 'late night'),
        popularity: synthPopularity(String(result.trackId), releaseYear),
        releaseYear,
        genre,
        artistPhase: 'in rotation',
        featured: false,
    };
};

const fetchItunes = async (term: string, limit: number): Promise<ItunesTrackResult[]> => {
    try {
        const response = await fetch(
            `${SEARCH_ENDPOINT}?term=${encodeURIComponent(term)}&country=${COUNTRY}&media=music&entity=song&limit=${limit}`
        );
        if (!response.ok) throw new Error('Apple search failed');
        const payload = (await response.json()) as { results?: ItunesTrackResult[] };
        return payload.results || [];
    } catch {
        return [];
    }
};

const fetchFeatured = async (seed: CuratedTrackSeed, index: number): Promise<NormalizedMusicItem | null> => {
    const [result] = await fetchItunes(seed.query, 1);
    const base = result ? baseFromResult(result) : null;
    if (!base) return null;
    return {
        ...base,
        lyricsSnippet: seed.lyricsSnippet,
        mood: moodForGenre(base.genre, seed.mood),
        popularity: Math.max(58, 100 - index * 5),
        artistPhase: seed.artistPhase,
        featured: true,
    };
};

const fetchCatalog = (query: string): Promise<NormalizedMusicItem[]> => {
    if (!catalogCache.has(query)) {
        catalogCache.set(
            query,
            fetchItunes(query, 6).then((results) =>
                results.map(baseFromResult).filter((track): track is NormalizedMusicItem => Boolean(track))
            )
        );
    }
    return catalogCache.get(query) || Promise.resolve([]);
};

// Prefer the server's Spotify-powered catalog (real popularity + genres). Returns
// [] when Spotify isn't configured server-side, which signals the iTunes fallback.
const fetchSpotifyCatalog = async (): Promise<NormalizedMusicItem[]> => {
    try {
        const response = await api.get('/culture/catalog');
        const data = response.data?.data;
        if (!Array.isArray(data)) return [];
        return data
            .map((item): NormalizedMusicItem | null => {
                if (!item || typeof item.trackId !== 'string' || !item.title || !item.albumArt) return null;
                return {
                    trackId: item.trackId,
                    title: item.title,
                    artist: item.artist || 'Unknown',
                    album: item.album || '',
                    albumArt: item.albumArt,
                    previewUrl: item.previewUrl || '',
                    trackUrl: item.trackUrl || '',
                    lyricsSnippet: item.lyricsSnippet || item.title,
                    mood: item.mood || 'late night',
                    popularity: typeof item.popularity === 'number' ? item.popularity : 60,
                    releaseYear: typeof item.releaseYear === 'number' && item.releaseYear > 0 ? item.releaseYear : CURRENT_YEAR,
                    genre: item.genre || 'music',
                    artistPhase: item.artistPhase || 'in rotation',
                    featured: false,
                };
            })
            .filter((track): track is NormalizedMusicItem => Boolean(track));
    } catch {
        return [];
    }
};

const fallbackTracks = (): NormalizedMusicItem[] =>
    TRENDING_TRACK_SEEDS.map((seed, index) => ({
        trackId: `fallback-${index + 1}`,
        title: seed.query.split(' ').slice(0, -2).join(' ') || seed.query,
        artist: seed.query.split(' ').slice(-2).join(' '),
        album: 'Raw XO fallback',
        albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80',
        previewUrl: '',
        trackUrl: 'https://music.apple.com',
        lyricsSnippet: seed.lyricsSnippet,
        mood: seed.mood,
        popularity: Math.max(58, 100 - index * 5),
        releaseYear: 2024 - index,
        genre: 'Music',
        artistPhase: seed.artistPhase,
        featured: true,
    }));

let catalogPromise: Promise<NormalizedMusicItem[]> | null = null;

export const musicService = {
    async getTrendingTracks(): Promise<NormalizedMusicItem[]> {
        if (!catalogPromise) {
            catalogPromise = (async () => {
                // Featured (curated, with lyric hooks) always come from iTunes for
                // reliable previews. The broad pool prefers Spotify, then iTunes.
                const featured = await Promise.all(
                    TRENDING_TRACK_SEEDS.map((seed, index) => fetchFeatured(seed, index))
                );

                let catalog = await fetchSpotifyCatalog();
                if (catalog.length === 0) {
                    const catalogBatches = await Promise.all(CATALOG_QUERIES.map((query) => fetchCatalog(query)));
                    catalog = catalogBatches.flat();
                }

                const seen = new Set<string>();
                const ordered: NormalizedMusicItem[] = [];

                // Featured first so the hero + Meaning Lab lead with curated tracks.
                for (const track of featured) {
                    if (!track || seen.has(track.trackId)) continue;
                    seen.add(track.trackId);
                    ordered.push(track);
                }

                // Then the broad catalog, de-duped by id and by title|artist so the
                // same song from different releases doesn't crowd the grid.
                const titleSeen = new Set(ordered.map((t) => `${t.title}|${t.artist}`.toLowerCase()));
                for (const track of catalog) {
                    const titleKey = `${track.title}|${track.artist}`.toLowerCase();
                    if (seen.has(track.trackId) || titleSeen.has(titleKey)) continue;
                    seen.add(track.trackId);
                    titleSeen.add(titleKey);
                    ordered.push(track);
                }

                const tracks = ordered.slice(0, 36);
                return tracks.length > 0 ? tracks : fallbackTracks();
            })().catch(() => fallbackTracks());
        }

        return catalogPromise;
    },

    // Album-art only, tuned for the hero wall: pulls straight from the fast,
    // memoized iTunes catalog batch (all queries in parallel) and deliberately
    // skips the Spotify `/culture/catalog` server round-trip that
    // getTrendingTracks() awaits. That server call — a cold Vercel serverless
    // function — is what made the wall paint 2-3s after everything else. The
    // game grid still uses getTrendingTracks for real popularity/genres; the
    // ambient wall only needs artwork, so it takes the quick route.
    async getHeroArtwork(): Promise<NormalizedMusicItem[]> {
        const batches = await Promise.all(CATALOG_QUERIES.map((query) => fetchCatalog(query)));
        const tracks = batches.flat();
        return tracks.length > 0 ? tracks : fallbackTracks();
    },
};

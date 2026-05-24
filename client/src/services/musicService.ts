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

const trackCache = new Map<string, Promise<NormalizedMusicItem | null>>();

const normalizeMood = (genre: string, fallbackMood: string): string => {
    const normalized = genre.toLowerCase();
    if (normalized.includes('hip-hop') || normalized.includes('rap')) return 'pressure';
    if (normalized.includes('r&b')) return 'after midnight';
    if (normalized.includes('pop')) return 'gloss and damage';
    if (normalized.includes('dance')) return 'high pulse';
    return fallbackMood;
};

const computePopularity = (index: number): number => Math.max(52, 100 - index * 6);

const toNormalizedTrack = (
    result: ItunesTrackResult,
    seed: CuratedTrackSeed,
    index: number
): NormalizedMusicItem | null => {
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

    return {
        trackId: String(result.trackId),
        title: result.trackName,
        artist: result.artistName,
        album: result.collectionName,
        albumArt: result.artworkUrl100.replace('100x100bb', '600x600bb'),
        previewUrl: result.previewUrl,
        trackUrl: result.trackViewUrl,
        lyricsSnippet: seed.lyricsSnippet,
        mood: normalizeMood(result.primaryGenreName || '', seed.mood),
        popularity: computePopularity(index),
        releaseYear: result.releaseDate ? new Date(result.releaseDate).getFullYear() : new Date().getFullYear(),
        genre: result.primaryGenreName || 'Music',
        artistPhase: seed.artistPhase,
    };
};

const fetchTrackForSeed = async (seed: CuratedTrackSeed, index: number): Promise<NormalizedMusicItem | null> => {
    const cacheKey = `${COUNTRY}:${seed.query}`;
    if (!trackCache.has(cacheKey)) {
        trackCache.set(
            cacheKey,
            fetch(
                `${SEARCH_ENDPOINT}?term=${encodeURIComponent(seed.query)}&country=${COUNTRY}&media=music&entity=song&limit=1`
            )
                .then((response) => {
                    if (!response.ok) throw new Error('Apple search failed');
                    return response.json() as Promise<{ results?: ItunesTrackResult[] }>;
                })
                .then((payload) => toNormalizedTrack(payload.results?.[0] || {}, seed, index))
                .catch(() => null)
        );
    }

    return trackCache.get(cacheKey) || Promise.resolve(null);
};

const fallbackTracks = (): NormalizedMusicItem[] =>
    TRENDING_TRACK_SEEDS.map((seed, index) => ({
        trackId: `fallback-${index + 1}`,
        title: seed.query.split(' ').slice(0, -2).join(' ') || seed.query,
        artist: seed.query.split(' ').slice(-2).join(' '),
        album: 'Afterglow FM fallback',
        albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80',
        previewUrl: '',
        trackUrl: 'https://music.apple.com',
        lyricsSnippet: seed.lyricsSnippet,
        mood: seed.mood,
        popularity: computePopularity(index),
        releaseYear: 2024 - index,
        genre: 'Music',
        artistPhase: seed.artistPhase,
    }));

export const musicService = {
    async getTrendingTracks(): Promise<NormalizedMusicItem[]> {
        const tracks = await Promise.all(TRENDING_TRACK_SEEDS.map((seed, index) => fetchTrackForSeed(seed, index)));
        const normalized = tracks.filter((track): track is NormalizedMusicItem => Boolean(track));
        return normalized.length > 0 ? normalized : fallbackTracks();
    },
};

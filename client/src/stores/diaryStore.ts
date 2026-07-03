import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// A single logged track in the listening diary. `rating` is null when a track
// has been played/encountered but not yet rated, so "played" and "rated" are
// distinct states (a play still counts toward the diary; a rating is the take).
export interface DiaryEntry {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    trackUrl?: string;
    rating: number | null;
    plays: number;
    firstLoggedAt: number;
    lastPlayedAt: number;
    ratedAt?: number;
}

// The minimum a caller needs to supply to log or rate a track. Anything the game
// reveal or the culture catalog already knows about a track fits this shape.
export interface DiaryTrackSeed {
    trackId: string;
    title: string;
    artist: string;
    album?: string;
    albumArt: string;
    trackUrl?: string;
}

interface DiaryState {
    entries: Record<string, DiaryEntry>;
    // Record that a track was heard (e.g. a game round revealed it). Idempotent
    // per track — repeated plays bump the counter and recency, never duplicate.
    logPlay: (track: DiaryTrackSeed) => void;
    // Set (or change) the 1–5 rating for a track, creating its entry if needed.
    rate: (track: DiaryTrackSeed, rating: number) => void;
    clear: () => void;
}

const now = () => Date.now();

const seedToEntry = (track: DiaryTrackSeed): DiaryEntry => ({
    trackId: track.trackId,
    title: track.title,
    artist: track.artist,
    album: track.album ?? '',
    albumArt: track.albumArt,
    trackUrl: track.trackUrl,
    rating: null,
    plays: 0,
    firstLoggedAt: now(),
    lastPlayedAt: now(),
});

export const useDiaryStore = create<DiaryState>()(
    persist(
        (set) => ({
            entries: {},

            logPlay: (track) =>
                set((state) => {
                    if (!track.trackId) return state;
                    const existing = state.entries[track.trackId];
                    const base = existing ?? seedToEntry(track);
                    return {
                        entries: {
                            ...state.entries,
                            [track.trackId]: {
                                ...base,
                                // Keep the freshest metadata (art/title can improve).
                                title: track.title || base.title,
                                artist: track.artist || base.artist,
                                album: track.album ?? base.album,
                                albumArt: track.albumArt || base.albumArt,
                                trackUrl: track.trackUrl ?? base.trackUrl,
                                plays: base.plays + 1,
                                lastPlayedAt: now(),
                            },
                        },
                    };
                }),

            rate: (track, rating) =>
                set((state) => {
                    if (!track.trackId) return state;
                    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
                    const base = state.entries[track.trackId] ?? seedToEntry(track);
                    return {
                        entries: {
                            ...state.entries,
                            [track.trackId]: {
                                ...base,
                                title: track.title || base.title,
                                artist: track.artist || base.artist,
                                album: track.album ?? base.album,
                                albumArt: track.albumArt || base.albumArt,
                                trackUrl: track.trackUrl ?? base.trackUrl,
                                rating: clamped,
                                ratedAt: now(),
                            },
                        },
                    };
                }),

            clear: () => set({ entries: {} }),
        }),
        { name: 'raw-xo-diary' }
    )
);

// ─── Derived selectors (pure, computed over the entries map) ──────────────────

export const diaryList = (entries: Record<string, DiaryEntry>): DiaryEntry[] =>
    Object.values(entries);

export const recentlyPlayed = (entries: Record<string, DiaryEntry>): DiaryEntry[] =>
    diaryList(entries).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

export const recentlyRated = (entries: Record<string, DiaryEntry>): DiaryEntry[] =>
    diaryList(entries)
        .filter((entry) => entry.rating !== null)
        .sort((a, b) => (b.ratedAt ?? 0) - (a.ratedAt ?? 0));

export const topRated = (entries: Record<string, DiaryEntry>, min = 5): DiaryEntry[] =>
    diaryList(entries)
        .filter((entry) => (entry.rating ?? 0) >= min)
        .sort((a, b) => (b.ratedAt ?? 0) - (a.ratedAt ?? 0));

export interface DiaryStats {
    logged: number;
    rated: number;
    avgRating: number | null;
    topArtist: string | null;
}

export const diaryStats = (entries: Record<string, DiaryEntry>): DiaryStats => {
    const list = diaryList(entries);
    const rated = list.filter((entry) => entry.rating !== null);
    const avgRating = rated.length
        ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length
        : null;

    const byArtist = new Map<string, number>();
    for (const entry of list) {
        if (!entry.artist) continue;
        byArtist.set(entry.artist, (byArtist.get(entry.artist) ?? 0) + 1);
    }
    let topArtist: string | null = null;
    let topCount = 0;
    for (const [artist, count] of byArtist) {
        if (count > topCount) {
            topArtist = artist;
            topCount = count;
        }
    }

    return { logged: list.length, rated: rated.length, avgRating, topArtist };
};

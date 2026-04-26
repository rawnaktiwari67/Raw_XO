export interface NormalizedMusicItem {
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
}

export interface MeaningOption {
    id: string;
    label: string;
    votes: number;
}

export interface ReactionOption {
    id: string;
    label: string;
    count: number;
}

export interface MeaningEntry {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    previewUrl: string;
    trackUrl: string;
    lyricsSnippet: string;
    shortTake: string;
    alternateMeanings: string[];
    whyItHits: string;
    whenItDropped: string;
    whatWasHappening: string;
    mood: string;
    popularity: number;
    releaseYear: number;
    artistPhase: string;
    meanings: MeaningOption[];
    reactions: ReactionOption[];
}

export interface CultureReview {
    id: string;
    trackId: string;
    title: string;
    artist: string;
    albumArt: string;
    rating: number;
    moodTag: string;
    take: string;
    createdAt: string;
}

export interface LyricGuessRound {
    id: string;
    trackId: string;
    title: string;
    artist: string;
    albumArt: string;
    previewUrl: string;
    trackUrl: string;
    snippet: string;
    meaning: string;
    options: string[];
}

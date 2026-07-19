type GameLanguage = 'all' | 'english' | 'hindi' | 'punjabi' | 'korean' | 'spanish';
type GameGenre = 'all' | 'hip-hop' | 'pop' | 'rnb' | 'dance';
type GameDifficulty = 'easy' | 'medium' | 'hard' | 'pro';

// Seconds on the clock per difficulty. Easier = more breathing room; harder =
// you have to trust your gut. The client uses this for the countdown and the
// server uses the same numbers as its speed-bonus window, so the two never
// drift out of sync (a longer clock must mean a longer window to earn bonus on).
// Pro keeps a 7s clock — its challenge is the clip length (a 0.1s blink,
// enforced client-side), not the countdown.
export const DIFFICULTY_ROUND_SECONDS: Record<GameDifficulty, number> = {
    easy: 10,
    medium: 7,
    hard: 5,
    pro: 7,
};

export type ArtistProfile = {
    label: string;
    value: string;
    language: GameLanguage;
};

export const CURATED_ARTISTS: ArtistProfile[] = [
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

export const GENRE_QUERY_MAP: Record<GameGenre, string[]> = {
    all: CURATED_ARTISTS.map((a) => a.value),
    'hip-hop': ['kanye west', 'travis scott', 'drake', 'kendrick lamar', 'post malone', 'doja cat'],
    pop: ['the weeknd', 'dua lipa', 'billie eilish', 'taylor swift', 'ariana grande', 'bad bunny'],
    rnb: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'ariana grande', 'drake'],
    dance: ['dua lipa', 'calvin harris', 'david guetta', 'charli xcx', 'the weeknd', 'doja cat'],
};

export const LANGUAGE_QUERY_MAP: Record<GameLanguage, string[]> = {
    all: [],
    english: ['the weeknd', 'kanye west', 'travis scott', 'drake', 'sza', 'billie eilish', 'dua lipa', 'ariana grande'],
    hindi: ['arijit singh', 'shreya ghoshal', 'pritam', 'atif aslam'],
    punjabi: ['diljit dosanjh', 'karan aujla', 'ap dhillon', 'shubh'],
    korean: ['bts', 'blackpink', 'newjeans', 'jung kook'],
    spanish: ['bad bunny', 'karol g', 'rosalia', 'rauw alejandro'],
};

export const INDIA_FOCUSED_LANGUAGES: GameLanguage[] = ['hindi', 'punjabi'];
export const INDIA_FOCUSED_ARTISTS = [
    'arijit singh', 'pritam', 'shreya ghoshal', 'atif aslam',
    'diljit dosanjh', 'karan aujla', 'ap dhillon', 'shubh',
];

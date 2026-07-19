// Shared game domain types, used across the game controller and its helper
// modules (song text matching, difficulty weighting, leaderboard scoping).

export type GameGenre = 'all' | 'hip-hop' | 'pop' | 'rnb' | 'dance';
export type GameLanguage = 'all' | 'english' | 'hindi' | 'punjabi' | 'korean' | 'spanish';
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'pro';
export type LeaderboardPeriod = 'daily' | 'all-time';

export type GameFilters = {
    genre: GameGenre;
    language: GameLanguage;
    difficulty: GameDifficulty;
    artist: string;
};

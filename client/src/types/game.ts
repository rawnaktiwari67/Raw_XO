export type GameGenre = 'all' | 'hip-hop' | 'pop' | 'rnb' | 'dance';
export type GameLanguage = 'all' | 'english' | 'hindi' | 'punjabi' | 'korean' | 'spanish';
export type GameDifficulty = 'easy' | 'medium' | 'hard';
export type LeaderboardPeriod = 'daily' | 'all-time';
export type LeaderboardScope = 'global' | 'artist' | 'genre';

export interface GameArtistOption {
    label: string;
    value: string;
    language: GameLanguage;
}

export interface GameFilters {
    genre: GameGenre;
    language: GameLanguage;
    difficulty: GameDifficulty;
    artist: string;
}

// Reveal data is embedded in batched session questions so the client can show
// the answer instantly with no network round-trip. Absent on the legacy
// /game/question path.
export interface GameReveal {
    correctAnswer: string;
    correctArtist?: string;
    album?: string;
    artworkUrl?: string;
    trackUrl?: string;
    songKey?: string;
    trackId?: string;
}

export interface GameQuestion {
    snippetUrl: string;
    options: string[];
    songId: string;
    artistName?: string;
    filters?: GameFilters;
    reveal?: GameReveal;
}

// A whole game's rounds fetched in one request (see GET /game/session).
export interface GameSessionBatch {
    questions: GameQuestion[];
    filters: GameFilters;
}

export interface GameResult {
    correct: boolean;
    correctAnswer: string;
    xpEarned: number;
    pointsAwarded: number;
    speedBonus: number;
    multiplier: number;
    responseTimeMs?: number;
    correctArtist?: string;
    album?: string;
    artworkUrl?: string;
    trackUrl?: string;
    trackId?: string;
    songKey?: string;
    filters?: GameFilters;
}

export interface GameStats {
    totalGamesPlayed: number;
    totalCorrect: number;
    accuracy: number;
    streak: number;
    bestStreak: number;
    ratingsCount: number;
    averageResponseTimeMs: number;
    fastestCorrectResponseTimeMs: number;
}

export interface LeaderboardEntry {
    _id: string;
    username: string;
    avatar: string;
    levelBadge: string;
    totalScore: number;
    sessions: number;
    isGuest?: boolean;
}

export interface LeaderboardData {
    entries: LeaderboardEntry[];
    userRank: number | null;
    period: LeaderboardPeriod;
    scope?: LeaderboardScope;
    scopeValue?: string;
}

export interface RoundLeaderboards {
    daily: LeaderboardData | null;
    artist: LeaderboardData | null;
    genre: LeaderboardData | null;
}

export interface GameSession {
    _id: string;
    trackId?: string;
    trackName?: string;
    artistName?: string;
    genre?: GameGenre;
    language?: GameLanguage;
    difficulty?: GameDifficulty;
    artistFilter?: string;
    artworkUrl?: string;
    trackUrl?: string;
    correct?: boolean;
    responseTimeMs?: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    xpEarned: number;
    sessionDate: string;
}

export interface SessionSummary {
    roundsPlayed: number;
    correctAnswers: number;
    accuracy: number;
    totalScore: number;
    bestStreak: number;
}

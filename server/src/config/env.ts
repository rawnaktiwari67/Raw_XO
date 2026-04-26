import dotenv from 'dotenv';
dotenv.config();

export const env = {
    PORT: process.env.PORT || '5000',
    MONGODB_URI: process.env.MONGODB_URI || '',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || 'change-me',
    GAME_SECRET: process.env.GAME_SECRET || 'change-me-game',
    GAME_ARTIST_QUERY: process.env.GAME_ARTIST_QUERY || 'the weeknd, kanye west, travis scott, drake',
    GAME_ITUNES_COUNTRY: process.env.GAME_ITUNES_COUNTRY || 'us',
    GAME_ITUNES_LIMIT: process.env.GAME_ITUNES_LIMIT || '80',
    GAME_TRACK_CACHE_MS: process.env.GAME_TRACK_CACHE_MS || '600000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

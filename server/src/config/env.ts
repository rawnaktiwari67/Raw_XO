import dotenv from 'dotenv';
dotenv.config();

const getEnv = () => ({
    PORT: process.env.PORT || '5000',
    MONGODB_URI: process.env.MONGODB_URI || '',
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || 'change-me',
    GAME_SECRET: process.env.GAME_SECRET || 'change-me-game',
    GAME_ARTIST_QUERY: process.env.GAME_ARTIST_QUERY || 'the weeknd, kanye west, travis scott, drake',
    GAME_ITUNES_COUNTRY: process.env.GAME_ITUNES_COUNTRY || 'us',
    GAME_ITUNES_LIMIT: process.env.GAME_ITUNES_LIMIT || '40',
    GAME_ITUNES_TIMEOUT_MS: process.env.GAME_ITUNES_TIMEOUT_MS || '4500',
    GAME_MAX_QUERY_TERMS: process.env.GAME_MAX_QUERY_TERMS || '6',
    GAME_TRACK_CACHE_MS: process.env.GAME_TRACK_CACHE_MS || '600000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS || '',
    REQUIRE_AUTH_FOR_CULTURE_WRITES: process.env.REQUIRE_AUTH_FOR_CULTURE_WRITES === 'true',
});

export const env = getEnv();

const assertProductionSecret = (name: string, value: string, unsafeDefaults: string[]): void => {
    if (value.length < 32 || unsafeDefaults.includes(value)) {
        throw new Error(`${name} must be set to a strong unique value in production.`);
    }
};

export const validateEnv = (): void => {
    if (env.NODE_ENV !== 'production') return;

    if (!env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in production.');
    }

    assertProductionSecret('JWT_SECRET', env.JWT_SECRET, ['change-me']);
    assertProductionSecret('GAME_SECRET', env.GAME_SECRET, ['change-me-game']);

    if (!env.CLIENT_ORIGIN || env.CLIENT_ORIGIN.includes('your-frontend-domain')) {
        throw new Error('CLIENT_ORIGIN must be set to your deployed frontend origin in production.');
    }

    if (!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
        throw new Error('Both CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required in production.');
    }
};

import dotenv from 'dotenv';
dotenv.config();

const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

const getEnv = () => ({
    PORT: process.env.PORT || '5000',
    VERCEL: process.env.VERCEL || '',
    VERCEL_ENV: process.env.VERCEL_ENV || '',
    MONGODB_URI: process.env.MONGODB_URI || '',
    CLERK_PUBLISHABLE_KEY: (
        process.env.CLERK_PUBLISHABLE_KEY
        || process.env.VITE_CLERK_PUBLISHABLE_KEY
        || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        || ''
    ).trim(),
    CLERK_SECRET_KEY: (process.env.CLERK_SECRET_KEY || '').trim(),
    JWT_SECRET: process.env.JWT_SECRET || 'change-me',
    GAME_SECRET: process.env.GAME_SECRET || 'change-me-game',
    GAME_ARTIST_QUERY: process.env.GAME_ARTIST_QUERY || 'the weeknd, kanye west, travis scott, drake',
    GAME_ITUNES_COUNTRY: process.env.GAME_ITUNES_COUNTRY || 'us',
    GAME_ITUNES_LIMIT: process.env.GAME_ITUNES_LIMIT || '40',
    GAME_ITUNES_TIMEOUT_MS: process.env.GAME_ITUNES_TIMEOUT_MS || '4500',
    GAME_MAX_QUERY_TERMS: process.env.GAME_MAX_QUERY_TERMS || '6',
    GAME_TRACK_CACHE_MS: process.env.GAME_TRACK_CACHE_MS || '600000',
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
    GAME_SPOTIFY_MARKET: process.env.GAME_SPOTIFY_MARKET || 'US',
    GAME_SPOTIFY_TRACK_SEARCH: process.env.GAME_SPOTIFY_TRACK_SEARCH === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || vercelOrigin || 'http://localhost:5173',
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS || '',
    REQUIRE_AUTH_FOR_CULTURE_WRITES: process.env.REQUIRE_AUTH_FOR_CULTURE_WRITES === 'true',
});

export const env = getEnv();

const isHostedDeploy = env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
const shouldValidateProduction = env.NODE_ENV === 'production' || isHostedDeploy;
export const hasClerkKeys = Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
export const shouldUseClerkServer = hasClerkKeys;

const assertProductionSecret = (name: string, value: string, unsafeDefaults: string[]): void => {
    if (value.length < 32 || unsafeDefaults.includes(value)) {
        throw new Error(`${name} must be set to a strong unique value in production.`);
    }
};

export const validateEnv = (): void => {
    if (!shouldValidateProduction) return;

    if (!env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in production.');
    }

    assertProductionSecret('JWT_SECRET', env.JWT_SECRET, ['change-me']);
    assertProductionSecret('GAME_SECRET', env.GAME_SECRET, ['change-me-game']);

    if (!env.CLIENT_ORIGIN || env.CLIENT_ORIGIN.includes('your-frontend-domain')) {
        throw new Error('CLIENT_ORIGIN must be set to your deployed frontend origin in production, or VERCEL_URL must be available.');
    }

    // Clerk is optional — game routes use optionalProtect so they work without auth.
    // Test keys (pk_test_ / sk_test_) are fine; live keys are preferred for user sessions.
    if (hasClerkKeys) {
        console.log(`[env] Clerk auth active (${env.CLERK_PUBLISHABLE_KEY.startsWith('pk_live_') ? 'live' : 'test'} keys)`);
    } else {
        console.log('[env] Clerk keys not set — running without auth');
    }
};

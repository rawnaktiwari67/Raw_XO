import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { env, hasClerkKeys, shouldUseClerkServer } from './config/env';
import { getLastDbError } from './config/db';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimiter';
import { crawlerMeta } from './seo/crawlerMeta';

import authRoutes from './routes/auth.routes';
import threadRoutes from './routes/thread.routes';
import commentRoutes from './routes/comment.routes';
import gameRoutes from './routes/game.routes';
import tourRoutes from './routes/tour.routes';
import userRoutes from './routes/user.routes';
import eraRoutes from './routes/era.routes';
import cultureRoutes from './routes/culture.routes';
import aiRoutes from './routes/ai.routes';

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = env.CLIENT_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// MUST come BEFORE clerkMiddleware so preflight OPTIONS requests receive the
// correct CORS headers before Clerk attempts to verify auth tokens.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // No origin = same-origin or server-to-server — always allow
        if (!origin) {
            callback(null, true);
            return;
        }
        // If no explicit origins configured, allow all (open/dev mode)
        if (allowedOrigins.length === 0) {
            callback(null, true);
            return;
        }
        // Allow explicitly configured origins
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        // Allow Vercel deployment and preview URLs (*.vercel.app)
        if (origin.endsWith('.vercel.app')) {
            callback(null, true);
            return;
        }
        // Allow Vite fallback ports in local development for either loopback hostname.
        if (env.NODE_ENV !== 'production' && /^http:\/\/(?:localhost|127\.0\.0\.1):517\d$/.test(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Explicitly respond to all OPTIONS preflight requests before any auth check
app.options('*', cors(corsOptions));

// ─── Clerk ────────────────────────────────────────────────────────────────────
if (shouldUseClerkServer) {
    app.use(clerkMiddleware({
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
    }));
} else if (hasClerkKeys) {
    console.warn('Clerk keys are present but Clerk middleware is disabled.');
} else if (env.CLERK_SECRET_KEY || env.CLERK_PUBLISHABLE_KEY) {
    console.warn('Clerk is partially configured. Set both CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable Clerk routes.');
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '8kb' }));
app.use(cookieParser());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/threads', threadRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/game', gameRoutes);
app.use('/api/v1/tours', tourRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/eras', eraRoutes);
app.use('/api/v1/culture', cultureRoutes);
app.use('/api/v1/ai', aiRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
// Public response only exposes coarse status. The raw connection error (which can
// leak host:port details) is gated behind a secret header so it stays available
// for debugging without being world-readable.
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get(['/health', '/api/v1/health'], (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    const authorized = typeof req.headers['x-health-key'] === 'string'
        && env.GAME_SECRET.length >= 16
        && req.headers['x-health-key'] === env.GAME_SECRET;

    res.json({
        status: connected ? 'ok' : 'degraded',
        db: DB_STATES[mongoose.connection.readyState] ?? String(mongoose.connection.readyState),
        timestamp: new Date(),
        ...(authorized ? { dbError: getLastDbError() } : {}),
    });
});

// ─── Crawler Open Graph ───────────────────────────────────────────────────────
// Deep-link previews for social scrapers. Only reached when Vercel rewrites a
// bot User-Agent here (see vercel.json); human traffic stays on the static SPA.
app.get(['/profile/:username', '/thread/:id', '/era/:slug'], crawlerMeta);

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

export default app;

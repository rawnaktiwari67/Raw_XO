import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import threadRoutes from './routes/thread.routes';
import commentRoutes from './routes/comment.routes';
import gameRoutes from './routes/game.routes';
import tourRoutes from './routes/tour.routes';
import userRoutes from './routes/user.routes';
import eraRoutes from './routes/era.routes';
import cultureRoutes from './routes/culture.routes';

const app = express();
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
if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
    app.use(clerkMiddleware({
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
    }));
} else if (env.CLERK_SECRET_KEY || env.CLERK_PUBLISHABLE_KEY) {
    console.warn('Clerk is partially configured. Set both CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable authenticated API routes.');
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

export default app;

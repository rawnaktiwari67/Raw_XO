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

if (env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
}

// Security
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

// Parsing
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Global rate limit
app.use('/api', apiLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/threads', threadRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/game', gameRoutes);
app.use('/api/v1/tours', tourRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/eras', eraRoutes);
app.use('/api/v1/culture', cultureRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler (must be last)
app.use(errorHandler);

export default app;

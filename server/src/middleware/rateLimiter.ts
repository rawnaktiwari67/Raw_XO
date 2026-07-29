import rateLimit from 'express-rate-limit';
import { MongoRateLimitStore } from './rateLimitStore';

// Auth and AI use a shared MongoDB-backed store so their limits hold across
// serverless instances (the default in-memory store is per-process and resets on
// cold start — see rateLimitStore.ts). The other limiters stay in-memory: they
// guard the hot game path where a per-instance approximation is acceptable and a
// DB round-trip per request is not.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new MongoRateLimitStore('auth'),
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { success: false, error: 'Rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many write requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const cultureWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { success: false, error: 'Too many culture updates.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const gameLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, error: 'Game rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter than gameLimiter: every hint request costs an LLM completion, so its
// limit is the one most worth enforcing across instances (real money). Shared
// Mongo-backed store, same rationale as authLimiter above.
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'AI rate limit exceeded, give it a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new MongoRateLimitStore('ai'),
});

export const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many votes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

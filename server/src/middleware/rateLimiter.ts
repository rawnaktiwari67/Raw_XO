import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
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

// Stricter than gameLimiter: every request costs a Groq completion (and the
// trivia route an embedding pass on top).
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'AI rate limit exceeded, give it a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many votes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

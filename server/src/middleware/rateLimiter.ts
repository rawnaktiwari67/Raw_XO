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

export const gameLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, error: 'Game rate limit exceeded.' },
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

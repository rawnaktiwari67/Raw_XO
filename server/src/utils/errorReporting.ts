import * as Sentry from '@sentry/node';

// Server-side crash reporting, opt-in via SENTRY_DSN. Mirrors the client's
// posture: a deployment without the env var runs exactly as before, and
// reporting failures are never allowed to affect a response.

const SENTRY_DSN = (process.env.SENTRY_DSN || '').trim();

let initialized = false;

export const initErrorReporting = (): void => {
    if (initialized || !SENTRY_DSN) return;
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0,
    });
    initialized = true;
};

/** Report a caught exception (no-op without SENTRY_DSN). */
export const reportError = (error: unknown, extra?: Record<string, unknown>): void => {
    if (!initialized) return;
    try {
        Sentry.captureException(error, extra ? { extra } : undefined);
    } catch {
        /* reporting is best-effort */
    }
};

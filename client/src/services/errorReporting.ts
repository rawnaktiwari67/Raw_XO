// Sentry, loaded lazily and only when configured. The SDK is dynamically
// imported so it ships as its own chunk and costs nothing (bytes or runtime)
// for deployments without a DSN — production error reporting is opt-in via
// VITE_SENTRY_DSN, exactly like analytics is via VITE_UMAMI_WEBSITE_ID.

type SentryModule = typeof import('@sentry/react');

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN || '').trim();

let sentryPromise: Promise<SentryModule | null> | null = null;

export function initErrorReporting(): void {
    if (!import.meta.env.PROD || !SENTRY_DSN) return;
    if (sentryPromise) return;

    sentryPromise = import('@sentry/react')
        .then((Sentry) => {
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: import.meta.env.MODE,
                // Errors are the point; keep performance tracing off to stay
                // lightweight (and out of the way of the game's frame budget).
                tracesSampleRate: 0,
            });
            return Sentry;
        })
        .catch(() => null); // reporting is best-effort, never break the app
}

/** Report a caught exception (no-op when Sentry isn't configured/loaded). */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
    void sentryPromise?.then((Sentry) => {
        Sentry?.captureException(error, extra ? { extra } : undefined);
    });
}

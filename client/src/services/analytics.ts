// Umami is a lightweight, cookie-free, privacy-friendly analytics tracker.
// We load it by injecting its <script> tag at runtime rather than hardcoding
// it in index.html, so the tracking id stays out of the repo (it comes from
// env vars) and analytics only run where we actually want them.
//
// The tracker auto-detects route changes in single-page apps, so React Router
// navigations are counted as pageviews with no extra wiring.

const UMAMI_SRC = (import.meta.env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js').trim();
const UMAMI_WEBSITE_ID = (import.meta.env.VITE_UMAMI_WEBSITE_ID || '').trim();
const UMAMI_HOST_URL = (import.meta.env.VITE_UMAMI_HOST_URL || '').trim();
const UMAMI_DOMAINS = (import.meta.env.VITE_UMAMI_DOMAINS || '').trim();

const isPlaceholderWebsiteId = (websiteId: string) =>
    websiteId === 'your-umami-website-id' || websiteId === '<your_website_id>';

/**
 * Load the Umami analytics script. No-op in dev builds (so local activity never
 * pollutes real stats) and when no website id is configured.
 */
// Product events, named snake_case for clean Umami dashboards. Keep the union
// tight so call sites can't invent ad-hoc event names.
export type AnalyticsEvent =
    | 'game_started'
    | 'game_finished'
    | 'guess_correct'
    | 'guess_wrong'
    | 'artist_selected'
    | 'genre_selected'
    | 'language_selected'
    | 'difficulty_selected'
    | 'leaderboard_opened'
    | 'culture_viewed'
    | 'profile_viewed';

interface UmamiTracker {
    track?: (event: string, data?: Record<string, string | number | boolean>) => void;
}

/**
 * Record a product event. Safe to call unconditionally: no-ops when the
 * tracker isn't loaded (dev builds, missing website id, script blocked), and
 * never throws — analytics must never take the app down with it.
 */
export function trackEvent(event: AnalyticsEvent, data?: Record<string, string | number | boolean>): void {
    const umami = (window as Window & { umami?: UmamiTracker }).umami;
    try {
        umami?.track?.(event, data);
    } catch {
        /* swallow — see docstring */
    }
}

export function initAnalytics(): void {
    // Only track in production and only once a website id is provided.
    if (!import.meta.env.PROD || !UMAMI_WEBSITE_ID || isPlaceholderWebsiteId(UMAMI_WEBSITE_ID)) return;

    // Guard against double-injection (e.g. React StrictMode / HMR).
    if (document.querySelector('script[data-umami-analytics="true"]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = UMAMI_SRC;
    script.setAttribute('data-umami-analytics', 'true');
    script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    if (UMAMI_HOST_URL) {
        script.setAttribute('data-host-url', UMAMI_HOST_URL);
    }
    if (UMAMI_DOMAINS) {
        script.setAttribute('data-domains', UMAMI_DOMAINS);
    }
    document.head.appendChild(script);
}

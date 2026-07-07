// Umami is a lightweight, cookie-free, privacy-friendly analytics tracker.
// We load it by injecting its <script> tag at runtime rather than hardcoding
// it in index.html, so the tracking id stays out of the repo (it comes from
// env vars) and analytics only run where we actually want them.
//
// The tracker auto-detects route changes in single-page apps, so React Router
// navigations are counted as pageviews with no extra wiring.

const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID;

/**
 * Load the Umami analytics script. No-op in dev builds (so local activity never
 * pollutes real stats) and when no website id is configured.
 */
export function initAnalytics(): void {
    // Only track in production and only once a website id is provided.
    if (!import.meta.env.PROD || !UMAMI_WEBSITE_ID) return;

    // Guard against double-injection (e.g. React StrictMode / HMR).
    if (document.querySelector('script[data-website-id]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.src = UMAMI_SRC;
    script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    document.head.appendChild(script);
}

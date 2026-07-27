// Warm the lazy route chunks before navigation so tapping a nav item doesn't
// trigger a chunk-download waterfall (fetch JS → parse → render → fetch data).
// The dynamic import()s mirror the ones in AppRouter; the bundler dedupes them,
// so calling here just pulls the same chunk into cache early. Each importer is
// wrapped so a failed prefetch (e.g. offline) never rejects into the console —
// the real navigation will retry and surface any genuine error.
const importers: Record<string, () => Promise<unknown>> = {
    '/archive': () => import('../pages/Culture'),
    '/tours': () => import('../pages/Tours'),
    '/leaderboard': () => import('../pages/Leaderboard'),
};

const prefetched = new Set<string>();

export function prefetchRoute(to: string): void {
    if (prefetched.has(to)) return;
    const load = importers[to];
    if (!load) return;
    prefetched.add(to);
    void load().catch(() => {
        // Allow a later attempt to retry if this one failed.
        prefetched.delete(to);
    });
}

// After first paint, quietly warm every primary route while the main thread is
// idle, so the first navigation to any of them is instant. Safe to call more
// than once — prefetchRoute de-dupes.
export function prefetchPrimaryRoutesWhenIdle(): void {
    const run = () => Object.keys(importers).forEach(prefetchRoute);
    const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
        ric(run, { timeout: 3000 });
    } else {
        window.setTimeout(run, 1500);
    }
}

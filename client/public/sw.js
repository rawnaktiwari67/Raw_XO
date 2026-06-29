// Minimal service worker for installability + an offline shell. Kept dependency-
// free and deliberately conservative: it never caches API responses, and uses a
// versioned cache name so a new deploy cleanly replaces the old one.
const CACHE = 'rawxo-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/og-cover.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Only handle our own origin; never intercept API or cross-origin requests.
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api')) return;

    // Navigations: network-first so users get fresh HTML, falling back to the
    // cached shell when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
        );
        return;
    }

    // Static assets: cache-first, then populate the cache on first network hit.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});

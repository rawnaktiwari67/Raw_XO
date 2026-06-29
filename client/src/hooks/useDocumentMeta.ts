import { useEffect } from 'react';

// Site-wide defaults, kept in sync with the static tags in index.html so a page
// without its own metadata (or one that just unmounted) reads correctly.
const DEFAULT_TITLE = 'Raw XO | Music Guessing and Culture';
const DEFAULT_DESCRIPTION =
    'Raw XO is a cinematic music game and culture room for people who remember songs by feeling, cover art, and context.';

interface DocumentMeta {
    title?: string;
    description?: string;
}

function setMetaContent(selector: string, attr: 'name' | 'property', key: string, content: string) {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function apply(title: string, description: string) {
    document.title = title;
    setMetaContent('meta[name="description"]', 'name', 'description', description);
    // Keep OG/Twitter in step so the browser/JS-aware crawlers see the same thing.
    // (Social scrapers don't run JS — server-side injection handles those.)
    setMetaContent('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaContent('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaContent('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaContent('meta[name="twitter:description"]', 'name', 'twitter:description', description);
}

/**
 * Sets the document title and description for the current route, restoring the
 * site defaults when the page unmounts. Pass `undefined`/empty while data is
 * still loading to leave the previous values in place.
 */
export function useDocumentMeta({ title, description }: DocumentMeta) {
    useEffect(() => {
        if (!title && !description) return;
        apply(title || DEFAULT_TITLE, description || DEFAULT_DESCRIPTION);

        return () => {
            apply(DEFAULT_TITLE, DEFAULT_DESCRIPTION);
        };
    }, [title, description]);
}

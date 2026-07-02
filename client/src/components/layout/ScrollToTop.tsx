import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Route changes don't reset scroll on their own. On mobile this made footer links
// (Create Profile / Sign In) look broken: tapping one from the bottom of a long
// page navigated but left you pinned at the bottom, so the new page read as blank.
// Reset to the top on every path change so each page starts where it should.
export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [pathname]);

    return null;
}

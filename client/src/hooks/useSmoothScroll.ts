import { useEffect } from 'react';
import Lenis from 'lenis';

// Single shared instance so route-change code (ScrollToTop) and gameplay lock
// can steer the same scroller that owns the wheel.
let lenis: Lenis | null = null;

export const getLenis = () => lenis;

// Inertia smooth-scrolling for the whole document. Skipped entirely for
// reduced-motion users and touch devices — native momentum scrolling on
// phones already feels right, and hijacking it reads as jank, not polish.
export function useSmoothScroll() {
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        if (reduced || coarse) return;

        lenis = new Lenis({
            duration: 1.05,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });

        let frame = requestAnimationFrame(function loop(time) {
            lenis?.raf(time);
            frame = requestAnimationFrame(loop);
        });

        return () => {
            cancelAnimationFrame(frame);
            lenis?.destroy();
            lenis = null;
        };
    }, []);
}

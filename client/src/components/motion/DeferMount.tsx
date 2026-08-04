import { useEffect, useState, type ReactNode } from 'react';

// Holds heavy below-the-fold content out of the *initial* React commit so it
// never blocks first paint (LCP) — then mounts it on the first idle tick after
// paint, well before the reader can scroll to it. Mounting on idle (rather than
// on scroll via IntersectionObserver) is deliberate: on-scroll mounting shifts
// the framer/layout cost INTO the scroll and janks it, whereas an idle mount
// pays that cost once, off the critical path, while the content slot sits
// reserved so nothing shifts. Purely a scheduling wrapper — no visual change.
export default function DeferMount({
    children,
    minHeight,
}: {
    children: ReactNode;
    minHeight: number | string;
    // Kept for call-site compatibility; mounting is idle-based, not margin-based.
    rootMargin?: string;
}) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (show) return;
        const mount = () => setShow(true);
        const ric = (window as unknown as {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }).requestIdleCallback;
        if (ric) {
            const id = ric(mount, { timeout: 1500 });
            return () => (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(id);
        }
        const t = window.setTimeout(mount, 300);
        return () => window.clearTimeout(t);
    }, [show]);

    return <div style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
}

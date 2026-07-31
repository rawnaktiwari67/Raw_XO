import { useEffect, useRef, useState, type ReactNode } from 'react';

// Mounts its children only once they scroll within `rootMargin` of the viewport,
// so heavy below-the-fold sections (their framer trees, scroll listeners, and
// data fetches) don't inflate the first render/commit or run before they're
// needed. A reserved-height placeholder holds the layout so nothing shifts when
// the real content swaps in, and `rootMargin` pre-mounts it ahead of arrival so
// the reveal is never visible. Purely a performance wrapper — no visual change.
export default function DeferMount({
    children,
    minHeight,
    rootMargin = '900px',
}: {
    children: ReactNode;
    minHeight: number | string;
    rootMargin?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (show) return;
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver !== 'function') {
            setShow(true);
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setShow(true);
                    io.disconnect();
                }
            },
            { rootMargin }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [show, rootMargin]);

    return (
        <div ref={ref} style={show ? undefined : { minHeight }}>
            {show ? children : null}
        </div>
    );
}

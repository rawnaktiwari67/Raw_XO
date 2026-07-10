import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

// Scroll-linked parallax drift: the wrapped content travels `distance`px against
// the scroll direction while it crosses the viewport.
export default function Parallax({
    children,
    distance = 36,
    className,
}: {
    children: ReactNode;
    distance?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start end', 'end start'],
    });
    const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

    if (reduced) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div ref={ref} className={className} style={{ y }}>
            {children}
        </motion.div>
    );
}

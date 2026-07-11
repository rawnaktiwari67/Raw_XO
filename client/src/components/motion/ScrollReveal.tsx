import { useRef, type ElementType, type RefObject } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

// Scroll-scrubbed text reveal: each word fades from dim to full opacity tied to
// scroll position (scrub, not time), so scrolling back re-dims it. The text is
// fully revealed by the time it reaches the upper half of the viewport.
interface ScrollRevealProps {
    children: string;
    as?: ElementType;
    className?: string;
}

function Word({
    progress,
    range,
    children,
}: {
    progress: MotionValue<number>;
    range: [number, number];
    children: string;
}) {
    const opacity = useTransform(progress, range, [0.14, 1]);
    return (
        <motion.span style={{ opacity }} className="inline-block">
            {children}
        </motion.span>
    );
}

export default function ScrollReveal({ children, as: Tag = 'p', className }: ScrollRevealProps) {
    const ref = useRef<HTMLElement | null>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start 0.92', 'start 0.45'],
    });

    if (reduced) {
        return <Tag className={className}>{children}</Tag>;
    }

    const words = children.split(/\s+/).filter(Boolean);
    // Each word's reveal window overlaps the next few so the sweep feels like a
    // wave instead of a hard word-by-word step.
    const spread = 2.5;

    return (
        <Tag
            ref={ref as RefObject<never>}
            className={className}
            aria-label={children}
        >
            {words.map((word, index) => (
                <span key={`${word}-${index}`} aria-hidden>
                    <Word
                        progress={scrollYProgress}
                        range={[
                            index / (words.length + spread),
                            Math.min(1, (index + spread) / (words.length + spread)),
                        ]}
                    >
                        {word}
                    </Word>
                    {index < words.length - 1 ? ' ' : null}
                </span>
            ))}
        </Tag>
    );
}

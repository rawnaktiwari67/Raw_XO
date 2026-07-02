import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type CountUpProps = {
    value: number;
    durationMs?: number;
    className?: string;
    format?: (value: number) => string;
};

// Animate a number counting up to its target. Cheap rAF tween, eased out, and it
// re-runs from the previous value whenever the target changes — so a leaderboard
// re-fetch nudges the numbers instead of snapping. Reduced-motion users get the
// final value immediately.
export default function CountUp({ value, durationMs = 900, className, format }: CountUpProps) {
    const reducedMotion = useReducedMotion();
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        if (reducedMotion) {
            setDisplay(value);
            return;
        }

        const from = fromRef.current;
        const delta = value - from;
        if (delta === 0) return;

        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(from + delta * eased));
            if (t < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                fromRef.current = value;
            }
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            fromRef.current = value;
        };
    }, [value, durationMs, reducedMotion]);

    return <span className={className}>{format ? format(display) : display.toLocaleString()}</span>;
}

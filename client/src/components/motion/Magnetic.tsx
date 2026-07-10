import { useRef, type MouseEvent, type ReactNode } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';

// Magnetic hover: the wrapped element leans toward the cursor and springs back
// on leave. Mouse-only by nature (mousemove never fires on touch), and inert
// for reduced-motion users.
export default function Magnetic({
    children,
    strength = 0.22,
    className = '',
}: {
    children: ReactNode;
    strength?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const reduced = useReducedMotion();
    const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.5 });
    const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.5 });

    if (reduced) {
        return <div className={`inline-block ${className}`}>{children}</div>;
    }

    const handleMove = (event: MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) * strength);
        y.set((event.clientY - rect.top - rect.height / 2) * strength);
    };

    const reset = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMove}
            onMouseLeave={reset}
            style={{ x, y }}
            className={`inline-block ${className}`}
        >
            {children}
        </motion.div>
    );
}

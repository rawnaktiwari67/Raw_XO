import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Image/cover unmask: the container clips open from the bottom while the
// content settles from a slight overscale. Plays once when scrolled into view.
export default function CoverReveal({
    children,
    delay = 0,
    className,
}: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    const reduced = useReducedMotion();

    if (reduced) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
            viewport={{ once: true, margin: '-8% 0% -8% 0%' }}
            transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
        >
            <motion.div
                initial={{ scale: 1.14 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true, margin: '-8% 0% -8% 0%' }}
                transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

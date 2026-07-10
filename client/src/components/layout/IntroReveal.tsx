import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// One-time load curtain: the RAW XO wordmark resolves out of a dark field, then
// the whole panel lifts away to reveal the app. Runs once per browser session
// (sessionStorage gate) so it's a first-impression moment, not a tax on every
// navigation. Skipped entirely for reduced-motion users.
const SESSION_KEY = 'rawxo-intro-shown';

export default function IntroReveal() {
    const reduced = useReducedMotion();
    const [show, setShow] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            return !sessionStorage.getItem(SESSION_KEY);
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (!show) return;
        try {
            sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
            /* private mode — curtain just won't persist, harmless */
        }
        const hold = window.setTimeout(() => setShow(false), 800);
        return () => window.clearTimeout(hold);
    }, [show]);

    // No curtain for reduced motion — it would be a blank hold with no payoff.
    if (reduced) return null;

    return (
        <AnimatePresence>
            {show ? (
                <motion.div
                    key="intro"
                    className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#08080b]"
                    initial={{ y: 0 }}
                    exit={{ y: '-100%' }}
                    transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                >
                    <motion.span
                        className="brand-mark text-gradient-gold text-[3.2rem] leading-none md:text-[5.5rem]"
                        initial={{ opacity: 0, y: 22, letterSpacing: '0.42em', filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, letterSpacing: '0.06em', filter: 'blur(0px)' }}
                        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                    >
                        RAW XO
                    </motion.span>
                    <motion.div
                        aria-hidden
                        className="absolute bottom-[24%] h-px w-44 origin-left bg-[linear-gradient(90deg,transparent,rgba(244,162,97,0.8),transparent)]"
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ duration: 1.0, ease: 'easeInOut' }}
                    />
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

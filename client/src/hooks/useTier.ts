import { useEffect, useState } from 'react';

export type Tier = 'phone' | 'tablet' | 'desktop';

// Device-intent tiers for the few places JS needs to branch layout/behaviour.
// Boundaries are pinned to Tailwind's md (768) and lg (1024) so a `useTier()`
// check and a `md:`/`lg:` class branch always agree on which world we're in:
//   phone   <768   — one-handed, vertical, thumb-driven
//   tablet  768–1023 — touch canvas
//   desktop ≥1024  — the reference implementation (pointer)
// This mirrors usePerfLite / the coarse-pointer checks already in the app; it's
// about arrangement, whereas usePerfLite is about how much motion to spend.
// SSR-safe default is desktop so the reference layout is what renders first.
function readTier(): Tier {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
    if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop';
    if (window.matchMedia('(min-width: 768px)').matches) return 'tablet';
    return 'phone';
}

export function useTier(): Tier {
    const [tier, setTier] = useState<Tier>(readTier);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mqs = [
            window.matchMedia('(min-width: 768px)'),
            window.matchMedia('(min-width: 1024px)'),
        ];
        const update = () => setTier(readTier());
        mqs.forEach((mq) => mq.addEventListener('change', update));
        update();
        return () => mqs.forEach((mq) => mq.removeEventListener('change', update));
    }, []);

    return tier;
}

// Convenience reads for the common branches.
export const usePhone = () => useTier() === 'phone';
export const useIsTouchTier = () => useTier() !== 'desktop';

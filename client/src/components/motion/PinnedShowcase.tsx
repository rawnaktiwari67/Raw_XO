import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

// Pinned scroll narrative (the hasanraheem.com discography pattern): the
// section occupies n×100vh of scroll track, the visible frame sticks to the
// viewport, and panels crossfade + drift as scroll progress moves through
// each panel's slice of the track.
export interface ShowcasePanel {
    label: string;
    title: string;
    body: string;
    to: string;
    cta: string;
}

function Panel({
    panel,
    index,
    count,
    progress,
}: {
    panel: ShowcasePanel;
    index: number;
    count: number;
    progress: MotionValue<number>;
}) {
    const start = index / count;
    const end = (index + 1) / count;
    const fade = 0.35 / count;

    const opacity = useTransform(
        progress,
        index === 0
            ? [start, end - fade, end]
            : index === count - 1
                ? [start, start + fade, end]
                : [start, start + fade, end - fade, end],
        index === 0
            ? [1, 1, 0]
            : index === count - 1
                ? [0, 1, 1]
                : [0, 1, 1, 0]
    );
    const y = useTransform(progress, [start, end], [28, -28]);
    const pointerEvents = useTransform(opacity, (value) => (value > 0.6 ? 'auto' : 'none'));

    return (
        <motion.div
            style={{ opacity, y, pointerEvents }}
            className="absolute inset-0 flex flex-col items-start justify-center px-6 md:px-12"
        >
            <p className="label-xs mb-4 text-accent">{panel.label}</p>
            <h2 className="display-lg max-w-3xl">{panel.title}</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-text-3">{panel.body}</p>
            <Link to={panel.to} className="btn-secondary mt-8 rounded-2xl">
                {panel.cta}
            </Link>
        </motion.div>
    );
}

export default function PinnedShowcase({ panels }: { panels: ShowcasePanel[] }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start start', 'end end'],
    });

    // Static stacked fallback: same content, no pinning.
    if (reduced) {
        return (
            <section className="mx-auto max-w-[1280px] space-y-20 px-6 py-20 md:px-12">
                {panels.map((panel) => (
                    <div key={panel.label}>
                        <p className="label-xs mb-4 text-accent">{panel.label}</p>
                        <h2 className="display-lg max-w-3xl">{panel.title}</h2>
                        <p className="mt-6 max-w-md text-base leading-relaxed text-text-3">{panel.body}</p>
                        <Link to={panel.to} className="btn-secondary mt-8 rounded-2xl">
                            {panel.cta}
                        </Link>
                    </div>
                ))}
            </section>
        );
    }

    return (
        <section ref={ref} style={{ height: `${panels.length * 100}vh` }} className="relative">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                <div className="relative mx-auto h-full w-full max-w-[1280px]">
                    {panels.map((panel, index) => (
                        <Panel
                            key={panel.label}
                            panel={panel}
                            index={index}
                            count={panels.length}
                            progress={scrollYProgress}
                        />
                    ))}

                    {/* Progress rail */}
                    <div className="absolute bottom-10 left-6 flex items-center gap-2 md:left-12">
                        {panels.map((panel, index) => (
                            <Dot key={panel.label} index={index} count={panels.length} progress={scrollYProgress} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function Dot({
    index,
    count,
    progress,
}: {
    index: number;
    count: number;
    progress: MotionValue<number>;
}) {
    const mid = (index + 0.5) / count;
    const half = 0.5 / count;
    const scaleX = useTransform(progress, [mid - half, mid, mid + half], [1, 3.4, 1]);
    const opacity = useTransform(progress, [mid - half, mid, mid + half], [0.25, 1, 0.25]);

    return (
        <motion.span
            style={{ scaleX, opacity }}
            className="h-1 w-4 origin-left rounded-full bg-accent"
        />
    );
}

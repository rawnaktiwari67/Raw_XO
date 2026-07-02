import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MeaningEntry } from '../../types/culture';

interface ReelsFeedProps {
    entries: MeaningEntry[];
    selectedMeaning: Record<string, string>;
    selectedReaction: Record<string, string>;
    onChooseMeaning: (entry: MeaningEntry, meaningId: string) => void;
    onChooseReaction: (entry: MeaningEntry, reactionId: string) => void;
    onOpenLab: (trackId: string) => void;
    onClose: () => void;
}

// How many slides to append each time the viewer nears the end. The catalog is
// finite, so we loop it — appending another batch keeps the feed endless like reels.
const PAGE = 8;

export default function ReelsFeed({
    entries,
    selectedMeaning,
    selectedReaction,
    onChooseMeaning,
    onChooseReaction,
    onOpenLab,
    onClose,
}: ReelsFeedProps) {
    const [count, setCount] = useState(PAGE);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Repeat the catalog to fill `count` slides. Keys carry the cycle index so
    // React keeps duplicated tracks distinct across loops.
    const slides = useMemo(() => {
        if (entries.length === 0) return [];
        return Array.from({ length: count }, (_, index) => ({
            entry: entries[index % entries.length],
            key: `${entries[index % entries.length].trackId}-${Math.floor(index / entries.length)}`,
        }));
    }, [entries, count]);

    const extend = useCallback(() => setCount((current) => current + PAGE), []);

    // Callback ref so the observer attaches the instant the sentinel mounts inside
    // the scroll container — reliable across the overlay's mount/StrictMode churn.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => {
            observerRef.current?.disconnect();
            if (!node) return;
            observerRef.current = new IntersectionObserver(
                (observed) => {
                    if (observed.some((item) => item.isIntersecting)) extend();
                },
                { root: node.parentElement, rootMargin: '600px' }
            );
            observerRef.current.observe(node);
        },
        [extend]
    );

    // Lock body scroll while the overlay is open, and let Escape close it.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-black"
        >
            <button
                type="button"
                onClick={onClose}
                aria-label="Close reels"
                className="fixed right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-text-1 backdrop-blur transition-colors hover:bg-black/70"
            >
                <span className="text-lg leading-none">×</span>
            </button>

            <div className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
                {slides.map(({ entry, key }) => {
                    const totalVotes = entry.meanings.reduce((sum, meaning) => sum + meaning.votes, 0) || 1;
                    const topMeanings = [...entry.meanings].sort((a, b) => b.votes - a.votes).slice(0, 3);
                    const topReactions = [...entry.reactions].sort((a, b) => b.count - a.count).slice(0, 3);

                    return (
                        <section
                            key={key}
                            className="relative flex h-[100dvh] w-full snap-start snap-always items-end justify-center overflow-hidden"
                        >
                            {/* Blurred album art fills the slide; a scrim keeps text readable. */}
                            <img
                                src={entry.albumArt}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

                            <div className="relative z-10 mx-auto w-full max-w-[560px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-24">
                                <img
                                    src={entry.albumArt}
                                    alt={entry.title}
                                    width={320}
                                    height={320}
                                    className="mx-auto aspect-square w-40 rounded-2xl object-cover shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:w-52"
                                />

                                <div className="mt-6">
                                    <span className="inline-block rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-text-2">
                                        {entry.mood}
                                    </span>
                                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-text-4">{entry.artist}</p>
                                    <p className="mt-2 font-heading text-3xl font-bold leading-tight text-text-1">
                                        {entry.lyricsSnippet}
                                    </p>
                                    <p className="mt-3 text-sm leading-relaxed text-text-3">{entry.shortTake}</p>
                                </div>

                                <div className="mt-5 space-y-2">
                                    {topMeanings.map((meaning) => {
                                        const active = selectedMeaning[entry.trackId] === meaning.id;
                                        const percentage = Math.round((meaning.votes / totalVotes) * 100);
                                        return (
                                            <button
                                                key={meaning.id}
                                                type="button"
                                                onClick={() => onChooseMeaning(entry, meaning.id)}
                                                className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                                                    active
                                                        ? 'border-amber/40 text-amber'
                                                        : 'border-white/12 text-text-1 hover:border-white/25'
                                                }`}
                                            >
                                                <span
                                                    aria-hidden
                                                    className="absolute inset-y-0 left-0 bg-amber/15"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                                <span className="relative flex items-center justify-between gap-3">
                                                    <span>{meaning.label}</span>
                                                    <span className="text-text-3">{percentage}%</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {topReactions.map((reaction) => {
                                        const active = selectedReaction[entry.trackId] === reaction.id;
                                        return (
                                            <button
                                                key={reaction.id}
                                                type="button"
                                                onClick={() => onChooseReaction(entry, reaction.id)}
                                                className={`rounded-full border px-3 py-2 text-xs capitalize transition-colors ${
                                                    active
                                                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                                        : 'border-white/12 bg-white/[0.03] text-text-3 hover:text-text-1'
                                                }`}
                                            >
                                                {reaction.label} · {reaction.count}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onOpenLab(entry.trackId)}
                                    className="btn-primary mt-6 w-full rounded-2xl"
                                >
                                    Open in Meaning Lab
                                </button>
                            </div>
                        </section>
                    );
                })}
                <div ref={sentinelRef} className="h-px w-full" />
            </div>
        </motion.div>
    );
}

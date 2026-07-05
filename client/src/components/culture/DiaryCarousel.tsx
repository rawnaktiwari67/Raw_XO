import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DiaryTrackSeed } from '../../stores/diaryStore';

// A card is any track we can show + rate. `rating` is the viewer's current
// rating for it (null = unrated), overlaid on the cover as a badge.
export interface DiaryCard extends DiaryTrackSeed {
    rating: number | null;
    // Optional 30s preview (catalog cards have one; diary-logged cards may not),
    // used by the full-screen crate reels for tap-to-play audio.
    previewUrl?: string;
}

interface DiaryCarouselProps {
    title: string;
    hint?: string;
    cards: DiaryCard[];
    onRate: (card: DiaryCard, rating: number) => void;
    emptyText?: string;
}

function StarRow({ value, onPick }: { value: number | null; onPick: (rating: number) => void }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value || 0;
    return (
        <div className="mt-2.5 flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= shown;
                return (
                    <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} of 5`}
                        onMouseEnter={() => setHover(star)}
                        onClick={() => onPick(star)}
                        className="rounded px-0.5 py-1.5 text-[18px] leading-none transition-transform duration-150 hover:scale-[1.35] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                        style={{
                            color: filled ? '#F4A261' : 'rgba(255,255,255,0.18)',
                            textShadow: filled ? '0 0 10px rgba(244,162,97,0.45)' : 'none',
                        }}
                    >
                        ★
                    </button>
                );
            })}
        </div>
    );
}

export default function DiaryCarousel({ title, hint, cards, onRate, emptyText }: DiaryCarouselProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const nudge = (direction: 1 | -1) => {
        scrollRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
    };

    return (
        <section className="mt-10">
            <div className="mb-4 flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-3">
                    <h2 className="font-heading text-2xl font-bold leading-tight text-text-1">{title}</h2>
                    {hint ? <span className="text-xs uppercase tracking-[0.16em] text-text-4">{hint}</span> : null}
                </div>
                {cards.length > 0 ? (
                    <div className="hidden gap-2 sm:flex">
                        <button
                            type="button"
                            aria-label="Scroll left"
                            onClick={() => nudge(-1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-text-1 shadow-sm transition-all hover:-translate-y-0.5 hover:border-transparent hover:bg-amber hover:text-[#0B0B0F] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label="Scroll right"
                            onClick={() => nudge(1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-text-1 shadow-sm transition-all hover:-translate-y-0.5 hover:border-transparent hover:bg-amber hover:text-[#0B0B0F] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M9 6l6 6-6 6" />
                            </svg>
                        </button>
                    </div>
                ) : null}
            </div>

            {cards.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-text-3">
                    {emptyText ?? 'Nothing here yet.'}
                </div>
            ) : (
                <div className="relative">
                <div
                    ref={scrollRef}
                    className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
                >
                    {cards.map((card) => (
                        <motion.div
                            key={card.trackId}
                            whileHover={{ y: -5 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                            className="group w-[154px] flex-none snap-start"
                        >
                            <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/5 transition-all duration-300 group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] group-hover:ring-amber/40">
                                <img
                                    src={card.albumArt}
                                    alt={card.title}
                                    width={308}
                                    height={308}
                                    loading="lazy"
                                    decoding="async"
                                    className="aspect-square w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
                                />
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                />
                                {card.rating !== null ? (
                                    <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-amber ring-1 ring-amber/30 backdrop-blur">
                                        <span className="text-[10px] leading-none">★</span>
                                        {card.rating.toFixed(1)}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-2.5 truncate text-sm font-bold text-text-1" title={card.title}>
                                {card.title}
                            </p>
                            <p className="truncate text-xs text-text-4" title={card.artist}>
                                {card.artist}
                            </p>
                            <StarRow value={card.rating} onPick={(rating) => onRate(card, rating)} />
                        </motion.div>
                    ))}
                </div>
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0B0B0F] to-transparent"
                />
                </div>
            )}
        </section>
    );
}

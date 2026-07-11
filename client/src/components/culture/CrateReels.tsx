import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DiaryCard } from './DiaryCarousel';

interface CrateReelsProps {
    cards: DiaryCard[];
    onRate: (card: DiaryCard, rating: number) => void;
    onClose: () => void;
}

// Slides appended per batch. The crate is finite, so it loops — appending keeps
// the swipe endless like reels.
const PAGE = 8;

function BigStars({ value, onPick }: { value: number | null; onPick: (rating: number) => void }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value || 0;
    return (
        <div className="mt-6 flex items-center justify-center gap-2.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= shown;
                return (
                    <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} of 5`}
                        onMouseEnter={() => setHover(star)}
                        onClick={() => onPick(star)}
                        className="rounded text-[34px] leading-none transition-transform duration-150 hover:scale-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                        style={{
                            color: filled ? '#F4A261' : 'rgba(255,255,255,0.2)',
                            textShadow: filled ? '0 0 16px rgba(244,162,97,0.5)' : 'none',
                        }}
                    >
                        ★
                    </button>
                );
            })}
        </div>
    );
}

export default function CrateReels({ cards, onRate, onClose }: CrateReelsProps) {
    const [count, setCount] = useState(PAGE);
    const [activeIndex, setActiveIndex] = useState(0);
    const [soundOn, setSoundOn] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const rafRef = useRef<number | null>(null);

    const slides = useMemo(() => {
        if (cards.length === 0) return [];
        return Array.from({ length: count }, (_, index) => ({
            card: cards[index % cards.length],
            key: `${cards[index % cards.length].trackId}-${Math.floor(index / cards.length)}`,
        }));
    }, [cards, count]);

    const extend = useCallback(() => setCount((current) => current + PAGE), []);
    const activeCard = slides[activeIndex]?.card;
    const catalogPosition = cards.length > 0 ? (activeIndex % cards.length) + 1 : 0;

    const handleScroll = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const el = scrollRef.current;
            if (!el || el.clientHeight === 0) return;
            const index = Math.round(el.scrollTop / el.clientHeight);
            setActiveIndex((current) => (current === index ? current : index));
            if (el.scrollTop + el.clientHeight * 2 >= el.scrollHeight) extend();
        });
    }, [extend]);

    useEffect(() => () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }, []);

    const scrollToIndex = useCallback((index: number) => {
        scrollRef.current
            ?.querySelector<HTMLElement>(`[data-index="${Math.max(0, index)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                scrollToIndex(activeIndex + 1);
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                scrollToIndex(activeIndex - 1);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose, scrollToIndex, activeIndex]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (soundOn && activeCard?.previewUrl) {
            if (audio.src !== activeCard.previewUrl) audio.src = activeCard.previewUrl;
            audio.currentTime = 0;
            audio.play().catch(() => {
                /* autoplay can be blocked until a gesture — the toggle is the gesture */
            });
        } else {
            audio.pause();
        }
    }, [soundOn, activeCard?.previewUrl]);

    useEffect(() => () => audioRef.current?.pause(), []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-black"
        >
            <audio ref={audioRef} preload="none" />

            <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/12 bg-black/50 px-3 py-1.5 text-xs text-text-2 backdrop-blur">
                    <span className="font-heading font-bold text-text-1">{catalogPosition}</span>
                    <span className="text-text-4">/ {cards.length}</span>
                </div>
                <div className="pointer-events-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setSoundOn((on) => !on)}
                        aria-pressed={soundOn}
                        aria-label={soundOn ? 'Mute preview' : 'Play preview'}
                        className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs uppercase tracking-[0.14em] backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50 ${
                            soundOn
                                ? 'border-amber/40 bg-amber/15 text-amber'
                                : 'border-white/15 bg-black/50 text-text-2 hover:bg-black/70'
                        }`}
                    >
                        <span aria-hidden>{soundOn ? '♪' : '🔇'}</span>
                        {soundOn ? 'Sound on' : 'Preview'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close reels"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-text-1 backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                    >
                        <span className="text-lg leading-none">×</span>
                    </button>
                </div>
            </div>

            <div className="pointer-events-none fixed right-2 top-1/2 z-[80] hidden -translate-y-1/2 sm:block">
                <div className="h-40 w-1 overflow-hidden rounded-full bg-white/12">
                    <div
                        className="w-full rounded-full bg-amber transition-[height] duration-300"
                        style={{ height: `${cards.length > 0 ? (catalogPosition / cards.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                data-lenis-prevent
                className="hide-scrollbar h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
            >
                {slides.map(({ card, key }, index) => (
                    <section
                        key={key}
                        data-index={index}
                        className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden"
                    >
                        <img
                            src={card.albumArt}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

                        <div className="relative z-10 mx-auto w-full max-w-[440px] px-6 text-center">
                            <img
                                src={card.albumArt}
                                alt={card.title}
                                width={440}
                                height={440}
                                className="mx-auto aspect-square w-56 rounded-[1.6rem] object-cover shadow-[0_28px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10 sm:w-64"
                            />

                            <p className="mt-7 text-xs uppercase tracking-[0.22em] text-text-4">{card.artist}</p>
                            <p className="mt-2 font-heading text-4xl font-bold leading-tight text-text-1">
                                {card.title}
                            </p>

                            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-text-3">
                                {card.rating !== null ? `You rated this ${card.rating.toFixed(1)}★` : 'Tap a star to rate'}
                            </p>

                            <BigStars value={card.rating} onPick={(rating) => onRate(card, rating)} />

                            {card.trackUrl ? (
                                <a
                                    href={card.trackUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-8 inline-block rounded-2xl border border-white/15 px-5 py-2.5 text-sm text-text-2 transition-all hover:-translate-y-0.5 hover:border-white/30 hover:text-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                                >
                                    Open track ↗
                                </a>
                            ) : null}
                        </div>
                    </section>
                ))}
            </div>

            <motion.div
                aria-hidden
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: activeIndex === 0 ? 1 : 0, y: activeIndex === 0 ? 0 : 6 }}
                transition={{ duration: 0.4 }}
                className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-[80] flex flex-col items-center text-[10px] uppercase tracking-[0.22em] text-text-4"
            >
                <motion.span
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-base leading-none"
                >
                    ↑
                </motion.span>
                Swipe for more
            </motion.div>
        </motion.div>
    );
}

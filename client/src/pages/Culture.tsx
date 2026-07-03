import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { musicService } from '../services/musicService';
import type { NormalizedMusicItem } from '../types/culture';
import DiaryCarousel, { type DiaryCard } from '../components/culture/DiaryCarousel';
// Lazy: the full-screen crate reels overlay only loads when opened.
const CrateReels = lazy(() => import('../components/culture/CrateReels'));
import {
    useDiaryStore,
    recentlyPlayed,
    topRated,
    diaryStats,
    type DiaryEntry,
} from '../stores/diaryStore';

const pageReveal = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

const entryToCard = (entry: DiaryEntry): DiaryCard => ({
    trackId: entry.trackId,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    albumArt: entry.albumArt,
    trackUrl: entry.trackUrl,
    rating: entry.rating,
});

export default function Culture() {
    useDocumentMeta({
        title: 'Your Diary — Raw XO',
        description: 'Log every track you hear, rate it, and watch your taste take shape.',
    });

    const entries = useDiaryStore((state) => state.entries);
    const rate = useDiaryStore((state) => state.rate);

    const [catalog, setCatalog] = useState<NormalizedMusicItem[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [reelsOpen, setReelsOpen] = useState(false);
    const toastTimer = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        musicService.getTrendingTracks().then((tracks) => {
            if (alive) setCatalog(tracks);
        });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => () => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
    }, []);

    const stats = useMemo(() => diaryStats(entries), [entries]);
    const played = useMemo(() => recentlyPlayed(entries).slice(0, 20).map(entryToCard), [entries]);
    const fives = useMemo(() => topRated(entries).slice(0, 20).map(entryToCard), [entries]);

    // Catalog cards carry the viewer's current rating (if any) so badges + stars
    // reflect the diary, and rating one writes straight back into it.
    const crate = useMemo<DiaryCard[]>(
        () =>
            catalog.map((track) => ({
                trackId: track.trackId,
                title: track.title,
                artist: track.artist,
                album: track.album,
                albumArt: track.albumArt,
                trackUrl: track.trackUrl,
                previewUrl: track.previewUrl,
                rating: entries[track.trackId]?.rating ?? null,
            })),
        [catalog, entries]
    );

    const handleRate = (card: DiaryCard, rating: number) => {
        rate(card, rating);
        setToast(`Rated “${card.title}” ${rating}★`);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 1800);
    };

    const hasDiary = stats.logged > 0;

    return (
        <div className="relative overflow-hidden">
            <motion.div
                aria-hidden
                className="absolute inset-0"
                animate={{ backgroundPosition: ['0% 0%', '100% 36%', '0% 0%'] }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    background:
                        'radial-gradient(58% 44% at 76% 12%, rgba(244,162,97,0.16), transparent 60%), radial-gradient(56% 48% at 10% 84%, rgba(255,255,255,0.05), transparent 68%)',
                    backgroundSize: '130% 130%',
                }}
            />

            <div className="relative mx-auto max-w-[1280px] px-6 pb-24 pt-28 md:px-12">
                <motion.section variants={pageReveal} initial="hidden" animate="visible">
                    <p className="label-xs mb-4">Your diary</p>
                    <h1 className="max-w-2xl font-heading text-5xl font-bold leading-[0.95] text-text-1 md:text-7xl">
                        Every track you&apos;ve called.
                    </h1>
                    <p className="mt-6 max-w-md text-base leading-relaxed text-text-3">
                        Rate what you hear and it lands here — a running record of your taste, not a wall of
                        someone else&apos;s opinions.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                            <p className="label-xs">Logged</p>
                            <p className="mt-1 font-heading text-2xl font-bold text-text-1">{stats.logged}</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                            <p className="label-xs">Avg rating</p>
                            <p className="mt-1 font-heading text-2xl font-bold text-amber">
                                {stats.avgRating !== null ? stats.avgRating.toFixed(1) : '—'}
                                <span className="text-sm text-text-4">/5</span>
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                            <p className="label-xs">Top artist</p>
                            <p className="mt-1 max-w-[10rem] truncate font-heading text-lg font-bold text-text-1">
                                {stats.topArtist ?? '—'}
                            </p>
                        </div>
                        {crate.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setReelsOpen(true)}
                                className="btn-primary self-center rounded-2xl transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
                            >
                                ▶ Reels
                            </button>
                        ) : null}
                        <Link to="/" className="btn-secondary self-center rounded-2xl">
                            Play a round →
                        </Link>
                    </div>
                </motion.section>

                {hasDiary ? (
                    <DiaryCarousel
                        title="Recently played"
                        hint="from your rounds"
                        cards={played}
                        onRate={handleRate}
                        emptyText="Play a round and the tracks you hear show up here."
                    />
                ) : null}

                <DiaryCarousel
                    title="Rate the crate"
                    hint="tap a star"
                    cards={crate}
                    onRate={handleRate}
                    emptyText="Loading the catalog…"
                />

                {fives.length > 0 ? (
                    <DiaryCarousel title="Your 5-star crate" hint="the greats" cards={fives} onRate={handleRate} />
                ) : null}

                {!hasDiary ? (
                    <p className="mt-10 text-sm text-text-4">
                        New here? Rate a few above, or{' '}
                        <Link to="/" className="text-amber hover:underline">
                            play a round
                        </Link>{' '}
                        to auto-fill your diary.
                    </p>
                ) : null}
            </div>

            {toast ? (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/12 bg-black/80 px-5 py-2.5 text-sm text-text-1 backdrop-blur"
                >
                    {toast}
                </motion.div>
            ) : null}

            <AnimatePresence>
                {reelsOpen ? (
                    <Suspense fallback={null}>
                        <CrateReels cards={crate} onRate={handleRate} onClose={() => setReelsOpen(false)} />
                    </Suspense>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

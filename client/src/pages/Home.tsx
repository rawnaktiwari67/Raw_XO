import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReelsFeed from '../components/culture/ReelsFeed';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { musicService } from '../services/musicService';
import { lyricsService } from '../services/lyricsService';
import { cultureService } from '../services/cultureService';
import { gameService } from '../services/gameService';
import type { CultureReview, LyricGuessRound, MeaningEntry } from '../types/culture';
import { useAuthStore } from '../stores/authStore';
import FilterPills from '../components/ui/FilterPills';

const pageReveal = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
    },
};

const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
};

const staggerItem = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const chipMotion = {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
};

const moodOptions = ['after midnight', 'pressure', 'gloss and damage', 'devotion', 'night drive', 'cold heartbreak'];

const cultureLanes = [
    {
        label: 'Decode',
        title: 'Lyric meaning battles',
        body: 'Pick the read that feels true, then watch the room tilt around it.',
    },
    {
        label: 'React',
        title: 'Mood and memory tags',
        body: 'Short, sharp reactions that say why the track still lands.',
    },
    {
        label: 'Replay',
        title: 'Audio guessing loop',
        body: 'Turn interpretation into a quick-fire listening game.',
    },
];

export default function Home() {
    useDocumentMeta({
        title: 'Culture — Raw XO',
        description: 'Lyric meanings, reactions, and reviews for trending tracks — the room where people argue about what a song is really about.',
    });
    const { user } = useAuthStore();
    const [entries, setEntries] = useState<MeaningEntry[]>([]);
    const [reviews, setReviews] = useState<CultureReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTrackId, setActiveTrackId] = useState('');
    const [selectedMeaning, setSelectedMeaning] = useState<Record<string, string>>({});
    const [selectedReaction, setSelectedReaction] = useState<Record<string, string>>({});
    const [rating, setRating] = useState(4);
    const [reviewMood, setReviewMood] = useState(moodOptions[0]);
    const [reviewTake, setReviewTake] = useState('');
    const [reviewSaved, setReviewSaved] = useState('');
    const [guessIndex, setGuessIndex] = useState(0);
    const [guessChoice, setGuessChoice] = useState('');
    const [guessRevealed, setGuessRevealed] = useState(false);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [browseMood, setBrowseMood] = useState<'all' | string>('all');
    const [browseSort, setBrowseSort] = useState<'popularity' | 'recent'>('popularity');
    const [searchQuery, setSearchQuery] = useState('');
    const [gridCount, setGridCount] = useState(9);
    const [reelsOpen, setReelsOpen] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const meaningLabRef = useRef<HTMLDivElement | null>(null);
    const gridObserverRef = useRef<IntersectionObserver | null>(null);

    // Activating a track is the page's core interaction — every "card" should be a
    // shortcut into the Meaning Lab for that song, not a dead end.
    const activateTrack = (trackId: string, scroll = false) => {
        const entry = entries.find((item) => item.trackId === trackId);
        if (!entry) return;
        setActiveTrackId(trackId);
        setReviewMood(entry.mood);
        if (scroll && meaningLabRef.current) {
            meaningLabRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError('');

            try {
                const reviewsPromise = cultureService.getReviews();
                const tracks = await musicService.getTrendingTracks();
                const { entries: nextEntries, selections } = await lyricsService.getMeaningEntries(tracks);
                if (!mounted) return;

                setEntries(nextEntries);
                setActiveTrackId(nextEntries[0]?.trackId || '');
                setReviewMood(nextEntries[0]?.mood || moodOptions[0]);

                // Re-hydrate the viewer's saved picks so their votes stay highlighted
                // across reloads instead of looking unvoted every visit.
                const meaningPicks: Record<string, string> = {};
                const reactionPicks: Record<string, string> = {};
                for (const [trackId, picked] of Object.entries(selections)) {
                    if (picked.meaningId) meaningPicks[trackId] = picked.meaningId;
                    if (picked.reactionId) reactionPicks[trackId] = picked.reactionId;
                }
                setSelectedMeaning(meaningPicks);
                setSelectedReaction(reactionPicks);

                const reviews = await reviewsPromise;
                if (!mounted) return;
                setReviews(reviews);
            } catch {
                if (!mounted) return;
                setError('Apple music data slipped. The fallback room is still live.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);

    const activeEntry = useMemo(
        () => entries.find((entry) => entry.trackId === activeTrackId) || entries[0] || null,
        [activeTrackId, entries]
    );

    const lyricRounds = useMemo<LyricGuessRound[]>(() => gameService.buildLyricGuessRounds(entries), [entries]);
    const currentRound = lyricRounds[guessIndex] || null;

    const popularInterpretations = useMemo(
        () =>
            [...entries]
                .sort((a, b) => {
                    const votesA = a.meanings.reduce((sum, meaning) => sum + meaning.votes, 0);
                    const votesB = b.meanings.reduce((sum, meaning) => sum + meaning.votes, 0);
                    return votesB - votesA;
                })
                .slice(0, 3),
        [entries]
    );

    const communityStats = useMemo(() => {
        const totalMeaningVotes = entries.reduce(
            (sum, entry) => sum + entry.meanings.reduce((entrySum, meaning) => entrySum + meaning.votes, 0),
            0
        );
        const totalReactions = entries.reduce(
            (sum, entry) => sum + entry.reactions.reduce((entrySum, reaction) => entrySum + reaction.count, 0),
            0
        );

        return {
            totalMeaningVotes,
            totalReactions,
            freshTakes: reviews.slice(0, 3),
        };
    }, [entries, reviews]);

    useEffect(() => {
        setGuessChoice('');
        setGuessRevealed(false);
        setIsPreviewPlaying(false);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [guessIndex]);

    const browseMoods = useMemo(() => {
        const moods = new Set<string>();
        entries.forEach((entry) => entry.mood && moods.add(entry.mood));
        return ['all', ...Array.from(moods)];
    }, [entries]);

    const visibleEntries = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return entries
            .filter((entry) => browseMood === 'all' || entry.mood === browseMood)
            .filter(
                (entry) =>
                    !query ||
                    entry.title.toLowerCase().includes(query) ||
                    entry.artist.toLowerCase().includes(query) ||
                    entry.lyricsSnippet.toLowerCase().includes(query)
            )
            .sort((a, b) =>
                browseSort === 'recent' ? b.releaseYear - a.releaseYear : b.popularity - a.popularity
            );
    }, [entries, browseMood, browseSort, searchQuery]);

    // Progressive/infinite grid: reveal a page at a time and loop the catalog so
    // scrolling never dead-ends. Keys carry the cycle so duplicated tracks stay
    // distinct to React across loops.
    const pagedEntries = useMemo(() => {
        if (visibleEntries.length === 0) return [];
        return Array.from({ length: gridCount }, (_, index) => {
            const entry = visibleEntries[index % visibleEntries.length];
            return { entry, key: `${entry.trackId}-${Math.floor(index / visibleEntries.length)}` };
        });
    }, [visibleEntries, gridCount]);

    // A new filter/search should start the grid fresh rather than keep a long,
    // half-scrolled loop from the previous result set.
    useEffect(() => {
        setGridCount(9);
    }, [browseMood, browseSort, searchQuery]);

    const extendGrid = useCallback(() => setGridCount((current) => current + 9), []);

    // Callback ref: attach the observer the moment the sentinel mounts (and
    // reattach if it remounts). More reliable than a useEffect+useRef pair, which
    // could tear the observer down before its first async callback under StrictMode.
    const gridSentinelRef = useCallback(
        (node: HTMLDivElement | null) => {
            gridObserverRef.current?.disconnect();
            if (!node) return;
            gridObserverRef.current = new IntersectionObserver(
                (observed) => {
                    if (observed.some((item) => item.isIntersecting)) extendGrid();
                },
                { rootMargin: '400px' }
            );
            gridObserverRef.current.observe(node);
        },
        [extendGrid]
    );

    const openLabFromReels = (trackId: string) => {
        setReelsOpen(false);
        activateTrack(trackId, true);
    };

    const myContributions = useMemo(() => {
        const name = user?.username?.trim().toLowerCase();
        if (!name) return [];
        return reviews.filter((review) => (review as CultureReview & { username?: string }).username?.trim().toLowerCase() === name);
    }, [reviews, user]);

    // With a deep catalog we can't list every track as a tab. Show the curated
    // featured tracks, and append the active one if the viewer drilled into a
    // catalog track so it stays selectable.
    const meaningLabTabs = useMemo(() => {
        const featured = entries.filter((entry) => entry.featured).slice(0, 8);
        if (activeEntry && !featured.some((entry) => entry.trackId === activeEntry.trackId)) {
            return [activeEntry, ...featured].slice(0, 9);
        }
        return featured;
    }, [entries, activeEntry]);

    const totalVotes = (entry: MeaningEntry) => entry.meanings.reduce((sum, meaning) => sum + meaning.votes, 0);

    const chooseMeaning = async (entry: MeaningEntry, meaningId: string) => {
        const previous = selectedMeaning[entry.trackId];
        if (previous === meaningId) return; // already this pick — server won't re-count
        void lyricsService.voteMeaning(entry.trackId, meaningId);
        // Optimistic: move the vote (drop the old pick, add the new) to mirror the
        // one-vote-per-listener rule the server now enforces.
        setEntries((current) =>
            current.map((item) =>
                item.trackId === entry.trackId
                    ? {
                        ...item,
                        meanings: item.meanings.map((meaning) => {
                            if (meaning.id === meaningId) return { ...meaning, votes: meaning.votes + 1 };
                            if (meaning.id === previous) return { ...meaning, votes: Math.max(0, meaning.votes - 1) };
                            return meaning;
                        }),
                    }
                    : item
            )
        );
        setSelectedMeaning((current) => ({ ...current, [entry.trackId]: meaningId }));
    };

    const chooseReaction = async (entry: MeaningEntry, reactionId: string) => {
        const previous = selectedReaction[entry.trackId];
        if (previous === reactionId) return;
        void lyricsService.react(entry.trackId, reactionId);
        setEntries((current) =>
            current.map((item) =>
                item.trackId === entry.trackId
                    ? {
                        ...item,
                        reactions: item.reactions.map((reaction) => {
                            if (reaction.id === reactionId) return { ...reaction, count: reaction.count + 1 };
                            if (reaction.id === previous) return { ...reaction, count: Math.max(0, reaction.count - 1) };
                            return reaction;
                        }),
                    }
                    : item
            )
        );
        setSelectedReaction((current) => ({ ...current, [entry.trackId]: reactionId }));
    };

    const saveReview = async () => {
        if (!activeEntry || reviewTake.trim().length < 8) return;

        const review = await cultureService.saveReview(
            activeEntry,
            rating,
            reviewMood,
            reviewTake.trim(),
            user?.username
        );
        setReviews((current) => [review, ...current]);
        setReviewTake('');
        setReviewSaved('Take saved.');
        window.setTimeout(() => setReviewSaved(''), 1800);
    };

    const submitGuess = (option: string) => {
        setGuessChoice(option);
        setGuessRevealed(true);
    };

    const togglePreview = async () => {
        if (!audioRef.current || !currentRound?.previewUrl) return;

        if (audioRef.current.paused) {
            try {
                await audioRef.current.play();
                setIsPreviewPlaying(true);
            } catch {
                setIsPreviewPlaying(false);
            }
        } else {
            audioRef.current.pause();
            setIsPreviewPlaying(false);
        }
    };

    const nextRound = () => {
        if (lyricRounds.length === 0) return;
        setGuessIndex((current) => (current + 1) % lyricRounds.length);
    };

    if (loading) {
        return (
            <div className="max-w-[1280px] mx-auto px-6 md:px-12 pt-28 pb-24 space-y-12">
                <div className="h-16 w-48 rounded-2xl bg-white/[0.05] animate-pulse" />
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-8 h-[340px] rounded-3xl bg-white/[0.04] animate-pulse" />
                    <div className="col-span-12 lg:col-span-4 h-[340px] rounded-3xl bg-white/[0.04] animate-pulse" />
                </div>
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-7 h-[460px] rounded-3xl bg-white/[0.04] animate-pulse" />
                    <div className="col-span-12 lg:col-span-5 h-[460px] rounded-3xl bg-white/[0.04] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden">
            <motion.div
                aria-hidden
                className="absolute inset-0"
                animate={{ backgroundPosition: ['0% 0%', '100% 36%', '0% 0%'] }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    background:
                        'radial-gradient(58% 44% at 76% 12%, rgba(244,162,97,0.18), transparent 60%), radial-gradient(56% 48% at 10% 84%, rgba(255,255,255,0.05), transparent 68%)',
                    backgroundSize: '130% 130%',
                }}
            />

            <div className="relative max-w-[1280px] mx-auto px-6 md:px-12 pt-28 pb-24">
                <motion.section
                    variants={pageReveal}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-12 gap-8 items-start"
                >
                    <div className="col-span-12 lg:col-span-5">
                        <p className="label-xs mb-6">Culture Archive</p>
                        <h1 className="font-heading font-bold text-5xl md:text-7xl text-text-1 leading-[0.93] tracking-normal max-w-xl">
                            Songs are better when the room has a take.
                        </h1>
                        <p className="text-text-3 text-base leading-relaxed max-w-md mt-6">
                            A tighter archive for lyric arguments, mood tags, quick reviews, and the context that makes
                            a track feel bigger than a stream count.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-8">
                            <a href="#trending" className="btn-primary rounded-2xl">
                                Enter the archive
                            </a>
                            <Link to="/" className="btn-secondary rounded-2xl">
                                Play the game
                            </Link>
                            <Link to="/leaderboard" className="btn-secondary rounded-2xl">
                                See the rankings
                            </Link>
                        </div>
                        {error ? <p className="text-sm text-amber mt-6">{error}</p> : null}
                    </div>

                    <div className="col-span-12 lg:col-span-7 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-5 md:p-7">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="label-xs mb-3">Now decoding</p>
                                <p className="font-heading font-bold text-3xl text-text-1 leading-tight">
                                    Trending tracks, but with actual memory attached.
                                </p>
                            </div>
                            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-text-3">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                Live music data
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3 mt-7">
                            {entries.slice(0, 3).map((entry, index) => (
                                <motion.button
                                    key={entry.trackId}
                                    type="button"
                                    whileHover={{ scale: 1.01, y: -2 }}
                                    onClick={() => {
                                        setActiveTrackId(entry.trackId);
                                        setReviewMood(entry.mood);
                                    }}
                                    className={`${index === 0 ? 'col-span-12 md:col-span-6' : 'col-span-12 md:col-span-3'} group text-left rounded-[1rem] overflow-hidden border border-white/10 bg-black/20 transition-colors hover:border-amber/25`}
                                >
                                    <div className="relative">
                                        <img src={entry.albumArt} alt={entry.title} width={400} height={176} loading="lazy" decoding="async" className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-text-2">
                                            {entry.mood}
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-xs uppercase tracking-[0.22em] text-text-4">{entry.artist}</p>
                                        <p className="font-heading font-bold text-xl text-text-1 mt-3 leading-tight">
                                            {entry.lyricsSnippet}
                                        </p>
                                        <p className="text-text-3 text-sm mt-3">{entry.shortTake}</p>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3"
                >
                    {cultureLanes.map((lane) => (
                        <motion.article
                            key={lane.label}
                            variants={staggerItem}
                            className="rounded-[1rem] border border-white/10 bg-black/20 p-5"
                        >
                            <p className="text-xs uppercase tracking-[0.18em] text-amber">{lane.label}</p>
                            <p className="mt-3 font-heading text-2xl font-bold leading-tight text-text-1">{lane.title}</p>
                            <p className="mt-3 text-sm leading-relaxed text-text-3">{lane.body}</p>
                        </motion.article>
                    ))}
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-10 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-6 py-5"
                >
                    <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-12 lg:col-span-4">
                            <p className="label-xs mb-3">Community</p>
                            <p className="font-heading font-bold text-3xl text-text-1 leading-tight">
                                The archive gets sharper as people vote.
                            </p>
                            <p className="text-text-3 text-sm mt-3 max-w-sm">
                                Meaning votes, reactions, and quick reviews turn each track into a living note.
                            </p>
                        </div>

                        <div className="col-span-12 lg:col-span-3 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-text-4">Meaning votes</p>
                                <p className="font-heading font-bold text-3xl text-text-1 mt-3">
                                    {communityStats.totalMeaningVotes}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-text-4">Reactions</p>
                                <p className="font-heading font-bold text-3xl text-text-1 mt-3">
                                    {communityStats.totalReactions}
                                </p>
                            </div>
                        </div>

                        <div className="col-span-12 lg:col-span-5">
                            <p className="text-xs uppercase tracking-[0.22em] text-text-4 mb-3">Freshest takes</p>
                            <div className="space-y-3">
                                {communityStats.freshTakes.length > 0 ? (
                                    communityStats.freshTakes.map((review) => (
                                        <button
                                            key={review.id}
                                            type="button"
                                            onClick={() => activateTrack(review.trackId, true)}
                                            className="block w-full rounded-2xl bg-black/20 px-4 py-3 text-left transition-colors hover:bg-black/30"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-heading font-bold text-text-1 text-lg">
                                                        {review.title}
                                                    </p>
                                                    <p className="text-text-4 text-xs mt-1">
                                                        {review.artist} - {review.moodTag}
                                                    </p>
                                                </div>
                                                <span className="text-amber text-sm">{review.rating}/5</span>
                                            </div>
                                            <p className="text-text-2 text-sm mt-3">{review.take}</p>
                                        </button>
                                    ))
                                ) : (
                                    <div className="rounded-2xl bg-black/20 px-4 py-4">
                                        <p className="text-text-2 text-sm">
                                            No shared takes yet. Drop one and the page starts sounding more alive.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.section>

                <section id="trending" className="mt-16">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                        <div>
                            <p className="label-xs mb-3">Trending</p>
                            <h2 className="font-heading font-bold text-4xl text-text-1 leading-tight">
                                Songs moving through the room right now.
                            </h2>
                        </div>
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search track, artist, or lyric…"
                            className="w-full sm:w-72 rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-text-1 placeholder:text-text-4 focus:border-amber/40 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <FilterPills
                            options={browseMoods.map((mood) => ({ value: mood, label: mood === 'all' ? 'All moods' : mood }))}
                            value={browseMood}
                            onChange={setBrowseMood}
                            size="sm"
                        />
                        <div className="flex items-center gap-3">
                            <FilterPills
                                options={[
                                    { value: 'popularity', label: 'Hottest' },
                                    { value: 'recent', label: 'Newest' },
                                ]}
                                value={browseSort}
                                onChange={(value) => setBrowseSort(value as 'popularity' | 'recent')}
                                size="sm"
                            />
                            <button
                                type="button"
                                onClick={() => setReelsOpen(true)}
                                disabled={visibleEntries.length === 0}
                                className="rounded-full border border-amber/35 bg-amber-dim px-4 py-1.5 text-xs font-semibold text-amber transition-colors hover:bg-amber/15 disabled:opacity-40"
                            >
                                ▶ Reels
                            </button>
                        </div>
                    </div>

                    {visibleEntries.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                            <p className="text-text-2 text-sm">Nothing matches that yet. Clear the filters to see the full room.</p>
                        </div>
                    ) : (
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: '-80px' }}
                            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        >
                            {pagedEntries.map(({ entry, key }) => {
                                const active = entry.trackId === activeTrackId;
                                return (
                                    <motion.button
                                        key={key}
                                        type="button"
                                        variants={staggerItem}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        onClick={() => activateTrack(entry.trackId, true)}
                                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                            active ? 'border-amber/40 bg-amber-dim/40' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <img src={entry.albumArt} alt={entry.title} width={80} height={80} loading="lazy" decoding="async" className="h-20 w-20 rounded-2xl object-cover" />
                                            <div>
                                                <p className="font-heading font-bold text-xl text-text-1">{entry.title}</p>
                                                <p className="text-text-3 text-sm mt-1">{entry.artist}</p>
                                                <p className="text-text-4 text-xs mt-2">
                                                    {entry.mood} · {entry.popularity}/100
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-text-2 text-sm mt-4">
                                            {entry.featured ? entry.lyricsSnippet : entry.album}
                                        </p>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    )}
                    {visibleEntries.length > 0 ? <div ref={gridSentinelRef} className="h-px w-full" /> : null}
                </section>

                <section id="meaning-lab" className="grid grid-cols-12 gap-8 mt-16 items-start scroll-mt-28">
                    <motion.div
                        ref={meaningLabRef}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="col-span-12 lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8"
                    >
                        {activeEntry ? (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <p className="label-xs mb-3">Meaning Lab</p>
                                        <h2 className="font-heading font-bold text-4xl text-text-1 leading-tight max-w-xl">
                                            {activeEntry.lyricsSnippet}
                                        </h2>
                                        <p className="text-text-2 text-base mt-4 max-w-xl">{activeEntry.shortTake}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {meaningLabTabs.map((entry) => (
                                            <button
                                                key={entry.trackId}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTrackId(entry.trackId);
                                                    setReviewMood(entry.mood);
                                                }}
                                                className={`rounded-full px-4 py-2 text-xs border transition-all ${
                                                    activeEntry.trackId === entry.trackId
                                                        ? 'border-amber/35 bg-amber-dim text-amber'
                                                        : 'border-white/10 bg-white/[0.03] text-text-3 hover:text-text-1'
                                                }`}
                                            >
                                                {entry.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6 mt-8">
                                    <div className="col-span-12 md:col-span-7">
                                        <p className="text-xs uppercase tracking-[0.22em] text-text-4">Choose the meaning</p>
                                        <div className="flex flex-wrap gap-3 mt-4">
                                            {activeEntry.meanings.map((meaning) => {
                                                const active = selectedMeaning[activeEntry.trackId] === meaning.id;
                                                return (
                                                    <motion.button
                                                        key={meaning.id}
                                                        type="button"
                                                        {...chipMotion}
                                                        onClick={() => chooseMeaning(activeEntry, meaning.id)}
                                                        className={`rounded-full px-4 py-3 text-sm border transition-all ${
                                                            active
                                                                ? 'border-amber/35 bg-amber-dim text-amber'
                                                                : 'border-white/10 bg-white/[0.03] text-text-2 hover:border-white/20 hover:text-text-1'
                                                        }`}
                                                    >
                                                        {meaning.label}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>

                                        <div className="space-y-3 mt-8">
                                            {activeEntry.meanings.map((meaning) => {
                                                const percentage = Math.round((meaning.votes / totalVotes(activeEntry)) * 100);
                                                return (
                                                    <div key={meaning.id}>
                                                        <div className="flex items-center justify-between text-sm text-text-2">
                                                            <span>{meaning.label}</span>
                                                            <span>{percentage}%</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-white/[0.06] mt-2 overflow-hidden">
                                                            <motion.div
                                                                className="h-full rounded-full bg-amber"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${percentage}%` }}
                                                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-8">
                                            <p className="text-xs uppercase tracking-[0.22em] text-text-4">Reactions</p>
                                            <div className="grid grid-cols-2 gap-3 mt-4">
                                                {activeEntry.reactions.map((reaction) => {
                                                    const active = selectedReaction[activeEntry.trackId] === reaction.id;
                                                    return (
                                                        <motion.button
                                                            key={reaction.id}
                                                            type="button"
                                                            {...chipMotion}
                                                            onClick={() => chooseReaction(activeEntry, reaction.id)}
                                                            className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                                                                active
                                                                    ? 'border-emerald-400/35 bg-emerald-500/10'
                                                                    : 'border-white/10 bg-black/20 hover:border-white/20'
                                                            }`}
                                                        >
                                                            <p className="text-text-1 font-semibold capitalize">{reaction.label}</p>
                                                            <p className="text-text-4 text-xs mt-2">{reaction.count} reactions</p>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-5 space-y-4">
                                        <div className="rounded-2xl bg-black/25 p-5">
                                            <p className="text-xs uppercase tracking-[0.22em] text-text-4">Why it hits</p>
                                            <p className="text-text-1 text-lg leading-relaxed mt-3">{activeEntry.whyItHits}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white/[0.03] p-5">
                                            <p className="text-xs uppercase tracking-[0.22em] text-text-4">When this dropped</p>
                                            <p className="text-text-2 text-sm mt-3">{activeEntry.whenItDropped}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white/[0.03] p-5">
                                            <p className="text-xs uppercase tracking-[0.22em] text-text-4">What was happening</p>
                                            <p className="text-text-2 text-sm mt-3">{activeEntry.whatWasHappening}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white/[0.03] p-5">
                                            <p className="text-xs uppercase tracking-[0.22em] text-text-4">Alternate meanings</p>
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {activeEntry.alternateMeanings.map((meaning) => (
                                                    <span
                                                        key={meaning}
                                                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-text-3"
                                                    >
                                                        {meaning}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </motion.div>

                    <motion.aside
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className="col-span-12 lg:col-span-5 space-y-4"
                    >
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <p className="label-xs mb-4">Popular interpretations</p>
                            <div className="space-y-4">
                                {popularInterpretations.map((entry) => {
                                    const topMeaning = [...entry.meanings].sort((a, b) => b.votes - a.votes)[0];
                                    return (
                                        <button
                                            key={entry.trackId}
                                            type="button"
                                            onClick={() => activateTrack(entry.trackId, true)}
                                            className="w-full rounded-2xl bg-black/20 p-4 text-left transition-colors hover:bg-black/30"
                                        >
                                            <p className="font-heading font-bold text-text-1 text-xl">{entry.title}</p>
                                            <p className="text-text-3 text-sm mt-1">{entry.artist}</p>
                                            <p className="text-amber text-sm mt-3">{topMeaning?.label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <p className="label-xs mb-4">Short takes</p>
                            {activeEntry ? (
                                <>
                                    <div className="flex items-center gap-4">
                                        <img src={activeEntry.albumArt} alt={activeEntry.title} width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 rounded-2xl object-cover" />
                                        <div>
                                            <p className="font-heading font-bold text-text-1 text-2xl">{activeEntry.title}</p>
                                            <p className="text-text-3 text-sm mt-1">{activeEntry.artist}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        {[1, 2, 3, 4, 5].map((value) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setRating(value)}
                                                className={`h-10 w-10 rounded-2xl border text-sm transition-all ${
                                                    rating === value
                                                        ? 'border-amber/35 bg-amber-dim text-amber'
                                                        : 'border-white/10 bg-white/[0.03] text-text-3'
                                                }`}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {moodOptions.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setReviewMood(option)}
                                                className={`rounded-full px-3 py-2 text-xs border transition-all ${
                                                    reviewMood === option
                                                        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                                                        : 'border-white/10 bg-white/[0.03] text-text-3'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>

                                    <textarea
                                        value={reviewTake}
                                        onChange={(event) => setReviewTake(event.target.value)}
                                        placeholder="One sharp line. No essay."
                                        className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-text-1 placeholder:text-text-4 focus:outline-none"
                                    />

                                    <div className="flex items-center justify-between gap-4 mt-4">
                                        <button type="button" onClick={saveReview} className="btn-primary rounded-2xl">
                                            Save take
                                        </button>
                                        <span className="text-xs text-emerald-300">{reviewSaved}</span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </motion.aside>
                </section>

                <section className="grid grid-cols-12 gap-8 mt-16 items-start">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                        className="col-span-12 lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="label-xs mb-3">Lyric + audio guess</p>
                                <h2 className="font-heading font-bold text-4xl text-text-1 leading-tight">
                                    Guess the track before the meaning lands.
                                </h2>
                            </div>
                            <Link to="/" className="btn-secondary rounded-2xl">
                                Full game
                            </Link>
                        </div>

                        {currentRound ? (
                            <>
                                <audio
                                    ref={audioRef}
                                    src={currentRound.previewUrl}
                                    onPause={() => setIsPreviewPlaying(false)}
                                    onEnded={() => setIsPreviewPlaying(false)}
                                />

                                <div className="grid grid-cols-12 gap-6 mt-8">
                                    <div className="col-span-12 md:col-span-5">
                                        <img src={currentRound.albumArt} alt={currentRound.title} width={600} height={600} loading="lazy" decoding="async" className="w-full rounded-3xl object-cover aspect-square" />
                                    </div>
                                    <div className="col-span-12 md:col-span-7">
                                        <p className="text-xs uppercase tracking-[0.22em] text-text-4">Lyric snippet</p>
                                        <p className="font-heading font-bold text-4xl text-text-1 mt-4 leading-tight">
                                            {currentRound.snippet}
                                        </p>
                                        <div className="flex items-center gap-3 mt-6">
                                            <button type="button" onClick={togglePreview} className="btn-primary rounded-2xl">
                                                {isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                                            </button>
                                            <span className="text-text-4 text-sm">
                                                {currentRound.previewUrl ? 'Apple preview clip' : 'Preview unavailable'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 mt-8">
                                            {currentRound.options.map((option) => {
                                                const chosen = guessChoice === option;
                                                const correct = option === currentRound.title;
                                                const stateClass = guessRevealed
                                                    ? correct
                                                        ? 'border-emerald-400/45 bg-emerald-500/12 text-white'
                                                        : chosen
                                                          ? 'border-red-400/45 bg-red-500/12 text-white'
                                                          : 'border-white/10 bg-white/[0.03] text-text-2'
                                                    : 'border-white/10 bg-white/[0.03] text-text-2 hover:border-white/20 hover:bg-white/[0.05]';

                                                return (
                                                    <motion.button
                                                        key={option}
                                                        type="button"
                                                        {...chipMotion}
                                                        onClick={() => !guessRevealed && submitGuess(option)}
                                                        className={`rounded-2xl border px-4 py-4 text-left transition-all ${stateClass}`}
                                                    >
                                                        {option}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>

                                        <motion.div
                                            initial={false}
                                            animate={{
                                                opacity: guessRevealed ? 1 : 0,
                                                y: guessRevealed ? 0 : 10,
                                                height: guessRevealed ? 'auto' : 0,
                                            }}
                                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-6">
                                                <p className={`font-heading font-semibold text-xl ${guessChoice === currentRound.title ? 'text-emerald-300' : 'text-red-300'}`}>
                                                    {guessChoice === currentRound.title ? 'Locked in.' : 'Not quite.'}
                                                </p>
                                                <p className="text-text-2 text-sm mt-2">
                                                    {currentRound.title} · {currentRound.artist}
                                                </p>
                                                <p className="text-text-3 text-sm mt-3">{currentRound.meaning}</p>
                                                <div className="flex flex-wrap gap-3 mt-5">
                                                    <button type="button" onClick={nextRound} className="btn-primary rounded-2xl">
                                                        Next lyric
                                                    </button>
                                                    <a
                                                        href={currentRound.trackUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn-secondary rounded-2xl"
                                                    >
                                                        Open in Apple
                                                    </a>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </motion.div>

                    <motion.aside
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className="col-span-12 lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.035] p-6"
                    >
                        {myContributions.length > 0 ? (
                            <div className="mb-6 rounded-2xl border border-amber/20 bg-amber-dim/30 p-4">
                                <p className="label-xs mb-3">Your takes</p>
                                <div className="space-y-3">
                                    {myContributions.slice(0, 3).map((review) => (
                                        <button
                                            key={review.id}
                                            type="button"
                                            onClick={() => activateTrack(review.trackId, true)}
                                            className="block w-full text-left"
                                        >
                                            <p className="text-sm font-semibold text-text-1">{review.title}</p>
                                            <p className="mt-1 text-xs text-text-3">{review.take}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <p className="label-xs mb-4">Recent reviews</p>
                        <div className="space-y-4">
                            {reviews.length === 0 ? (
                                <div className="rounded-2xl bg-black/20 p-5">
                                    <p className="font-heading font-bold text-text-1 text-2xl">No takes yet.</p>
                                    <p className="text-text-3 text-sm mt-3">Save a sharp line and the room starts to remember you.</p>
                                </div>
                            ) : (
                                reviews.slice(0, 4).map((review) => (
                                    <button
                                        key={review.id}
                                        type="button"
                                        onClick={() => activateTrack(review.trackId, true)}
                                        className="block w-full rounded-2xl bg-black/20 p-4 text-left transition-colors hover:bg-black/30"
                                    >
                                        <div className="flex items-center gap-4">
                                            <img src={review.albumArt} alt={review.title} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 rounded-2xl object-cover" />
                                            <div>
                                                <p className="font-heading font-bold text-text-1 text-xl">{review.title}</p>
                                                <p className="text-text-3 text-sm">{review.artist}</p>
                                            </div>
                                        </div>
                                        <p className="text-text-2 text-sm mt-4">{review.take}</p>
                                        <div className="flex items-center justify-between text-xs text-text-4 mt-4">
                                            <span>{review.moodTag}</span>
                                            <span>{review.rating}/5</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.aside>
                </section>

                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-3xl border border-white/10 bg-black/25 px-6 py-5 mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                    <div>
                        <p className="label-xs mb-3">Loop</p>
                        <p className="font-heading font-bold text-3xl text-text-1 leading-tight">
                            Discover. Interpret. React. Guess. Reveal. Rate. Continue.
                        </p>
                    </div>
                    <Link to="/" className="btn-primary rounded-2xl">
                        Back to main game
                    </Link>
                </motion.section>
            </div>

            <AnimatePresence>
                {reelsOpen ? (
                    <ReelsFeed
                        entries={visibleEntries}
                        selectedMeaning={selectedMeaning}
                        selectedReaction={selectedReaction}
                        onChooseMeaning={chooseMeaning}
                        onChooseReaction={chooseReaction}
                        onOpenLab={openLabFromReels}
                        onClose={() => setReelsOpen(false)}
                    />
                ) : null}
            </AnimatePresence>
        </div>
    );
}

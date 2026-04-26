import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { musicService } from '../services/musicService';
import { lyricsService } from '../services/lyricsService';
import { cultureService } from '../services/cultureService';
import { gameService } from '../services/gameService';
import type { CultureReview, LyricGuessRound, MeaningEntry } from '../types/culture';
import { useAuthStore } from '../stores/authStore';

const pageReveal = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
    },
};

const chipMotion = {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
};

const moodOptions = ['after midnight', 'pressure', 'gloss and damage', 'devotion', 'night drive', 'cold heartbreak'];

export default function Home() {
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
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError('');

            try {
                const tracks = await musicService.getTrendingTracks();
                const nextEntries = await lyricsService.getMeaningEntries(tracks);
                if (!mounted) return;

                setEntries(nextEntries);
                setActiveTrackId(nextEntries[0]?.trackId || '');
                setReviewMood(nextEntries[0]?.mood || moodOptions[0]);
                setReviews(await cultureService.getReviews());
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

    const totalVotes = (entry: MeaningEntry) => entry.meanings.reduce((sum, meaning) => sum + meaning.votes, 0);

    const chooseMeaning = async (entry: MeaningEntry, meaningId: string) => {
        await lyricsService.voteMeaning(entry.trackId, meaningId);
        setEntries((current) =>
            current.map((item) =>
                item.trackId === entry.trackId
                    ? {
                        ...item,
                        meanings: item.meanings.map((meaning) =>
                            meaning.id === meaningId ? { ...meaning, votes: meaning.votes + 1 } : meaning
                        ),
                    }
                    : item
            )
        );
        setSelectedMeaning((current) => ({ ...current, [entry.trackId]: meaningId }));
    };

    const chooseReaction = async (entry: MeaningEntry, reactionId: string) => {
        await lyricsService.react(entry.trackId, reactionId);
        setEntries((current) =>
            current.map((item) =>
                item.trackId === entry.trackId
                    ? {
                        ...item,
                        reactions: item.reactions.map((reaction) =>
                            reaction.id === reactionId ? { ...reaction, count: reaction.count + 1 } : reaction
                        ),
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
                        <p className="label-xs mb-6">Culture System</p>
                        <h1 className="font-heading font-bold text-5xl md:text-7xl text-text-1 leading-[0.93] tracking-normal max-w-xl">
                            The part of the song people keep arguing with.
                        </h1>
                        <p className="text-text-3 text-base leading-relaxed max-w-md mt-6">
                            Trending tracks, lyric meaning battles, fast takes, and a guessing loop that turns context
                            into replay.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-8">
                            <a href="#trending" className="btn-primary rounded-2xl">
                                See what is moving
                            </a>
                            <Link to="/" className="btn-secondary rounded-2xl">
                                Main guess game
                            </Link>
                        </div>
                        {error ? <p className="text-sm text-amber mt-6">{error}</p> : null}
                    </div>

                    <div className="col-span-12 lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="label-xs mb-3">Live pulse</p>
                                <p className="font-heading font-bold text-3xl text-text-1 leading-tight">
                                    Discover. Interpret. React. Guess. Rate.
                                </p>
                            </div>
                            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-text-3">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                Apple-fed music data
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4 mt-8">
                            {entries.slice(0, 3).map((entry, index) => (
                                <motion.button
                                    key={entry.trackId}
                                    type="button"
                                    whileHover={{ scale: 1.01, y: -2 }}
                                    onClick={() => {
                                        setActiveTrackId(entry.trackId);
                                        setReviewMood(entry.mood);
                                    }}
                                    className={`${index === 0 ? 'col-span-12 md:col-span-6' : 'col-span-12 md:col-span-3'} text-left rounded-2xl overflow-hidden border border-white/10 bg-black/20`}
                                >
                                    <img src={entry.albumArt} alt={entry.title} className="h-44 w-full object-cover" />
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
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5"
                >
                    <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-12 lg:col-span-4">
                            <p className="label-xs mb-3">Community</p>
                            <p className="font-heading font-bold text-3xl text-text-1 leading-tight">
                                The room is already talking.
                            </p>
                            <p className="text-text-3 text-sm mt-3 max-w-sm">
                                Shared votes, live reactions, and the freshest takes are shaping what each line means.
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
                                        <div key={review.id} className="rounded-2xl bg-black/20 px-4 py-3">
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
                                        </div>
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
                    <div className="flex items-end justify-between gap-4 mb-6">
                        <div>
                            <p className="label-xs mb-3">Trending</p>
                            <h2 className="font-heading font-bold text-4xl text-text-1 leading-tight">
                                Songs moving through the room right now.
                            </h2>
                        </div>
                        <p className="text-text-4 text-sm max-w-sm text-right">
                            Real track data from Apple. Lyric meaning and reactions layered on top.
                        </p>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {entries.map((entry) => (
                            <motion.article
                                key={entry.trackId}
                                whileHover={{ scale: 1.02, y: -2 }}
                                className="min-w-[280px] max-w-[280px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                            >
                                <div className="flex items-center gap-4">
                                    <img src={entry.albumArt} alt={entry.title} className="h-20 w-20 rounded-2xl object-cover" />
                                    <div>
                                        <p className="font-heading font-bold text-xl text-text-1">{entry.title}</p>
                                        <p className="text-text-3 text-sm mt-1">{entry.artist}</p>
                                        <p className="text-text-4 text-xs mt-2">
                                            {entry.mood} · {entry.popularity}/100
                                        </p>
                                    </div>
                                </div>
                                <p className="text-text-2 text-sm mt-4">{entry.lyricsSnippet}</p>
                            </motion.article>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-12 gap-8 mt-16 items-start">
                    <motion.div
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
                                        {entries.map((entry) => (
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
                                            onClick={() => setActiveTrackId(entry.trackId)}
                                            className="w-full rounded-2xl bg-black/20 p-4 text-left"
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
                                        <img src={activeEntry.albumArt} alt={activeEntry.title} className="h-16 w-16 rounded-2xl object-cover" />
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
                                        <img src={currentRound.albumArt} alt={currentRound.title} className="w-full rounded-3xl object-cover aspect-square" />
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
                        <p className="label-xs mb-4">Recent reviews</p>
                        <div className="space-y-4">
                            {reviews.length === 0 ? (
                                <div className="rounded-2xl bg-black/20 p-5">
                                    <p className="font-heading font-bold text-text-1 text-2xl">No takes yet.</p>
                                    <p className="text-text-3 text-sm mt-3">Save a sharp line and the room starts to remember you.</p>
                                </div>
                            ) : (
                                reviews.slice(0, 4).map((review) => (
                                    <article key={review.id} className="rounded-2xl bg-black/20 p-4">
                                        <div className="flex items-center gap-4">
                                            <img src={review.albumArt} alt={review.title} className="h-14 w-14 rounded-2xl object-cover" />
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
                                    </article>
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
        </div>
    );
}

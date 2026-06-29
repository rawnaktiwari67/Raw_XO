import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { gameService } from '../../services/gameService';
import { roundSecondsFor } from '../../config/gameConfig';
import ShareButton from './ShareButton';
import SoundToggle from './SoundToggle';
import { unlock, playTick, playCorrect, playWrong, playComplete, vibrate } from '../../services/sound';
import type { GameArtistOption, GameDifficulty, GameGenre, GameLanguage, LeaderboardData } from '../../types/game';

const ROUND_LIMIT = 5;

const GENRE_OPTIONS: Array<{ label: string; value: GameGenre }> = [
    { label: 'All', value: 'all' },
    { label: 'Hip Hop', value: 'hip-hop' },
    { label: 'Pop', value: 'pop' },
    { label: 'R&B', value: 'rnb' },
    { label: 'Dance', value: 'dance' },
];

const LANGUAGE_OPTIONS: Array<{ label: string; value: GameLanguage }> = [
    { label: 'English', value: 'english' },
    { label: 'All', value: 'all' },
    { label: 'Hindi', value: 'hindi' },
    { label: 'Punjabi', value: 'punjabi' },
    { label: 'Korean', value: 'korean' },
    { label: 'Spanish', value: 'spanish' },
];

const DIFFICULTY_OPTIONS: Array<{ label: string; value: GameDifficulty }> = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
];

function formatResponseTime(value?: number) {
    if (!value || value <= 0) return '--';
    return `${(value / 1000).toFixed(2)}s`;
}

function getLiveMultiplier(streak: number) {
    return Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
}

function getRatingTone(value: number, selectedRating: number | null) {
    const active = selectedRating === value;
    if (value <= 2) {
        return active
            ? 'bg-rose-400 text-ch-0 ring-1 ring-rose-200/70'
            : 'bg-rose-400/10 text-rose-100 ring-1 ring-rose-300/18 hover:bg-rose-400/18';
    }
    if (value === 3) {
        return active
            ? 'bg-amber text-ch-0 ring-1 ring-amber/70'
            : 'bg-amber/10 text-amber-100 ring-1 ring-amber/18 hover:bg-amber/18';
    }
    return active
        ? 'bg-emerald-300 text-ch-0 ring-1 ring-emerald-100/70'
        : 'bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-300/18 hover:bg-emerald-400/18';
}

function getRatingMessage(value: number | null) {
    if (!value) return 'Rate it fast.';
    if (value <= 2) return 'Not your lane.';
    if (value === 3) return 'Solid, but not sacred.';
    return "Guess it's one of your favorites.";
}

function AnimatedValue({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const start = displayValue;
        const end = value;
        if (start === end) return;

        const startTime = performance.now();
        const duration = 420;
        let raf = 0;

        const step = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(Math.round(start + (end - start) * eased));
            if (progress < 1) raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, displayValue]);

    return <span>{displayValue}</span>;
}

function titleCase(value: string) {
    return value
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');
}

function getFanMessage(artist: string, accuracy: number, score: number) {
    const name = artist || 'this artist';

    if (accuracy >= 80) {
        return `You are a big ${name} fan. No notes, just frightening recall.`;
    }

    if (accuracy >= 60) {
        return `${name} would let you in the group chat, but only after one more album run.`;
    }

    if (score > 0) {
        return `You know some ${name}, but the deep cuts caught you looking around the room.`;
    }

    return `Looks like someone needs to binge listen to a ${name} album today.`;
}

function RankCard({
    label,
    board,
    fallback,
}: {
    label: string;
    board: LeaderboardData | null;
    fallback: string;
}) {
    const leader = board?.entries?.[0];

    return (
        <div className="rounded-[1rem] bg-black/18 px-4 py-4 ring-1 ring-white/[0.05]">
            <p className="label-xs">{label}</p>
            <div className="mt-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-heading text-[1.9rem] leading-none text-text-1">
                        {board?.userRank ? `#${board.userRank}` : '--'}
                    </p>
                    <p className="mt-2 truncate text-xs text-text-4">
                        {leader ? `Leader: ${leader.username}` : fallback}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-heading text-lg leading-none text-accent">
                        {leader ? leader.totalScore.toLocaleString() : '0'}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-text-4">top pts</p>
                </div>
            </div>
        </div>
    );
}

function FilterRail<T extends string>({
    label,
    options,
    value,
    onChange,
    disabled,
}: {
    label: string;
    options: Array<{ label: string; value: T }>;
    value: T;
    onChange: (next: T) => void;
    disabled: boolean;
}) {
    const selectedOption = options.find((option) => option.value === value);

    return (
        <div className="min-h-[174px] rounded-[1.1rem] bg-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="label-xs">{label}</p>
                    <p className="mt-2 truncate text-sm font-semibold text-text-1">{selectedOption?.label ?? label}</p>
                </div>
                <span className="rounded-full bg-white/[0.035] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-text-4">
                    Select
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const active = option.value === value;

                    return (
                        <motion.button
                            key={option.value}
                            type="button"
                            whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
                            whileTap={disabled ? undefined : { scale: 0.99 }}
                            onClick={() => onChange(option.value)}
                            disabled={disabled}
                            className={`min-h-10 rounded-[0.85rem] px-4 py-2 text-[11px] uppercase tracking-[0.12em] transition-all duration-300 ${
                                active
                                    ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.24),rgba(244,162,97,0.09))] text-text-1 ring-1 ring-amber/20'
                                    : 'bg-white/[0.035] text-text-3 hover:text-text-1'
                            } disabled:opacity-60`}
                        >
                            {option.label}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

function ArtistPicker({
    artists,
    value,
    onChange,
    disabled,
    language,
}: {
    artists: GameArtistOption[];
    value: string;
    onChange: (artist: string) => void;
    disabled: boolean;
    language: GameLanguage;
}) {
    const [query, setQuery] = useState('');
    const [liveArtists, setLiveArtists] = useState<GameArtistOption[]>([]);
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const customArtistValue = normalizedQuery.toLowerCase();
    const visiblePresetArtists = artists.filter((artist) => language === 'all' || artist.language === language || artist.language === 'all');
    const exactPreset = visiblePresetArtists.find((artist) => artist.value === customArtistValue);
    const selectedArtist = value === 'all'
        ? null
        : artists.find((artist) => artist.value === value) ?? { label: value, value, language };
    const filteredPresetArtists = visiblePresetArtists
        .filter((artist) => {
            if (!normalizedQuery) return true;
            return artist.label.toLowerCase().includes(normalizedQuery.toLowerCase());
        })
        .slice(0, normalizedQuery ? 8 : 7);
    const filteredArtists = [...filteredPresetArtists, ...liveArtists]
        .filter((artist, index, list) => list.findIndex((item) => item.value === artist.value) === index)
        .slice(0, normalizedQuery ? 10 : 7);
    const canUseCustomArtist = normalizedQuery.length >= 2 && !exactPreset;

    const applyCustomArtist = () => {
        if (exactPreset) {
            onChange(exactPreset.value);
            setQuery('');
            return;
        }
        if (!canUseCustomArtist) return;
        onChange(customArtistValue);
        setQuery('');
    };

    const selectArtist = (artist: string) => {
        onChange(artist);
        setQuery('');
    };

    useEffect(() => {
        if (normalizedQuery.length < 2) {
            setLiveArtists([]);
            return;
        }

        let active = true;
        const timeout = window.setTimeout(async () => {
            try {
                const response = await gameService.searchArtists(normalizedQuery, language);
                if (!active) return;
                setLiveArtists(Array.isArray(response.data?.data) ? response.data.data : []);
            } catch {
                if (!active) return;
                setLiveArtists([]);
            }
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [language, normalizedQuery]);

    return (
        <div className="min-h-[174px] rounded-[1.1rem] bg-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="label-xs">Artist Pool</p>
                    <p className="mt-2 truncate text-sm font-semibold text-text-1">
                        {selectedArtist ? selectedArtist.label : 'All available artists'}
                    </p>
                </div>
                {value !== 'all' ? (
                    <button
                        type="button"
                        onClick={() => selectArtist('all')}
                        disabled={disabled}
                        className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1 disabled:opacity-50"
                    >
                        Clear
                    </button>
                ) : null}
            </div>

            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    applyCustomArtist();
                }}
                placeholder="Search any artist"
                disabled={disabled}
                className="h-10 w-full rounded-[0.85rem] bg-black/15 px-3 text-sm text-text-1 outline-none ring-1 ring-white/[0.04] transition-all placeholder:text-text-4 focus:bg-black/20 focus:ring-amber/30"
            />

            <div className="scrollbar-cinematic mt-3 max-h-[82px] overflow-y-auto pr-2">
                <div className="flex flex-wrap gap-2">
                    <motion.button
                        type="button"
                        whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
                        whileTap={disabled ? undefined : { scale: 0.99 }}
                        onClick={() => selectArtist('all')}
                        disabled={disabled}
                        className={`min-h-9 rounded-[0.8rem] px-3 py-2 text-left text-[10px] uppercase tracking-[0.11em] transition-all duration-300 ${
                            value === 'all'
                                ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.22),rgba(244,162,97,0.08))] text-text-1 ring-1 ring-amber/20'
                                : 'bg-white/[0.03] text-text-3 hover:text-text-1'
                        } disabled:opacity-60`}
                    >
                        Any Artist
                    </motion.button>

                    {canUseCustomArtist ? (
                        <motion.button
                            type="button"
                            whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
                            whileTap={disabled ? undefined : { scale: 0.99 }}
                            onClick={applyCustomArtist}
                            disabled={disabled}
                            className="min-h-9 rounded-[0.8rem] bg-amber/10 px-3 py-2 text-left text-[10px] uppercase tracking-[0.11em] text-text-1 ring-1 ring-amber/20 transition-all duration-300 disabled:opacity-60"
                        >
                            Use {normalizedQuery}
                        </motion.button>
                    ) : null}

                    {filteredArtists.map((artist) => {
                        const active = value === artist.value;

                        return (
                            <motion.button
                                key={artist.value}
                                type="button"
                                whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
                                whileTap={disabled ? undefined : { scale: 0.99 }}
                                onClick={() => selectArtist(artist.value)}
                                disabled={disabled}
                                className={`min-h-9 max-w-[150px] rounded-[0.8rem] px-3 py-2 text-left text-[10px] uppercase tracking-[0.11em] transition-all duration-300 ${
                                    active
                                        ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.22),rgba(244,162,97,0.08))] text-text-1 ring-1 ring-amber/20'
                                        : 'bg-white/[0.03] text-text-3 hover:text-text-1'
                                } disabled:opacity-60`}
                            >
                                <span className="block truncate">{artist.label}</span>
                            </motion.button>
                        );
                    })}
                </div>

                {filteredArtists.length === 0 && !canUseCustomArtist ? (
                    <p className="py-3 text-sm text-text-4">No artists found.</p>
                ) : null}
            </div>
        </div>
    );
}

// Bell-curve heights, organic widths, staggered timing — no two bars move together
const VIZ_BARS = [
    { w: 2.5, h: 22, dur: 820,  delay: 0   },
    { w: 2.5, h: 34, dur: 680,  delay: 70  },
    { w: 3,   h: 46, dur: 940,  delay: 140 },
    { w: 3,   h: 58, dur: 760,  delay: 30  },
    { w: 3.5, h: 66, dur: 610,  delay: 200 },
    { w: 3.5, h: 78, dur: 880,  delay: 300 },
    { w: 3.5, h: 82, dur: 560,  delay: 160 },
    { w: 3,   h: 70, dur: 730,  delay: 240 },
    { w: 3.5, h: 60, dur: 1050, delay: 80  },
    { w: 3,   h: 48, dur: 650,  delay: 180 },
    { w: 2.5, h: 36, dur: 810,  delay: 110 },
    { w: 2.5, h: 24, dur: 720,  delay: 50  },
] as const;

function AudioVisualizer({ active, urgent, hero = false }: { active: boolean; urgent: boolean; hero?: boolean }) {
    const s = hero ? 1.25 : 1;  // hero scale multiplier
    const containerH = hero ? 64 : 56;
    const gap = hero ? 4.5 : 3.5;

    const barGrad = urgent
        ? 'linear-gradient(to top, rgba(251,146,60,0.96), rgba(255,210,140,0.48))'
        : 'linear-gradient(to top, rgba(244,162,97,0.92), rgba(255,255,255,0.42))';

    return (
        <div className="flex items-end" style={{ height: containerH, gap }} aria-hidden>
            {VIZ_BARS.map((bar, i) => (
                <div
                    key={i}
                    style={{
                        width: bar.w * s,
                        height: bar.h * s,
                        borderRadius: 999,
                        transformOrigin: 'bottom',
                        background: barGrad,
                        transition: 'background 0.35s ease',
                        ...(active
                            ? {
                                animation: `${urgent ? 'audioBarUrgent' : 'audioBar'} ${urgent ? Math.round(bar.dur * 0.65) : bar.dur}ms ease-in-out ${bar.delay}ms infinite`,
                              }
                            : {
                                transform: 'scaleY(0.12)',
                                opacity: 0.38,
                              }),
                    }}
                />
            ))}
        </div>
    );
}

function CountUp({ value, duration = 1.4 }: { value: number; duration?: number }) {
    const mv = useMotionValue(0);
    const display = useTransform(mv, (v) => Math.round(v).toLocaleString());
    useEffect(() => {
        const controls = animate(mv, value, { duration, ease: [0.25, 0.46, 0.45, 0.94] });
        return controls.stop;
    }, [mv, value, duration]);
    return <motion.span>{display}</motion.span>;
}

export default function GamePlayer() {
    const {
        question,
        phase,
        startRound,
        submitAnswer,
        result,
        resetRound,
        rateTrack,
        streak,
        bestSessionStreak,
        lastBrokenStreak,
        sessionScore,
        roundsPlayedInSession,
        correctAnswersInSession,
        sessionSummary,
        isSummaryVisible,
        roundLeaderboards,
        isLoading,
        isRating,
        error,
        filters,
        roundFilters,
        artistOptions,
        setGenre,
        setLanguage,
        setDifficulty,
        setArtist,
        startFreshSession,
        prefetchNextQuestion,
        revealSessionSummary,
        dismissSessionSummary,
        fetchRoundLeaderboards,
        fetchArtists,
    } = useGameStore();

    // Clock length follows the active round's difficulty: easy 10s, medium 7s,
    // hard 5s. While setting up we preview the chosen difficulty's clock; once a
    // round is live we honour the difficulty the question was actually built for
    // (roundFilters), so changing the picker mid-round can't shorten the timer.
    const roundSeconds = roundSecondsFor((phase === 'idle' ? filters : roundFilters).difficulty);

    const audioRef = useRef<HTMLAudioElement>(null);
    const roundStartedAtRef = useRef<number | null>(null);
    const heroCardRef = useRef<HTMLDivElement>(null);
    const [timeLeft, setTimeLeft] = useState(roundSeconds);
    const [rating, setRating] = useState<number | null>(null);
    const [clipBlocked, setClipBlocked] = useState(false);
    const [timerActive, setTimerActive] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Hero card — mouse-reactive glow (parallax spotlight effect).
    // Moved a translate-positioned blurred blob instead of animating a CSS radial
    // gradient: transforms are GPU-composited, whereas animating background-image
    // forces a full layer repaint on every mousemove frame.
    const rawMX = useMotionValue(0.5);
    const rawMY = useMotionValue(0.5);
    const sMX = useSpring(rawMX, { stiffness: 90, damping: 24 });
    const sMY = useSpring(rawMY, { stiffness: 90, damping: 24 });
    const glowX = useTransform(sMX, [0, 1], ['-22%', '22%']);
    const glowY = useTransform(sMY, [0, 1], ['-30%', '30%']);

    const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = heroCardRef.current?.getBoundingClientRect();
        if (!rect) return;
        rawMX.set((e.clientX - rect.left) / rect.width);
        rawMY.set((e.clientY - rect.top) / rect.height);
    };

    const handleHeroMouseLeave = () => {
        rawMX.set(0.5);
        rawMY.set(0.5);
    };

    const resetPlaybackState = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setTimeLeft(roundSeconds);
        setClipBlocked(false);
        setTimerActive(false);
        setSelectedOption(null);
        setRating(null);
        roundStartedAtRef.current = null;
    };

    const playClip = async (restart = true) => {
        const audio = audioRef.current;
        if (!audio) return;

        // Starting a clip is a user gesture — unlock the cue AudioContext here.
        unlock();

        if (restart) {
            audio.pause();
            audio.currentTime = 0;
            audio.load();
            setTimeLeft(roundSeconds);
        }

        try {
            await audio.play();
            setClipBlocked(false);
            setTimerActive(true);
            roundStartedAtRef.current = performance.now();
        } catch {
            setClipBlocked(true);
            setTimerActive(false);
        }
    };

    useEffect(() => {
        void fetchArtists();
    }, [fetchArtists]);

    useEffect(() => {
        if (phase === 'idle' && !question) {
            resetPlaybackState();
        }
    }, [phase, question?.songId]);

    useEffect(() => {
        if (phase !== 'playing' || !question) return;

        resetPlaybackState();
        void playClip(true);

        return () => {
            if (audioRef.current) audioRef.current.pause();
            setTimerActive(false);
        };
    }, [phase, question?.songId]);

    useEffect(() => {
        if (phase !== 'playing' || !question || !timerActive) return;

        const tick = window.setInterval(() => {
            setTimeLeft((currentValue) => Math.max(0, currentValue - 1));
        }, 1000);

        const timeout = window.setTimeout(() => {
            if (audioRef.current) audioRef.current.pause();
            setTimerActive(false);
            void submitAnswer('__timeout__', roundSeconds * 1000);
        }, roundSeconds * 1000);

        return () => {
            window.clearInterval(tick);
            window.clearTimeout(timeout);
        };
    }, [phase, question?.songId, submitAnswer, timerActive, roundSeconds]);

    // Single tick on the last second of the round (plus a light haptic tap).
    useEffect(() => {
        if (phase === 'playing' && timerActive && timeLeft === 1) {
            playTick();
            vibrate(20);
        }
    }, [phase, timerActive, timeLeft]);

    // Reveal cue: a rising chime for a correct guess, a dry buzz for a miss.
    useEffect(() => {
        if (phase !== 'result' || !result) return;
        if (result.correct) {
            playCorrect();
            vibrate([15, 40, 30]);
        } else {
            playWrong();
            vibrate(120);
        }
    }, [phase, result]);

    // Small flourish when the end-of-session recap opens.
    useEffect(() => {
        if (isSummaryVisible) playComplete();
    }, [isSummaryVisible]);

    // Guarantee recap appears after the 5th result — backup for any edge-case where
    // the store's isSummaryVisible flag didn't land before this render
    useEffect(() => {
        if (phase !== 'result' || roundsPlayedInSession < ROUND_LIMIT || isSummaryVisible) return;
        const t = window.setTimeout(() => {
            revealSessionSummary();
            void fetchRoundLeaderboards();
        }, 1200);
        return () => window.clearTimeout(t);
    }, [phase, roundsPlayedInSession, isSummaryVisible, revealSessionSummary, fetchRoundLeaderboards]);

    // Warm the next clip while the player reads the result, so "Next" starts instantly.
    useEffect(() => {
        if (phase === 'result' && roundsPlayedInSession < ROUND_LIMIT) {
            void prefetchNextQuestion();
        }
    }, [phase, roundsPlayedInSession, prefetchNextQuestion]);

    const handleSelectOption = (option: string) => {
        if (phase !== 'playing' || selectedOption) return;

        unlock();
        // Punchy double-tap buzz so the choice feels physical (Android only —
        // iOS Safari blocks navigator.vibrate).
        vibrate([30, 25, 30]);
        setSelectedOption(option);
        if (audioRef.current) audioRef.current.pause();
        setTimerActive(false);
        const responseTimeMs = roundStartedAtRef.current
            ? Math.max(0, Math.round(performance.now() - roundStartedAtRef.current))
            : 0;
        void submitAnswer(option, responseTimeMs);
    };

    const handleReveal = () => {
        if (phase !== 'playing') return;
        setTimerActive(false);
        if (audioRef.current) audioRef.current.pause();
        const responseTimeMs = roundStartedAtRef.current
            ? Math.max(0, Math.round(performance.now() - roundStartedAtRef.current))
            : 0;
        void submitAnswer('__skip__', responseTimeMs);
    };

    const handleRate = async (value: number) => {
        setRating(value);
        await rateTrack(value);
    };

    const handleNext = async () => {
        if (roundsPlayedInSession >= ROUND_LIMIT) {
            revealSessionSummary();
            void fetchRoundLeaderboards();
            return;
        }

        resetRound();
        dismissSessionSummary();
        await startRound();
    };

    const handlePlayAgain = () => {
        resetPlaybackState();
        dismissSessionSummary();
        resetRound();
    };

    const handleBackToSetup = () => {
        resetPlaybackState();
        dismissSessionSummary();
        resetRound();
    };

    const resetFilterSession = () => {
        resetPlaybackState();
        if (phase !== 'idle') resetRound();
    };

    const handleGenreChange = (genre: GameGenre) => {
        if (filters.genre === genre) return;
        setGenre(genre);
        resetFilterSession();
    };

    const handleLanguageChange = (language: GameLanguage) => {
        if (filters.language === language) return;
        setLanguage(language);
        resetFilterSession();
    };

    const handleDifficultyChange = (difficulty: GameDifficulty) => {
        if (filters.difficulty === difficulty) return;
        setDifficulty(difficulty);
        resetFilterSession();
    };

    const handleArtistChange = (artist: string) => {
        if (filters.artist === artist) return;
        setArtist(artist);
        resetFilterSession();
    };

    const isResult = phase === 'result' && !!result;
    const isCorrect = !!result?.correct;
    const isUrgent = timerActive && timeLeft <= 2;
    const selectedArtistLabel = filters.artist === 'all'
        ? 'Any artist'
        : (artistOptions.find((artist) => artist.value === filters.artist)?.label ?? filters.artist);
    const recapArtist = result?.correctArtist || (filters.artist === 'all' ? 'your mystery artist' : selectedArtistLabel);
    const activeGenreLabel = filters.genre === 'all' ? 'mixed genre' : titleCase(filters.genre);
    const summary = sessionSummary ?? {
        roundsPlayed: roundsPlayedInSession,
        correctAnswers: correctAnswersInSession,
        accuracy: roundsPlayedInSession > 0 ? Math.round((correctAnswersInSession / roundsPlayedInSession) * 100) : 0,
        totalScore: sessionScore,
        bestStreak: bestSessionStreak,
    };
    const attemptsLeft = Math.max(0, ROUND_LIMIT - roundsPlayedInSession);
    const liveMultiplier = result?.multiplier ?? getLiveMultiplier(streak);

    const topTitle = isResult
        ? isCorrect
            ? 'Locked in.'
            : 'Not quite.'
        : phase === 'answered'
          ? 'Checking your instinct.'
          : phase === 'playing'
            ? 'You either know it or you do not.'
            : 'Five clips. One scorecard.';

    const topBody = isResult
        ? isCorrect
            ? 'Fast answers pay more. Keep the streak alive and move straight into the next round.'
            : lastBrokenStreak
              ? `Streak lost at ${lastBrokenStreak}. Catch the reveal, rate it, then move again.`
              : 'Take the reveal, rate the track, and run it back.'
        : phase === 'answered'
          ? 'Hold for a second while the answer resolves.'
          : phase === 'playing'
            ? 'Five seconds, four options, one instinct.'
            : 'Pick an artist or leave it open, then play a five-clip round.';

    if (phase !== 'idle' || isLoading) {
        return (
            <div className="guess-immersive relative flex h-[100svh] min-h-[100svh] items-center justify-center overflow-hidden px-1.5 py-1.5 sm:px-4 sm:py-4">
                {question ? <audio key={question.songId} ref={audioRef} src={question.snippetUrl} preload="auto" /> : null}

                <div
                    aria-hidden
                    className={`absolute inset-0 transition-colors duration-500 ${
                        isResult
                            ? isCorrect
                                ? 'bg-[radial-gradient(circle_at_50%_26%,rgba(16,185,129,0.20),transparent_38%),linear-gradient(180deg,#07100d_0%,#09090d_100%)]'
                                : 'bg-[radial-gradient(circle_at_50%_26%,rgba(244,63,94,0.20),transparent_38%),linear-gradient(180deg,#12080b_0%,#09090d_100%)]'
                            : 'bg-[radial-gradient(circle_at_50%_22%,rgba(244,162,97,0.16),transparent_40%),linear-gradient(180deg,#111014_0%,#07070a_100%)]'
                    }`}
                />
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.42)_76%)]" />

                <motion.section
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    className="relative grid h-full w-full max-w-[1060px] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 sm:gap-3"
                >
                    <header className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[0.75rem] bg-white/[0.035] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[72px] sm:gap-3 sm:rounded-[0.85rem] sm:px-4">
                        <button
                            type="button"
                            onClick={handleBackToSetup}
                            aria-label="Back to setup"
                            className="flex min-h-10 items-center gap-1 rounded-[0.7rem] border border-white/[0.12] bg-white/[0.06] px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-text-2 transition-colors hover:bg-white/[0.10] hover:text-text-1 sm:min-h-10 sm:px-4 sm:text-xs"
                        >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Back</span>
                        </button>
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <p className="label-xs truncate">Guess Round</p>
                                <span className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.10em] text-text-4 sm:inline">
                                    {selectedArtistLabel}
                                </span>
                                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 sm:text-[11px]">
                                    {Math.min(roundsPlayedInSession + (isResult ? 0 : 1), ROUND_LIMIT)}/{ROUND_LIMIT}
                                </span>
                                <SoundToggle />
                            </div>
                            <div className="mt-1.5 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-white/[0.08] sm:h-2">
                                <motion.div
                                    className={`h-full ${isUrgent ? 'bg-orange-300' : isResult && isCorrect ? 'bg-emerald-300' : isResult ? 'bg-rose-300' : 'bg-amber'}`}
                                    initial={false}
                                    animate={{ width: `${(timeLeft / roundSeconds) * 100}%` }}
                                    transition={{ duration: 0.18, ease: 'linear' }}
                                />
                            </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-2 text-right sm:gap-5">
                            <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-3 sm:text-[0.6875rem] sm:tracking-[0.12em]">Time</p>
                                <p className={`font-heading text-[1.15rem] leading-none sm:text-[2.2rem] ${isUrgent ? 'text-orange-100' : 'text-text-1'}`}>
                                    {phase === 'playing' ? timeLeft : isResult ? formatResponseTime(result?.responseTimeMs) : '--'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-3 sm:text-[0.6875rem] sm:tracking-[0.12em]">Streak</p>
                                <p className="font-heading text-[1.15rem] leading-none text-text-1 sm:text-[1.75rem]">
                                    <AnimatedValue value={streak} />
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-3 sm:text-[0.6875rem] sm:tracking-[0.12em]">Score</p>
                                <p className="font-heading text-[1.15rem] leading-none text-accent sm:text-[1.75rem]">
                                    <AnimatedValue value={sessionScore} />
                                </p>
                            </div>
                        </div>
                    </header>

                    <main className="grid min-h-0 grid-rows-[minmax(74px,0.42fr)_minmax(0,1fr)] gap-1.5 sm:grid-rows-[minmax(128px,0.58fr)_minmax(0,1fr)] sm:gap-3">
                        {/* ── Hero Card ─────────────────────────────────────── */}
                        <motion.div
                            ref={heroCardRef}
                            onMouseMove={handleHeroMouseMove}
                            onMouseLeave={handleHeroMouseLeave}
                            className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[0.9rem] bg-[linear-gradient(158deg,rgba(20,21,28,0.97),rgba(10,10,14,0.99))] sm:rounded-[1.1rem]"
                            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.075), 0 0 0 1px rgba(255,255,255,0.05)' }}
                        >
                            {/* Mouse-reactive amber spotlight — translate-positioned blob.
                                Centered via left/top offsets (not translate) so framer's
                                x/y transform is purely the parallax movement. */}
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute left-[15%] top-[-10%] h-[120%] w-[70%] rounded-full blur-3xl will-change-transform"
                                style={{
                                    x: glowX,
                                    y: glowY,
                                    background: 'radial-gradient(circle, rgba(244,162,97,0.14), transparent 70%)',
                                }}
                            />

                            {/* Breathing ambient glow — pulses with timer */}
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                animate={timerActive
                                    ? { opacity: isUrgent ? [0.55, 1, 0.55] : [0.32, 0.72, 0.32] }
                                    : { opacity: 0.2 }}
                                transition={{ duration: isUrgent ? 0.85 : 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                                style={{
                                    background: isUrgent
                                        ? 'radial-gradient(46% 54% at 50% 92%, rgba(251,146,60,0.22), transparent)'
                                        : 'radial-gradient(46% 54% at 50% 92%, rgba(244,162,97,0.18), transparent)',
                                }}
                            />

                            {/* Result-state tint — overlays whole card */}
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                animate={{ opacity: isResult ? 1 : 0 }}
                                transition={{ duration: 0.5 }}
                                style={{
                                    background: isResult
                                        ? isCorrect
                                            ? 'radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.09), transparent)'
                                            : 'radial-gradient(60% 60% at 50% 0%, rgba(244,63,94,0.09), transparent)'
                                        : 'none',
                                }}
                            />

                            {/* Top shimmer edge */}
                            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
                            {/* Bottom divider */}
                            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/[0.045]" />

                            {/* ── Card content — transitions between phases ── */}
                            <AnimatePresence mode="wait">
                                {isLoading && !question ? (

                                    /* Loading state */
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="relative flex flex-col items-center justify-center gap-2.5 py-3 text-center sm:gap-3.5 sm:py-4"
                                    >
                                        <div className="relative flex flex-col items-center">
                                            <motion.div
                                                aria-hidden
                                                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-8 w-40 rounded-full blur-xl"
                                                animate={{ opacity: [0.25, 0.55, 0.25] }}
                                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                                style={{ background: 'radial-gradient(ellipse, rgba(244,162,97,0.6), transparent 68%)' }}
                                            />
                                            <AudioVisualizer active urgent={false} hero />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="label-xs">Loading</p>
                                            <h2 className="font-heading text-[clamp(1.35rem,5vw,2.9rem)] leading-[0.92] text-text-1 tracking-[-0.02em]">
                                                Finding the next clip
                                            </h2>
                                        </div>
                                    </motion.div>

                                ) : isResult && result?.artworkUrl ? (

                                    /* Result state — album art + answer reveal */
                                    <motion.div
                                        key="result"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                        className="relative grid w-full max-w-[900px] items-center gap-2 px-2 py-2 sm:gap-5 sm:px-4 sm:py-3 grid-cols-[56px_minmax(0,1fr)] text-left sm:grid-cols-[152px_minmax(0,1fr)]"
                                    >
                                        <motion.img
                                            src={result.artworkUrl}
                                            alt=""
                                            initial={{ opacity: 0, scale: 0.88, filter: 'blur(10px)' }}
                                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                                            className={`aspect-square w-full object-cover rounded-[0.65rem] sm:rounded-[0.85rem] shadow-[0_20px_52px_rgba(0,0,0,0.42)] ${
                                                isCorrect ? 'ring-1 ring-emerald-400/30' : 'ring-1 ring-rose-400/22'
                                            }`}
                                        />
                                        <div className="min-w-0 space-y-1 sm:space-y-2">
                                            <p className={`label-xs ${isCorrect ? 'text-emerald-200/85' : 'text-rose-200/85'}`}>
                                                {isCorrect ? 'Correct' : 'Wrong'}
                                            </p>
                                            <h2 className="mx-auto max-w-[680px] line-clamp-2 font-heading text-[clamp(1rem,4.2vw,2.85rem)] leading-[0.96] text-text-1 tracking-[-0.015em]">
                                                {result.correctAnswer}
                                            </h2>
                                            <p className="mx-auto min-h-4 max-w-[620px] line-clamp-1 text-[11px] leading-snug text-text-3 sm:text-sm sm:line-clamp-none sm:min-h-5">
                                                {`${result.correctArtist || 'Unknown artist'}${result.album ? ` · ${result.album}` : ''}`}
                                            </p>
                                        </div>
                                    </motion.div>

                                ) : (

                                    /* Playing / Checking state — centrepiece */
                                    <motion.div
                                        key="playing"
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                                        className="relative flex w-full flex-col items-center justify-center gap-1.5 py-2 text-center sm:gap-2.5 sm:py-3"
                                    >
                                        {/* Visualizer with bloom glow below the bars */}
                                        <div className="relative flex flex-col items-center">
                                            <motion.div
                                                aria-hidden
                                                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-10 w-52 rounded-full blur-2xl"
                                                animate={timerActive
                                                    ? {
                                                        opacity: isUrgent ? [0.45, 0.95, 0.45] : [0.22, 0.6, 0.22],
                                                        scaleX: isUrgent ? [1, 1.2, 1] : [1, 1.12, 1],
                                                      }
                                                    : { opacity: 0.18, scaleX: 1 }}
                                                transition={{ duration: isUrgent ? 0.8 : 2.3, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                                                style={{
                                                    background: isUrgent
                                                        ? 'radial-gradient(ellipse, rgba(251,146,60,0.75), transparent 68%)'
                                                        : 'radial-gradient(ellipse, rgba(244,162,97,0.65), transparent 68%)',
                                                }}
                                            />
                                            <AudioVisualizer active={timerActive && phase === 'playing'} urgent={isUrgent} hero />
                                        </div>

                                        {/* Live status indicator */}
                                        <motion.div
                                            className="flex items-center gap-1.5"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3, delay: 0.06 }}
                                        >
                                            <AnimatePresence>
                                                {(timerActive || phase === 'answered') && (
                                                    <motion.span
                                                        initial={{ scale: 0, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: 0, opacity: 0 }}
                                                        transition={{ duration: 0.18 }}
                                                        className="relative flex h-1.5 w-1.5 shrink-0"
                                                    >
                                                        {/* Ping ring */}
                                                        <motion.span
                                                            className={`absolute inline-flex h-full w-full rounded-full ${
                                                                phase === 'answered' ? 'bg-amber/55'
                                                                : isUrgent ? 'bg-orange-300/55'
                                                                : 'bg-emerald-300/55'
                                                            }`}
                                                            animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                                                            transition={{ duration: phase === 'answered' ? 0.68 : isUrgent ? 0.5 : 1.5, repeat: Infinity, ease: 'easeOut' }}
                                                        />
                                                        {/* Solid dot */}
                                                        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                                                            phase === 'answered' ? 'bg-amber'
                                                            : isUrgent ? 'bg-orange-300'
                                                            : 'bg-emerald-300'
                                                        }`} />
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                            <p className={`label-xs transition-colors duration-200 ${
                                                phase === 'answered' ? 'text-amber/88'
                                                : isUrgent ? 'text-orange-200/80'
                                                : 'text-text-3'
                                            }`}>
                                                {phase === 'answered' ? 'Checking' : 'Listen'}
                                            </p>
                                        </motion.div>

                                        {/* Main heading */}
                                        <motion.h2
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                                            className="mx-auto max-w-[640px] line-clamp-2 font-heading text-[clamp(1.3rem,4vw,2.5rem)] leading-[0.95] text-text-1 tracking-[-0.025em]"
                                        >
                                            What track is this?
                                        </motion.h2>

                                        {/* Subtitle */}
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.55, delay: 0.2 }}
                                            className="text-[11px] tracking-[0.04em] text-text-4 sm:text-[12px]"
                                        >
                                            Five seconds. Four options. One instinct.
                                        </motion.p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        <div className="grid min-h-0 grid-cols-2 gap-1.5 sm:gap-2">
                            {question?.options.map((option, index) => {
                                const isSelected = selectedOption === option;
                                const isCorrectOption = isResult && result?.correctAnswer === option;
                                const isWrongOption = isResult && isSelected && !isCorrectOption;

                                return (
                                    <motion.button
                                        key={`${question.songId}-${option}`}
                                        type="button"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.38, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
                                        whileHover={phase === 'playing' && !selectedOption ? { y: -2, scale: 1.005 } : undefined}
                                        whileTap={phase === 'playing' && !selectedOption ? { scale: 0.99 } : undefined}
                                        onClick={() => handleSelectOption(option)}
                                        disabled={!!selectedOption || phase !== 'playing'}
                                        className={`min-h-[52px] rounded-[0.75rem] px-3 py-2.5 text-left text-text-1 transition-all duration-200 sm:min-h-[78px] sm:rounded-[0.85rem] sm:px-4 ${
                                            isCorrectOption
                                                ? 'bg-emerald-400/18 ring-1 ring-emerald-300/55 shadow-[0_18px_45px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(52,211,153,0.15)]'
                                                : isWrongOption
                                                  ? 'bg-rose-400/18 ring-1 ring-rose-300/55 shadow-[0_18px_45px_rgba(244,63,94,0.14),inset_0_1px_0_rgba(251,113,133,0.15)]'
                                                  : isSelected
                                                    ? 'bg-amber/16 ring-1 ring-amber/30 shadow-[inset_0_1px_0_rgba(244,162,97,0.2)]'
                                                    : 'bg-white/[0.045] ring-1 ring-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.08] hover:ring-white/[0.07] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]'
                                        } disabled:opacity-100`}
                                    >
                                        <span className="line-clamp-2 block text-[clamp(0.95rem,3.6vw,1.25rem)] font-bold leading-tight tracking-[-0.01em]">
                                            {option}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </main>

                    <footer className="min-h-[50px] rounded-[0.75rem] bg-white/[0.04] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[58px] sm:rounded-[0.85rem] sm:px-4">
                        {error ? (
                            <p className="text-sm text-rose-100/90">{error}</p>
                        ) : isLoading && !question ? (
                            <div className="flex h-full items-center justify-between gap-3">
                                <p className="truncate text-sm font-semibold text-text-2">Loading next round...</p>
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full w-1/2 rounded-full bg-amber" />
                                </div>
                            </div>
                        ) : isResult && result ? (
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
                                <div className="min-w-0">
                                    <p className={`text-xs font-semibold sm:text-sm ${isCorrect ? 'text-emerald-100' : 'text-rose-100'}`}>
                                        {isCorrect ? `+${result.pointsAwarded} pts` : 'Missed this one'}
                                    </p>
                                    <p className={`truncate text-[11px] font-semibold sm:text-xs ${
                                        rating ? (rating >= 4 ? 'text-emerald-100' : rating <= 2 ? 'text-rose-100' : 'text-amber-100') : 'text-text-4'
                                    }`}>
                                        {roundsPlayedInSession >= ROUND_LIMIT ? 'Round complete. Your score is landing.' : getRatingMessage(rating)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => void handleRate(value)}
                                            disabled={isRating}
                                            className={`h-7 w-7 rounded-[0.45rem] text-[10px] font-semibold transition-all sm:h-10 sm:w-10 sm:rounded-[0.6rem] sm:text-sm ${getRatingTone(value, rating)} disabled:opacity-70`}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                    {roundsPlayedInSession >= ROUND_LIMIT ? (
                                        <motion.span
                                            animate={{ opacity: [0.55, 1, 0.55] }}
                                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                                            className="ml-1 inline-flex items-center gap-1.5 rounded-[0.6rem] bg-amber/14 px-3 py-1.5 text-[10px] font-semibold text-amber sm:px-5 sm:text-xs"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                                            Recap loading
                                        </motion.span>
                                    ) : (
                                        <motion.button
                                            whileHover={{ scale: 1.02, y: -1 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleNext}
                                            disabled={isLoading}
                                            className="btn-primary ml-1 min-h-8 rounded-[0.6rem] px-2 py-1.5 text-[10px] disabled:opacity-60 sm:min-h-11 sm:px-5 sm:text-xs"
                                        >
                                            {isLoading ? '...' : `Next ${attemptsLeft}`}
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-text-2 sm:text-sm">
                                    {phase === 'answered' ? 'Resolving...' : selectedOption ? 'Locked.' : 'Tap an answer.'}
                                </p>
                                <div className="flex shrink-0 gap-1.5 sm:gap-2">
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => void playClip(true)}
                                        className="btn-secondary min-h-8 rounded-[0.75rem] px-3 py-2 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-11 sm:rounded-[0.85rem] sm:px-4 sm:py-3 sm:text-xs"
                                    >
                                        {clipBlocked ? 'Play' : 'Replay'}
                                    </motion.button>
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleReveal}
                                        className="btn-secondary min-h-8 rounded-[0.75rem] px-3 py-2 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-11 sm:rounded-[0.85rem] sm:px-4 sm:py-3 sm:text-xs"
                                    >
                                        Reveal
                                    </motion.button>
                                </div>
                            </div>
                        )}
                    </footer>
                </motion.section>

                <AnimatePresence>
                    {isSummaryVisible ? (
                        <motion.div
                            className="absolute inset-0 z-20 flex items-center justify-center bg-black/64 px-3 py-4 backdrop-blur-md"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(12px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                                className="relative w-full max-w-[920px] overflow-hidden rounded-[1.25rem] bg-[linear-gradient(145deg,rgba(18,24,22,0.98),rgba(8,8,12,0.98))] p-4 shadow-[0_38px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.08] sm:p-6"
                            >
                                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,162,97,0.18),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(16,185,129,0.16),transparent_32%)]" />
                                <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber/60 to-transparent" />
                                <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
                                    <div className="space-y-5">
                                        <div>
                                            <p className="label-xs text-amber/90">Round Finished</p>
                                            <h2 className="mt-3 font-heading text-[clamp(2.4rem,7vw,5rem)] leading-[0.82] text-text-1">
                                                <CountUp value={summary.totalScore} /> pts
                                            </h2>
                                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-2">
                                                {getFanMessage(recapArtist, summary.accuracy, summary.totalScore)}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                            {[
                                                ['Correct', `${summary.correctAnswers}/${summary.roundsPlayed}`],
                                                ['Accuracy', `${summary.accuracy}%`],
                                                ['Best Streak', String(summary.bestStreak)],
                                            ].map(([label, value], index) => (
                                                <motion.div
                                                    key={label}
                                                    initial={{ opacity: 0, y: 16 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.12 + index * 0.06, duration: 0.42 }}
                                                    className="rounded-[1rem] bg-white/[0.045] px-3 py-4 ring-1 ring-white/[0.05]"
                                                >
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-4">{label}</p>
                                                    <p className="mt-2 font-heading text-[1.6rem] leading-none text-text-1 sm:text-[2rem]">{value}</p>
                                                </motion.div>
                                            ))}
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={handlePlayAgain}
                                                className="btn-primary rounded-[0.85rem] px-5 py-3 text-xs"
                                            >
                                                New Game
                                            </button>
                                            <ShareButton
                                                data={{
                                                    score: summary.totalScore,
                                                    accuracy: summary.accuracy,
                                                    correctAnswers: summary.correctAnswers,
                                                    roundsPlayed: summary.roundsPlayed,
                                                    bestStreak: summary.bestStreak,
                                                    artist: recapArtist,
                                                    message: getFanMessage(recapArtist, summary.accuracy, summary.totalScore),
                                                    difficulty: roundFilters.difficulty,
                                                }}
                                            />
                                            <Link
                                                to="/"
                                                onClick={handleBackToSetup}
                                                className="btn-secondary rounded-[0.85rem] px-5 py-3 text-xs"
                                            >
                                                Back Home
                                            </Link>
                                            <Link to="/leaderboard" className="btn-secondary rounded-[0.85rem] px-5 py-3 text-xs">
                                                See Leaderboard
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <RankCard
                                            label="Today"
                                            board={roundLeaderboards.daily}
                                            fallback="Be the first score today"
                                        />
                                        <RankCard
                                            label={`${recapArtist} Fans`}
                                            board={roundLeaderboards.artist}
                                            fallback="No artist board yet"
                                        />
                                        <RankCard
                                            label={`${activeGenreLabel} Board`}
                                            board={roundLeaderboards.genre}
                                            fallback="Pick a genre for this board"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {question ? <audio key={question.songId} ref={audioRef} src={question.snippetUrl} preload="auto" /> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ArtistPicker
                    artists={artistOptions}
                    value={filters.artist}
                    onChange={handleArtistChange}
                    disabled={isLoading}
                    language={filters.language}
                />
                <FilterRail label="Genre" options={GENRE_OPTIONS} value={filters.genre} onChange={handleGenreChange} disabled={isLoading} />
                <FilterRail label="Language" options={LANGUAGE_OPTIONS} value={filters.language} onChange={handleLanguageChange} disabled={isLoading} />
                <FilterRail label="Difficulty" options={DIFFICULTY_OPTIONS} value={filters.difficulty} onChange={handleDifficultyChange} disabled={isLoading} />
            </div>

            <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    boxShadow: isResult
                        ? isCorrect
                            ? '0 36px 88px rgba(16,185,129,0.16)'
                            : '0 36px 88px rgba(244,63,94,0.14)'
                        : isUrgent
                          ? '0 36px 88px rgba(251,146,60,0.12)'
                          : '0 32px 80px rgba(0,0,0,0.22)',
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(255,255,255,0.012))] p-8"
            >
                <div className="space-y-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-2xl space-y-4">
                            <p className="label-xs">Guess Round</p>
                            <div className="space-y-4">
                                <h2 className="font-heading text-[clamp(2rem,3vw,3.4rem)] leading-[0.9] text-text-1">
                                    {topTitle}
                                </h2>
                                <p className="max-w-xl text-sm leading-relaxed text-text-3">{topBody}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-text-3">
                            <div className="space-y-2">
                                <p className="label-xs">Timer</p>
                                <p className={`font-heading text-[1.8rem] leading-none ${isUrgent ? 'text-orange-100' : 'text-text-1'}`}>
                                    {roundSeconds}s
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="label-xs">Streak</p>
                                <p className="font-heading text-[1.8rem] leading-none text-text-1">
                                    <AnimatedValue value={streak} />
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="label-xs">Best</p>
                                <p className="font-heading text-[1.8rem] leading-none text-text-1">
                                    <AnimatedValue value={bestSessionStreak} />
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="label-xs">Multiplier</p>
                                <p className="font-heading text-[1.8rem] leading-none text-accent">x{liveMultiplier.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                            className={`h-full ${isUrgent ? 'bg-orange-300' : 'bg-amber'}`}
                            initial={false}
                            animate={{ width: `${(timeLeft / roundSeconds) * 100}%` }}
                            transition={{ duration: 0.18, ease: 'linear' }}
                        />
                    </div>

                    {error ? (
                        <div className="rounded-[1rem] bg-rose-300/8 px-4 py-4 text-sm text-rose-100/90">
                            {error}
                        </div>
                    ) : null}

                    {phase === 'idle' ? (
                        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                            <div className="space-y-4">
                                <p className="label-xs">Ready</p>
                                <p className="max-w-xl text-sm leading-relaxed text-text-3">
                                    {filters.artist === 'all' ? 'The pool spans multiple artists.' : `Now pulling from ${selectedArtistLabel}.`}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    void startFreshSession();
                                }}
                                disabled={isLoading}
                                className="btn-primary rounded-[1rem] px-8 py-4 shadow-[0_18px_40px_rgba(244,162,97,0.18)] disabled:opacity-50"
                            >
                                {isLoading ? 'Loading Clip' : 'Play Round'}
                            </motion.button>
                        </div>
                    ) : null}

                    {phase !== 'idle' && !isResult ? (
                        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="label-xs">Choose Fast</p>
                                    <p className="text-sm text-text-4">
                                        {phase === 'playing' ? `${timeLeft}s left` : 'Resolving'}
                                    </p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {question?.options.map((option, index) => {
                                        const isSelected = selectedOption === option;

                                        return (
                                            <motion.button
                                                key={`${question.songId}-${option}`}
                                                type="button"
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.36, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                                                whileHover={phase === 'playing' && !selectedOption ? { y: -2, scale: 1.01 } : undefined}
                                                whileTap={phase === 'playing' && !selectedOption ? { scale: 0.99 } : undefined}
                                                onClick={() => handleSelectOption(option)}
                                                disabled={!!selectedOption || phase !== 'playing'}
                                                className={`min-h-[112px] rounded-[1rem] px-4 py-4 text-left transition-all duration-200 ${
                                                    isSelected
                                                        ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.22),rgba(244,162,97,0.10))] text-text-1 shadow-[inset_0_1px_0_rgba(244,162,97,0.2)] ring-1 ring-amber/20'
                                                        : 'bg-white/[0.03] text-text-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04] hover:text-text-1 hover:bg-white/[0.055] hover:ring-white/[0.07]'
                                                } disabled:opacity-80`}
                                            >
                                                <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-white/40">
                                                    Option {index + 1}
                                                </span>
                                                <span className="block text-[1rem] font-medium leading-snug">{option}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                <AnimatePresence>
                                    {phase === 'answered' ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            className={`rounded-[1rem] px-4 py-4 ${
                                                selectedOption ? 'bg-amber/10' : 'bg-white/[0.03]'
                                            }`}
                                        >
                                            <p className="label-xs">Checking Your Pick</p>
                                            <p className="mt-2 text-sm font-semibold text-text-1">{selectedOption ?? 'No answer locked in'}</p>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-6">
                                <div className="rounded-[1rem] bg-white/[0.03] px-4 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="relative flex h-16 w-16 items-center justify-center">
                                            <motion.span
                                                className={`absolute inset-0 rounded-full ${
                                                    isUrgent ? 'bg-orange-300/18' : 'bg-amber/14'
                                                }`}
                                                animate={timerActive ? { scale: [1, 1.08, 1], opacity: [0.5, 0.85, 0.5] } : { scale: 1, opacity: 0.35 }}
                                                transition={{ duration: 1.4, repeat: timerActive ? Infinity : 0, ease: 'easeInOut' }}
                                            />
                                            <span className="relative h-4 w-4 rounded-full bg-white/90 shadow-[0_0_22px_rgba(255,255,255,0.45)]" />
                                        </div>
                                        <AudioVisualizer active={timerActive} urgent={isUrgent} />
                                    </div>
                                </div>

                                <div className="space-y-4 text-sm text-text-3">
                                    <div className="space-y-2">
                                        <p className="label-xs">Score</p>
                                        <p className="font-heading text-[1.8rem] leading-none text-text-1">
                                            <AnimatedValue value={sessionScore} />
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="label-xs">Speed Bonus</p>
                                        <p className="font-heading text-[1.5rem] leading-none text-text-1">+60</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            void playClip(true);
                                        }}
                                        className="btn-primary rounded-[1rem] px-6 py-4"
                                    >
                                        {clipBlocked ? 'Play Clip' : 'Replay'}
                                    </motion.button>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.01, y: -1 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleReveal}
                                        className="btn-secondary rounded-[1rem] px-6 py-4"
                                    >
                                        Reveal
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {isResult && result ? (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="space-y-8"
                        >
                            <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
                                <div className="space-y-4">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
                                        animate={{
                                            opacity: 1,
                                            scale: isCorrect ? [1, 1.02, 1] : 1,
                                            filter: 'blur(0px)',
                                            boxShadow: isCorrect
                                                ? '0 26px 70px rgba(16,185,129,0.22)'
                                                : '0 26px 70px rgba(244,63,94,0.18)',
                                        }}
                                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                        className={`overflow-hidden rounded-[1rem] ${
                                            isCorrect ? 'ring-1 ring-emerald-400/30' : 'ring-1 ring-rose-400/24'
                                        }`}
                                    >
                                        {result.artworkUrl ? (
                                            <img src={result.artworkUrl} alt="" width={600} height={600} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                                        ) : (
                                            <div className="aspect-square w-full bg-gradient-to-br from-white/10 to-transparent" />
                                        )}
                                    </motion.div>
                                    <div className="space-y-2 text-sm text-text-3">
                                        <p className="label-xs">{isCorrect ? 'You Got It' : 'Reveal'}</p>
                                        <p>{selectedOption ? `You picked ${selectedOption}.` : 'No answer locked in.'}</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <p className={`label-xs ${isCorrect ? 'text-emerald-200/80' : 'text-rose-200/80'}`}>
                                            {isCorrect ? 'Locked In' : 'Missed It'}
                                        </p>
                                        <div className="space-y-4">
                                            <h3 className="font-heading text-[clamp(2.4rem,5vw,4.25rem)] leading-[0.9] text-text-1">
                                                {result.correctAnswer}
                                            </h3>
                                            <p className="text-base text-text-3">
                                                {result.correctArtist || 'Unknown artist'}
                                                {result.album ? ` · ${result.album}` : ''}
                                            </p>
                                        </div>
                                        <motion.p
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.12, duration: 0.42 }}
                                            className={`text-sm ${isCorrect ? 'text-emerald-200/85' : 'text-rose-200/80'}`}
                                        >
                                            {isCorrect ? 'You got it. Keep the streak alive.' : 'Not quite. Take the reveal and run it back.'}
                                        </motion.p>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-text-3">
                                        <div className="space-y-2">
                                            <p className="label-xs">Time</p>
                                            <p className="font-heading text-[1.4rem] leading-none text-text-1">
                                                {formatResponseTime(result.responseTimeMs)}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="label-xs">Points</p>
                                            <p className="font-heading text-[1.4rem] leading-none text-text-1">
                                                +{result.pointsAwarded}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="label-xs">Speed</p>
                                            <p className="font-heading text-[1.4rem] leading-none text-text-1">
                                                +{result.speedBonus}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="label-xs">Multiplier</p>
                                            <p className="font-heading text-[1.4rem] leading-none text-accent">
                                                x{result.multiplier.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="label-xs">Rate the Track</p>
                                        <div className="flex items-center gap-2">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <motion.button
                                                    key={value}
                                                    whileHover={{ scale: 1.03, y: -1 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleRate(value)}
                                                    disabled={isRating}
                                                    className={`h-12 w-12 rounded-[1rem] text-sm font-semibold transition-all ${
                                                        rating && value <= rating
                                                            ? 'bg-amber text-ch-0'
                                                            : 'bg-white/[0.03] text-text-3 hover:text-text-1'
                                                    }`}
                                                >
                                                    {value}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 pt-2">
                                        <motion.button
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleNext}
                                            className="btn-primary rounded-[1rem] px-8 py-4 text-sm font-semibold"
                                        >
                                            Next Clip
                                        </motion.button>
                                        {result.trackUrl ? (
                                            <a
                                                href={result.trackUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary rounded-[1rem] px-6 py-4 text-sm font-semibold"
                                            >
                                                Open Track
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </div>
            </motion.section>

        </div>
    );
}

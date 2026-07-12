import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useGameStore, HINT_POINT_PENALTY } from '../../stores/gameStore';
import { gameService } from '../../services/gameService';
import { aiService } from '../../services/aiService';
import { roundSecondsFor } from '../../config/gameConfig';
import ShareButton from './ShareButton';
import SoundToggle from './SoundToggle';
import { unlock, playTick, playCorrect, playWrong, playComplete, vibrate } from '../../services/sound';
import type { GameArtistOption, GameDifficulty, GameGenre, GameLanguage, LeaderboardData } from '../../types/game';

const ROUND_LIMIT = 5;

// Each press of the Hint button walks the server's guessesUsed specificity
// ladder (see POST /ai/hint: 1-2 vague, 3-4 genre/era, 5+ near-giveaway), so
// three presses cover the whole range: atmospheric → concrete → almost-there.
// Every press costs points — the count feeds submitAnswer, where the score
// penalty is applied (mirrored client/server, see gameStore's HINT_POINT_PENALTY).
const HINT_LADDER = [1, 3, 5];
const MAX_HINTS = HINT_LADDER.length;
// Player-facing names for the ladder rungs — the hint card frames each buy as
// progressively hotter intel rather than three identical "hints".
const HINT_LEVELS = ['Whisper', 'Lead', 'Giveaway'];

// Glyph pool for the hint decode effect. Mostly block/box characters so the
// scramble reads as "signal resolving", not random punctuation soup.
const DECODE_GLYPHS = '▙▚▜▞█▓▒░◆◇/\\<>+=*#';

// Scramble-reveal: unresolved characters churn through glyphs while the real
// text locks in left-to-right, like intel decrypting. Perf-lite users (touch /
// reduced motion) get the plain text immediately — the interval never starts.
function DecodeText({ text, lite }: { text: string; lite: boolean }) {
    const [display, setDisplay] = useState(() => (lite ? text : ''));

    useEffect(() => {
        if (lite) {
            setDisplay(text);
            return;
        }
        let frame = 0;
        // ~30ms cadence, resolving a couple of characters per frame; short
        // hints decode fast, long ones still land well under a second.
        const totalFrames = Math.min(26, 8 + Math.ceil(text.length / 3));
        const iv = window.setInterval(() => {
            frame += 1;
            if (frame >= totalFrames) {
                setDisplay(text);
                window.clearInterval(iv);
                return;
            }
            const resolved = Math.floor((frame / totalFrames) * text.length);
            let out = text.slice(0, resolved);
            for (let i = resolved; i < text.length; i += 1) {
                out += text[i] === ' ' ? ' ' : DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)];
            }
            setDisplay(out);
        }, 30);
        return () => window.clearInterval(iv);
    }, [text, lite]);

    return <>{display}</>;
}

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

// True on phones/tablets (coarse pointer) or when the user asks for reduced
// motion. We use it to strip the expensive always-on blur + infinite-animation
// layers that choke mobile GPUs and make the round feel laggy. Desktop (fine
// pointer, motion allowed) keeps the full treatment.
function usePerfLite() {
    const [lite, setLite] = useState(false);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const queries = [
            window.matchMedia('(pointer: coarse)'),
            window.matchMedia('(prefers-reduced-motion: reduce)'),
        ];
        const update = () => setLite(queries.some((query) => query.matches));
        update();
        queries.forEach((query) => query.addEventListener('change', update));
        return () => queries.forEach((query) => query.removeEventListener('change', update));
    }, []);

    return lite;
}

function formatResponseTime(value?: number) {
    if (!value || value <= 0) return '--';
    return `${(value / 1000).toFixed(2)}s`;
}

function getLiveMultiplier(streak: number) {
    return Math.min(1 + Math.floor(streak / 3) * 0.25, 2);
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
    locked = false,
    onLockedTap,
}: {
    label: string;
    options: Array<{ label: string; value: T }>;
    value: T;
    onChange: (next: T) => void;
    disabled: boolean;
    // When locked, the rail is shown but inert: tapping any chip fires onLockedTap
    // (toast + haptic) instead of changing the value. Used when an artist is set,
    // which overrides genre/language on the server anyway.
    locked?: boolean;
    onLockedTap?: () => void;
}) {
    const selectedOption = options.find((option) => option.value === value);
    const interactive = !disabled && !locked;

    return (
        <div className={`min-h-0 rounded-[1.1rem] bg-white/[0.025] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] lg:min-h-[200px] transition-opacity duration-300 ${locked ? 'opacity-55' : ''}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="label-xs">{label}</p>
                    <p className="mt-2 truncate text-sm font-semibold text-text-1">{selectedOption?.label ?? label}</p>
                </div>
                {locked ? (
                    <span className="flex items-center gap-1 rounded-full bg-white/[0.035] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-text-4">
                        <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5" aria-hidden>
                            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2.2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        Locked
                    </span>
                ) : (
                    <span className="rounded-full bg-white/[0.035] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-text-4">
                        Select
                    </span>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const active = option.value === value;

                    return (
                        <motion.button
                            key={option.value}
                            type="button"
                            whileHover={interactive ? { y: -3, scale: 1.03 } : undefined}
                            whileTap={interactive ? { scale: 0.98 } : undefined}
                            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                            onClick={() => {
                                if (locked) {
                                    onLockedTap?.();
                                    return;
                                }
                                onChange(option.value);
                            }}
                            disabled={disabled}
                            aria-disabled={locked}
                            className={`relative min-h-10 rounded-[0.85rem] px-4 py-2 text-[11px] uppercase tracking-[0.12em] transition-[color,background-color,box-shadow] duration-300 ${
                                active
                                    ? 'font-semibold text-text-1'
                                    : 'bg-white/[0.035] text-text-3 hover:bg-white/[0.07] hover:text-text-1 hover:ring-1 hover:ring-white/10 hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)]'
                            } disabled:opacity-60 ${locked ? 'cursor-not-allowed' : ''}`}
                        >
                            {/* Shared-layout highlight: one pill per rail, matched by
                                layoutId, so selecting a chip glides the amber fill over
                                from the previous chip. Sized slightly beyond the chip
                                (-inset) with an amber bloom so the selection reads bigger. */}
                            {active ? (
                                <motion.span
                                    layoutId={`rail-active-${label}`}
                                    aria-hidden
                                    className="absolute -inset-0.5 rounded-[0.95rem] bg-[linear-gradient(180deg,rgba(244,162,97,0.28),rgba(244,162,97,0.11))] ring-1 ring-amber/30 shadow-[0_0_20px_rgba(244,162,97,0.22)]"
                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                />
                            ) : null}
                            <span className="relative z-[1]">{option.label}</span>
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
    const [isSearching, setIsSearching] = useState(false);
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
            setIsSearching(false);
            return;
        }

        let active = true;
        setIsSearching(true);
        const timeout = window.setTimeout(async () => {
            try {
                const response = await gameService.searchArtists(normalizedQuery, language);
                if (!active) return;
                setLiveArtists(Array.isArray(response.data?.data) ? response.data.data : []);
            } catch {
                if (!active) return;
                setLiveArtists([]);
            } finally {
                if (active) setIsSearching(false);
            }
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [language, normalizedQuery]);

    return (
        <div className="min-h-0 rounded-[1.1rem] bg-white/[0.025] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] lg:min-h-[200px]">
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

            {/* This search is the first real interaction, so it's given weight: a
                leading icon, a brighter resting border, and an amber inset-glow that
                blooms on focus (the `peer` drives the icon's colour shift too). */}
            <div className="group relative">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-4 transition-colors duration-300 peer-focus:text-amber group-focus-within:text-amber"
                >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        applyCustomArtist();
                    }}
                    placeholder="Search any artist — Don Toliver, Ed Sheeran…"
                    disabled={disabled}
                    className="peer h-11 w-full rounded-[0.85rem] bg-black/20 pl-9 pr-9 text-sm text-text-1 outline-none ring-1 ring-white/[0.10] transition-all duration-300 placeholder:text-text-4 focus:bg-black/25 focus:ring-amber/45 focus:shadow-[inset_0_0_0_1px_rgba(244,162,97,0.35),0_0_22px_rgba(244,162,97,0.14)]"
                />
                {isSearching ? (
                    <span
                        aria-hidden
                        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/15 border-t-amber"
                    />
                ) : null}
            </div>

            {/* Type-anyone CTA: plays the exact text the player typed, even when the
                live lookup returns nothing — so any artist is reachable, not just presets. */}
            {canUseCustomArtist ? (
                <motion.button
                    type="button"
                    whileHover={disabled ? undefined : { y: -1, scale: 1.005 }}
                    whileTap={disabled ? undefined : { scale: 0.99 }}
                    onClick={applyCustomArtist}
                    disabled={disabled}
                    className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-2 rounded-[0.85rem] bg-[linear-gradient(180deg,rgba(244,162,97,0.26),rgba(244,162,97,0.1))] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-1 ring-1 ring-amber/25 transition-all duration-300 disabled:opacity-60"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="truncate">Play “{normalizedQuery}”</span>
                </motion.button>
            ) : null}

            <div className="scrollbar-cinematic mt-3 max-h-[110px] overflow-y-auto pr-2">
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

                {isSearching && filteredArtists.length === 0 ? (
                    <p className="py-3 text-sm text-text-4">Searching…</p>
                ) : normalizedQuery && filteredArtists.length === 0 && !canUseCustomArtist ? (
                    <p className="py-3 text-sm text-text-4">No matches — keep typing to search any artist.</p>
                ) : null}
            </div>

            {!normalizedQuery ? (
                <p className="mt-2 text-[10px] leading-snug text-text-4">
                    Type any artist and press Enter to play their songs.
                </p>
            ) : null}
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

    // One bar. Shared between the real row (grows up from its base) and the
    // reflection (grows down from the top), so both ride the same keyframes and
    // stay perfectly in phase — the reflection genuinely mirrors the music.
    const renderBar = (bar: (typeof VIZ_BARS)[number], i: number, heightScale: number, origin: 'top' | 'bottom') => (
        <div
            key={i}
            style={{
                width: bar.w * s,
                height: bar.h * s * heightScale,
                borderRadius: 999,
                transformOrigin: origin,
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
    );

    return (
        <div className="flex flex-col items-center" aria-hidden>
            <div className="flex items-end" style={{ height: containerH, gap }}>
                {VIZ_BARS.map((bar, i) => renderBar(bar, i, 1, 'bottom'))}
            </div>
            {/* Reflection — a dim, downward-fading echo of the bars for an
                equalizer-on-glass sheen. Strongest at the waterline, gone by the bottom. */}
            <div
                className="pointer-events-none flex items-start"
                style={{
                    height: containerH * 0.42,
                    gap,
                    marginTop: 2,
                    opacity: 0.16,
                    maskImage: 'linear-gradient(to bottom, #000, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
                }}
            >
                {VIZ_BARS.map((bar, i) => renderBar(bar, i, 0.42, 'top'))}
            </div>
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
        prefetchedQuestion,
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
        clearSession,
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

    // On phones we run a lighter render: no mouse spotlight, frozen ambient
    // glows, no backdrop blur, and a snappier reveal. Desktop keeps everything.
    const lite = usePerfLite();

    const audioRef = useRef<HTMLAudioElement>(null);
    // Off-screen element that buffers the *next* clip's bytes during the result
    // screen, so hitting "Next" starts playback instantly instead of waiting on
    // a fresh CDN download.
    const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
    const roundStartedAtRef = useRef<number | null>(null);
    const heroCardRef = useRef<HTMLDivElement>(null);
    // timeLeft is tracked in a ref so per-second ticks never trigger a React
    // re-render of the entire GamePlayer tree. The timer text elements are
    // updated via direct DOM mutation; isUrgent is a one-shot setState.
    const timeLeftRef = useRef(roundSeconds);
    const headerTimerRef = useRef<HTMLSpanElement>(null);
    // The draining bright overlay copy of the header countdown digit; kept in sync
    // with headerTimerRef on every tick so the number reads correctly under the fill.
    const headerTimerFillRef = useRef<HTMLSpanElement>(null);
    const sidebarTimerRef = useRef<HTMLSpanElement>(null);
    // Filters collapse into a compact "Customize" panel on phones so Play isn't
    // buried under four tall cards. Always expanded on desktop (lg+).
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [rating, setRating] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<number | null>(null);
    const [clipBlocked, setClipBlocked] = useState(false);
    const [timerActive, setTimerActive] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    // AI hints for the current round. hintsUsedRef mirrors hints.length for the
    // submit paths (including the timeout effect, which must not re-run — and
    // reset its clock — when a hint arrives mid-round).
    const [hints, setHints] = useState<string[]>([]);
    const [hintLoading, setHintLoading] = useState(false);
    const hintsUsedRef = useRef(0);
    // Auto-advance countdown shown on the result screen: 3 → 2 → 1, then the
    // next clip loads on its own so the session keeps its rhythm. null = off.
    const [autoNextIn, setAutoNextIn] = useState<number | null>(null);

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

    // ── "The room listens" ──────────────────────────────────────────────
    // The signature moment: while a clip plays, an amber pulse swells through the
    // whole round in time with a beat. The clip audio is cross-origin (iTunes
    // previews) so it can't be analysed for real amplitude; instead a synthetic
    // envelope at ~118 BPM — sharp attack, quick decay, plus a softer off-beat —
    // drives a motion value the backdrop and hero card read from. Skipped on
    // reduced-motion/low-power (lite) since it's a per-frame animation.
    const beat = useMotionValue(0);
    const beatBgOpacity = useTransform(beat, [0, 1], [0, 0.9]);
    const beatBgScale = useTransform(beat, [0, 1], [1, 1.06]);
    const beatCardScale = useTransform(beat, [0, 1], [1, 1.012]);
    const beatGlowOpacity = useTransform(beat, [0, 1], [0.34, 0.95]);

    useEffect(() => {
        if (lite || phase !== 'playing' || !timerActive) {
            beat.set(0);
            return;
        }
        let raf = 0;
        const startedAt = performance.now();
        const interval = 60 / 118; // seconds per beat
        const loop = (now: number) => {
            const t = (now - startedAt) / 1000;
            const kick = Math.pow(1 - (t % interval) / interval, 2.4);
            const off = Math.pow(1 - ((t + interval / 2) % interval) / interval, 3) * 0.35;
            beat.set(Math.min(1, kick + off));
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            beat.set(0);
        };
    }, [lite, phase, timerActive, beat]);

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
        timeLeftRef.current = roundSeconds;
        setIsUrgent(false);
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
            // No audio.load() here: the element preloads on mount (keyed per
            // round) and the next clip is buffered off-screen during the result
            // screen, so the bytes are already warm. Calling load() would abort
            // that buffer and re-fetch, which is exactly what made clips start
            // slowly on mobile. Just rewind and play off the warm buffer.
            try { audio.currentTime = 0; } catch { /* metadata not ready yet — play() still starts from 0 */ }
            timeLeftRef.current = roundSeconds;
            setIsUrgent(false);
            if (headerTimerRef.current) headerTimerRef.current.textContent = String(roundSeconds);
            if (headerTimerFillRef.current) headerTimerFillRef.current.textContent = String(roundSeconds);
            if (sidebarTimerRef.current) sidebarTimerRef.current.textContent = String(roundSeconds);
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
        // resetPlaybackState/playClip are plain functions redefined every render;
        // depending on question?.songId (not question or the functions) is what
        // keeps this from re-firing on every re-render during playback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, question?.songId]);

    useEffect(() => {
        if (phase !== 'playing' || !question) return;

        // Fresh round, fresh hint budget.
        setHints([]);
        setHintLoading(false);
        hintsUsedRef.current = 0;

        resetPlaybackState();
        void playClip(true);

        const audio = audioRef.current;
        return () => {
            if (audio) audio.pause();
            setTimerActive(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, question?.songId]);

    useEffect(() => {
        if (phase !== 'playing' || !question || !timerActive) return;

        timeLeftRef.current = roundSeconds;

        const tick = window.setInterval(() => {
            const t = Math.max(0, timeLeftRef.current - 1);
            timeLeftRef.current = t;
            // Direct DOM mutation — no React re-render per tick.
            if (headerTimerRef.current) headerTimerRef.current.textContent = String(t);
            if (headerTimerFillRef.current) headerTimerFillRef.current.textContent = String(t);
            if (sidebarTimerRef.current) sidebarTimerRef.current.textContent = String(t);
            if (t === 1) { playTick(); vibrate(20); }
        }, 1000);

        // One-shot: flip isUrgent state exactly once at the 2-second mark.
        // The heartbeat buzz makes the deadline physical before the eyes
        // register the color shift.
        const urgentMs = Math.max(0, (roundSeconds - 2) * 1000);
        const urgentTimeout = urgentMs > 0
            ? window.setTimeout(() => {
                setIsUrgent(true);
                vibrate([24, 42, 24]);
            }, urgentMs)
            : null;

        const timeout = window.setTimeout(() => {
            if (audioRef.current) audioRef.current.pause();
            setTimerActive(false);
            void submitAnswer('__timeout__', roundSeconds * 1000, hintsUsedRef.current);
        }, roundSeconds * 1000);

        return () => {
            window.clearInterval(tick);
            if (urgentTimeout !== null) window.clearTimeout(urgentTimeout);
            window.clearTimeout(timeout);
        };
        // Keyed on question?.songId rather than question itself, matching the
        // other playback effects above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, question?.songId, submitAnswer, timerActive, roundSeconds]);

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

    // Warm the *first* clip while the player is still on the setup screen, so
    // "Play Round" starts instantly instead of waiting on a cold external fetch —
    // the one round that previously had no prefetch. Debounced so rapid filter
    // tweaks don't fire a burst of lookups; filter changes null the warmed
    // question (in the store), so this re-warms with the latest filters.
    useEffect(() => {
        if (phase !== 'idle' || isLoading || question || prefetchedQuestion) return;
        const t = window.setTimeout(() => {
            void prefetchNextQuestion();
        }, 550);
        return () => window.clearTimeout(t);
    }, [phase, isLoading, question, prefetchedQuestion, filters, prefetchNextQuestion]);

    // Preload the result artwork while the clip is playing so the reveal is
    // instant — the URL is embedded in the question batch and known ahead of time.
    useEffect(() => {
        const url = question?.reveal?.artworkUrl;
        if (phase !== 'playing' || !url) return;
        const img = new Image();
        img.src = url;
    }, [phase, question?.reveal?.artworkUrl]);

    // Once the next question is warmed, buffer its audio bytes off-screen so the
    // upcoming round's <audio> hits the browser cache and plays without a download
    // stall. Best-effort: errors are ignored and playback still works on miss.
    useEffect(() => {
        const nextUrl = prefetchedQuestion?.snippetUrl;
        // Buffer during the result screen (rounds 2-5) and on the setup screen
        // (round 1) — both are moments where the next clip is warmed ahead of play.
        if ((phase !== 'result' && phase !== 'idle') || !nextUrl) return;

        const preloader = new Audio();
        preloader.preload = 'auto';
        preloader.src = nextUrl;
        preloader.load();
        preloadAudioRef.current = preloader;

        return () => {
            preloader.src = '';
            preloadAudioRef.current = null;
        };
    }, [phase, prefetchedQuestion?.snippetUrl]);

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
        void submitAnswer(option, responseTimeMs, hintsUsedRef.current);
    };

    const handleReveal = () => {
        if (phase !== 'playing') return;
        // "Fold" haptic — softer than the answer-lock buzz since it's a concession.
        vibrate([10, 22, 10]);
        setTimerActive(false);
        if (audioRef.current) audioRef.current.pause();
        const responseTimeMs = roundStartedAtRef.current
            ? Math.max(0, Math.round(performance.now() - roundStartedAtRef.current))
            : 0;
        void submitAnswer('__skip__', responseTimeMs, hintsUsedRef.current);
    };

    const handleHint = async () => {
        if (phase !== 'playing' || !question || hintLoading || hints.length >= MAX_HINTS) return;

        // Light tap acknowledging the press, distinct from the arrival buzz below.
        vibrate(10);
        setHintLoading(true);
        try {
            const res = await aiService.getHint(question.songId, HINT_LADDER[hints.length]);
            const hint: unknown = res.data?.data?.hint;
            if (typeof hint !== 'string' || !hint) throw new Error('Empty hint');
            setHints((current) => [...current, hint]);
            // Only a delivered hint costs points — a failed request stays free.
            hintsUsedRef.current += 1;
            // "Incoming intel" double-pulse as the decode animation kicks off.
            vibrate([12, 30, 12]);
        } catch {
            showToast('Hints are offline right now.');
        } finally {
            setHintLoading(false);
        }
    };

    const handleRate = async (value: number) => {
        // A 5-star gets a tiny celebratory triple; everything else a single tick.
        vibrate(value === 5 ? [14, 26, 18] : 12);
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
        vibrate(12);
        resetPlaybackState();
        dismissSessionSummary();
        clearSession();
        resetRound();
    };

    const handleBackToSetup = () => {
        vibrate(12);
        resetPlaybackState();
        dismissSessionSummary();
        clearSession();
        resetRound();
    };

    // Auto-advance: once a result is on screen (and it isn't the final round),
    // count 3 → 2 → 1 with a haptic tick each second, then load the next clip so
    // the session keeps its rhythm. Tapping "Next" advances immediately; leaving
    // the result screen (or reaching the last round) clears the countdown.
    useEffect(() => {
        if (phase !== 'result' || !result || roundsPlayedInSession >= ROUND_LIMIT) {
            setAutoNextIn(null);
            return;
        }

        setAutoNextIn(3);
        vibrate(12);

        // Track the countdown in a closure and only pass plain values to setState.
        // Side effects (haptics, advancing the round) run here in the interval body,
        // never inside a setState updater — an updater that calls store setters fires
        // "cannot update a component while rendering" because updaters must be pure.
        let n = 3;
        const iv = window.setInterval(() => {
            n -= 1;
            if (n <= 0) {
                window.clearInterval(iv);
                setAutoNextIn(null);
                vibrate([22, 30, 44]);
                void handleNext();
                return;
            }
            setAutoNextIn(n);
            vibrate(12);
        }, 1000);

        return () => window.clearInterval(iv);
        // Keyed on the round + phase; handleNext reads live store state on call.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, result, roundsPlayedInSession]);

    const resetFilterSession = () => {
        resetPlaybackState();
        if (phase !== 'idle') resetRound();
    };

    // Every filter change lands with the same light tick — enough to feel the
    // selection register without competing with the gameplay haptics.
    const handleGenreChange = (genre: GameGenre) => {
        if (filters.genre === genre) return;
        vibrate(8);
        setGenre(genre);
        resetFilterSession();
    };

    const handleLanguageChange = (language: GameLanguage) => {
        if (filters.language === language) return;
        vibrate(8);
        setLanguage(language);
        resetFilterSession();
    };

    const handleDifficultyChange = (difficulty: GameDifficulty) => {
        if (filters.difficulty === difficulty) return;
        vibrate(8);
        setDifficulty(difficulty);
        resetFilterSession();
    };

    const handleArtistChange = (artist: string) => {
        if (filters.artist === artist) return;
        vibrate(8);
        setArtist(artist);
        resetFilterSession();
    };

    // Floating toast with a short "nope" haptic. Used when a player taps a filter
    // that's locked because an artist is already set.
    const showToast = (message: string) => {
        setToast(message);
        vibrate([18, 36, 18]);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2400);
    };

    useEffect(() => () => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
    }, []);

    // Picking a specific artist overrides genre + language on the server, so we
    // lock both rails and explain why on tap rather than letting them silently
    // do nothing.
    const artistLocksFilters = filters.artist !== 'all';
    const handleLockedFilterTap = () => {
        showToast('Artist is set — clear it to pick a genre or language.');
    };

    const isResult = phase === 'result' && !!result;
    const isCorrect = !!result?.correct;
    const selectedArtistLabel = filters.artist === 'all'
        ? 'Any artist'
        : (artistOptions.find((artist) => artist.value === filters.artist)?.label ?? filters.artist);
    const recapArtist = result?.correctArtist || (filters.artist === 'all' ? 'your mystery artist' : selectedArtistLabel);
    const activeGenreLabel = filters.genre === 'all' ? 'mixed genre' : titleCase(filters.genre);
    // When an artist is set, genre/language are ignored by the server, so leave
    // them out of the summary to keep it honest (reads "Artist · Difficulty").
    const filtersSummary = [
        selectedArtistLabel,
        filters.artist === 'all' ? GENRE_OPTIONS.find((o) => o.value === filters.genre)?.label ?? 'All' : null,
        filters.artist === 'all' ? LANGUAGE_OPTIONS.find((o) => o.value === filters.language)?.label ?? 'Any' : null,
        DIFFICULTY_OPTIONS.find((o) => o.value === filters.difficulty)?.label ?? '',
    ].filter(Boolean).join(' · ');
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

                {/* Beat swell — the whole room brightens on the pulse while a clip
                    plays. Mounted only during 'playing' so it never touches the
                    result/idle states, and only when motion is allowed. */}
                {phase === 'playing' && !lite ? (
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            opacity: beatBgOpacity,
                            scale: beatBgScale,
                            background: isUrgent
                                ? 'radial-gradient(52% 46% at 50% 40%, rgba(251,146,60,0.22), transparent 68%)'
                                : 'radial-gradient(52% 46% at 50% 40%, rgba(244,162,97,0.18), transparent 68%)',
                        }}
                    />
                ) : null}

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
                                <div
                                    key={`header-timer-${question?.songId}`}
                                    className={`h-full rounded-full ${isUrgent ? 'bg-orange-300' : isResult && isCorrect ? 'bg-emerald-300' : isResult ? 'bg-rose-300' : 'bg-amber'}`}
                                    style={{
                                        animation: `barDrain ${roundSeconds}s linear both`,
                                        animationPlayState: timerActive ? 'running' : 'paused',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-2 text-right sm:gap-5">
                            <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-3 sm:text-[0.6875rem] sm:tracking-[0.12em]">Time</p>
                                <p className={`font-heading text-[1.15rem] leading-none sm:text-[2.2rem] ${isUrgent ? 'text-orange-100' : 'text-text-1'}`}>
                                    {phase === 'playing'
                                        ? (
                                            <span className="relative inline-block">
                                                {/* Dim base digit… */}
                                                <span ref={headerTimerRef} className="opacity-25">{roundSeconds}</span>
                                                {/* …with a bright copy whose fill drains away over the round. */}
                                                <span
                                                    key={`num-fill-${question?.songId}`}
                                                    ref={headerTimerFillRef}
                                                    aria-hidden
                                                    className={`absolute inset-0 ${isUrgent ? 'text-orange-200' : 'text-amber'}`}
                                                    style={{
                                                        animation: `numberDrain ${roundSeconds}s linear both`,
                                                        animationPlayState: timerActive ? 'running' : 'paused',
                                                    }}
                                                >{roundSeconds}</span>
                                            </span>
                                        )
                                        : isResult
                                            ? formatResponseTime(result?.responseTimeMs)
                                            : '--'}
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
                            // scale pumps a hair on each beat so the focal card feels
                            // like it's breathing with the track (1.000 when idle).
                            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.075), 0 0 0 1px rgba(255,255,255,0.05)', scale: beatCardScale }}
                        >
                            {/* Mouse-reactive amber spotlight — translate-positioned blob.
                                Centered via left/top offsets (not translate) so framer's
                                x/y transform is purely the parallax movement. Skipped on
                                mobile: there's no mouse to drive it, and the blur-3xl layer
                                is the heaviest thing on the card. */}
                            {!lite ? (
                                <motion.div
                                    aria-hidden
                                    className="pointer-events-none absolute left-[15%] top-[-10%] h-[120%] w-[70%] rounded-full blur-3xl will-change-transform"
                                    style={{
                                        x: glowX,
                                        y: glowY,
                                        background: 'radial-gradient(circle, rgba(244,162,97,0.14), transparent 70%)',
                                    }}
                                />
                            ) : null}

                            {/* Breathing ambient glow — pulses with timer. On mobile it's
                                held at a static glow (no infinite per-frame repaint). */}
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                animate={lite
                                    ? { opacity: timerActive ? (isUrgent ? 0.7 : 0.5) : 0.2 }
                                    : timerActive
                                        ? { opacity: isUrgent ? [0.55, 1, 0.55] : [0.32, 0.72, 0.32] }
                                        : { opacity: 0.2 }}
                                transition={lite
                                    ? { duration: 0.3 }
                                    : { duration: isUrgent ? 0.85 : 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                                style={{
                                    background: isUrgent
                                        ? 'radial-gradient(46% 54% at 50% 92%, rgba(251,146,60,0.22), transparent)'
                                        : 'radial-gradient(46% 54% at 50% 92%, rgba(244,162,97,0.18), transparent)',
                                }}
                            />

                            {/* Beat throb — the card's amber floor lights up on each
                                pulse, layered over the slow breath above. Playing only. */}
                            {phase === 'playing' && !lite ? (
                                <motion.div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        opacity: beatGlowOpacity,
                                        background: isUrgent
                                            ? 'radial-gradient(50% 60% at 50% 100%, rgba(251,146,60,0.28), transparent 72%)'
                                            : 'radial-gradient(50% 60% at 50% 100%, rgba(244,162,97,0.24), transparent 72%)',
                                    }}
                                />
                            ) : null}

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
                            {/* On mobile, crossfade ('sync') instead of 'wait': 'wait' holds
                                the new state until the old one finishes exiting, which is the
                                ~0.6s "reveal is slow" gap. 'sync' shows the answer immediately. */}
                            <AnimatePresence mode={lite ? 'sync' : 'wait'}>
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
                                                animate={lite ? { opacity: 0.45 } : { opacity: [0.25, 0.55, 0.25] }}
                                                transition={lite ? { duration: 0.3 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
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
                                        <div className="relative">
                                            <motion.img
                                                src={result.artworkUrl}
                                                alt=""
                                                {...({ fetchpriority: 'high' } as Record<string, string>)}
                                                decoding="async"
                                                initial={lite ? { opacity: 0, scale: 0.9 } : { opacity: 0, scale: 0.82, filter: 'blur(10px)' }}
                                                animate={lite ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                                transition={lite ? { duration: 0.22, ease: [0.22, 1, 0.36, 1] } : { type: 'spring', stiffness: 320, damping: 26, mass: 0.6 }}
                                                className={`aspect-square w-full object-cover rounded-[0.65rem] sm:rounded-[0.85rem] shadow-[0_20px_52px_rgba(0,0,0,0.42)] ${
                                                    isCorrect ? 'ring-1 ring-emerald-400/30' : 'ring-1 ring-rose-400/22'
                                                }`}
                                            />
                                            {/* One-shot burst ring that flares out the moment a correct
                                                answer reveals — the little "yes!" punch the reveal was missing. */}
                                            {isCorrect ? (
                                                <motion.span
                                                    aria-hidden
                                                    className="pointer-events-none absolute inset-0 rounded-[0.65rem] ring-2 ring-emerald-300/70 sm:rounded-[0.85rem]"
                                                    initial={{ opacity: 0.7, scale: 1 }}
                                                    animate={{ opacity: 0, scale: 1.35 }}
                                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                                />
                                            ) : null}
                                        </div>
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
                                                animate={lite
                                                    ? { opacity: timerActive ? (isUrgent ? 0.85 : 0.5) : 0.18, scaleX: 1 }
                                                    : timerActive
                                                        ? {
                                                            opacity: isUrgent ? [0.45, 0.95, 0.45] : [0.22, 0.6, 0.22],
                                                            scaleX: isUrgent ? [1, 1.2, 1] : [1, 1.12, 1],
                                                          }
                                                        : { opacity: 0.18, scaleX: 1 }}
                                                transition={lite ? { duration: 0.3 } : { duration: isUrgent ? 0.8 : 2.3, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
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
                                                            animate={lite ? { scale: 1.6, opacity: 0.28 } : { scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                                                            transition={lite ? { duration: 0.3 } : { duration: phase === 'answered' ? 0.68 : isUrgent ? 0.5 : 1.5, repeat: Infinity, ease: 'easeOut' }}
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

                                        {/* Subtitle — becomes the intel card once a hint is bought.
                                            Each hint arrives as "decrypted intel": a glassy amber
                                            panel with a level tag, budget pips, a scanline sweep,
                                            and the text scramble-resolving into place. */}
                                        {hints.length > 0 || hintLoading ? (
                                            <motion.div
                                                key="hint-card"
                                                initial={lite ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                                                animate={lite ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                                                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                                                className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[0.9rem] bg-[linear-gradient(180deg,rgba(244,162,97,0.10),rgba(244,162,97,0.03))] px-3.5 py-2.5 text-left ring-1 ring-amber/25 shadow-[inset_0_1px_0_rgba(244,162,97,0.16),0_10px_28px_rgba(244,162,97,0.07)]"
                                            >
                                                {/* Scanline sweep on every new hint — one pass, then gone. */}
                                                {!lite && (
                                                    <motion.span
                                                        aria-hidden
                                                        key={`sweep-${hints.length}`}
                                                        className="pointer-events-none absolute inset-y-0 w-16 bg-[linear-gradient(90deg,transparent,rgba(244,162,97,0.22),transparent)]"
                                                        initial={{ left: '-18%' }}
                                                        animate={{ left: '112%' }}
                                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber/90">
                                                        <motion.svg
                                                            viewBox="0 0 24 24"
                                                            fill="currentColor"
                                                            className="h-3 w-3"
                                                            aria-hidden
                                                            animate={lite ? undefined : { rotate: [0, 12, -8, 0], scale: [1, 1.18, 1] }}
                                                            transition={lite ? undefined : { duration: 0.7, ease: 'easeOut' }}
                                                        >
                                                            <path d="M12 2l1.9 5.6L20 9.5l-5 3.9 1.6 6L12 15.9 7.4 19.4 9 13.4 4 9.5l6.1-1.9z" />
                                                        </motion.svg>
                                                        {hintLoading
                                                            ? 'Decrypting intel'
                                                            : `Intel 0${hints.length} — ${HINT_LEVELS[hints.length - 1]}`}
                                                    </span>
                                                    {/* Budget pips: lit = spent, dim = still available. */}
                                                    <span className="flex shrink-0 items-center gap-1" aria-label={`${hints.length} of ${MAX_HINTS} hints used`}>
                                                        {HINT_LEVELS.map((level, i) => (
                                                            <span
                                                                key={level}
                                                                className={`h-1 rounded-full transition-all duration-300 ${
                                                                    i < hints.length ? 'w-3.5 bg-amber' : 'w-1.5 bg-amber/25'
                                                                }`}
                                                            />
                                                        ))}
                                                    </span>
                                                </div>
                                                {/* Earlier hints stay readable — stacked small above the latest. */}
                                                {hints.length > 1 && (
                                                    <div className="mt-1.5 space-y-0.5">
                                                        {hints.slice(0, -1).map((hint, i) => (
                                                            <p key={i} className="line-clamp-1 text-[10px] leading-snug text-amber/45 sm:text-[11px]">
                                                                {hint}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {hintLoading && hints.length === 0 ? (
                                                    <div className="mt-1.5 h-2.5 w-3/4 overflow-hidden rounded-full bg-amber/10">
                                                        <motion.span
                                                            className="block h-full w-1/3 rounded-full bg-amber/40"
                                                            animate={{ x: ['-100%', '320%'] }}
                                                            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                                        />
                                                    </div>
                                                ) : hints.length > 0 ? (
                                                    <p className="mt-1 text-[12px] leading-relaxed text-amber-50/95 sm:text-[13px]">
                                                        <DecodeText key={hints.length} text={hints[hints.length - 1]} lite={lite} />
                                                    </p>
                                                ) : null}
                                            </motion.div>
                                        ) : (
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.55, delay: 0.2 }}
                                                className="text-[11px] tracking-[0.04em] text-text-4 sm:text-[12px]"
                                            >
                                                Five seconds. Four options. One instinct.
                                            </motion.p>
                                        )}
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
                                        initial={lite ? { opacity: 0 } : { opacity: 0, y: 10 }}
                                        animate={lite ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                                        whileHover={!lite && phase === 'playing' && !selectedOption ? { y: -2, scale: 1.005 } : undefined}
                                        whileTap={phase === 'playing' && !selectedOption ? { scale: 0.99 } : undefined}
                                        onClick={() => handleSelectOption(option)}
                                        disabled={!!selectedOption || phase !== 'playing'}
                                        className={`flex min-h-[60px] items-center rounded-[1.25rem] px-4 py-3 text-left text-text-1 transition-all duration-200 sm:min-h-[84px] sm:rounded-[1.6rem] sm:px-5 ${
                                            isCorrectOption
                                                ? 'bg-[linear-gradient(180deg,rgba(16,185,129,0.22),rgba(16,185,129,0.08))] ring-1 ring-emerald-300/55 shadow-[0_18px_45px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(52,211,153,0.18)]'
                                                : isWrongOption
                                                  ? 'bg-[linear-gradient(180deg,rgba(244,63,94,0.22),rgba(244,63,94,0.08))] ring-1 ring-rose-300/55 shadow-[0_18px_45px_rgba(244,63,94,0.16),inset_0_1px_0_rgba(251,113,133,0.18)]'
                                                  : isSelected
                                                    ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.2),rgba(244,162,97,0.07))] ring-1 ring-amber/35 shadow-[0_14px_36px_rgba(244,162,97,0.14),inset_0_1px_0_rgba(244,162,97,0.2)]'
                                                    : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.022))] ring-1 ring-white/[0.06] shadow-[0_10px_26px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.035))] hover:ring-white/[0.1] hover:shadow-[0_16px_34px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.12)]'
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
                            <div className="flex h-full flex-col justify-center gap-2">
                                {/* ── Rate section ── points badge + clear prompt, then big star row ── */}
                                <div className="flex items-center justify-between gap-2">
                                    <motion.span
                                        key={isCorrect ? 'pts' : 'missed'}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                            isCorrect ? 'bg-emerald-400/15 text-emerald-100' : 'bg-rose-400/15 text-rose-100'
                                        }`}
                                    >
                                        {isCorrect ? <>+<CountUp value={result.pointsAwarded} duration={0.7} /> pts</> : 'Missed'}
                                    </motion.span>
                                    <span className={`truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                        rating ? (rating >= 4 ? 'text-emerald-200/90' : rating <= 2 ? 'text-rose-200/90' : 'text-amber-200/90') : 'text-text-4'
                                    }`}>
                                        {rating ? getRatingMessage(rating) : 'Rate this track'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-5 gap-1.5">
                                    {[1, 2, 3, 4, 5].map((value) => {
                                        const filled = !!rating && value <= rating;
                                        return (
                                            <motion.button
                                                key={value}
                                                type="button"
                                                whileTap={{ scale: 0.92 }}
                                                onClick={() => void handleRate(value)}
                                                disabled={isRating}
                                                aria-label={`Rate ${value} of 5`}
                                                className={`flex min-h-10 items-center justify-center rounded-[0.6rem] transition-all duration-200 ${
                                                    filled
                                                        ? 'bg-amber/18 ring-1 ring-amber/45'
                                                        : 'bg-white/[0.045] ring-1 ring-white/[0.05] hover:bg-white/[0.08]'
                                                } disabled:opacity-70`}
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 transition-colors ${filled ? 'text-amber' : 'text-text-4'}`} aria-hidden>
                                                    <path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.04 1.1-6.46-4.69-4.58 6.49-.94z" />
                                                </svg>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {/* ── Next section ── single dominant action ── */}
                                {roundsPlayedInSession >= ROUND_LIMIT ? (
                                    <motion.div
                                        animate={{ opacity: [0.55, 1, 0.55] }}
                                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-[0.7rem] bg-amber/14 text-xs font-semibold text-amber"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                                        Tallying your recap…
                                    </motion.div>
                                ) : (
                                    <motion.button
                                        whileTap={{ scale: 0.985 }}
                                        onClick={() => {
                                            vibrate(12);
                                            void handleNext();
                                        }}
                                        disabled={isLoading}
                                        className="btn-primary relative min-h-11 w-full overflow-hidden rounded-[0.7rem] text-sm font-semibold disabled:opacity-60"
                                    >
                                        {/* Countdown progress sweep behind the label. */}
                                        {autoNextIn !== null ? (
                                            <motion.span
                                                aria-hidden
                                                className="absolute inset-y-0 left-0 bg-black/[0.08]"
                                                initial={{ width: '100%' }}
                                                animate={{ width: '0%' }}
                                                transition={{ duration: 3, ease: 'linear' }}
                                            />
                                        ) : null}
                                        <span className="relative flex items-center justify-center gap-2">
                                            {isLoading ? (
                                                'Loading…'
                                            ) : autoNextIn !== null ? (
                                                <>
                                                    Next song in
                                                    <motion.span
                                                        key={autoNextIn}
                                                        initial={{ scale: 0.35, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                                                        className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-black/15 px-1.5 font-bold tabular-nums"
                                                    >
                                                        {autoNextIn}
                                                    </motion.span>
                                                </>
                                            ) : (
                                                `Next clip · ${attemptsLeft} left`
                                            )}
                                        </span>
                                    </motion.button>
                                )}
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
                                        onClick={() => void handleHint()}
                                        disabled={hintLoading || hints.length >= MAX_HINTS}
                                        // Soft breathing glow until the first hint is bought, so the
                                        // button reads as "there's help here" without shouting.
                                        animate={
                                            !lite && phase === 'playing' && hints.length === 0 && !hintLoading
                                                ? { boxShadow: ['0 0 0px rgba(244,162,97,0)', '0 0 18px rgba(244,162,97,0.28)', '0 0 0px rgba(244,162,97,0)'] }
                                                : { boxShadow: '0 0 0px rgba(244,162,97,0)' }
                                        }
                                        transition={{ duration: 2.2, repeat: !lite && phase === 'playing' && hints.length === 0 && !hintLoading ? Infinity : 0, ease: 'easeInOut' }}
                                        className={`flex min-h-8 items-center gap-1.5 rounded-[0.75rem] px-3 py-2 text-[10px] font-semibold transition-colors sm:min-h-11 sm:rounded-[0.85rem] sm:px-4 sm:py-3 sm:text-xs ${
                                            hints.length >= MAX_HINTS
                                                ? 'bg-white/[0.04] text-text-4 ring-1 ring-white/[0.05]'
                                                : 'bg-amber-dim text-amber ring-1 ring-amber/25 shadow-[inset_0_1px_0_rgba(244,162,97,0.15)] hover:bg-amber/[0.16]'
                                        } disabled:opacity-70`}
                                    >
                                        <motion.svg
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
                                            aria-hidden
                                            animate={hintLoading && !lite ? { rotate: 360 } : { rotate: 0 }}
                                            transition={hintLoading && !lite ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                                        >
                                            <path d="M12 2l1.9 5.6L20 9.5l-5 3.9 1.6 6L12 15.9 7.4 19.4 9 13.4 4 9.5l6.1-1.9z" />
                                        </motion.svg>
                                        {hintLoading
                                            ? 'Decrypting…'
                                            : hints.length >= MAX_HINTS
                                                ? 'No intel left'
                                                : `Hint −${HINT_POINT_PENALTY}`}
                                        {/* Remaining-budget pips (hidden once exhausted — the label covers it). */}
                                        {hints.length < MAX_HINTS && !hintLoading ? (
                                            <span className="flex items-center gap-0.5" aria-hidden>
                                                {HINT_LEVELS.map((level, i) => (
                                                    <span
                                                        key={level}
                                                        className={`h-1 w-1 rounded-full ${i < MAX_HINTS - hints.length ? 'bg-amber/80' : 'bg-amber/22'}`}
                                                    />
                                                ))}
                                            </span>
                                        ) : null}
                                    </motion.button>
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => {
                                            vibrate(8);
                                            void playClip(true);
                                        }}
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
                            className={`absolute inset-0 z-20 flex items-center justify-center px-3 py-4 ${lite ? 'bg-black/85' : 'bg-black/64 backdrop-blur-md'}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                initial={lite ? { opacity: 0, y: 20, scale: 0.97 } : { opacity: 0, y: 28, scale: 0.96, filter: 'blur(12px)' }}
                                animate={lite ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                                transition={lite ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] } : { duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
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

            <AnimatePresence>
                {toast ? (
                    <motion.div
                        key="filter-toast"
                        initial={{ opacity: 0, y: -16, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -12, x: '-50%' }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        role="status"
                        aria-live="polite"
                        className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,rgba(28,29,38,0.98),rgba(16,16,22,0.98))] px-4 py-2.5 text-xs font-semibold text-text-1 shadow-[0_18px_46px_rgba(0,0,0,0.5)] ring-1 ring-amber/25"
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-amber" aria-hidden>
                            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2.2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        {toast}
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <div>
                {/* Mobile: one tappable summary row that expands the filters. Hidden on desktop. */}
                <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    aria-expanded={filtersOpen}
                    className="flex w-full items-center gap-3 rounded-[1.1rem] bg-white/[0.04] px-4 py-3.5 text-left ring-1 ring-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-white/[0.055] lg:hidden"
                >
                    <span className="min-w-0 flex-1">
                        <span className="label-xs block">Customize</span>
                        <span className="mt-1 block truncate text-sm text-text-2">{filtersSummary}</span>
                    </span>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`h-4 w-4 shrink-0 text-text-3 transition-transform duration-300 ${filtersOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                    >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {/* <640: single column (cards are short now). 640–1279: artist
                    picker spans full width, the three rails sit 2-up. xl: 4 across. */}
                {/* Artist gets the widest column — picking an artist is the highest-
                    stakes choice, so it carries more visual weight than the three rails. */}
                <div className={`grid-cols-1 gap-3 sm:grid-cols-2 lg:grid xl:grid-cols-[1.6fr_1fr_1fr_1fr] ${filtersOpen ? 'mt-4 grid' : 'hidden'}`}>
                    <div className="sm:col-span-2 xl:col-span-1">
                        <ArtistPicker
                            artists={artistOptions}
                            value={filters.artist}
                            onChange={handleArtistChange}
                            disabled={isLoading}
                            language={filters.language}
                        />
                    </div>
                    <FilterRail label="Genre" options={GENRE_OPTIONS} value={filters.genre} onChange={handleGenreChange} disabled={isLoading} locked={artistLocksFilters} onLockedTap={handleLockedFilterTap} />
                    <FilterRail label="Language" options={LANGUAGE_OPTIONS} value={filters.language} onChange={handleLanguageChange} disabled={isLoading} locked={artistLocksFilters} onLockedTap={handleLockedFilterTap} />
                    <FilterRail label="Difficulty" options={DIFFICULTY_OPTIONS} value={filters.difficulty} onChange={handleDifficultyChange} disabled={isLoading} />
                </div>
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
                className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.014))] p-5 ring-1 ring-white/[0.07] sm:p-8"
            >
                {/* Material depth: a bright top edge catches the light, and a soft
                    amber bloom in the corner gives the flat panel a focal warmth. */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(244,162,97,0.12),transparent_68%)] blur-2xl" />
                <div className="relative space-y-6 sm:space-y-8">
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
                            <div className={`space-y-2 ${phase === 'idle' ? 'hidden sm:block' : ''}`}>
                                <p className="label-xs">Streak</p>
                                <p className="font-heading text-[1.8rem] leading-none text-text-1">
                                    <AnimatedValue value={streak} />
                                </p>
                            </div>
                            <div className={`space-y-2 ${phase === 'idle' ? 'hidden sm:block' : ''}`}>
                                <p className="label-xs">Best</p>
                                <p className="font-heading text-[1.8rem] leading-none text-text-1">
                                    <AnimatedValue value={bestSessionStreak} />
                                </p>
                            </div>
                            <div className={`space-y-2 ${phase === 'idle' ? 'hidden sm:block' : ''}`}>
                                <p className="label-xs">Multiplier</p>
                                <p className="font-heading text-[1.8rem] leading-none text-accent">x{liveMultiplier.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className={`relative h-2 overflow-hidden rounded-full bg-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] ${phase === 'idle' ? 'hidden sm:block' : ''}`}>
                        <div
                            key={`desktop-timer-${question?.songId}`}
                            className={`h-full rounded-full ${
                                isUrgent
                                    ? 'bg-[linear-gradient(90deg,#fb923c,#fed7a1)] shadow-[0_0_14px_rgba(251,146,60,0.6)]'
                                    : 'bg-[linear-gradient(90deg,#F6C56B,#F4A261)] shadow-[0_0_14px_rgba(244,162,97,0.5)]'
                            }`}
                            style={{
                                animation: `barDrain ${roundSeconds}s linear both`,
                                animationPlayState: timerActive ? 'running' : 'paused',
                            }}
                        />
                    </div>

                    {error ? (
                        <div className="rounded-[1rem] bg-rose-300/8 px-4 py-4 text-sm text-rose-100/90">
                            {error}
                        </div>
                    ) : null}

                    {phase === 'idle' ? (
                        <div className="flex flex-col gap-5 sm:gap-8 xl:flex-row xl:items-end xl:justify-between">
                            <div className="hidden space-y-4 sm:block">
                                <p className="label-xs">Ready</p>
                                <p className="max-w-xl text-sm leading-relaxed text-text-3">
                                    {filters.artist === 'all' ? 'The pool spans multiple artists.' : `Now pulling from ${selectedArtistLabel}.`}
                                </p>
                            </div>
                            {/* The primary "where do I click" moment: oversized, amber,
                                with a soft pulsing bloom behind it so it's the obvious
                                next action once the filters are set. */}
                            <div className="relative w-full sm:w-auto">
                                <motion.span
                                    aria-hidden
                                    className="pointer-events-none absolute -inset-2 rounded-[1.6rem] bg-[radial-gradient(circle,rgba(244,162,97,0.4),transparent_70%)] blur-xl"
                                    animate={isLoading ? { opacity: 0.4 } : { opacity: [0.45, 0.85, 0.45] }}
                                    transition={isLoading ? { duration: 0.3 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.03, y: -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => {
                                        // Session kickoff gets a firmer double-tap than in-round taps.
                                        vibrate([14, 28, 14]);
                                        void startFreshSession();
                                    }}
                                    disabled={isLoading}
                                    className="btn-primary relative flex w-full items-center justify-center gap-2.5 rounded-[1.15rem] px-10 py-5 text-[15px] font-bold shadow-[0_22px_55px_rgba(244,162,97,0.34)] disabled:opacity-50 sm:w-auto"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4 shrink-0">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    {isLoading ? 'Loading Clip' : 'Start Session'}
                                </motion.button>
                            </div>
                        </div>
                    ) : null}

                    {phase !== 'idle' && !isResult ? (
                        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="label-xs">Choose Fast</p>
                                    <p className="text-sm text-text-4">
                                        {phase === 'playing'
                                            ? <><span ref={sidebarTimerRef}>{roundSeconds}</span>s left</>
                                            : 'Resolving'}
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
                                        initial={lite ? { opacity: 0, scale: 0.96 } : { opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
                                        animate={lite ? {
                                            opacity: 1,
                                            scale: 1,
                                            boxShadow: isCorrect
                                                ? '0 26px 70px rgba(16,185,129,0.22)'
                                                : '0 26px 70px rgba(244,63,94,0.18)',
                                        } : {
                                            opacity: 1,
                                            scale: isCorrect ? [1, 1.02, 1] : 1,
                                            filter: 'blur(0px)',
                                            boxShadow: isCorrect
                                                ? '0 26px 70px rgba(16,185,129,0.22)'
                                                : '0 26px 70px rgba(244,63,94,0.18)',
                                        }}
                                        transition={lite ? { duration: 0.3, ease: [0.22, 1, 0.36, 1] } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                        className={`overflow-hidden rounded-[1rem] ${
                                            isCorrect ? 'ring-1 ring-emerald-400/30' : 'ring-1 ring-rose-400/24'
                                        }`}
                                    >
                                        {result.artworkUrl ? (
                                            <img src={result.artworkUrl} alt="" width={300} height={300} decoding="async" {...({ fetchpriority: 'high' } as Record<string, string>)} className="aspect-square w-full object-cover" />
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

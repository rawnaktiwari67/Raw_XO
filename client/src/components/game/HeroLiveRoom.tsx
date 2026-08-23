import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { musicService } from '../../services/musicService';
import { todayPuzzleNumber } from '../../services/dailyStore';
import { type Hsl, AMBER_HSL, hsl, extractAccent } from '../../game/coverAccent';
import type { NormalizedMusicItem } from '../../types/culture';

// ── Hero "live room" layer ───────────────────────────────────────────────────
// Design inspiration, with full credit: the "live room" staging here — a frosted
// now-playing capsule over a cinematic backdrop, plus a small ambient HUD (a live
// clock and a communal presence chip) — is an homage to saloon.wtf ("Deluxe
// Saloon") by its creator, whose synced-listening room nails that "you just
// walked into a room that's already playing" feeling. This is a reinterpretation
// built entirely on Raw XO's own tokens, motion, and data (nothing lifted from
// their assets or markup); saloon.wtf is credited here as the spark for it.
//
// Honest signals only: the clock is the viewer's real local time, and the
// presence chip shows today's shared Daily puzzle number — the true "everyone's
// in the same room today" analog to saloon's live listener count (Raw XO has no
// realtime presence, so we don't invent an "N online"). The capsule cycles real
// featured tracks from the catalog and links out to where you can actually hear
// them — framed as "In rotation", never as a spoiler for a round.

// Match HeroCoverWall's tone filter: Desi/Bollywood sleeves clash with the
// cinematic charcoal look the landing is going for, so they're kept out of the
// rotating capsule the same way they're kept out of the ambient wall.
const DESI_GENRE = /(indian|bolly|punjabi|desi|world|hindi)/i;
const DESI_ARTIST = /(arijit|diljit|ap dhillon|dhillon|karan aujla|shubh|badshah|honey singh|sidhu|nucleya|prateek)/i;

const ROTATE_MS = 9000;

// The secondary accent pulled from each sleeve (amber stays the primary brand
// colour) lives in game/coverAccent.ts so its colour maths stay unit-testable.

function formatClock(d: Date): string {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m}${ampm}`;
}

// Name the source from the outbound URL so the "Listen" chip tells the truth
// about where the tap actually lands (Apple Music for the iTunes catalog,
// Spotify when a Spotify link is present).
function sourceLabel(url: string): string {
    if (/spotify/i.test(url)) return 'Spotify';
    if (/music\.apple|itunes/i.test(url)) return 'Apple Music';
    return 'Listen';
}

// The four-bar equaliser reuses the global `audioBar` keyframes (index.css). It's
// pure ambience — the capsule never actually plays audio on the landing — so it's
// the first thing frozen on the perf-lite path.
function Equalizer({ animated, color }: { animated: boolean; color: string }) {
    const bars = [0, 0.32, 0.14, 0.46];
    return (
        <div aria-hidden className="flex h-5 items-end gap-[3px]">
            {bars.map((delay, i) => (
                <span
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                        height: '100%',
                        background: color,
                        transition: 'background 0.6s ease',
                        transformOrigin: 'bottom',
                        transform: animated ? undefined : 'scaleY(0.5)',
                        opacity: animated ? undefined : 0.7,
                        animation: animated ? `audioBar 1.1s ease-in-out ${-delay}s infinite` : undefined,
                    }}
                />
            ))}
        </div>
    );
}

export default function HeroLiveRoom({ username }: { username?: string }) {
    const reduced = useReducedMotion();

    // Coarse pointers (phones/tablets) take the "lite" path for anything that runs
    // forever — no rotation interval, no equaliser, no backdrop blur — matching the
    // per-tier motion budget the rest of the landing uses (see HeroCoverWall).
    const [coarse, setCoarse] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(pointer: coarse)');
        const update = () => setCoarse(mq.matches);
        update();
        mq.addEventListener?.('change', update);
        return () => mq.removeEventListener?.('change', update);
    }, []);
    const lite = reduced || coarse;

    // Real local time, ticked once a minute (aligned to the minute boundary so the
    // display never lags a real clock by up to a minute).
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let timer: number;
        const tick = () => {
            setNow(new Date());
            timer = window.setTimeout(tick, 60000 - (Date.now() % 60000));
        };
        timer = window.setTimeout(tick, 60000 - (Date.now() % 60000));
        return () => window.clearTimeout(timer);
    }, []);

    // Featured tracks for the capsule. Pulls from the memoized catalog (already
    // warmed by the game grid / hero wall, so this adds no real network), keeps
    // only sleeves with the fields the capsule needs, and drops the Desi tone
    // outliers so the rotation matches the hero's cinematic grade.
    const [tracks, setTracks] = useState<NormalizedMusicItem[]>([]);
    useEffect(() => {
        let alive = true;
        musicService.getTrendingTracks().then((all) => {
            if (!alive) return;
            const seen = new Set<string>();
            const picked = all
                .filter(
                    (t) =>
                        t.title &&
                        t.artist &&
                        t.albumArt &&
                        !DESI_GENRE.test(t.genre || '') &&
                        t.mood !== 'devotion' &&
                        !DESI_ARTIST.test(t.artist || '')
                )
                .filter((t) => {
                    if (seen.has(t.trackId)) return false;
                    seen.add(t.trackId);
                    return true;
                })
                .slice(0, 8);
            setTracks(picked);
        });
        return () => {
            alive = false;
        };
    }, []);

    // Cycle the capsule through the featured set. Paused on the lite path and while
    // the tab is backgrounded (nothing to see, no reason to keep re-rendering).
    const [index, setIndex] = useState(0);
    const tracksRef = useRef(tracks);
    tracksRef.current = tracks;
    useEffect(() => {
        if (lite || tracks.length <= 1) return;
        let timer: number;
        const schedule = () => {
            timer = window.setTimeout(() => {
                if (document.visibilityState === 'visible') {
                    setIndex((i) => (i + 1) % tracksRef.current.length);
                }
                schedule();
            }, ROTATE_MS);
        };
        schedule();
        return () => window.clearTimeout(timer);
    }, [lite, tracks.length]);

    // Pull the secondary accent from the current sleeve (see extractAccent). Runs
    // once per track change; smoothly cross-fades via CSS transitions below. Amber
    // is the fallback for monochrome covers, so the capsule never loses its accent.
    const [accent, setAccent] = useState<Hsl>(AMBER_HSL);
    const currentTrack = tracks.length ? tracks[index % tracks.length] : null;
    const currentTrackId = currentTrack?.trackId;
    useEffect(() => {
        if (!currentTrack) return;
        let alive = true;
        const url = (currentTrack.albumArt || '').replace(/\d+x\d+bb/, '100x100bb');
        if (!url) {
            setAccent(AMBER_HSL);
            return;
        }
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
            if (alive) setAccent(extractAccent(im) || AMBER_HSL);
        };
        im.onerror = () => {
            if (alive) setAccent(AMBER_HSL);
        };
        im.src = url;
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrackId]);

    if (!currentTrack) return null;
    const track = currentTrack;
    const source = sourceLabel(track.trackUrl || '');

    return (
        <motion.div
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-[1] flex w-full max-w-[22rem] flex-col items-start gap-3 lg:items-end"
        >
            {/* Ambient HUD row — honest live signals: the viewer's local clock (with
                a slow amber "live" pulse) and today's shared Daily number, the
                communal "same room today" cue. `username` folds in as a third chip
                for signed-in players, replacing the old standalone "Playing as" pill. */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] font-medium text-text-2 lg:justify-end">
                <span className="inline-flex items-center gap-1.5 tabular-nums drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                    <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full bg-amber ${lite ? '' : 'accent-pulse'}`} />
                    {formatClock(now)}
                </span>
                <span aria-hidden className="h-3 w-px bg-white/15" />
                <span className="uppercase tracking-[0.12em] text-text-3 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                    Daily #{todayPuzzleNumber()}
                </span>
                {username ? (
                    <>
                        <span aria-hidden className="h-3 w-px bg-white/15" />
                        <span className="truncate drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                            <span className="text-text-3">as </span>
                            <span className="text-text-1">{username}</span>
                        </span>
                    </>
                ) : null}
            </div>

            {/* Now-playing capsule — the saloon-inspired frosted pill, on Raw XO
                tokens. Backdrop blur only on the full-motion (desktop) path; the
                lite path falls back to a solid charcoal fill per the motion budget. */}
            <div
                className={`group relative flex w-full items-center gap-3.5 rounded-full py-2.5 pl-2.5 pr-4 ring-1 ring-white/10 ${
                    lite ? 'bg-ch-2/90' : 'bg-white/[0.06]'
                }`}
                style={{
                    // Colored halo pulled from the current sleeve — the secondary
                    // accent's most visible moment. Cross-fades as the track rotates.
                    boxShadow: `0 18px 50px -14px rgba(0,0,0,0.7), 0 10px 44px -14px ${hsl(accent, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                    transition: 'box-shadow 0.6s ease',
                    // A moderate blur reads just as glassy as a 40px one here (the
                    // wall is already faded + scrimmed behind the capsule) at a
                    // fraction of the per-frame cost — backdrop-blur re-samples the
                    // animating wall every frame and its cost scales with radius.
                    ...(lite ? {} : { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }),
                }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.a
                        key={track.trackId}
                        href={track.trackUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="flex min-w-0 flex-1 items-center gap-3.5 outline-none"
                    >
                        <span
                            className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full ring-1 ring-white/10"
                            style={{
                                boxShadow: `0 4px 16px -4px rgba(0,0,0,0.6), 0 0 18px -2px ${hsl(accent, 0.55)}`,
                                transition: 'box-shadow 0.6s ease',
                            }}
                        >
                            <img
                                src={track.albumArt}
                                alt=""
                                decoding="async"
                                loading="lazy"
                                className="h-full w-full object-cover"
                            />
                            {/* Vinyl-hole dot — small nod to a spinning record without
                                the cost of an actual rotation animation. */}
                            <span aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ch-0 ring-1 ring-white/20" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span
                                className="block text-[10px] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: hsl(accent), transition: 'color 0.6s ease' }}
                            >
                                In rotation
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-semibold text-text-1">
                                {track.title}
                            </span>
                            <span className="block truncate text-xs text-text-3">{track.artist}</span>
                        </span>
                    </motion.a>
                </AnimatePresence>

                <Equalizer animated={!lite} color={hsl(accent)} />

                {track.trackUrl ? (
                    <a
                        href={track.trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${track.title} on ${source}`}
                        title={`Open on ${source}`}
                        className="tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-text-2 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-text-1"
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                            <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </a>
                ) : null}
            </div>
        </motion.div>
    );
}

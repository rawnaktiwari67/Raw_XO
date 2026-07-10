import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { getLenis } from '../hooks/useSmoothScroll';
import GamePlayer from '../components/game/GamePlayer';
import Leaderboard from '../components/game/Leaderboard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { GameSession } from '../types/game';
import ScrollReveal from '../components/motion/ScrollReveal';
import Magnetic from '../components/motion/Magnetic';
import PinnedShowcase, { type ShowcasePanel } from '../components/motion/PinnedShowcase';

// three.js is the heaviest dependency in the bundle (~492KB). Lazy-load it so it
// never blocks the initial paint, and only mount it once the page is idle.
const LaserFlow = lazy(() => import('../components/effects/LaserFlow'));
// Album-art wall for the hero — lazy + post-idle so its imagery never competes
// with the LCP headline for bandwidth on first paint.
const HeroCoverWall = lazy(() => import('../components/game/HeroCoverWall'));

// Hero entrance choreography. Children stagger; the headline animates on
// transform only (never opacity) so it stays the immediate LCP paint.
const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const heroItem = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const } },
};
// The headline rises out of a clipped mask (translateY on a full line-height,
// parent has overflow-hidden) rather than fading — a cleaner reveal that still
// touches transform only, so it stays the immediate LCP paint.
const heroHeadline = {
    hidden: { y: '115%' },
    visible: { y: '0%', transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const } },
};

// Signed-out explainer — fills the left column beside the leaderboard so the
// page has no dead gutter, and doubles as onboarding.
const HOW_IT_WORKS = [
    { title: 'Hit play', body: 'A five-second clip drops. No title, no artist — just the sound.' },
    { title: 'Pick fast', body: 'Four titles appear. Trust your ear and lock one before it disappears.' },
    { title: 'Build your ear', body: 'Every call becomes history — streaks, ratings, and a rank to chase.' },
];

const SHOWCASE_PANELS: ShowcasePanel[] = [
    {
        label: '01 — Log',
        title: 'Every track you hear becomes a diary.',
        body: 'Rate what plays in your rounds and watch your taste take shape — a record of your ear, not a wall of opinions.',
        to: '/archive',
        cta: 'Open the diary',
    },
    {
        label: '02 — Rank',
        title: 'Chase the ear above you.',
        body: 'Daily and all-time boards, sliceable by artist and genre. See how good your instinct really is.',
        to: '/leaderboard',
        cta: 'See the board',
    },
    {
        label: '03 — Live',
        title: 'Take the instinct to a stage.',
        body: 'Live listings across Indian cities, with a Spotify check on every artist before you commit to the night.',
        to: '/tours',
        cta: 'Find a show',
    },
];

function formatResponseTime(value?: number) {
    if (!value || value <= 0) return 'No time';
    return `${(value / 1000).toFixed(2)}s`;
}

function HistoryItem({ item, index = 0 }: { item: GameSession; index?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-6% 0px' }}
            transition={{ duration: 0.42, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[1rem] bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-1">
                        {item.trackName || 'Unknown track'}
                    </p>
                    <p className="mt-2 text-sm text-text-3">
                        {item.artistName || 'Unknown artist'}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.14em] ${
                        item.correct ? 'bg-emerald-300/10 text-emerald-200/80' : 'bg-orange-300/10 text-orange-200/80'
                    }`}>
                        {item.correct ? 'Correct' : 'Missed'}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-text-4">
                        {formatResponseTime(item.responseTimeMs)}
                    </span>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-text-4">
                <span>{new Date(item.sessionDate).toLocaleDateString()}</span>
                <span>{item.xpEarned} xp</span>
            </div>
        </motion.div>
    );
}

export default function Game() {
    useDocumentMeta({
        title: 'Raw XO — Five seconds. Four options. One instinct.',
        description: 'A cinematic 5-second music guessing game. A clip plays, four track names appear, and you pick before it disappears.',
    });
    const { isAuthenticated, user } = useAuthStore();
    const { stats, history, phase, isLoading, fetchStats, fetchHistory } = useGameStore();
    const isGameplayActive = phase !== 'idle' || isLoading;
    const [showLaser, setShowLaser] = useState(false);
    // Album-art wall mounts shortly after first paint (desktop, motion allowed).
    // setTimeout — not requestIdleCallback — so it fires reliably even in a
    // backgrounded tab, while still landing after the LCP headline has painted.
    const [showImagery, setShowImagery] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            fetchStats();
            fetchHistory();
        }
    }, [fetchHistory, fetchStats, isAuthenticated]);

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || window.innerWidth < 768) return;
        const t = window.setTimeout(() => setShowImagery(true), 350);
        return () => window.clearTimeout(t);
    }, []);

    // Mount the WebGL backdrop only after the page is idle, and never for users
    // who prefer reduced motion or are on a small/low-power screen.
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || window.innerWidth < 768) return;

        const idle = window.requestIdleCallback
            ? window.requestIdleCallback(() => setShowLaser(true), { timeout: 1500 })
            : window.setTimeout(() => setShowLaser(true), 600);

        return () => {
            if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle);
            else window.clearTimeout(idle as number);
        };
    }, []);

    useEffect(() => {
        document.body.classList.toggle('gameplay-locked', isGameplayActive);
        // Lenis owns the wheel; pause it while gameplay locks the viewport so
        // scroll attempts don't accumulate behind the frozen page.
        const lenis = getLenis();
        if (isGameplayActive) lenis?.stop();
        else lenis?.start();

        return () => {
            document.body.classList.remove('gameplay-locked');
            getLenis()?.start();
        };
    }, [isGameplayActive]);

    if (isGameplayActive) {
        return (
            <div className="gameplay-page relative h-screen overflow-hidden">
                <GamePlayer />
            </div>
        );
    }

    return (
        // The clipping wrapper stops before PinnedShowcase: position:sticky is
        // inert inside an overflow-hidden ancestor, so the pinned section must
        // live outside the backdrop-clipping container.
        <div className="relative">
        <div className="relative overflow-hidden">
            {/* Laser beam is the deepest layer so its warm glow reads *behind* the
                album-art wall, diffusing up through the gaps between covers. */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-[34rem] opacity-[0.16]">
                {showLaser ? (
                    <Suspense fallback={null}>
                        <LaserFlow
                            color="#F4A261"
                            dpr={0.7}
                            horizontalBeamOffset={0.08}
                            verticalBeamOffset={-0.02}
                            horizontalSizing={0.92}
                            verticalSizing={2.3}
                            wispDensity={1}
                            wispSpeed={10}
                            wispIntensity={2.2}
                            flowSpeed={0.18}
                            flowStrength={0.14}
                            fogIntensity={0.18}
                            fogScale={0.24}
                            fogFallSpeed={0.34}
                            decay={1.02}
                            falloffStart={1.04}
                            mouseTiltStrength={0}
                        />
                    </Suspense>
                ) : null}
            </div>

            {/* Ambient album-art wall — sits above the laser so the covers catch
                the glow from behind; gradient scrims below still paint over it. */}
            {showImagery ? (
                <Suspense fallback={null}>
                    <HeroCoverWall />
                </Suspense>
            ) : null}

            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[24rem]"
                style={{
                    background:
                        'linear-gradient(180deg, rgba(11,11,15,0.02) 0%, rgba(11,11,15,0.12) 38%, rgba(11,11,15,0.92) 100%)',
                }}
            />
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(58% 40% at 84% 8%, rgba(244,162,97,0.12), transparent 62%), radial-gradient(60% 46% at 4% 94%, rgba(255,255,255,0.04), transparent 74%)',
                }}
            />

            <div className="relative mx-auto max-w-[1160px] px-4 pb-16 pt-24 md:px-8 md:pt-28">
                {/* Choreographed entrance: the eyebrow and subtext stagger in with
                    opacity, but the LCP <h1> uses transform only (no opacity fade),
                    since an opacity:0 start would push the largest paint out by the
                    whole animation. relative so the album-art wall can sit behind it. */}
                <motion.section
                    variants={heroContainer}
                    initial="hidden"
                    animate="visible"
                    className="relative mb-10 flex min-h-[20rem] flex-col justify-end gap-6 md:min-h-[24rem] lg:flex-row lg:items-end lg:justify-between"
                >
                    <motion.div variants={heroItem} className="relative z-[1] max-w-2xl">
                        <motion.p variants={heroItem} className="label-xs mb-2 flex items-center gap-2">
                            <span aria-hidden className="accent-pulse inline-block h-1.5 w-1.5 rounded-full bg-amber" />
                            Raw XO
                        </motion.p>
                        {/* overflow-hidden clips the headline as it rises; the pb/-mb pair
                            gives descenders room without changing layout spacing. */}
                        <div className="overflow-hidden pb-[0.16em] -mb-[0.16em]">
                            <motion.h1
                                variants={heroHeadline}
                                className="font-heading text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[0.9] tracking-[-0.02em] text-text-1"
                            >
                                <span className="text-gradient-gold">5 seconds.</span> Pick it before it disappears.
                            </motion.h1>
                        </div>
                        <motion.p variants={heroItem} className="mt-4 max-w-xl text-sm leading-relaxed text-text-3 md:text-base">
                            Fast rounds, instant reveals, and real history. Nothing above the game that does not help you play.
                        </motion.p>
                    </motion.div>
                    {isAuthenticated && user ? (
                        <motion.div variants={heroItem} className="relative z-[1] rounded-full bg-white/[0.03] px-4 py-2 text-sm text-text-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            Playing as <span className="text-text-1">{user.username}</span>
                        </motion.div>
                    ) : null}
                </motion.section>

                <section className="min-w-0">
                    <GamePlayer />
                </section>

                <section className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        {!isAuthenticated ? (
                            <div className="space-y-6">
                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <p className="label-xs mb-4 text-orange-200/80">Save Your Runs</p>
                                    <ScrollReveal as="h2" className="font-heading text-[2rem] leading-[0.94] text-text-1">
                                        Keep your best times, streaks, and ratings when you are ready.
                                    </ScrollReveal>
                                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-3">
                                        Guest mode is instant. Signing in turns every round into history you can chase.
                                    </p>
                                    <div className="mt-6 flex flex-wrap items-center gap-4">
                                        <Magnetic>
                                            <Link to="/login" className="btn-primary rounded-[1rem] px-6 py-4 text-[13px]">Sign In</Link>
                                        </Magnetic>
                                        <Magnetic>
                                            <Link to="/register" className="btn-secondary rounded-[1rem] px-6 py-4 text-[13px]">Create Account</Link>
                                        </Magnetic>
                                    </div>
                                </div>

                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <p className="label-xs mb-5">How it plays</p>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        {HOW_IT_WORKS.map((step, i) => (
                                            <motion.div
                                                key={step.title}
                                                initial={{ opacity: 0, y: 26 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true, margin: '-8% 0px' }}
                                                transition={{ duration: 0.5, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                                                className="rounded-[1rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))] p-4 ring-1 ring-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                                            >
                                                <span className="font-heading text-[2rem] leading-none text-gradient-gold">{i + 1}</span>
                                                <p className="mt-3 text-sm font-bold text-text-1">{step.title}</p>
                                                <p className="mt-1.5 text-xs leading-relaxed text-text-4">{step.body}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <p className="label-xs mb-4">Your Pace</p>
                                    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Played</p>
                                            <p className="font-heading text-[1.7rem] leading-none text-text-1">{stats?.totalGamesPlayed ?? 0}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Accuracy</p>
                                            <p className="font-heading text-[1.7rem] leading-none text-accent">{stats?.accuracy ?? 0}%</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Streak</p>
                                            <p className="font-heading text-[1.7rem] leading-none text-text-1">{stats?.streak ?? 0}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Best Time</p>
                                            <p className="font-heading text-[1.7rem] leading-none text-text-1">
                                                {stats?.fastestCorrectResponseTimeMs
                                                    ? formatResponseTime(stats.fastestCorrectResponseTimeMs)
                                                    : '--'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <p className="label-xs mb-4">Recent Rounds</p>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {history.length === 0 ? (
                                            <p className="text-sm text-text-3">Play a few rounds and your history will appear here.</p>
                                        ) : (
                                            history.slice(0, 4).map((item, i) => (
                                                <HistoryItem key={item._id} item={item} index={i} />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <aside className="xl:pt-2">
                        <Leaderboard />
                    </aside>
                </section>
            </div>
        </div>

            <PinnedShowcase panels={SHOWCASE_PANELS} />
        </div>
    );
}

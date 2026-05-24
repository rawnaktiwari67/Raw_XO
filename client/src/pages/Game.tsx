import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import GamePlayer from '../components/game/GamePlayer';
import Leaderboard from '../components/game/Leaderboard';
import LaserFlow from '../components/effects/LaserFlow';
import type { GameSession } from '../types/game';

function formatResponseTime(value?: number) {
    if (!value || value <= 0) return 'No time';
    return `${(value / 1000).toFixed(2)}s`;
}

function HistoryItem({ item }: { item: GameSession }) {
    return (
        <div className="rounded-[1rem] bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
        </div>
    );
}

export default function Game() {
    const { isAuthenticated, user } = useAuthStore();
    const { stats, history, phase, isLoading, fetchStats, fetchHistory } = useGameStore();
    const isGameplayActive = phase !== 'idle' || isLoading;

    useEffect(() => {
        if (isAuthenticated) {
            fetchStats();
            fetchHistory();
        }
    }, [fetchHistory, fetchStats, isAuthenticated]);

    useEffect(() => {
        document.body.classList.toggle('gameplay-locked', isGameplayActive);

        return () => {
            document.body.classList.remove('gameplay-locked');
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
        <div className="relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 top-0 h-[34rem] opacity-[0.16]">
                <LaserFlow
                    color="#F4A261"
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
            </div>

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
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                >
                    <div className="max-w-2xl">
                        <p className="label-xs mb-2">Raw XO</p>
                        <h1 className="font-heading text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.9] text-text-1">
                            5 seconds. Pick it before it disappears.
                        </h1>
                        <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-3 md:text-base">
                            Fast rounds, instant reveals, and real history. Nothing above the game that does not help you play.
                        </p>
                    </div>
                    {isAuthenticated && user ? (
                        <div className="rounded-full bg-white/[0.03] px-4 py-2 text-sm text-text-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            Playing as <span className="text-text-1">{user.username}</span>
                        </div>
                    ) : null}
                </motion.section>

                <section className="min-w-0">
                    <GamePlayer />
                </section>

                <section className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        {!isAuthenticated ? (
                            <div className="rounded-[1.25rem] bg-white/[0.02] p-6">
                                <p className="label-xs mb-4 text-orange-200/80">Save Your Runs</p>
                                <h2 className="font-heading text-[2rem] leading-[0.94] text-text-1">
                                    Keep your best times, streaks, and ratings when you are ready.
                                </h2>
                                <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-3">
                                    Guest mode is instant. Signing in turns every round into history you can chase.
                                </p>
                                <div className="mt-6 flex flex-wrap items-center gap-4">
                                    <Link to="/login" className="btn-primary rounded-[1rem] px-6 py-4 text-[13px]">Sign In</Link>
                                    <Link to="/register" className="btn-secondary rounded-[1rem] px-6 py-4 text-[13px]">Create Account</Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6">
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

                                <div className="rounded-[1.25rem] bg-white/[0.02] p-6">
                                    <p className="label-xs mb-4">Recent Rounds</p>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {history.length === 0 ? (
                                            <p className="text-sm text-text-3">Play a few rounds and your history will appear here.</p>
                                        ) : (
                                            history.slice(0, 4).map((item) => (
                                                <HistoryItem key={item._id} item={item} />
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
    );
}

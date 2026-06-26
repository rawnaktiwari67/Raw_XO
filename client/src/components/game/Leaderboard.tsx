import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import type { LeaderboardPeriod } from '../../types/game';

export default function Leaderboard() {
    const { user } = useAuthStore();
    const { leaderboard, leaderboardPeriod, leaderboardRank, fetchLeaderboard } = useGameStore();

    useEffect(() => {
        void fetchLeaderboard(leaderboardPeriod);
    }, [fetchLeaderboard, leaderboardPeriod]);

    const changePeriod = (period: LeaderboardPeriod) => {
        void fetchLeaderboard(period);
    };

    return (
        <div className="rounded-[1.5rem] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_16px_32px_rgba(0,0,0,0.16)]">
            <p className="label-xs mb-4">Leaderboard</p>

            <div className="mb-4 flex items-start justify-between gap-4">
                <h3 className="font-heading text-[1.8rem] leading-[0.94] text-text-1">
                    {leaderboardPeriod === 'daily' ? 'Daily Run' : 'All-Time Rank'}
                </h3>

                <div className="flex gap-2">
                    {(['daily', 'all-time'] as const).map((period) => {
                        const active = leaderboardPeriod === period;

                        return (
                            <button
                                key={period}
                                type="button"
                                onClick={() => changePeriod(period)}
                                className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-all duration-300 ${
                                    active
                                        ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.22),rgba(244,162,97,0.10))] text-text-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(244,162,97,0.14)]'
                                        : 'bg-white/[0.03] text-text-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:text-text-1'
                                }`}
                            >
                                {period === 'daily' ? 'Daily' : 'All-Time'}
                            </button>
                        );
                    })}
                </div>
            </div>

            {leaderboardRank ? (
                <div className="mb-4 rounded-[1rem] bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Your Rank</p>
                    <p className="mt-2 font-heading text-[1.6rem] leading-none text-accent">#{leaderboardRank}</p>
                </div>
            ) : null}

            {leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-3">No scores yet. Start the first run.</p>
            ) : (
                <ol className="flex flex-col gap-4">
                    {leaderboard.map((entry, index) => {
                        const isUser = !!user && entry._id === user._id;
                        const name = entry.username?.trim() || 'Guest';
                        const initial = name[0]?.toUpperCase() ?? 'G';
                        const hue = (name.charCodeAt(0) * 7) % 360;

                        return (
                            <motion.li
                                key={entry._id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05, duration: 0.38 }}
                                className={`flex items-center gap-4 rounded-[1rem] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                                    isUser
                                        ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.14),rgba(244,162,97,0.06))]'
                                        : 'bg-black/10'
                                }`}
                            >
                                <span className="w-5 text-center font-heading text-text-3">{index + 1}</span>
                                <div
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-ch-0"
                                    style={{ background: `hsl(${hue}, 58%, 64%)` }}
                                >
                                    {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-text-1">{name}</p>
                                    <p className="mt-2 text-xs text-text-4">{entry.levelBadge} · {entry.sessions} sessions</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-heading text-sm text-accent">{entry.totalScore.toLocaleString()}</p>
                                    <p className="text-xs text-text-4">pts</p>
                                </div>
                            </motion.li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

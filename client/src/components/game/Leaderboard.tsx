import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from '../../types/game';
import { avatarHue, avatarInitial } from '../../utils/avatar';
import CountUp from '../ui/CountUp';
import FilterPills from '../ui/FilterPills';

type LeaderboardProps = {
    // 'full' powers the dedicated Rank page (podium + scope filters + sticky bar).
    // 'compact' is the slim sidebar version shown next to the game.
    variant?: 'full' | 'compact';
};

const periodOptions = [
    { value: 'daily' as const, label: 'Daily' },
    { value: 'all-time' as const, label: 'All-Time' },
];

const scopeOptions = [
    { value: 'global' as const, label: 'Global' },
    { value: 'genre' as const, label: 'By Genre' },
    { value: 'artist' as const, label: 'By Artist' },
];

const genreOptions = [
    { value: 'hip-hop', label: 'Hip-Hop' },
    { value: 'pop', label: 'Pop' },
    { value: 'rnb', label: 'R&B' },
    { value: 'dance', label: 'Dance' },
];

const artistSuggestions = ['The Weeknd', 'Drake', 'Travis Scott', 'Arijit Singh', 'AP Dhillon', 'Diljit Dosanjh'];

const medalRing = ['#f4c97b', '#cbd5e1', '#d8a07a'];

const speedLabel = (ms?: number) => (ms && ms > 0 ? `${(ms / 1000).toFixed(1)}s` : null);

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: number }) {
    const name = entry.username?.trim() || 'Guest';
    if (entry.avatar) {
        return (
            <img
                src={entry.avatar}
                alt={name}
                width={size}
                height={size}
                loading="lazy"
                decoding="async"
                className="rounded-full object-cover"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="flex items-center justify-center rounded-full font-bold text-ch-0"
            style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${avatarHue(name)}, 58%, 64%)` }}
        >
            {avatarInitial(name)}
        </div>
    );
}

function NameTag({ entry, className = '' }: { entry: LeaderboardEntry; className?: string }) {
    const name = entry.username?.trim() || 'Guest';
    if (entry.isGuest || name === 'Guest') {
        return <span className={`truncate ${className}`}>{name}</span>;
    }
    return (
        <Link to={`/profile/${name}`} className={`truncate transition-colors hover:text-accent ${className}`}>
            {name}
        </Link>
    );
}

export default function Leaderboard({ variant = 'compact' }: LeaderboardProps) {
    const isFull = variant === 'full';
    const { user } = useAuthStore();
    const {
        leaderboard,
        leaderboardPeriod,
        leaderboardRank,
        leaderboardScope,
        leaderboardScopeValue,
        leaderboardLoading,
        fetchLeaderboard,
    } = useGameStore();
    const [artistInput, setArtistInput] = useState('');

    useEffect(() => {
        void fetchLeaderboard(leaderboardPeriod);
        // Fetch once on mount; later changes go through the explicit handlers below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changePeriod = (period: LeaderboardPeriod) => void fetchLeaderboard(period, leaderboardScope, leaderboardScopeValue);

    const changeScope = (scope: LeaderboardScope) => {
        if (scope === 'global') {
            void fetchLeaderboard(leaderboardPeriod, 'global', '');
        } else if (scope === 'genre') {
            void fetchLeaderboard(leaderboardPeriod, 'genre', genreOptions[0].value);
        } else {
            // Artist scope needs a value; wait for the user to pick/type one.
            void fetchLeaderboard(leaderboardPeriod, 'artist', '');
        }
    };

    const applyScopeValue = (value: string) => void fetchLeaderboard(leaderboardPeriod, leaderboardScope, value);

    const submitArtist = (event: React.FormEvent) => {
        event.preventDefault();
        if (artistInput.trim()) applyScopeValue(artistInput.trim());
    };

    const podium = isFull ? leaderboard.slice(0, 3) : [];
    // The compact sidebar shows only the top 5 to stay tight; the full board lives
    // on the Rank page (linked below). The full variant lists everyone past the podium.
    const rest = isFull ? leaderboard.slice(3) : leaderboard.slice(0, 5);

    // Who is the player chasing? The entry directly above their rank, if visible.
    const yourEntry = useMemo(
        () => (user ? leaderboard.find((entry) => entry._id === user._id) : null),
        [leaderboard, user]
    );
    const chaseTarget = useMemo(() => {
        if (!leaderboardRank || leaderboardRank < 2) return null;
        return leaderboard[leaderboardRank - 2] || null;
    }, [leaderboard, leaderboardRank]);

    const titleText =
        leaderboardScope === 'genre'
            ? `${genreOptions.find((g) => g.value === leaderboardScopeValue)?.label || 'Genre'} board`
            : leaderboardScope === 'artist'
              ? leaderboardScopeValue
                  ? `${leaderboardScopeValue} board`
                  : 'Pick an artist'
              : leaderboardPeriod === 'daily'
                ? 'Daily Run'
                : 'All-Time Rank';

    const renderRow = (entry: LeaderboardEntry, rank: number) => {
        const isUser = !!user && entry._id === user._id;
        const accuracy = typeof entry.accuracy === 'number' ? entry.accuracy : null;
        const speed = speedLabel(entry.avgResponseMs);

        return (
            <motion.li
                key={entry._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(rank, 12) * 0.035, duration: 0.34 }}
                className={`flex items-center gap-4 rounded-[1rem] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                    isUser
                        ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.16),rgba(244,162,97,0.06))] ring-1 ring-accent/25'
                        : 'bg-black/10'
                }`}
            >
                <span className="w-6 text-center font-heading text-text-3">{rank}</span>
                <Avatar entry={entry} size={36} />
                <div className="min-w-0 flex-1">
                    <NameTag entry={entry} className="text-sm font-medium text-text-1" />
                    <p className="mt-1 text-xs text-text-4">
                        {entry.levelBadge} · {entry.sessions} rounds
                        {accuracy !== null ? ` · ${accuracy}% acc` : ''}
                        {speed ? ` · ${speed}` : ''}
                    </p>
                </div>
                <div className="text-right">
                    <CountUp value={entry.totalScore} className="font-heading text-sm text-accent" />
                    <p className="text-xs text-text-4">pts</p>
                </div>
            </motion.li>
        );
    };

    return (
        <div className="rounded-[1.5rem] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_16px_32px_rgba(0,0,0,0.16)]">
            <p className="label-xs mb-4">Leaderboard</p>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-heading text-[1.5rem] leading-[0.96] text-text-1 sm:text-[1.8rem] sm:leading-[0.94]">{titleText}</h3>
                <FilterPills options={periodOptions} value={leaderboardPeriod} onChange={changePeriod} size="sm" />
            </div>

            {isFull ? (
                <div className="mb-5 space-y-3">
                    <FilterPills options={scopeOptions} value={leaderboardScope} onChange={changeScope} size="sm" />

                    {leaderboardScope === 'genre' ? (
                        <FilterPills
                            options={genreOptions}
                            value={leaderboardScopeValue || genreOptions[0].value}
                            onChange={applyScopeValue}
                            size="sm"
                        />
                    ) : null}

                    {leaderboardScope === 'artist' ? (
                        <div className="space-y-3">
                            <form onSubmit={submitArtist} className="flex gap-2">
                                <input
                                    value={artistInput}
                                    onChange={(event) => setArtistInput(event.target.value)}
                                    placeholder="Type an artist…"
                                    className="flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-1 placeholder:text-text-4 focus:border-accent/40 focus:outline-none"
                                />
                                <button type="submit" className="btn-secondary rounded-full px-5 py-2 text-xs">
                                    Go
                                </button>
                            </form>
                            <div className="flex flex-wrap gap-2">
                                {artistSuggestions.map((artist) => (
                                    <button
                                        key={artist}
                                        type="button"
                                        onClick={() => {
                                            setArtistInput(artist);
                                            applyScopeValue(artist);
                                        }}
                                        className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                                            leaderboardScopeValue.toLowerCase() === artist.toLowerCase()
                                                ? 'border-accent/35 bg-amber-dim text-accent'
                                                : 'border-white/10 bg-white/[0.03] text-text-3 hover:text-text-1'
                                        }`}
                                    >
                                        {artist}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {isFull && leaderboardRank ? (
                <div className="mb-5 rounded-[1rem] bg-[linear-gradient(180deg,rgba(244,162,97,0.14),rgba(244,162,97,0.05))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Your rank</p>
                            <p className="mt-1 font-heading text-[1.7rem] leading-none text-accent">#{leaderboardRank}</p>
                        </div>
                        {yourEntry ? (
                            <div className="text-right">
                                <CountUp value={yourEntry.totalScore} className="font-heading text-lg text-text-1" />
                                <p className="text-xs text-text-4">pts</p>
                            </div>
                        ) : null}
                    </div>
                    {chaseTarget && yourEntry ? (
                        <p className="mt-3 text-xs text-text-3">
                            {(chaseTarget.totalScore - yourEntry.totalScore).toLocaleString()} pts behind{' '}
                            <span className="text-text-1">{chaseTarget.username?.trim() || 'the rank above'}</span>
                        </p>
                    ) : null}
                </div>
            ) : !isFull && leaderboardRank ? (
                <div className="mb-4 rounded-[1rem] bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-4">Your Rank</p>
                    <p className="mt-2 font-heading text-[1.6rem] leading-none text-accent">#{leaderboardRank}</p>
                </div>
            ) : null}

            {leaderboardLoading && leaderboard.length === 0 ? (
                <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton h-14 w-full" style={{ borderRadius: '1rem' }} />
                    ))}
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="rounded-[1rem] bg-black/10 px-4 py-8 text-center">
                    <p className="text-sm text-text-2">
                        {leaderboardScope === 'artist' && !leaderboardScopeValue
                            ? 'Pick an artist to see who tops that board.'
                            : 'No scores here yet. Be the first to set the pace.'}
                    </p>
                </div>
            ) : (
                <>
                    {podium.length > 0 ? (
                        <ol className="mb-5 grid grid-cols-3 gap-3">
                            {podium.map((entry, index) => {
                                const isUser = !!user && entry._id === user._id;
                                return (
                                    <motion.li
                                        key={entry._id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.06, duration: 0.4 }}
                                        className={`flex flex-col items-center rounded-[1.1rem] px-2 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                                            index === 0 ? 'bg-white/[0.05] -mt-2' : 'bg-black/15'
                                        } ${isUser ? 'ring-1 ring-accent/30' : ''}`}
                                    >
                                        <div className="relative">
                                            <div className="rounded-full p-[2px]" style={{ background: medalRing[index] }}>
                                                <div className="rounded-full bg-ch-0 p-[2px]">
                                                    <Avatar entry={entry} size={index === 0 ? 52 : 44} />
                                                </div>
                                            </div>
                                            <span
                                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold text-ch-0"
                                                style={{ background: medalRing[index] }}
                                            >
                                                {index + 1}
                                            </span>
                                        </div>
                                        <NameTag entry={entry} className="mt-3 max-w-full text-xs font-semibold text-text-1" />
                                        <CountUp value={entry.totalScore} className="mt-1 font-heading text-sm text-accent" />
                                        {typeof entry.accuracy === 'number' ? (
                                            <span className="mt-1 text-[10px] text-text-4">{entry.accuracy}% acc</span>
                                        ) : null}
                                    </motion.li>
                                );
                            })}
                        </ol>
                    ) : null}

                    <ol className="flex flex-col gap-3">
                        {rest.map((entry, index) => renderRow(entry, (isFull ? 4 : 1) + index))}
                    </ol>

                    {/* Compact board is capped at 5 — send the rest to the Rank page. */}
                    {!isFull && leaderboard.length > 5 ? (
                        <Link
                            to="/leaderboard"
                            className="mt-4 flex items-center justify-center gap-1.5 rounded-[1rem] bg-white/[0.03] px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:bg-white/[0.05] hover:text-text-1"
                        >
                            See full leaderboard
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
                                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </Link>
                    ) : null}
                </>
            )}
        </div>
    );
}

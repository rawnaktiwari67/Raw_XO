import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import {
    todayPuzzleNumber,
    buildDailyShareText,
    type DailyState,
} from '../../services/dailyStore';

// The daily challenge card — the retention hook. On the setup screen it offers
// today's one shared puzzle; once you've played it flips to a spoiler-free result
// grid + streak you won't want to break, plus a share that carries no titles.
// Playing routes through the store's loadDaily(), so the round itself is the same
// GamePlayer engine as everything else.

function shareUrl(): string {
    if (typeof window === 'undefined') return '';
    return window.location.origin || '';
}

function StreakBadge({ streak, best }: { streak: number; best: number }) {
    if (streak <= 0 && best <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber ring-1 ring-amber/25">
            <span aria-hidden>🔥</span>
            {streak > 0 ? `${streak}-day streak` : `Best ${best}`}
            {streak > 0 && best > streak ? <span className="text-amber/60">· best {best}</span> : null}
        </span>
    );
}

function ResultGrid({ results }: { results: boolean[] }) {
    const correct = results.filter(Boolean).length;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5" role="img" aria-label={`${correct} of ${results.length} correct`}>
                {results.map((hit, i) => (
                    <span
                        key={i}
                        aria-hidden
                        className={`h-6 w-6 rounded-md ${
                            hit
                                ? 'bg-emerald-400/25 ring-1 ring-emerald-300/50'
                                : 'bg-white/[0.05] ring-1 ring-white/10'
                        }`}
                    />
                ))}
                <span className="ml-1.5 text-sm font-bold text-text-1">
                    {correct}/{results.length}
                </span>
            </div>
        </div>
    );
}

export default function DailyCard() {
    const phase = useGameStore((s) => s.phase);
    const isLoading = useGameStore((s) => s.isLoading);
    const dailyState = useGameStore((s) => s.dailyState);
    const loadDaily = useGameStore((s) => s.loadDaily);

    const [shareLabel, setShareLabel] = useState('Share result');

    // Only relevant on the setup screen — during play/reveal GamePlayer owns the panel.
    if (phase !== 'idle') return null;

    const today = todayPuzzleNumber();
    const playedToday = dailyState.lastPuzzle === today && !!dailyState.lastResult;

    const handleShare = async (state: DailyState) => {
        if (!state.lastResult) return;
        const text = buildDailyShareText(state.lastResult, state.streak, shareUrl());
        try {
            if (navigator.share) {
                await navigator.share({ text });
                setShareLabel('Shared');
            } else {
                await navigator.clipboard.writeText(text);
                setShareLabel('Copied');
            }
        } catch {
            try {
                await navigator.clipboard.writeText(text);
                setShareLabel('Copied');
            } catch {
                setShareLabel('Try again');
            }
        }
        window.setTimeout(() => setShareLabel('Share result'), 2200);
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Daily challenge"
            className="rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(244,162,97,0.09),rgba(255,255,255,0.02))] p-4 ring-1 ring-amber/20 shadow-[0_14px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(244,162,97,0.14)] sm:p-5"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber/85">
                        Daily Challenge
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold tracking-tight text-text-1 sm:text-xl">
                        #{today}
                    </h2>
                </div>
                <StreakBadge streak={dailyState.streak} best={dailyState.best} />
            </div>

            {playedToday && dailyState.lastResult ? (
                <div className="mt-4 flex flex-col gap-3">
                    <ResultGrid results={dailyState.lastResult.results} />
                    <p className="text-sm text-text-3">
                        Done for today — a new puzzle drops at midnight UTC.
                    </p>
                    <button
                        type="button"
                        onClick={() => handleShare(dailyState)}
                        className="tap-target inline-flex w-full items-center justify-center rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-text-1 ring-1 ring-white/[0.1] transition-colors hover:bg-white/[0.1] sm:w-auto"
                    >
                        {shareLabel}
                    </button>
                </div>
            ) : (
                <div className="mt-4 flex flex-col gap-3">
                    <p className="text-sm text-text-3">
                        Same five clips for everyone today. One shot. Keep your streak alive.
                    </p>
                    <button
                        type="button"
                        onClick={() => void loadDaily()}
                        disabled={isLoading}
                        className="tap-target inline-flex w-full items-center justify-center rounded-xl bg-amber px-4 py-3 text-sm font-bold text-black shadow-[0_10px_28px_rgba(244,162,97,0.28)] transition-transform hover:scale-[1.01] disabled:opacity-60"
                    >
                        {isLoading ? 'Loading…' : 'Play today’s daily'}
                    </button>
                </div>
            )}
        </motion.section>
    );
}

import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LINKS } from './navLinks';

// Phone-only primary navigation. Desktop/tablet keep the top bar (this is
// `md:hidden`); it replaces the old hamburger dropdown so the four core
// destinations sit permanently in the thumb zone. Hidden during an active round
// via `body.gameplay-locked .mobile-tabbar` (see index.css), matching how the
// header/footer are suppressed there.

type IconProps = { active: boolean };

// Stroke icons at a common 22px box. Active state is carried by colour on the
// parent, so the glyphs just inherit currentColor.
function PlayIcon({ active }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M8 5.5v13l10-6.5-10-6.5z" strokeLinejoin="round" />
        </svg>
    );
}

function CultureIcon({ active }: IconProps) {
    // A record — the diary/archive lives here.
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <circle cx="12" cy="12" r="8.4" />
            <circle cx="12" cy="12" r="2.6" fill={active ? 'currentColor' : 'none'} />
        </svg>
    );
}

function LiveIcon({ active }: IconProps) {
    // A ticket stub — live shows / tours.
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v2a2 2 0 0 0 0 3.9v1.1A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.1a2 2 0 0 0 0-3.9v-2z" strokeLinejoin="round" />
            {active ? <path d="M12 8v8" strokeDasharray="1.5 2.4" strokeLinecap="round" /> : null}
        </svg>
    );
}

function RankIcon({ active }: IconProps) {
    // Podium bars — the leaderboard.
    return (
        <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <rect x="4" y="12" width="4.4" height="7" rx="1" />
            <rect x="9.8" y="7" width="4.4" height="12" rx="1" />
            <rect x="15.6" y="10" width="4.4" height="9" rx="1" />
        </svg>
    );
}

const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
    '/': PlayIcon,
    '/archive': CultureIcon,
    '/tours': LiveIcon,
    '/leaderboard': RankIcon,
};

function isActive(to: string, pathname: string) {
    if (to === '/') return pathname === '/' || pathname === '/game';
    if (to === '/archive') return pathname.startsWith('/archive') || pathname.startsWith('/era') || pathname.startsWith('/thread');
    return pathname === to || pathname.startsWith(`${to}/`);
}

export default function MobileTabBar() {
    const { pathname } = useLocation();

    return (
        <nav
            aria-label="Primary"
            className="mobile-tabbar pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[linear-gradient(180deg,rgba(11,11,15,0.82),rgba(11,11,15,0.96))] backdrop-blur-xl md:hidden"
        >
            <ul className="mx-auto flex max-w-[520px] items-stretch justify-around px-2">
                {LINKS.map((link) => {
                    const active = isActive(link.to, pathname);
                    const Icon = ICONS[link.to] ?? PlayIcon;

                    return (
                        <li key={link.to} className="flex-1">
                            <Link
                                to={link.to}
                                aria-current={active ? 'page' : undefined}
                                className={`tap-target relative mx-auto flex min-h-[54px] flex-col items-center justify-center gap-1 pb-1 pt-2 transition-colors duration-200 ${
                                    active ? 'text-amber' : 'text-text-3 hover:text-text-2'
                                }`}
                            >
                                {active ? (
                                    <motion.span
                                        layoutId="tabbar-active"
                                        aria-hidden
                                        className="absolute top-0 h-[2.5px] w-7 rounded-full bg-amber shadow-[0_0_10px_rgba(244,162,97,0.5)]"
                                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                    />
                                ) : null}
                                <span className="h-[22px] w-[22px]">
                                    <Icon active={active} />
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
                                    {link.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

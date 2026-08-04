import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useAuthStore } from '../../stores/authStore';
import { shouldUseClerk } from '../../services/authMode';
import { authService } from '../../services/authService';
import RollText from '../motion/RollText';
import { LINKS } from './navLinks';
import { prefetchRoute } from '../../router/prefetch';

function NavLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
    const { pathname } = useLocation();
    const active = to === '/'
        ? pathname === '/' || pathname === '/game'
        : pathname === to;

    return (
        // Hover/focus warms the target chunk so the click navigates with no
        // chunk-download wait.
        <Link
            to={to}
            onClick={onClick}
            onMouseEnter={() => prefetchRoute(to)}
            onFocus={() => prefetchRoute(to)}
            className={`nav-link roll-trigger ${active ? 'nav-link-active' : ''}`}
        >
            <RollText>{label}</RollText>
        </Link>
    );
}

export default function Navbar() {
    const { user, isAuthenticated, clearSession } = useAuthStore();
    const navigate = useNavigate();
    const [isScrolled, setIsScrolled] = useState(false);

    // A plain passive scroll listener toggles the scrolled state — framer's
    // useScroll() re-measures the whole document on every layout change (it was
    // the single biggest cost during mount), which is absurd overkill for a
    // 14px threshold. This fires only on real scroll and never measures layout.
    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 14);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLocalSignOut = async () => {
        try {
            await authService.logout();
        } finally {
            clearSession();
            navigate('/');
        }
    };

    return (
        <motion.header
            // Opacity only — no transform. A residual transform on this element
            // (even translateY(0)) makes it a containing block that kills the inner
            // bar's backdrop-filter blur, so the entrance can't use x/y/scale.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-0 z-50"
        >
            <div
                className="transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                    backdropFilter: isScrolled ? 'blur(18px)' : 'blur(10px)',
                    background: isScrolled
                        ? 'linear-gradient(90deg, rgba(11,11,15,0.92) 0%, rgba(24,19,16,0.86) 100%)'
                        : 'linear-gradient(90deg, rgba(11,11,15,0.82) 0%, rgba(24,19,16,0.58) 100%)',
                    borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.03)',
                }}
            >
                <div className="pt-safe mx-auto flex h-[62px] max-w-[1280px] items-center justify-between gap-4 px-4 md:h-[76px] md:px-12">
                    <Link to="/" className="tap-target inline-flex items-center shrink-0" aria-label="Raw XO home">
                        <span className="brand-mark text-[1.6rem] leading-none text-gradient-gold md:text-[1.9rem]">
                            Raw XO
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-8 md:flex lg:gap-10">
                        {LINKS.map((item) => (
                            <NavLink key={item.to} to={item.to} label={item.label} />
                        ))}
                    </nav>

                    {/* Account cluster. Primary navigation now lives in the phone
                        bottom tab bar (MobileTabBar), so this stays lean on mobile:
                        just enough to reach your profile and sign out. */}
                    <div className="flex items-center gap-2 md:gap-3">
                        {isAuthenticated && user ? (
                            <>
                                <Link
                                    to={`/profile/${user.username}`}
                                    className="block max-w-[92px] truncate text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1 sm:max-w-none"
                                >
                                    {user.username}
                                </Link>
                                {shouldUseClerk ? (
                                    <ClerkSignedInControls
                                        onAfterSignOut={() => {
                                            clearSession();
                                            navigate('/');
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleLocalSignOut();
                                        }}
                                        className="btn-secondary rounded-[1.1rem] px-4 py-2 text-[11px] md:px-5 md:text-xs"
                                    >
                                        Sign Out
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-2 transition-colors hover:text-text-1"
                                >
                                    Sign In
                                </Link>
                                {/* The primary account action gets the accent — a solid
                                    pill instead of a ghost outline, so it reads over the
                                    bright cover wall behind the navbar. Deliberately a
                                    desaturated amber (not the full accent): the hero's
                                    "5 seconds." must stay the brightest orange on screen,
                                    and the nav shouldn't compete with it. */}
                                <Link
                                    to="/register"
                                    className="tap-target inline-flex items-center justify-center rounded-[1.1rem] bg-[#D69E71] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ch-0 shadow-[0_8px_22px_rgba(214,158,113,0.24)] transition-all duration-300 hover:-translate-y-px hover:bg-amber md:px-5 md:text-xs"
                                >
                                    Join
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.header>
    );
}

function ClerkSignedInControls({ onAfterSignOut }: { onAfterSignOut: () => void }) {
    const { signOut } = useClerk();

    return (
        <div className="flex items-center gap-2 md:gap-3">
            <UserButton
                appearance={{
                    elements: {
                        avatarBox: 'h-9 w-9 ring-1 ring-white/10',
                    },
                }}
                afterSignOutUrl="/"
            />
            {/* On phones the avatar's own Clerk menu carries "Sign out", so the
                explicit pill only appears from sm up to avoid a crowded top bar. */}
            <button
                onClick={async () => {
                    await signOut();
                    onAfterSignOut();
                }}
                className="btn-secondary hidden rounded-[1.1rem] px-4 py-2 text-[11px] sm:inline-flex md:px-5 md:text-xs"
            >
                Sign Out
            </button>
        </div>
    );
}

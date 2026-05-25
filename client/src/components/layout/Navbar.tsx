import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from 'framer-motion';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useAuthStore } from '../../stores/authStore';
import { shouldUseClerk } from '../../services/authMode';

const LINKS = [
    { to: '/', label: 'Play' },
    { to: '/archive', label: 'Culture' },
    { to: '/tours', label: 'Live' },
    { to: '/leaderboard', label: 'Rank' },
];

function NavLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
    const { pathname } = useLocation();
    const active = to === '/'
        ? pathname === '/' || pathname === '/game'
        : pathname === to;

    return (
        <Link to={to} onClick={onClick} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
            {label}
        </Link>
    );
}

export default function Navbar() {
    const { user, isAuthenticated, clearSession } = useAuthStore();
    const navigate = useNavigate();
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useMotionValueEvent(scrollY, 'change', (value) => setIsScrolled(value > 14));

    return (
        <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
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
                <div className="mx-auto flex h-[62px] max-w-[1280px] items-center justify-between gap-4 px-4 md:h-[76px] md:px-12">
                    <Link to="/" className="shrink-0">
                        <span className="brand-mark text-[1.6rem] leading-none text-gradient-gold md:text-[1.9rem]">Raw XO</span>
                    </Link>

                    <nav className="hidden items-center gap-8 md:flex lg:gap-10">
                        {LINKS.map((item) => (
                            <NavLink key={item.to} to={item.to} label={item.label} />
                        ))}
                    </nav>

                    <div className="flex items-center gap-2 md:gap-3">
                        {isAuthenticated && user ? (
                            <>
                                <Link
                                    to={`/profile/${user.username}`}
                                    className="hidden text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1 sm:block"
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
                                    <Link to="/login" className="btn-secondary rounded-[1.1rem] px-4 py-2 text-[11px] md:px-5 md:text-xs">
                                        Sign In
                                    </Link>
                                )}
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="hidden text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1 sm:block"
                                >
                                    Sign In
                                </Link>
                                <Link to="/register" className="btn-secondary rounded-[1.1rem] px-4 py-2 text-[11px] md:px-5 md:text-xs">
                                    Join
                                </Link>
                            </>
                        )}

                        {/* Mobile hamburger */}
                        <button
                            type="button"
                            aria-label="Toggle menu"
                            onClick={() => setMobileOpen((prev) => !prev)}
                            className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-[0.7rem] bg-white/[0.04] transition-colors hover:bg-white/[0.07] md:hidden"
                        >
                            <span
                                className={`h-px w-5 bg-text-2 transition-all duration-300 ${
                                    mobileOpen ? 'translate-y-[6px] rotate-45' : ''
                                }`}
                            />
                            <span
                                className={`h-px w-5 bg-text-2 transition-all duration-300 ${
                                    mobileOpen ? 'opacity-0' : ''
                                }`}
                            />
                            <span
                                className={`h-px w-5 bg-text-2 transition-all duration-300 ${
                                    mobileOpen ? '-translate-y-[6px] -rotate-45' : ''
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown menu */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.nav
                            key="mobile-menu"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden border-t border-white/[0.04] md:hidden"
                        >
                            <div className="flex flex-col gap-4 px-4 py-5">
                                {LINKS.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        label={item.label}
                                        onClick={() => setMobileOpen(false)}
                                    />
                                ))}
                                {isAuthenticated && user ? (
                                    <Link
                                        to={`/profile/${user.username}`}
                                        onClick={() => setMobileOpen(false)}
                                        className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1"
                                    >
                                        {user.username}
                                    </Link>
                                ) : (
                                    <Link
                                        to="/login"
                                        onClick={() => setMobileOpen(false)}
                                        className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1"
                                    >
                                        Sign In
                                    </Link>
                                )}
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
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
            <button
                onClick={async () => {
                    await signOut();
                    onAfterSignOut();
                }}
                className="btn-secondary rounded-[1.1rem] px-4 py-2 text-[11px] md:px-5 md:text-xs"
            >
                Sign Out
            </button>
        </div>
    );
}

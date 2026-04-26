import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useAuthStore } from '../../stores/authStore';

const LINKS = [
    { to: '/', label: 'Play' },
    { to: '/archive', label: 'Culture' },
    { to: '/tours', label: 'Live' },
    { to: '/leaderboard', label: 'Rank' },
];

function NavLink({ to, label }: { to: string; label: string }) {
    const { pathname } = useLocation();
    const active = to === '/'
        ? pathname === '/' || pathname === '/game'
        : pathname === to;

    return (
        <Link to={to} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
            {label}
        </Link>
    );
}

export default function Navbar() {
    const { user, isAuthenticated, clearSession } = useAuthStore();
    const navigate = useNavigate();
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);

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
                <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-6 px-6 md:px-12">
                    <Link to="/" className="shrink-0">
                        <span className="brand-mark text-[1.9rem] leading-none text-gradient-gold">Raw XO</span>
                    </Link>

                    <nav className="hidden items-center gap-8 md:flex lg:gap-10">
                        {LINKS.map((item) => (
                            <NavLink key={item.to} to={item.to} label={item.label} />
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        {isAuthenticated && user ? (
                            <>
                                <Link
                                    to={`/profile/${user.username}`}
                                    className="hidden text-[11px] uppercase tracking-[0.14em] text-text-3 transition-colors hover:text-text-1 sm:block"
                                >
                                    {user.username}
                                </Link>
                                {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? (
                                    <ClerkSignedInControls
                                        onAfterSignOut={() => {
                                            clearSession();
                                            navigate('/');
                                        }}
                                    />
                                ) : (
                                    <Link to="/login" className="btn-secondary rounded-[1.1rem] px-5 py-2 text-xs">
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
                                <Link to="/register" className="btn-secondary rounded-[1.1rem] px-5 py-2 text-xs">
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
        <div className="flex items-center gap-3">
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
                className="btn-secondary rounded-[1.1rem] px-5 py-2 text-xs"
            >
                Sign Out
            </button>
        </div>
    );
}

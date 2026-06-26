import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const Game = lazy(() => import('../pages/Game'));
const Home = lazy(() => import('../pages/Home'));
const EraPage = lazy(() => import('../pages/EraPage'));
const ThreadDetail = lazy(() => import('../pages/ThreadDetail'));
const Profile = lazy(() => import('../pages/Profile'));
const Tours = lazy(() => import('../pages/Tours'));
const LeaderboardPage = lazy(() => import('../pages/Leaderboard'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));

function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    );
}

function PageLoader() {
    return (
        <div className="min-h-[60vh] max-w-[1280px] mx-auto px-6 md:px-12 pt-28 pb-24 space-y-6">
            <div className="skeleton h-7 w-28" />
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-5 space-y-4">
                    <div className="skeleton h-5 w-20" style={{ borderRadius: '0.5rem' }} />
                    <div className="skeleton h-20 w-full" style={{ borderRadius: '1rem' }} />
                    <div className="skeleton h-4 w-3/4" style={{ borderRadius: '0.5rem' }} />
                    <div className="flex gap-3">
                        <div className="skeleton h-11 w-36" style={{ borderRadius: '1rem' }} />
                        <div className="skeleton h-11 w-32" style={{ borderRadius: '1rem' }} />
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-7 skeleton h-[320px]" style={{ borderRadius: '1.5rem' }} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-28" style={{ borderRadius: '1rem' }} />
                ))}
            </div>
        </div>
    );
}

export default function AppRouter() {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<PageTransition><Game /></PageTransition>} />
                        <Route path="/archive" element={<PageTransition><Home /></PageTransition>} />
                        <Route path="/era/:slug" element={<PageTransition><EraPage /></PageTransition>} />
                        <Route path="/thread/:id" element={<PageTransition><ThreadDetail /></PageTransition>} />
                        <Route path="/login/*" element={<PageTransition><Login /></PageTransition>} />
                        <Route path="/register/*" element={<PageTransition><Register /></PageTransition>} />
                        <Route path="/profile/:username" element={<PageTransition><Profile /></PageTransition>} />
                        <Route path="/game" element={<Navigate to="/" replace />} />
                        <Route path="/tours" element={<PageTransition><Tours /></PageTransition>} />
                        <Route path="/leaderboard" element={<PageTransition><LeaderboardPage /></PageTransition>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

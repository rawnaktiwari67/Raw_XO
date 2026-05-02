import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import EraPage from '../pages/EraPage';
import ThreadDetail from '../pages/ThreadDetail';
import Profile from '../pages/Profile';
import Game from '../pages/Game';
import Tours from '../pages/Tours';
import LeaderboardPage from '../pages/Leaderboard';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));

function AuthPageLoader() {
    return (
        <div className="min-h-screen px-6 py-28">
            <div className="mx-auto h-[420px] w-full max-w-[440px] animate-pulse rounded-[1.6rem] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.28)]" />
        </div>
    );
}

export default function AppRouter() {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
                <Suspense fallback={<AuthPageLoader />}>
                    <Routes>
                        <Route path="/" element={<Game />} />
                        <Route path="/archive" element={<Home />} />
                        <Route path="/era/:slug" element={<EraPage />} />
                        <Route path="/thread/:id" element={<ThreadDetail />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/profile/:username" element={<Profile />} />
                        <Route path="/game" element={<Navigate to="/" replace />} />
                        <Route path="/tours" element={<Tours />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

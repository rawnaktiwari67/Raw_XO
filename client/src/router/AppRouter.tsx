import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

function PageLoader() {
    return (
        <div className="min-h-screen px-6 py-28">
            <div className="mx-auto h-12 w-36 animate-pulse rounded bg-white/[0.04]" />
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
                        <Route path="/" element={<Game />} />
                        <Route path="/archive" element={<Home />} />
                        <Route path="/era/:slug" element={<EraPage />} />
                        <Route path="/thread/:id" element={<ThreadDetail />} />
                        <Route path="/login/*" element={<Login />} />
                        <Route path="/register/*" element={<Register />} />
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

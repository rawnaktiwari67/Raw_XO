import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import EraPage from '../pages/EraPage';
import ThreadDetail from '../pages/ThreadDetail';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Profile from '../pages/Profile';
import Game from '../pages/Game';
import Tours from '../pages/Tours';
import LeaderboardPage from '../pages/Leaderboard';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function AppRouter() {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
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
            </main>
            <Footer />
        </div>
    );
}

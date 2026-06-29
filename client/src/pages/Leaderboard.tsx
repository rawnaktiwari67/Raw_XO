import { motion } from 'framer-motion';
import Leaderboard from '../components/game/Leaderboard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function LeaderboardPage() {
    useDocumentMeta({
        title: 'Leaderboard — Raw XO',
        description: 'Daily and all-time leaderboards, sliceable by artist and genre. See how good your ear really is.',
    });
    return (
        <div className="max-w-[880px] mx-auto px-6 md:px-12 pt-28 pb-14">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <p className="label-xs mb-4">Community Scores</p>
                <h1 className="display-lg mb-4">Top listeners this season</h1>
                <p className="text-text-3 text-sm mb-8">Ranking is based on total points from game sessions.</p>
                <Leaderboard />
            </motion.div>
        </div>
    );
}

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function NotFound() {
    useDocumentMeta({
        title: 'Page not found — Raw XO',
        description: 'That page does not exist. Head back and play a round instead.',
    });

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-[880px] flex-col items-start justify-center px-6 pb-14 pt-28 md:px-12">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <p className="label-xs mb-4">404 — Off The Record</p>
                <h1 className="display-lg mb-4">This track doesn&rsquo;t exist.</h1>
                <p className="mb-8 max-w-md text-sm text-text-3">
                    Whatever you were looking for isn&rsquo;t in the crate. The game, the diary, and the
                    boards are all still where you left them.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-full bg-amber px-6 py-3 text-sm font-semibold text-bg transition-transform duration-200 hover:scale-[1.02]"
                    >
                        Play a round
                    </Link>
                    <Link
                        to="/archive"
                        className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-text-1 ring-1 ring-white/15 transition-colors duration-200 hover:bg-white/[0.06]"
                    >
                        Open the diary
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}

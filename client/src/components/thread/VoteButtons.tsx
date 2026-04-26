import { motion } from 'framer-motion';

interface Props {
    upvotes: number;
    hasUpvoted: boolean;
    hasDownvoted: boolean;
    onUpvote: () => void;
    onDownvote: () => void;
}

export default function VoteButtons({ upvotes, hasUpvoted, hasDownvoted, onUpvote, onDownvote }: Props) {
    return (
        <div className="flex items-center gap-1">
            <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onUpvote}
                aria-label="Upvote"
                className={`p-1.5 rounded-lg transition-all duration-200 text-sm ${hasUpvoted
                        ? 'text-sunset-orange bg-sunset-orange/15'
                        : 'text-text-subtle hover:text-sunset-orange hover:bg-sunset-orange/10'
                    }`}
            >
                ▲
            </motion.button>
            <span className={`text-xs font-semibold min-w-[20px] text-center ${hasUpvoted ? 'text-sunset-orange' : 'text-text-subtle'}`}>
                {upvotes}
            </span>
            <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onDownvote}
                aria-label="Downvote"
                className={`p-1.5 rounded-lg transition-all duration-200 text-sm ${hasDownvoted
                        ? 'text-blue-400 bg-blue-400/15'
                        : 'text-text-subtle hover:text-blue-400 hover:bg-blue-400/10'
                    }`}
            >
                ▼
            </motion.button>
        </div>
    );
}

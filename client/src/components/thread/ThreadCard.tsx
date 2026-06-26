import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Thread } from '../../types/thread';
import VoteButtons from './VoteButtons';
import { useAuthStore } from '../../stores/authStore';
import { avatarInitial } from '../../utils/avatar';

interface Props {
    thread: Thread;
    onVote?: (id: string, type: 'up' | 'down') => void;
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function ThreadCard({ thread, onVote }: Props) {
    const { user } = useAuthStore();
    const upvoteCount = thread.upvotes.length;
    const hasUpvoted = user ? thread.upvotes.includes(user._id) : false;
    const hasDownvoted = user ? thread.downvotes.includes(user._id) : false;
    const accentColor = thread.era?.accentColor ?? '#FF7A3D';

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
            whileHover={{ y: -3, boxShadow: `0 0 32px ${accentColor}18, 0 8px 40px rgba(0,0,0,0.40)` }}
            className="group glass-surface p-5 flex flex-col gap-4 cursor-default"
            style={{ transition: 'box-shadow 280ms ease, transform 280ms ease' }}
        >
            {/* Era accent bar — top edge */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[1.25rem] opacity-0 group-hover:opacity-70 transition-opacity duration-400"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            />

            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
                <Link
                    to={`/thread/${thread._id}`}
                    className="font-heading font-semibold text-text-warm hover:text-peach-glow transition-colors duration-200 text-base leading-snug line-clamp-2 flex-1"
                >
                    {thread.title}
                </Link>
                {thread.isPinned && (
                    <span className="shrink-0 text-[11px] bg-highlight-gold/15 text-highlight-gold px-2.5 py-0.5 rounded-full border border-highlight-gold/25 font-medium">
                        Pinned
                    </span>
                )}
            </div>

            {/* Body preview */}
            <p className="text-text-subtle text-sm line-clamp-2 leading-relaxed -mt-1">
                {thread.body}
            </p>

            {/* Tags */}
            {thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {thread.tags.slice(0, 4).map((tag) => (
                        <span
                            key={tag}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-text-subtle border border-white/[0.08] hover:border-white/20 hover:text-text-muted transition-colors duration-150"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Meta row */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                <div className="flex items-center gap-3 text-xs text-text-subtle">
                    {/* Author */}
                    <Link
                        to={`/profile/${thread.author.username}`}
                        className="flex items-center gap-1.5 hover:text-text-warm transition-colors duration-150"
                    >
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-dusk-navy shrink-0"
                            style={{ background: accentColor }}
                        >
                            {avatarInitial(thread.author.username)}
                        </div>
                        <span className="font-medium">{thread.author.username}</span>
                    </Link>

                    <span className="text-white/20">·</span>
                    <span className="opacity-60">{timeAgo(thread.createdAt)}</span>
                    <span className="text-white/20">·</span>

                    <Link
                        to={`/thread/${thread._id}`}
                        className="flex items-center gap-1 hover:text-text-warm transition-colors duration-150"
                    >
                        <span>💬</span>
                        <span>{thread.commentCount}</span>
                    </Link>
                </div>

                <VoteButtons
                    upvotes={upvoteCount}
                    hasUpvoted={hasUpvoted}
                    hasDownvoted={hasDownvoted}
                    onUpvote={() => onVote?.(thread._id, 'up')}
                    onDownvote={() => onVote?.(thread._id, 'down')}
                />
            </div>
        </motion.article>
    );
}

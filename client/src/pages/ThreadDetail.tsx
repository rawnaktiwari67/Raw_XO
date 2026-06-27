import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useThreadStore } from '../stores/threadStore';
import { useCommentStore } from '../stores/commentStore';
import { useAuthStore } from '../stores/authStore';
import VoteButtons from '../components/thread/VoteButtons';
import CommentCard from '../components/comment/CommentCard';
import { avatarInitial } from '../utils/avatar';

export default function ThreadDetail() {
    const { id } = useParams<{ id: string }>();
    const { currentThread, fetchThread, voteThread, isLoading: threadLoading, error: threadError } = useThreadStore();
    const { comments, isLoading: commentsLoading, fetchComments, addComment, clearComments } = useCommentStore();
    const { user, isAuthenticated } = useAuthStore();
    const [commentBody, setCommentBody] = useState('');
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchThread(id);
        fetchComments(id);
        return () => clearComments();
    }, [id, fetchThread, fetchComments, clearComments]);

    const topLevel = comments.filter((c) => !c.parent);

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentBody.trim() || !id) return;
        setPosting(true);
        try {
            await addComment({ threadId: id, body: commentBody });
            setCommentBody('');
        } finally {
            setPosting(false);
        }
    };

    if (!currentThread) {
        if (threadError && !threadLoading) return (
            <div className="max-w-3xl mx-auto px-4 py-24 text-center">
                <p className="label-xs mb-3 text-accent">Thread</p>
                <h1 className="font-heading text-[clamp(1.8rem,5vw,2.8rem)] leading-[0.95] text-text-1">
                    This thread isn't here anymore.
                </h1>
                <p className="mt-4 text-sm text-text-3">It may have been removed, or the link is broken.</p>
                <Link to="/archive" className="btn-secondary mt-8 inline-block rounded-[1rem] px-6 py-3 text-sm">
                    Back to culture
                </Link>
            </div>
        );

        return (
            <div className="max-w-3xl mx-auto px-4 py-12">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton mt-5 h-9 w-3/4 rounded-lg" />
                <div className="mt-4 space-y-2.5">
                    <div className="skeleton h-3.5 w-full rounded" />
                    <div className="skeleton h-3.5 w-11/12 rounded" />
                    <div className="skeleton h-3.5 w-4/5 rounded" />
                </div>
                <div className="skeleton mt-8 h-12 w-full rounded-xl" />
                <div className="mt-6 space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="skeleton h-20 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const t = currentThread;
    const hasUpvoted = user ? t.upvotes.includes(user._id) : false;
    const hasDownvoted = user ? t.downvotes.includes(user._id) : false;

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-text-subtle text-sm mb-6">
                <Link to="/" className="hover:text-text-warm">Home</Link>
                <span>›</span>
                <Link to={`/era/${t.era.slug}`} className="hover:text-text-warm" style={{ color: t.era.accentColor }}>
                    {t.era.name}
                </Link>
                <span>›</span>
                <span className="truncate max-w-[200px]">{t.title}</span>
            </div>

            {/* Thread */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-surface p-6 mb-6"
                style={{ borderTop: `2px solid ${t.era.accentColor}` }}
            >
                <h1 className="font-heading font-bold text-2xl sm:text-3xl text-text-warm mb-4 leading-tight">{t.title}</h1>
                <p className="text-text-muted leading-relaxed whitespace-pre-wrap">{t.body}</p>

                {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {t.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-subtle border border-white/10">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm text-text-subtle">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-dusk-navy"
                            style={{ background: t.era.accentColor }}>
                            {avatarInitial(t.author.username)}
                        </div>
                        <Link to={`/profile/${t.author.username}`} className="hover:text-text-warm">{t.author.username}</Link>
                        <span className="text-xs text-text-subtle">{t.author.levelBadge}</span>
                        <span>·</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{t.commentCount} comments</span>
                    </div>
                    <VoteButtons
                        upvotes={t.upvotes.length}
                        hasUpvoted={hasUpvoted}
                        hasDownvoted={hasDownvoted}
                        onUpvote={() => voteThread(t._id, 'up')}
                        onDownvote={() => voteThread(t._id, 'down')}
                    />
                </div>
            </motion.div>

            {/* Comment Form */}
            {isAuthenticated ? (
                <form onSubmit={handleComment} className="glass-surface p-4 mb-6 flex gap-3">
                    <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="flex-1 bg-dusk-purple/50 border border-white/10 rounded-xl px-4 py-2.5 text-text-warm text-sm placeholder-text-subtle focus:outline-none focus:border-sunset-orange/50 resize-none"
                    />
                    <button
                        type="submit"
                        disabled={posting}
                        className="px-5 py-2.5 bg-sunset-orange text-dusk-navy font-bold text-sm rounded-xl hover:bg-peach-glow transition-all shadow-glow-orange self-end disabled:opacity-50"
                    >
                        {posting ? '...' : 'Post'}
                    </button>
                </form>
            ) : (
                <div className="glass-surface p-4 mb-6 text-center text-text-subtle text-sm">
                    <Link to="/login" className="text-sunset-orange hover:text-peach-glow">Login</Link> to join the discussion
                </div>
            )}

            {/* Comments */}
            <div className="glass-surface p-4">
                <h2 className="font-heading font-semibold text-text-warm mb-4">{comments.length} Comments</h2>
                {commentsLoading ? (
                    <div className="flex flex-col gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
                ) : topLevel.length === 0 ? (
                    <p className="text-text-subtle text-sm text-center py-6">No comments yet — be the first.</p>
                ) : (
                    topLevel.map((c) => (
                        <CommentCard key={c._id} comment={c} threadId={t._id} allComments={comments} />
                    ))
                )}
            </div>
        </div>
    );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Comment } from '../../types/comment';
import { useAuthStore } from '../../stores/authStore';
import { useCommentStore } from '../../stores/commentStore';
import { avatarInitial, avatarHue } from '../../utils/avatar';

interface Props {
    comment: Comment;
    threadId: string;
    depth?: number;
    allComments: Comment[];
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommentCard({ comment, threadId, depth = 0, allComments }: Props) {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.body);
    const { user } = useAuthStore();
    const { addComment, editComment, removeComment, voteComment } = useCommentStore();

    const replies = allComments.filter((c) => c.parent === comment._id);
    const hasVoted = user ? comment.upvotes.includes(user._id) : false;
    const isAuthor = user?._id === comment.author._id;

    const handleReply = async () => {
        if (!replyText.trim()) return;
        await addComment({ threadId, parentId: comment._id, body: replyText });
        setReplyText('');
        setShowReply(false);
    };

    const handleEdit = async () => {
        if (!editText.trim()) return;
        await editComment(comment._id, editText);
        setIsEditing(false);
    };

    return (
        <div className={`${depth > 0 ? 'ml-6 border-l border-white/10 pl-4' : ''}`}>
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-3"
            >
                {/* Author / time */}
                <div className="flex items-center gap-2 mb-2">
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-dusk-navy"
                        style={{ background: `hsl(${avatarHue(comment.author.username)}, 60%, 60%)` }}
                    >
                        {avatarInitial(comment.author.username)}
                    </div>
                    <span className="text-text-warm text-sm font-medium">{comment.author.username}</span>
                    <span className="text-text-subtle text-xs">{comment.author.levelBadge}</span>
                    <span className="text-text-subtle text-xs">· {timeAgo(comment.createdAt)}</span>
                </div>

                {/* Body */}
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-dusk-purple/50 border border-white/10 rounded-xl p-3 text-text-warm text-sm resize-none focus:outline-none focus:border-sunset-orange/50"
                            rows={3}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleEdit} className="text-xs text-sunset-orange hover:text-peach-glow">Save</button>
                            <button onClick={() => setIsEditing(false)} className="text-xs text-text-subtle hover:text-text-muted">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <p className="text-text-muted text-sm leading-relaxed">{comment.isDeleted ? '[deleted]' : comment.body}</p>
                )}

                {/* Actions */}
                {!comment.isDeleted && (
                    <div className="flex items-center gap-3 mt-2">
                        <button
                            onClick={() => user && voteComment(comment._id, user._id)}
                            className={`flex items-center gap-1 text-xs transition-colors ${hasVoted ? 'text-sunset-orange' : 'text-text-subtle hover:text-sunset-orange'}`}
                        >
                            ▲ {comment.upvotes.length}
                        </button>
                        {user && depth < 3 && (
                            <button
                                onClick={() => setShowReply(!showReply)}
                                className="text-xs text-text-subtle hover:text-text-warm transition-colors"
                            >
                                Reply
                            </button>
                        )}
                        {isAuthor && (
                            <>
                                <button onClick={() => setIsEditing(true)} className="text-xs text-text-subtle hover:text-text-warm transition-colors">Edit</button>
                                <button onClick={() => removeComment(comment._id)} className="text-xs text-text-subtle hover:text-red-400 transition-colors">Delete</button>
                            </>
                        )}
                    </div>
                )}

                {/* Reply input */}
                <AnimatePresence>
                    {showReply && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 flex gap-2"
                        >
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 bg-dusk-purple/50 border border-white/10 rounded-xl p-3 text-text-warm text-sm resize-none focus:outline-none focus:border-sunset-orange/50"
                                rows={2}
                            />
                            <button
                                onClick={handleReply}
                                className="px-4 py-2 bg-sunset-orange text-dusk-navy text-sm font-semibold rounded-xl hover:bg-peach-glow transition-colors self-end"
                            >
                                Post
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Nested replies */}
            {replies.map((reply) => (
                <CommentCard key={reply._id} comment={reply} threadId={threadId} depth={depth + 1} allComments={allComments} />
            ))}
        </div>
    );
}

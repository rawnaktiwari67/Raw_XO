import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import XPBar from '../components/user/XPBar';
import api from '../services/api';
import type { User } from '../types/user';
import type { Thread } from '../types/thread';
import type { Comment } from '../types/comment';

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const { user: me } = useAuthStore();
    const isMe = me?.username === username;

    const [profile, setProfile] = useState<User | null>(null);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [tab, setTab] = useState<'threads' | 'comments'>('threads');
    const [editBio, setEditBio] = useState(false);
    const [bioText, setBioText] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get(`/api/v1/users/${username}`).then((res) => {
            setProfile(res.data.data);
            setBioText(res.data.data.bio || '');
        }).catch(() => { });
    }, [username]);

    useEffect(() => {
        if (!isMe) return;
        api.get('/api/v1/users/me/threads').then((r) => setThreads(r.data.data)).catch(() => { });
        api.get('/api/v1/users/me/comments').then((r) => setComments(r.data.data)).catch(() => { });
    }, [isMe]);

    const saveBio = async () => {
        setSaving(true);
        try {
            await api.put('/api/v1/users/me', { bio: bioText });
            setProfile((p) => p ? { ...p, bio: bioText } : p);
            setEditBio(false);
        } finally {
            setSaving(false);
        }
    };

    if (!profile) return (
        <div className="max-w-2xl mx-auto px-4 py-12 text-center text-text-subtle">
            <div className="text-4xl mb-3 animate-pulse">🌙</div>
            <p>Loading profile...</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            {/* Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-surface p-6 mb-6"
            >
                <div className="flex items-start gap-4">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-dusk-navy shrink-0"
                        style={{ background: `hsl(${username!.charCodeAt(0) * 7 % 360}, 60%, 60%)` }}
                    >
                        {profile.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="font-heading font-bold text-2xl text-text-warm">{profile.username}</h1>
                            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: '#FF7A3D', color: '#FF7A3D' }}>
                                {profile.levelBadge}
                            </span>
                        </div>
                        <div className="text-text-subtle text-sm mt-1">Level {profile.level} · {profile.xp} XP</div>

                        {editBio && isMe ? (
                            <div className="flex gap-2 mt-3">
                                <input
                                    value={bioText}
                                    onChange={(e) => setBioText(e.target.value)}
                                    maxLength={300}
                                    className="flex-1 bg-dusk-purple/50 border border-white/10 rounded-xl px-3 py-2 text-text-warm text-sm focus:outline-none focus:border-sunset-orange/50"
                                />
                                <button onClick={saveBio} disabled={saving} className="px-3 py-1.5 text-xs bg-sunset-orange text-dusk-navy rounded-xl font-bold">Save</button>
                                <button onClick={() => setEditBio(false)} className="px-3 py-1.5 text-xs text-text-subtle hover:text-text-muted">Cancel</button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 mt-2">
                                <p className="text-text-muted text-sm leading-relaxed">{profile.bio || <span className="text-text-subtle italic">No bio yet</span>}</p>
                                {isMe && (
                                    <button onClick={() => setEditBio(true)} className="text-text-subtle text-xs hover:text-sunset-orange shrink-0">✏️ Edit</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5">
                    <XPBar xp={profile.xp} level={profile.level} badge={profile.levelBadge} />
                </div>
            </motion.div>

            {/* History (only for own profile in MVP) */}
            {isMe && (
                <>
                    <div className="flex gap-2 mb-4">
                        {(['threads', 'comments'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === t ? 'bg-sunset-orange text-dusk-navy' : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
                            >
                                {t === 'threads' ? `🧵 Threads (${threads.length})` : `💬 Comments (${comments.length})`}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {tab === 'threads' ? (
                            threads.length === 0 ? (
                                <div className="text-text-subtle text-sm text-center py-8">No threads yet.</div>
                            ) : threads.map((thread) => (
                                <div key={thread._id} className="glass-surface p-4">
                                    <a href={`/thread/${thread._id}`} className="font-heading font-semibold text-text-warm hover:text-sunset-orange transition-colors block mb-1">
                                        {thread.title}
                                    </a>
                                    <div className="flex gap-3 text-xs text-text-subtle">
                                        <span>Era: {(thread.era as unknown as { name: string })?.name || 'Unknown'}</span>
                                        <span>·</span>
                                        <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                                        <span>·</span>
                                        <span>{thread.upvotes.length} upvotes</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            comments.length === 0 ? (
                                <div className="text-text-subtle text-sm text-center py-8">No comments yet.</div>
                            ) : comments.map((comment) => (
                                <div key={comment._id} className="glass-surface p-4">
                                    <p className="text-text-muted text-sm line-clamp-2">{comment.body}</p>
                                    <div className="text-xs text-text-subtle mt-1">{new Date(comment.createdAt).toLocaleDateString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useThreadStore } from '../stores/threadStore';
import { useAuthStore } from '../stores/authStore';
import ThreadCard from '../components/thread/ThreadCard';
import type { Era } from '../types/thread';

export default function EraPage() {
    const { slug } = useParams<{ slug: string }>();
    const [era, setEra] = useState<Era | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { threads, totalPages, currentPage, sort, isLoading, fetchThreads, createThread, voteThread, setSort } = useThreadStore();
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!slug) return;
        api.get(`/api/v1/eras/${slug}`).then((res) => setEra(res.data.data)).catch(() => { });
        fetchThreads(slug, 1);
    }, [slug, sort, fetchThreads]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!era || !title.trim() || !body.trim()) return;
        setSubmitting(true);
        try {
            await createThread({ title, body, eraId: era._id, tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean) });
            setTitle(''); setBody(''); setTagInput(''); setShowForm(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Era Header */}
            {era && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-2 text-text-subtle text-sm mb-3">
                        <Link to="/" className="hover:text-text-warm">Home</Link>
                        <span>›</span>
                        <span style={{ color: era.accentColor }}>{era.name}</span>
                    </div>
                    <div className="glass-surface p-6 mb-6" style={{ borderLeft: `3px solid ${era.accentColor}` }}>
                        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-text-warm mb-2">{era.name}</h1>
                        <p className="text-text-muted leading-relaxed">{era.description}</p>
                    </div>
                </motion.div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex gap-2">
                    {(['latest', 'top'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => { setSort(s); if (slug) fetchThreads(slug, 1); }}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${sort === s ? 'bg-sunset-orange text-dusk-navy' : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
                        >
                            {s === 'latest' ? '🕐 Latest' : '🔥 Top'}
                        </button>
                    ))}
                </div>
                {isAuthenticated && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-1.5 bg-sunset-orange/15 border border-sunset-orange/30 text-sunset-orange text-sm font-medium rounded-xl hover:bg-sunset-orange/25 transition-all"
                    >
                        {showForm ? '✕ Cancel' : '+ New Thread'}
                    </button>
                )}
            </div>

            {/* Thread Form */}
            {showForm && isAuthenticated && (
                <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onSubmit={handleCreate}
                    className="glass-surface p-5 mb-5 flex flex-col gap-3"
                >
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Thread title..."
                        required
                        className="w-full bg-dusk-purple/50 border border-white/10 rounded-xl px-4 py-3 text-text-warm placeholder-text-subtle focus:outline-none focus:border-sunset-orange/50"
                    />
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Share your thoughts, theory, or hot take..."
                        required
                        rows={4}
                        className="w-full bg-dusk-purple/50 border border-white/10 rounded-xl px-4 py-3 text-text-warm placeholder-text-subtle focus:outline-none focus:border-sunset-orange/50 resize-none"
                    />
                    <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Tags: theory, lyrics, symbolism (comma-separated)"
                        className="w-full bg-dusk-purple/50 border border-white/10 rounded-xl px-4 py-2.5 text-text-muted text-sm placeholder-text-subtle focus:outline-none focus:border-sunset-orange/50"
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="self-end px-6 py-2.5 bg-sunset-orange text-dusk-navy font-bold rounded-xl hover:bg-peach-glow transition-all shadow-glow-orange disabled:opacity-50"
                    >
                        {submitting ? 'Posting...' : 'Post Thread'}
                    </button>
                </motion.form>
            )}

            {/* Thread List */}
            {isLoading ? (
                <div className="flex flex-col gap-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="glass-surface h-40 animate-pulse" />
                    ))}
                </div>
            ) : threads.length === 0 ? (
                <div className="text-center py-16 text-text-subtle">
                    <div className="text-4xl mb-3">🌙</div>
                    <p>No threads yet. Be the first to start the conversation.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {threads.map((t) => (
                        <ThreadCard key={t._id} thread={t} onVote={voteThread} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-3 mt-8">
                    <button
                        disabled={currentPage <= 1}
                        onClick={() => slug && fetchThreads(slug, currentPage - 1)}
                        className="px-4 py-2 glass-surface text-sm text-text-muted hover:text-text-warm disabled:opacity-40 rounded-xl"
                    >
                        ← Prev
                    </button>
                    <span className="px-4 py-2 text-text-subtle text-sm self-center">{currentPage} / {totalPages}</span>
                    <button
                        disabled={currentPage >= totalPages}
                        onClick={() => slug && fetchThreads(slug, currentPage + 1)}
                        className="px-4 py-2 glass-surface text-sm text-text-muted hover:text-text-warm disabled:opacity-40 rounded-xl"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

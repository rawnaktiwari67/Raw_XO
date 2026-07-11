import { create } from 'zustand';
import type { Comment, CreateCommentPayload } from '../types/comment';
import { commentService } from '../services/commentService';

interface CommentState {
    comments: Comment[];
    isLoading: boolean;
    fetchComments: (threadId: string) => Promise<void>;
    addComment: (data: CreateCommentPayload) => Promise<void>;
    editComment: (id: string, body: string) => Promise<void>;
    removeComment: (id: string) => Promise<void>;
    voteComment: (id: string, userId: string) => Promise<void>;
    clearComments: () => void;
}

export const useCommentStore = create<CommentState>((set) => ({
    comments: [],
    isLoading: false,

    fetchComments: async (threadId) => {
        set({ isLoading: true });
        try {
            const res = await commentService.getComments(threadId);
            set({ comments: res.data.data, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    addComment: async (data) => {
        const res = await commentService.create(data);
        set((s) => ({ comments: [...s.comments, res.data.data] }));
    },

    editComment: async (id, body) => {
        const res = await commentService.update(id, body);
        set((s) => ({ comments: s.comments.map((c) => (c._id === id ? res.data.data : c)) }));
    },

    removeComment: async (id) => {
        await commentService.delete(id);
        // Soft-delete in place to mirror the server: filtering the comment out
        // entirely would unmount its card — and every reply nested under it —
        // instead of showing the intended '[deleted]' tombstone.
        set((s) => ({
            comments: s.comments.map((c) =>
                c._id === id ? { ...c, isDeleted: true, body: '' } : c
            ),
        }));
    },

    voteComment: async (id, userId) => {
        await commentService.vote(id);
        set((s) => ({
            comments: s.comments.map((c) => {
                if (c._id !== id) return c;
                const voted = c.upvotes.includes(userId);
                return {
                    ...c,
                    upvotes: voted
                        ? c.upvotes.filter((u) => u !== userId)
                        : [...c.upvotes, userId],
                };
            }),
        }));
    },

    clearComments: () => set({ comments: [] }),
}));

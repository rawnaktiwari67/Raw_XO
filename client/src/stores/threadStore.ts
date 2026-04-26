import { create } from 'zustand';
import type { Thread, CreateThreadPayload } from '../types/thread';
import { threadService } from '../services/threadService';

interface ThreadState {
    threads: Thread[];
    currentThread: Thread | null;
    totalPages: number;
    currentPage: number;
    sort: 'latest' | 'top';
    isLoading: boolean;
    error: string | null;
    fetchThreads: (era: string, page?: number) => Promise<void>;
    fetchThread: (id: string) => Promise<void>;
    createThread: (data: CreateThreadPayload) => Promise<void>;
    updateThread: (id: string, data: Partial<CreateThreadPayload>) => Promise<void>;
    deleteThread: (id: string) => Promise<void>;
    voteThread: (id: string, type: 'up' | 'down') => Promise<void>;
    setSort: (sort: 'latest' | 'top') => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
    threads: [],
    currentThread: null,
    totalPages: 1,
    currentPage: 1,
    sort: 'latest',
    isLoading: false,
    error: null,

    fetchThreads: async (era, page = 1) => {
        set({ isLoading: true });
        try {
            const res = await threadService.getThreads({ era, sort: get().sort, page, limit: 15 });
            set({ threads: res.data.data.threads, totalPages: res.data.data.totalPages, currentPage: page, isLoading: false });
        } catch {
            set({ isLoading: false, error: 'Failed to load threads' });
        }
    },

    fetchThread: async (id) => {
        set({ isLoading: true, currentThread: null });
        try {
            const res = await threadService.getThread(id);
            set({ currentThread: res.data.data, isLoading: false });
        } catch {
            set({ isLoading: false, error: 'Thread not found' });
        }
    },

    createThread: async (data) => {
        const res = await threadService.create(data);
        set((s) => ({ threads: [res.data.data, ...s.threads] }));
    },

    updateThread: async (id, data) => {
        const res = await threadService.update(id, data);
        set((s) => ({
            threads: s.threads.map((t) => (t._id === id ? res.data.data : t)),
            currentThread: s.currentThread?._id === id ? res.data.data : s.currentThread,
        }));
    },

    deleteThread: async (id) => {
        await threadService.delete(id);
        set((s) => ({ threads: s.threads.filter((t) => t._id !== id) }));
    },

    voteThread: async (id, type) => {
        const res = await threadService.vote(id, type);
        const { upvotes, downvotes } = res.data.data;
        set((s) => ({
            threads: s.threads.map((t) => t._id === id ? { ...t, upvotes, downvotes } : t),
        }));
    },

    setSort: (sort) => set({ sort }),
}));

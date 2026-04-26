import { create } from 'zustand';
import type { User } from '../types/user';
import { authService } from '../services/authService';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    fetchMe: () => Promise<void>;
    clearSession: () => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    fetchMe: async () => {
        set({ isLoading: true });
        try {
            const res = await authService.getMe();
            set({ user: res.data.data, isAuthenticated: true, isLoading: false });
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false, error: null }),
    clearError: () => set({ error: null }),
}));

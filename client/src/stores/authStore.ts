import { create } from 'zustand';
import type { User } from '../types/user';
import { authService } from '../services/authService';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    fetchMe: () => Promise<User | null>;
    setSession: (user: User) => void;
    clearSession: () => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    fetchMe: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await authService.getMe();
            const user = res.data.data as User;
            set({ user, isAuthenticated: true, isLoading: false, error: null });
            return user;
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false, error: 'Not authenticated' });
            return null;
        }
    },

    setSession: (user) => set({ user, isAuthenticated: true, isLoading: false, error: null }),
    clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false, error: null }),
    clearError: () => set({ error: null }),
}));

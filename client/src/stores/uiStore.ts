import { create } from 'zustand';
import { setMuted } from '../services/sound';

type ModalType = 'login' | 'register' | 'confirm-delete' | null;

const SOUND_KEY = 'rawxo:sound';

// Sound is on by default; only an explicit opt-out is persisted.
function loadSoundEnabled(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(SOUND_KEY) !== 'off';
}

interface UIState {
    isModalOpen: boolean;
    modalType: ModalType;
    sidebarOpen: boolean;
    soundEnabled: boolean;
    openModal: (type: ModalType) => void;
    closeModal: () => void;
    toggleSidebar: () => void;
    toggleSound: () => void;
}

const initialSound = loadSoundEnabled();
setMuted(!initialSound);

export const useUIStore = create<UIState>((set) => ({
    isModalOpen: false,
    modalType: null,
    sidebarOpen: false,
    soundEnabled: initialSound,

    openModal: (type) => set({ isModalOpen: true, modalType: type }),
    closeModal: () => set({ isModalOpen: false, modalType: null }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    toggleSound: () =>
        set((s) => {
            const next = !s.soundEnabled;
            setMuted(!next);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
            }
            return { soundEnabled: next };
        }),
}));

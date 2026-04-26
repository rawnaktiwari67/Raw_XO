import { create } from 'zustand';

type ModalType = 'login' | 'register' | 'confirm-delete' | null;

interface UIState {
    isModalOpen: boolean;
    modalType: ModalType;
    sidebarOpen: boolean;
    openModal: (type: ModalType) => void;
    closeModal: () => void;
    toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isModalOpen: false,
    modalType: null,
    sidebarOpen: false,

    openModal: (type) => set({ isModalOpen: true, modalType: type }),
    closeModal: () => set({ isModalOpen: false, modalType: null }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

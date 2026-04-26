import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import AppRouter from './router/AppRouter';
import { useAuthStore } from './stores/authStore';

function AppShell() {
    return (
        <BrowserRouter>
            <AnimatePresence mode="wait">
                <AppRouter />
            </AnimatePresence>
        </BrowserRouter>
    );
}

function ClerkSessionBridge() {
    const { isLoaded, isSignedIn } = useAuth();
    const { fetchMe, clearSession } = useAuthStore();

    useEffect(() => {
        if (!isLoaded) return;

        if (isSignedIn) {
            void fetchMe();
            return;
        }

        clearSession();
    }, [clearSession, fetchMe, isLoaded, isSignedIn]);

    return <AppShell />;
}

export default function App({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
    if (!clerkEnabled) {
        return <AppShell />;
    }

    return <ClerkSessionBridge />;
}

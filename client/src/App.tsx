import { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import AppRouter from './router/AppRouter';
import { setClerkTokenGetter } from './services/clerkToken';
import { useAuthStore } from './stores/authStore';

function AppShell() {
    return (
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <AnimatePresence mode="wait">
                <AppRouter />
            </AnimatePresence>
        </BrowserRouter>
    );
}

function ClerkSessionBridge() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const { fetchMe, clearSession } = useAuthStore();
    // Track whether we've already registered the token getter this mount
    const tokenGetterSetRef = useRef(false);

    // Always keep the token getter up-to-date. This runs synchronously
    // before the auth-state effect below so that fetchMe() can immediately
    // attach the Clerk JWT to the /auth/me request.
    useEffect(() => {
        setClerkTokenGetter(getToken);
        tokenGetterSetRef.current = true;
    }, [getToken]);

    useEffect(() => {
        if (!isLoaded) return;
        // Ensure token getter is registered before we fetch the profile
        if (!tokenGetterSetRef.current) {
            setClerkTokenGetter(getToken);
            tokenGetterSetRef.current = true;
        }

        if (isSignedIn) {
            void fetchMe();
            return;
        }

        clearSession();
    }, [clearSession, fetchMe, getToken, isLoaded, isSignedIn]);

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-bg text-text-1">
                <div className="mx-auto h-screen max-w-[1280px] px-6 py-28 md:px-12">
                    <div className="h-12 w-36 animate-pulse rounded bg-white/[0.04]" />
                </div>
            </div>
        );
    }

    return <AppShell />;
}

export default function App({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
    if (!clerkEnabled) {
        return <AppShell />;
    }

    return <ClerkSessionBridge />;
}

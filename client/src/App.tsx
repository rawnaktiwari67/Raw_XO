import { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/layout/ErrorBoundary';
import InstallPrompt from './components/layout/InstallPrompt';
import { setClerkTokenGetter } from './services/clerkToken';
import { useAuthStore } from './stores/authStore';

const waitForToken = async (getToken: () => Promise<string | null>) => {
    const delays = [0, 150, 350, 700, 1200];

    for (const delay of delays) {
        if (delay > 0) {
            await new Promise((resolve) => {
                window.setTimeout(resolve, delay);
            });
        }

        const token = await getToken();
        if (token) return token;
    }

    return null;
};

const syncProfileWithRetry = async (fetchMe: () => Promise<unknown>) => {
    const delays = [0, 250, 600, 1200];

    for (const delay of delays) {
        if (delay > 0) {
            await new Promise((resolve) => {
                window.setTimeout(resolve, delay);
            });
        }

        const user = await fetchMe();
        if (user) return true;
    }

    return false;
};

function AppShell() {
    return (
        <ErrorBoundary>
            <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                <AppRouter />
                <InstallPrompt />
            </BrowserRouter>
        </ErrorBoundary>
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

        let isCancelled = false;

        if (isSignedIn) {
            void (async () => {
                const token = await waitForToken(getToken);
                if (isCancelled) return;

                if (token) {
                    await syncProfileWithRetry(fetchMe);
                }
            })();

            return () => {
                isCancelled = true;
            };
        }

        clearSession();
        return () => {
            isCancelled = true;
        };
    }, [clearSession, fetchMe, getToken, isLoaded, isSignedIn]);

    // Render the app immediately — never block first paint on Clerk's SDK. The
    // effects above hydrate auth into authStore in the background once Clerk is
    // loaded; the UI starts in guest state and fills in the signed-in details
    // when they arrive. (Previously this returned a full-screen skeleton until
    // `isLoaded`, which is what froze the deployed site behind a blank splash.)
    return <AppShell />;
}

export default function App({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
    if (!clerkEnabled) {
        return <AppShell />;
    }

    return <ClerkSessionBridge />;
}

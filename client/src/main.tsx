import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import { clerkPublishableKey, clerkSignInUrl, clerkSignUpUrl, shouldUseClerk } from './services/authMode';

// Mount film grain layer outside React tree — survives re-renders, no layout impact
const grain = document.createElement('div');
grain.id = 'grain';
grain.setAttribute('aria-hidden', 'true');
document.body.appendChild(grain);

// Register the service worker in production only, after load so it never
// competes with first paint. Dev keeps the plain module flow (no SW caching).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            /* installability is a progressive enhancement — ignore failures */
        });
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {shouldUseClerk ? (
            <ClerkProvider
                publishableKey={clerkPublishableKey}
                signInUrl={clerkSignInUrl}
                signUpUrl={clerkSignUpUrl}
                signInFallbackRedirectUrl="/"
                signUpFallbackRedirectUrl="/"
            >
                <App clerkEnabled />
            </ClerkProvider>
        ) : (
            <App />
        )}
    </React.StrictMode>
);

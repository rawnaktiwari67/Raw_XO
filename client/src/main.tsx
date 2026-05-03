import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import { shouldUseClerk } from './services/authMode';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Mount film grain layer outside React tree — survives re-renders, no layout impact
const grain = document.createElement('div');
grain.id = 'grain';
grain.setAttribute('aria-hidden', 'true');
document.body.appendChild(grain);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {shouldUseClerk ? (
            <ClerkProvider
                publishableKey={clerkPublishableKey}
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

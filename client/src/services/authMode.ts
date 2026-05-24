const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

export const isClerkEnabled = Boolean(clerkPublishableKey);
export const isClerkTestKey = clerkPublishableKey.startsWith('pk_test_');
export const shouldUseClerk = isClerkEnabled && !(import.meta.env.PROD && isClerkTestKey);

export const clerkDisabledReason = isClerkEnabled && !shouldUseClerk
    ? 'Google sign-in is paused on this deployment until Clerk live keys are added in Vercel.'
    : '';

export const clerkSignInUrl = '/login';
export const clerkSignUpUrl = '/register';

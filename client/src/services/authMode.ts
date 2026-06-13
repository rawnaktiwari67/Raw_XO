const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

export const isClerkEnabled = Boolean(clerkPublishableKey);
export const shouldUseClerk = isClerkEnabled;

export const clerkDisabledReason = '';

export const clerkSignInUrl = '/login';
export const clerkSignUpUrl = '/register';

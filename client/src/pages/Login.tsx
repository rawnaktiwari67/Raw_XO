import { SignIn } from '@clerk/clerk-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { clerkDisabledReason, clerkSignUpUrl, shouldUseClerk } from '../services/authMode';
import { useAuthStore } from '../stores/authStore';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
        const message = response?.data?.error ?? response?.data?.message;
        if (typeof message === 'string' && message.trim()) return message;
    }

    return fallback;
};

export default function Login() {
    const navigate = useNavigate();
    const { setSession } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await authService.login({ email, password });
            setSession(res.data.data);
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err, 'Could not sign in with those details.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return shouldUseClerk ? (
        <div className="min-h-screen px-3 pb-10 pt-20 sm:px-6 sm:py-24">
            <div className="mx-auto flex max-w-[1180px] items-start justify-center">
                <div className="w-full max-w-[440px]">
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-[0.9rem] border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-xs text-text-3 sm:mb-4 sm:rounded-[1rem] sm:px-4">
                        <span>New Google account?</span>
                        <Link to="/register" className="font-semibold text-accent hover:text-text-1">
                            Create account
                        </Link>
                    </div>
                    <SignIn
                        routing="path"
                        path="/login"
                        signUpUrl={clerkSignUpUrl}
                        forceRedirectUrl="/"
                        fallbackRedirectUrl="/"
                        appearance={{
                            elements: {
                                rootBox: 'w-full',
                                cardBox: 'w-full',
                                card: 'w-full rounded-[1rem] border-0 bg-[linear-gradient(180deg,rgba(16,16,20,0.96),rgba(12,12,16,0.96))] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_22px_60px_rgba(0,0,0,0.24)] sm:rounded-[1.4rem] sm:px-8 sm:py-8',
                                headerTitle: 'font-heading text-[1.9rem] leading-[0.96] text-text-1 sm:text-[2.3rem]',
                                headerSubtitle: 'text-sm text-text-3',
                                socialButtonsBlockButton: 'min-h-11 rounded-[0.85rem] border border-white/10 bg-white/[0.03] text-text-1 sm:rounded-[1rem]',
                                formButtonPrimary: 'min-h-11 rounded-[0.85rem] bg-white text-black hover:bg-white/90 sm:rounded-[1rem]',
                                formFieldInput: 'min-h-11 rounded-[0.85rem] border border-white/10 bg-white/[0.03] text-text-1 sm:rounded-[1rem]',
                                footerActionLink: 'text-accent hover:text-text-1',
                                identityPreviewText: 'text-text-2',
                                formFieldLabel: 'text-text-3 uppercase tracking-[0.12em] text-[11px]',
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    ) : (
        <div className="min-h-screen px-3 pb-10 pt-20 sm:px-6 sm:py-24">
            <div className="mx-auto flex max-w-[1180px] items-start justify-center">
                <form
                    onSubmit={handleSubmit}
                    className="w-full max-w-[440px] rounded-[1rem] bg-[linear-gradient(180deg,rgba(16,16,20,0.96),rgba(12,12,16,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_80px_rgba(0,0,0,0.32)] sm:rounded-[1.6rem] sm:p-8"
                >
                    <div className="space-y-3">
                        <h1 className="font-heading text-[1.95rem] leading-[0.96] text-text-1 sm:text-[2.3rem]">Sign in to Raw XO</h1>
                        <p className="text-sm text-text-3">Use your email account to keep your runs and rank.</p>
                    </div>

                    {clerkDisabledReason ? (
                        <div className="mt-6 rounded-[1rem] border border-amber/20 bg-amber/10 px-4 py-3 text-sm text-amber">
                            {clerkDisabledReason}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="mt-6 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <div className="mt-8 space-y-5">
                        <label className="block space-y-2">
                            <span className="label-xs">Email Address</span>
                            <input
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                type="email"
                                autoComplete="email"
                                required
                                className="h-12 w-full rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-1 outline-none transition focus:border-amber/40"
                            />
                        </label>
                        <label className="block space-y-2">
                            <span className="label-xs">Password</span>
                            <input
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                type="password"
                                autoComplete="current-password"
                                required
                                className="h-12 w-full rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-1 outline-none transition focus:border-amber/40"
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-8 h-12 w-full rounded-[1rem] bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                    >
                        {isSubmitting ? 'Signing in' : 'Continue'}
                    </button>

                    <p className="mt-6 text-center text-sm text-text-3">
                        Don't have an account? <Link to="/register" className="text-accent hover:text-text-1">Sign up</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

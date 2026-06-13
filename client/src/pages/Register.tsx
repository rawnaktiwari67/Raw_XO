import { SignUp } from '@clerk/clerk-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { clerkDisabledReason, clerkSignInUrl, shouldUseClerk } from '../services/authMode';
import { useAuthStore } from '../stores/authStore';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
        const message = response?.data?.error ?? response?.data?.message;
        if (typeof message === 'string' && message.trim()) return message;
    }

    return fallback;
};

export default function Register() {
    const navigate = useNavigate();
    const { setSession } = useAuthStore();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await authService.register({ username, email, password });
            setSession(res.data.data);
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err, 'Could not create that account.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return shouldUseClerk ? (
        <div className="min-h-screen px-3 pb-10 pt-20 sm:px-6 sm:py-24">
            <div className="mx-auto flex max-w-[1180px] items-start justify-center">
                <SignUp
                    routing="path"
                    path="/register"
                    signInUrl={clerkSignInUrl}
                    forceRedirectUrl="/"
                    fallbackRedirectUrl="/"
                    appearance={{
                        elements: {
                            rootBox: 'w-full',
                            cardBox: 'w-full max-w-[440px]',
                            card: 'w-full rounded-[1rem] border-0 bg-[linear-gradient(180deg,rgba(16,16,20,0.96),rgba(12,12,16,0.96))] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_80px_rgba(0,0,0,0.32)] sm:rounded-[1.6rem] sm:px-8 sm:py-8',
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
    ) : (
        <div className="min-h-screen px-3 pb-10 pt-20 sm:px-6 sm:py-24">
            <div className="mx-auto flex max-w-[1180px] items-start justify-center">
                <form
                    onSubmit={handleSubmit}
                    className="w-full max-w-[440px] rounded-[1rem] bg-[linear-gradient(180deg,rgba(16,16,20,0.96),rgba(12,12,16,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_80px_rgba(0,0,0,0.32)] sm:rounded-[1.6rem] sm:p-8"
                >
                    <div className="space-y-3">
                        <h1 className="font-heading text-[1.95rem] leading-[0.96] text-text-1 sm:text-[2.3rem]">Join Raw XO</h1>
                        <p className="text-sm text-text-3">Create an email account for saved scores and profile progress.</p>
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
                            <span className="label-xs">Username</span>
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                autoComplete="username"
                                required
                                className="h-12 w-full rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-1 outline-none transition focus:border-amber/40"
                            />
                        </label>
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
                                autoComplete="new-password"
                                minLength={6}
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
                        {isSubmitting ? 'Creating account' : 'Create Account'}
                    </button>

                    <p className="mt-6 text-center text-sm text-text-3">
                        Already have an account? <Link to="/login" className="text-accent hover:text-text-1">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

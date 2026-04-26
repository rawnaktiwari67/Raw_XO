import { SignUp } from '@clerk/clerk-react';

export default function Register() {
    if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
        return (
            <div className="min-h-screen px-6 py-28">
                <div className="mx-auto max-w-xl rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.28)]">
                    <p className="label-xs mb-4">Clerk Setup</p>
                    <h1 className="font-heading text-[2.4rem] leading-[0.92] text-text-1">Add your Clerk keys before opening sign-up.</h1>
                    <p className="mt-3 text-sm leading-relaxed text-text-3">
                        Set `VITE_CLERK_PUBLISHABLE_KEY` in the client env and `CLERK_SECRET_KEY` on the server, then refresh this page.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-6 py-24">
            <div className="mx-auto flex max-w-[1180px] items-start justify-center">
                <SignUp
                    routing="path"
                    path="/register"
                    signInUrl="/login"
                    fallbackRedirectUrl="/"
                    appearance={{
                        elements: {
                            rootBox: 'w-full',
                            cardBox: 'w-full max-w-[440px]',
                            card: 'rounded-[1.6rem] border-0 bg-[linear-gradient(180deg,rgba(16,16,20,0.96),rgba(12,12,16,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_80px_rgba(0,0,0,0.32)]',
                            headerTitle: 'font-heading text-[2.3rem] leading-[0.92] text-text-1',
                            headerSubtitle: 'text-sm text-text-3',
                            socialButtonsBlockButton: 'rounded-[1rem] border border-white/10 bg-white/[0.03] text-text-1',
                            formButtonPrimary: 'rounded-[1rem] bg-white text-black hover:bg-white/90',
                            formFieldInput: 'rounded-[1rem] border border-white/10 bg-white/[0.03] text-text-1',
                            footerActionLink: 'text-accent hover:text-text-1',
                            identityPreviewText: 'text-text-2',
                            formFieldLabel: 'text-text-3 uppercase tracking-[0.12em] text-[11px]',
                        },
                    }}
                />
            </div>
        </div>
    );
}

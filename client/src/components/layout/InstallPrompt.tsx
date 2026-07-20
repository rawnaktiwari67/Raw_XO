import { useEffect, useState } from 'react';

// The browser fires this (Chrome/Edge/Android) when the PWA is installable; we
// capture it, suppress the default mini-infobar, and drive our own "Install app"
// chip so the option is discoverable instead of hidden in browser chrome.
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'rawxo:install-dismissed-until';
const DISMISS_DAYS = 7;

// Already running as an installed app? Then there's nothing to offer.
function isStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

// iOS Safari never fires beforeinstallprompt and has no programmatic install —
// the only path is the Share sheet, so there we show a short how-to instead.
function isIOS() {
    return (
        /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !(window as Window & { MSStream?: unknown }).MSStream
    );
}

function dismissedRecently() {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
}

export default function InstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    // `entered` drives a rAF-triggered CSS transition for the rise-in. A keyframe
    // with `both` fill intermittently stuck at its `from` frame when the chip
    // mounted mid page-churn; a transition flipped on the next frame always lands
    // on the shown state (and snaps instantly under the global reduced-motion rule).
    const [entered, setEntered] = useState(false);
    const [showIosHint, setShowIosHint] = useState(false);

    useEffect(() => {
        if (!visible) {
            setEntered(false);
            return;
        }
        // setTimeout (not requestAnimationFrame) so the shown state still lands
        // when the tab is backgrounded — rAF is paused while hidden, which would
        // leave the chip stuck invisible. The end opacity applies either way; the
        // short delay only lets the from-frame paint so the transition can play.
        const id = window.setTimeout(() => setEntered(true), 30);
        return () => window.clearTimeout(id);
    }, [visible]);

    useEffect(() => {
        if (isStandalone() || dismissedRecently()) return;

        const onBeforeInstall = (event: Event) => {
            // Stop Chrome's own banner; we surface the prompt on our button tap.
            event.preventDefault();
            // Keep the deferred prompt (so a later manual entry point could use it)
            // but honour a same-session dismissal — the event can re-fire.
            setDeferred(event as BeforeInstallPromptEvent);
            if (dismissedRecently() || isStandalone()) return;
            setVisible(true);
        };
        const onInstalled = () => {
            setDeferred(null);
            setVisible(false);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onInstalled);

        // iOS gets the chip too (via the Share-sheet how-to), shown after a beat
        // so it never competes with first paint.
        let iosTimer: number | undefined;
        if (isIOS()) iosTimer = window.setTimeout(() => setVisible(true), 1800);

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
            if (iosTimer) window.clearTimeout(iosTimer);
        };
    }, []);

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
        setVisible(false);
        setShowIosHint(false);
    };

    const handleInstall = async () => {
        if (deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            setDeferred(null);
            setVisible(false);
            // If they said no, respect it and stay quiet for a while.
            if (choice.outcome !== 'accepted') dismiss();
            return;
        }
        // iOS path — toggle the Share-sheet instructions.
        if (isIOS()) setShowIosHint((value) => !value);
    };

    if (!visible) return null;

    return (
        // `install-chip` lets the gameplay-locked body rule hide it while a round
        // is running (mirrors how the header/footer are hidden).
        <div
            className="install-chip pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            style={{
                transition: 'opacity 0.42s cubic-bezier(0.16,1,0.3,1), transform 0.42s cubic-bezier(0.16,1,0.3,1)',
                opacity: entered ? 1 : 0,
                transform: entered ? 'translateY(0)' : 'translateY(24px)',
            }}
        >
            <div className="pointer-events-auto relative w-full max-w-[26rem]">
                {showIosHint ? (
                    <div className="absolute inset-x-0 bottom-[calc(100%+0.6rem)] rounded-[1rem] border border-white/10 bg-[rgba(17,18,24,0.96)] px-4 py-3 text-sm leading-relaxed text-text-2 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
                        <span className="text-text-1">To install:</span> tap the Share
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="mx-1 inline-block h-4 w-4 -translate-y-px text-amber">
                            <path d="M12 3v12M12 3 8 7M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        button, then <span className="text-text-1">“Add to Home Screen.”</span>
                    </div>
                ) : null}

                <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-[rgba(17,18,24,0.92)] p-2.5 pl-4 shadow-[0_16px_44px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] bg-amber/12 text-amber">
                        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                            <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M12 6v7m0 0-2.4-2.4M12 13l2.4-2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-text-1">Install Raw XO</p>
                        <p className="truncate text-xs text-text-3">Full-screen app, instant launch.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleInstall()}
                        className="tap-target inline-flex shrink-0 items-center justify-center rounded-[0.85rem] bg-amber px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.03em] text-ch-0 transition-transform duration-200 active:scale-[0.97]"
                    >
                        Install
                    </button>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Dismiss install prompt"
                        className="tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] text-text-4 transition-colors hover:text-text-2"
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

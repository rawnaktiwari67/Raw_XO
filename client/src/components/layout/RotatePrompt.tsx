// Full-screen "rotate to portrait" nudge for the gameplay cockpit.
//
// The cockpit is a deliberate one-screen PORTRAIT layout (a fixed header /
// board / footer grid). A landscape phone's short viewport can't contain it, so
// rather than show a clipped, half-usable board we cover it with a prompt to
// rotate. Visibility is entirely CSS-driven — see `.rotate-nudge` in index.css:
// it appears only when the round is active (`body.gameplay-locked`) AND the
// viewport is a short, coarse-pointer landscape (a phone held sideways).
// Portrait phones (≥600px tall) and every laptop/desktop never match that query,
// so this element renders once, globally, and simply stays hidden for them.
export default function RotatePrompt() {
    return (
        <div
            className="rotate-nudge fixed inset-0 z-[80] flex-col items-center justify-center gap-6 bg-[#0B0B0F] px-8 text-center"
            role="dialog"
            aria-label="Rotate your device to portrait to keep playing"
        >
            <div className="rotate-nudge-icon text-amber" aria-hidden>
                <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
                    <line x1="10.5" y1="18.8" x2="13.5" y2="18.8" strokeLinecap="round" />
                </svg>
            </div>
            <div>
                <p className="label-xs mb-2 text-amber/80">Raw XO</p>
                <h2 className="font-heading text-[1.9rem] leading-[0.98] tracking-[-0.01em] text-text-1">
                    Turn your phone upright
                </h2>
                <p className="mx-auto mt-2.5 max-w-[21rem] text-sm leading-relaxed text-text-3">
                    The round plays in portrait — rotate to keep going.
                </p>
            </div>
        </div>
    );
}

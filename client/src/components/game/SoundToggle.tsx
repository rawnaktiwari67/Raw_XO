import { useUIStore } from '../../stores/uiStore';
import { unlock } from '../../services/sound';

// Speaker icon that toggles game audio. Mirrors the HUD's quiet, monochrome
// chrome rather than introducing an icon dependency.
export default function SoundToggle({ className = '' }: { className?: string }) {
    const soundEnabled = useUIStore((s) => s.soundEnabled);
    const toggleSound = useUIStore((s) => s.toggleSound);

    const handleClick = () => {
        // Turning sound on counts as the unlocking gesture for the AudioContext.
        if (!soundEnabled) unlock();
        toggleSound();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'Mute game sound' : 'Unmute game sound'}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.05] text-text-3 transition hover:bg-white/[0.1] hover:text-text-1 ${className}`}
        >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path
                    d="M11 5 6 9H3v6h3l5 4V5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {soundEnabled ? (
                    <path
                        d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : (
                    <path
                        d="m16 9 5 6m0-6-5 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
            </svg>
        </button>
    );
}

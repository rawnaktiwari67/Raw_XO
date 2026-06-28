import { useRef, useState } from 'react';
import { renderScorecard, type ScorecardData } from '../../utils/shareCard';

type ShareState = 'idle' | 'working' | 'shared' | 'copied' | 'saved' | 'error';

const FILE_NAME = 'raw-xo-scorecard.png';

function shareUrl() {
    if (typeof window === 'undefined') return '';
    return window.location.origin || '';
}

function shareText(data: ScorecardData) {
    const where = data.artist ? ` on ${data.artist}` : '';
    return `I scored ${data.score.toLocaleString()} on Raw XO — ${data.accuracy}%${where}. Think your ear's better? ${shareUrl()}`.trim();
}

const LABELS: Record<ShareState, string> = {
    idle: 'Share Score',
    working: 'Building…',
    shared: 'Shared',
    copied: 'Link Copied',
    saved: 'Image Saved',
    error: 'Try Again',
};

export default function ShareButton({ data }: { data: ScorecardData }) {
    const [state, setState] = useState<ShareState>('idle');
    const resetTimer = useRef<number>();

    const flash = (next: ShareState) => {
        setState(next);
        window.clearTimeout(resetTimer.current);
        resetTimer.current = window.setTimeout(() => setState('idle'), 2400);
    };

    const handleShare = async () => {
        if (state === 'working') return;
        setState('working');

        try {
            const blob = await renderScorecard(data);
            const file = new File([blob], FILE_NAME, { type: 'image/png' });
            const text = shareText(data);

            // 1. Native share sheet with the image (mobile + supporting browsers).
            const nav = navigator as Navigator & {
                canShare?: (d?: ShareData) => boolean;
            };
            if (nav.share && nav.canShare?.({ files: [file] })) {
                try {
                    await nav.share({ files: [file], text, title: 'Raw XO' });
                    flash('shared');
                    return;
                } catch (err) {
                    // User dismissed the sheet — treat as a no-op, not an error.
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        setState('idle');
                        return;
                    }
                    // Otherwise fall through to the download/copy fallback.
                }
            }

            // 2. Fallback: download the PNG so it can be posted manually…
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = FILE_NAME;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);

            // …and copy the share line + link to the clipboard.
            try {
                await navigator.clipboard?.writeText(text);
                flash('copied');
            } catch {
                flash('saved');
            }
        } catch {
            flash('error');
        }
    };

    return (
        <button
            type="button"
            onClick={handleShare}
            disabled={state === 'working'}
            aria-live="polite"
            className="btn-secondary rounded-[0.85rem] px-5 py-3 text-xs disabled:opacity-70"
        >
            {LABELS[state]}
        </button>
    );
}

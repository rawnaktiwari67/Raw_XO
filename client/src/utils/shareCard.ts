// Hand-drawn shareable scorecard. We render onto a 2D canvas instead of pulling
// in a DOM-to-image dependency (html2canvas et al.) — it keeps the bundle lean
// and gives pixel control over the charcoal/amber look. The output is a portrait
// 1080×1350 PNG, sized for Instagram/WhatsApp story sharing.

export interface ScorecardData {
    score: number;
    accuracy: number;
    correctAnswers: number;
    roundsPlayed: number;
    bestStreak: number;
    artist: string;
    message: string;
    difficulty: string;
}

const WIDTH = 1080;
const HEIGHT = 1350;

// The site leans on Barlow Condensed (headings) and Inter (body). They're loaded
// as web fonts, so we wait on document.fonts before drawing; the fallbacks keep
// the card legible if the network fonts never arrived.
const HEADING_STACK = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif';
const BODY_STACK = 'Inter, "Segoe UI", system-ui, sans-serif';

const COLORS = {
    amber: '#F4A261',
    emerald: '#34D399',
    text1: '#F4F2EC',
    text3: 'rgba(244,242,236,0.66)',
    text4: 'rgba(244,242,236,0.42)',
};

async function waitForFonts() {
    if (typeof document === 'undefined' || !document.fonts?.ready) return;
    try {
        // Nudge the two faces we need, then wait for the set to settle. Guarded so
        // a slow/blocked font request can never hang the share action.
        await Promise.race([
            Promise.all([
                document.fonts.load('700 120px "Barlow Condensed"'),
                document.fonts.load('600 40px Inter'),
                document.fonts.ready,
            ]),
            new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
    } catch {
        /* fall back to the system stack */
    }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Naive word-wrap for the fan message, returns the line count actually drawn.
function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
) {
    const words = text.split(' ');
    let line = '';
    let lines = 0;
    for (let i = 0; i < words.length; i += 1) {
        const test = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, y + lines * lineHeight);
            line = words[i];
            lines += 1;
            if (lines >= maxLines - 1) {
                // Last allowed line: dump the remainder, ellipsing if needed.
                let rest = words.slice(i).join(' ');
                while (ctx.measureText(`${rest}…`).width > maxWidth && rest.includes(' ')) {
                    rest = rest.slice(0, rest.lastIndexOf(' '));
                }
                ctx.fillText(rest.length < text.length ? `${rest}…` : rest, x, y + lines * lineHeight);
                return lines + 1;
            }
        } else {
            line = test;
        }
    }
    ctx.fillText(line, x, y + lines * lineHeight);
    return lines + 1;
}

export async function renderScorecard(data: ScorecardData): Promise<Blob> {
    await waitForFonts();

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Base charcoal wash.
    const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    base.addColorStop(0, '#12110F');
    base.addColorStop(0.55, '#0C0C10');
    base.addColorStop(1, '#070709');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Amber + emerald glows, echoing the recap overlay.
    const amberGlow = ctx.createRadialGradient(180, 200, 0, 180, 200, 720);
    amberGlow.addColorStop(0, 'rgba(244,162,97,0.22)');
    amberGlow.addColorStop(1, 'rgba(244,162,97,0)');
    ctx.fillStyle = amberGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const emeraldGlow = ctx.createRadialGradient(960, 340, 0, 960, 340, 640);
    emeraldGlow.addColorStop(0, 'rgba(16,185,129,0.18)');
    emeraldGlow.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.fillStyle = emeraldGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Hairline frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    roundedRect(ctx, 40, 40, WIDTH - 80, HEIGHT - 80, 44);
    ctx.stroke();

    const padX = 96;

    // Wordmark.
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.amber;
    ctx.font = `700 40px ${BODY_STACK}`;
    ctx.fillText('RAW XO', padX, 168);
    ctx.fillStyle = COLORS.text4;
    ctx.font = `600 26px ${BODY_STACK}`;
    ctx.fillText('FIVE SECONDS · FOUR OPTIONS · ONE INSTINCT', padX, 210);

    // Big score.
    ctx.fillStyle = COLORS.text1;
    ctx.font = `700 280px ${HEADING_STACK}`;
    const scoreText = data.score.toLocaleString();
    ctx.fillText(scoreText, padX, 520);
    ctx.fillStyle = COLORS.amber;
    ctx.font = `600 56px ${HEADING_STACK}`;
    ctx.fillText('POINTS', padX + 6, 580);

    // Fan message.
    ctx.fillStyle = COLORS.text3;
    ctx.font = `500 40px ${BODY_STACK}`;
    wrapText(ctx, data.message, padX, 680, WIDTH - padX * 2, 54, 3);

    // Stat tiles.
    const tiles: Array<[string, string]> = [
        ['CORRECT', `${data.correctAnswers}/${data.roundsPlayed}`],
        ['ACCURACY', `${data.accuracy}%`],
        ['BEST STREAK', String(data.bestStreak)],
    ];
    const gap = 28;
    const tileW = (WIDTH - padX * 2 - gap * 2) / 3;
    const tileH = 220;
    const tileY = 880;
    tiles.forEach(([label, value], i) => {
        const x = padX + i * (tileW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        roundedRect(ctx, x, tileY, tileW, tileH, 28);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.5;
        roundedRect(ctx, x, tileY, tileW, tileH, 28);
        ctx.stroke();

        ctx.fillStyle = COLORS.text4;
        ctx.font = `700 24px ${BODY_STACK}`;
        ctx.fillText(label, x + 28, tileY + 56);
        ctx.fillStyle = i === 1 ? COLORS.amber : COLORS.text1;
        ctx.font = `700 96px ${HEADING_STACK}`;
        ctx.fillText(value, x + 26, tileY + 168);
    });

    // Artist + difficulty chips.
    const chipY = 1170;
    ctx.font = `600 30px ${BODY_STACK}`;
    const drawChip = (text: string, x: number, accent: string) => {
        const w = ctx.measureText(text).width + 56;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundedRect(ctx, x, chipY, w, 64, 32);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x + 28, chipY + 32, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.text1;
        ctx.fillText(text, x + 48, chipY + 42);
        return w;
    };
    const artistChip = data.artist ? `${data.artist}` : 'Mixed shuffle';
    const w1 = drawChip(artistChip, padX, COLORS.amber);
    drawChip(capitalize(data.difficulty), padX + w1 + 20, COLORS.emerald);

    // Footer URL.
    ctx.fillStyle = COLORS.text4;
    ctx.font = `600 30px ${BODY_STACK}`;
    ctx.fillText(shareHost(), padX, HEIGHT - 96);

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to encode scorecard'));
        }, 'image/png');
    });
}

function capitalize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shareHost() {
    if (typeof window === 'undefined') return 'Raw XO';
    return window.location.host || 'Raw XO';
}

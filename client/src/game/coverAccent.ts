// ── Cover-derived secondary accent ───────────────────────────────────────────
// The now-playing capsule pulls its secondary accent live from the current album
// sleeve (amber stays the primary brand colour). This module holds the pure
// colour maths — kept out of the component so it's unit-testable without pulling
// in the whole framer/motion tree. See HeroLiveRoom.tsx for how it's applied.

export type Hsl = { h: number; s: number; l: number };

// Amber (#F4A261) as HSL — the fallback whenever a sleeve is too monochrome to
// yield a confident hue (many covers are black-and-white).
export const AMBER_HSL: Hsl = { h: 27, s: 87, l: 67 };

export const hsl = (c: Hsl, alpha?: number) =>
    alpha == null ? `hsl(${c.h} ${c.s}% ${c.l}%)` : `hsl(${c.h} ${c.s}% ${c.l}% / ${alpha})`;

export function rgbToHsl(r: number, g: number, b: number): Hsl {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (d !== 0) {
        switch (mx) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return { h: h * 360, s, l };
}

// Pick the dominant *vibrant* hue: downscale, drop near-black/near-white/greyish
// pixels, bin the rest by hue weighted toward saturation, average the winning
// bin, then clamp the result to a lightness/saturation band that always reads as
// a usable accent on the charcoal capsule. Returns null when nothing vivid
// survives (→ caller falls back to amber). Canvas readback needs a CORS-clean
// image (Apple's artwork CDN sends the header — verified before shipping this).
export function extractAccent(img: HTMLImageElement): Hsl | null {
    const N = 24;
    const canvas = document.createElement('canvas');
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, N, N);
    let data: Uint8ClampedArray;
    try {
        data = ctx.getImageData(0, 0, N, N).data;
    } catch {
        return null; // tainted canvas (no CORS) — fall back to amber
    }
    const bins: Record<number, { w: number; r: number; g: number; b: number }> = {};
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const c = rgbToHsl(r, g, b);
        if (c.l < 0.14 || c.l > 0.93 || c.s < 0.28) continue;
        const key = Math.round(c.h / 20);
        const w = c.s * c.s * (0.4 + 0.6 * Math.min(1, c.l * 1.6));
        const bin = bins[key] || (bins[key] = { w: 0, r: 0, g: 0, b: 0 });
        bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
    }
    let best: { w: number; r: number; g: number; b: number } | null = null;
    for (const k in bins) if (!best || bins[k].w > best.w) best = bins[k];
    if (!best) return null;
    const out = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
    return {
        h: Math.round(out.h),
        s: Math.round(Math.min(1, Math.max(0.6, out.s)) * 100),
        l: Math.round(Math.min(0.72, Math.max(0.56, out.l)) * 100),
    };
}

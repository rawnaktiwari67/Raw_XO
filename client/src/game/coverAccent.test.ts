import { describe, expect, it, afterEach } from 'vitest';
import { rgbToHsl, hsl, AMBER_HSL, extractAccent } from './coverAccent';

// The colour maths behind the capsule's cover-derived accent. extractAccent's
// pixel binning needs a real canvas (not available in the node test env), so we
// cover the pure hue conversion + the css formatter here, plus extractAccent's
// graceful-fallback guards.

describe('rgbToHsl', () => {
    it('maps pure primaries to their canonical hues', () => {
        expect(Math.round(rgbToHsl(255, 0, 0).h)).toBe(0);
        expect(Math.round(rgbToHsl(0, 255, 0).h)).toBe(120);
        expect(Math.round(rgbToHsl(0, 0, 255).h)).toBe(240);
    });

    it('reports zero saturation for greys (black/white/mid-grey)', () => {
        expect(rgbToHsl(0, 0, 0).s).toBe(0);
        expect(rgbToHsl(255, 255, 255).s).toBe(0);
        expect(rgbToHsl(128, 128, 128).s).toBe(0);
    });

    it('reports lightness at the extremes and the middle', () => {
        expect(rgbToHsl(0, 0, 0).l).toBe(0);
        expect(rgbToHsl(255, 255, 255).l).toBe(1);
        expect(rgbToHsl(128, 128, 128).l).toBeCloseTo(0.502, 2);
    });

    it('recovers amber (#F4A261) close to its documented HSL', () => {
        const c = rgbToHsl(244, 162, 97);
        expect(Math.round(c.h)).toBeGreaterThanOrEqual(24);
        expect(Math.round(c.h)).toBeLessThanOrEqual(30);
        expect(Math.round(c.s * 100)).toBeGreaterThan(80);
        expect(Math.round(c.l * 100)).toBeCloseTo(67, 0);
    });
});

describe('hsl formatter', () => {
    it('formats a solid colour', () => {
        expect(hsl({ h: 210, s: 60, l: 56 })).toBe('hsl(210 60% 56%)');
    });

    it('formats a translucent colour when an alpha is given', () => {
        expect(hsl({ h: 210, s: 60, l: 56 }, 0.5)).toBe('hsl(210 60% 56% / 0.5)');
    });

    it('formats amber from the shared constant', () => {
        expect(hsl(AMBER_HSL)).toBe('hsl(27 87% 67%)');
    });
});

describe('extractAccent — fallback guards', () => {
    const img = {} as HTMLImageElement;

    // The node test env has no `document`; stub just the createElement the
    // function touches, returning a fake canvas whose 2D context we control.
    const stubCanvas = (ctx: unknown) => {
        (globalThis as unknown as { document: unknown }).document = {
            createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
        };
    };
    const solidFrame = (r: number, g: number, b: number) => {
        const px = new Uint8ClampedArray(24 * 24 * 4);
        for (let i = 0; i < px.length; i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
        return { drawImage: () => {}, getImageData: () => ({ data: px }) };
    };

    afterEach(() => { delete (globalThis as unknown as { document?: unknown }).document; });

    it('returns null when a 2D context is unavailable (caller falls back to amber)', () => {
        stubCanvas(null);
        expect(extractAccent(img)).toBeNull();
    });

    it('returns null when the canvas is tainted (getImageData throws)', () => {
        stubCanvas({ drawImage: () => {}, getImageData: () => { throw new Error('tainted'); } });
        expect(extractAccent(img)).toBeNull();
    });

    it('returns null for an all-grey image (no vivid hue survives → amber)', () => {
        stubCanvas(solidFrame(128, 128, 128));
        expect(extractAccent(img)).toBeNull();
    });

    it('extracts a clamped, usable accent from a vividly coloured image', () => {
        // a solid vivid blue frame → dominant hue ~240, clamped into the usable band
        stubCanvas(solidFrame(30, 90, 220));
        const accent = extractAccent(img);
        expect(accent).not.toBeNull();
        expect(accent!.h).toBeGreaterThan(200);
        expect(accent!.h).toBeLessThan(260);
        // clamped to the readable band
        expect(accent!.s).toBeGreaterThanOrEqual(60);
        expect(accent!.l).toBeGreaterThanOrEqual(56);
        expect(accent!.l).toBeLessThanOrEqual(72);
    });
});

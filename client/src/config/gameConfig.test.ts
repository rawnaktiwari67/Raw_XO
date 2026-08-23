import { describe, expect, it } from 'vitest';
import {
    difficultyForClipSeconds,
    CLIP_SECONDS_FOR_DIFFICULTY,
    CLIP_MIN_SECONDS,
    CLIP_MAX_SECONDS,
    PRO_CLIP_MAX_SECONDS,
    DIFFICULTY_SECONDS,
    roundSecondsFor,
} from './gameConfig';
import type { GameDifficulty } from '../types/game';

// The clip-length bar is the real difficulty control: how much song you hear IS
// the difficulty. These tests pin the bar↔tier mapping so a snapped pill value
// always round-trips to the same tier and the boundaries don't quietly move.

describe('difficultyForClipSeconds — tier boundaries', () => {
    it('maps the shortest clips (incl. the Pro flex minimum) to pro', () => {
        expect(difficultyForClipSeconds(CLIP_MIN_SECONDS)).toBe('pro');
        expect(difficultyForClipSeconds(0.1)).toBe('pro');
        expect(difficultyForClipSeconds(PRO_CLIP_MAX_SECONDS)).toBe('pro'); // ≤3s is pro
    });

    it('maps just past the pro ceiling up to the hard clock to hard', () => {
        expect(difficultyForClipSeconds(PRO_CLIP_MAX_SECONDS + 0.1)).toBe('hard');
        expect(difficultyForClipSeconds(DIFFICULTY_SECONDS.hard)).toBe('hard'); // 5s
    });

    it('maps above hard up to the medium clock to medium', () => {
        expect(difficultyForClipSeconds(DIFFICULTY_SECONDS.hard + 0.1)).toBe('medium');
        expect(difficultyForClipSeconds(DIFFICULTY_SECONDS.medium)).toBe('medium'); // 7s
    });

    it('maps above medium up to the maximum to easy', () => {
        expect(difficultyForClipSeconds(DIFFICULTY_SECONDS.medium + 0.1)).toBe('easy');
        expect(difficultyForClipSeconds(DIFFICULTY_SECONDS.easy)).toBe('easy'); // 10s
        expect(difficultyForClipSeconds(CLIP_MAX_SECONDS)).toBe('easy');
    });
});

describe('CLIP_SECONDS_FOR_DIFFICULTY ↔ difficultyForClipSeconds round-trip', () => {
    // Tapping a pill snaps the bar to a value; that value must map back to the
    // same tier, or the pill and bar would disagree.
    it('round-trips easy/medium/hard through their snapped clip lengths', () => {
        (['easy', 'medium', 'hard'] as GameDifficulty[]).forEach((tier) => {
            expect(difficultyForClipSeconds(CLIP_SECONDS_FOR_DIFFICULTY[tier])).toBe(tier);
        });
    });

    it('snaps pro to the flex minimum, which maps back to pro', () => {
        expect(CLIP_SECONDS_FOR_DIFFICULTY.pro).toBe(CLIP_MIN_SECONDS);
        expect(difficultyForClipSeconds(CLIP_SECONDS_FOR_DIFFICULTY.pro)).toBe('pro');
    });
});

describe('roundSecondsFor', () => {
    it('returns the tier clock, defaulting undefined to medium', () => {
        expect(roundSecondsFor('hard')).toBe(DIFFICULTY_SECONDS.hard);
        expect(roundSecondsFor(undefined)).toBe(DIFFICULTY_SECONDS.medium);
    });
});

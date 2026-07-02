import { describe, expect, it } from 'vitest';
import { calculateGameXP, calculateLevel, LEVEL_MAP } from './xpUtils';

describe('calculateGameXP', () => {
    it('gives 5 consolation XP for a wrong answer, ignoring streak', () => {
        expect(calculateGameXP(false, 0)).toBe(5);
        expect(calculateGameXP(false, 10)).toBe(5);
    });

    it('gives base 50 plus 10 per streak, capped at +50', () => {
        expect(calculateGameXP(true, 0)).toBe(50);
        expect(calculateGameXP(true, 3)).toBe(80);
        expect(calculateGameXP(true, 5)).toBe(100);
        expect(calculateGameXP(true, 50)).toBe(100);
    });
});

describe('calculateLevel', () => {
    it('maps XP boundaries to the right level and badge', () => {
        expect(calculateLevel(0)).toEqual({ level: 1, badge: 'XO Initiate' });
        expect(calculateLevel(99)).toEqual({ level: 1, badge: 'XO Initiate' });
        expect(calculateLevel(100)).toEqual({ level: 2, badge: 'A-List Fan' });
        expect(calculateLevel(3000)).toEqual({ level: 6, badge: 'Dawn FM Legend' });
        expect(calculateLevel(999999)).toEqual({ level: 6, badge: 'Dawn FM Legend' });
    });

    it('never returns undefined for negative XP', () => {
        expect(calculateLevel(-10)).toEqual({ level: 1, badge: 'XO Initiate' });
    });

    it('keeps the level map sorted ascending by minXp (lookup depends on it)', () => {
        for (let i = 1; i < LEVEL_MAP.length; i += 1) {
            expect(LEVEL_MAP[i].minXp).toBeGreaterThan(LEVEL_MAP[i - 1].minXp);
            expect(LEVEL_MAP[i].level).toBe(LEVEL_MAP[i - 1].level + 1);
        }
    });
});

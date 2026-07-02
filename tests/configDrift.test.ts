import { describe, expect, it } from 'vitest';
import { DIFFICULTY_SECONDS } from '../client/src/config/gameConfig';
import { DIFFICULTY_ROUND_SECONDS } from '../server/src/config/gameConstants';

// The README promises the client countdown and the server speed-bonus window
// "read the same numbers ... so they can't drift apart". This test is what
// actually enforces that promise.
describe('client/server difficulty config', () => {
    it('has identical round seconds per difficulty', () => {
        expect(DIFFICULTY_SECONDS).toEqual(DIFFICULTY_ROUND_SECONDS);
    });

    it('gives easier difficulties strictly more time', () => {
        expect(DIFFICULTY_ROUND_SECONDS.easy).toBeGreaterThan(DIFFICULTY_ROUND_SECONDS.medium);
        expect(DIFFICULTY_ROUND_SECONDS.medium).toBeGreaterThan(DIFFICULTY_ROUND_SECONDS.hard);
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// devStore is the keyless/local leaderboard path (no MongoDB). It's pure ranking
// logic over a JSON file, so we mock fs to feed a fixed dataset and assert the
// ordering, per-scope filtering, and rank math — the leaderboard behaviour that
// has to stay correct at launch — without touching the real dev-data.json.

const { fsState } = vi.hoisted(() => ({ fsState: { data: '' } }));

vi.mock('fs', () => ({
    default: {
        existsSync: () => true,
        readFileSync: () => fsState.data,
        writeFileSync: (_path: string, contents: string) => { fsState.data = contents; },
    },
    existsSync: () => true,
    readFileSync: () => fsState.data,
    writeFileSync: (_path: string, contents: string) => { fsState.data = contents; },
}));

import { devStore } from './devStore';

const today = new Date().toISOString();
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const user = (id: string, username: string) => ({
    _id: id, username, email: `${username}@x.io`, passwordHash: 'x', avatar: '',
    bio: '', xp: 0, level: 1, levelBadge: 'XO Initiate', createdAt: today, updatedAt: today,
});

const score = (over: Record<string, unknown>) => ({
    _id: `g_${Math.random().toString(36).slice(2)}`,
    trackName: '', artistName: '', artworkUrl: '', trackUrl: '',
    genre: 'all', language: 'all', difficulty: 'medium', artistFilter: 'all',
    correct: true, responseTimeMs: 1000, correctCount: 1, totalQuestions: 1, xpEarned: 10,
    sessionDate: today, trackId: 't',
    ...over,
});

beforeEach(() => {
    fsState.data = JSON.stringify({
        users: [user('u1', 'alpha'), user('u2', 'bravo'), user('u3', 'charlie')],
        gameScores: [
            // alpha: 300 total, 1/2 correct → 50% accuracy, pop / drake
            score({ user: 'u1', score: 100, correct: true, genre: 'pop', artistFilter: 'drake', artistName: 'Drake' }),
            score({ user: 'u1', score: 200, correct: false, genre: 'pop', artistFilter: 'drake', artistName: 'Drake' }),
            // bravo: 250 total, rock
            score({ user: 'u2', score: 250, correct: true, genre: 'rock', artistFilter: 'all' }),
            // charlie's only score is old — excluded from the daily board
            score({ user: 'u3', score: 999, correct: true, sessionDate: lastWeek }),
        ],
        ratings: [], cultureSignals: [], cultureReviews: [],
    });
});

describe('devStore.getLeaderboard', () => {
    it('ranks players by total score, descending', () => {
        const board = devStore.getLeaderboard('all-time');
        const names = board.entries.map((e) => e.username);
        expect(names.slice(0, 3)).toEqual(['charlie', 'alpha', 'bravo']); // 999, 300, 250
    });

    it('computes per-player accuracy from correct/total sessions', () => {
        const alpha = devStore.getLeaderboard('all-time').entries.find((e) => e.username === 'alpha');
        expect(alpha?.accuracy).toBe(50); // 1 of 2 correct
        expect(alpha?.totalScore).toBe(300);
    });

    it('resolves the requesting user\'s rank', () => {
        expect(devStore.getLeaderboard('all-time', 'u2').userRank).toBe(3); // bravo is 3rd
        expect(devStore.getLeaderboard('all-time', 'u1').userRank).toBe(2);
    });

    it('excludes players with no scores in the daily window', () => {
        const daily = devStore.getLeaderboard('daily');
        const names = daily.entries.map((e) => e.username);
        expect(names).toContain('alpha');
        expect(names).toContain('bravo');
        expect(names).not.toContain('charlie'); // charlie only played last week
    });

    it('filters by genre scope', () => {
        const pop = devStore.getLeaderboard('all-time', undefined, 'genre', 'pop');
        expect(pop.entries.map((e) => e.username)).toEqual(['alpha']);
    });

    it('filters by artist scope (artistFilter or artistName match)', () => {
        const drake = devStore.getLeaderboard('all-time', undefined, 'artist', 'drake');
        expect(drake.entries.map((e) => e.username)).toEqual(['alpha']);
    });

    it('omits players whose only sessions fall outside the requested scope', () => {
        const rock = devStore.getLeaderboard('all-time', undefined, 'genre', 'rock');
        expect(rock.entries.map((e) => e.username)).toEqual(['bravo']);
    });
});

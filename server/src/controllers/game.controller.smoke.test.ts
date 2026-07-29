import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

// End-to-end smoke test for the core gameplay loop, driven over real HTTP against
// the actual Express app. Only the network fetch layer is mocked; token crypto,
// difficulty selection, scoring, and controller orchestration all run for real.
//
// The pool uses distinct single-word titles with NO substring overlap, so an
// exact-title guess matches and every other option is unambiguously wrong — which
// also lets us assert the exact-match correctness fix (a partial title or the
// artist name must NOT score).
const { TEST_POOL } = vi.hoisted(() => {
    const words = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
        'india', 'juliet', 'kilo', 'lima', 'papa', 'quebec', 'romeo', 'sierra',
    ];
    const pool = words.map((word, i) => ({
        id: `smoke-${i}`,
        title: word,
        artist: `${word}corp`,
        album: `${word}record`,
        releaseYear: 2020,
        durationMs: 200000 + i * 1000,
        snippetUrl: `https://example.com/${i}.m4a`,
        artworkUrl: `https://example.com/${i}.jpg`,
        trackUrl: `https://example.com/${i}`,
        popularity: 50,
    }));
    return { TEST_POOL: pool };
});

vi.mock('../game/musicProviders', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../game/musicProviders')>();
    return {
        ...actual,
        fetchItunesSongPool: vi.fn(async () => TEST_POOL),
        fetchSpotifySongPool: vi.fn(async () => []),
    };
});

import app from '../app';

let server: http.Server;
let baseUrl: string;

const api = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}/api/v1/game${path}`, init);

const postAnswer = (body: Record<string, unknown>) =>
    api('/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

const startRound = async (artist: string) => {
    const body = await (await api(`/session?count=1&difficulty=medium&artist=${artist}`)).json();
    return body.data.questions[0];
};

beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('core gameplay loop (smoke)', () => {
    it('plays a full session end to end: fetch batch → answer every round → tally', async () => {
        const session = await (await api('/session?count=5&difficulty=medium&artist=smokeloop')).json();
        expect(session.success).toBe(true);

        const questions: Array<{ songId: string; reveal: { correctAnswer: string } }> = session.data.questions;
        expect(questions.length).toBeGreaterThanOrEqual(1);

        let correctCount = 0;
        let totalPoints = 0;

        for (const q of questions) {
            const res = await postAnswer({
                songId: q.songId,
                answer: q.reveal.correctAnswer,
                difficulty: 'medium',
                responseTimeMs: 800,
                streak: correctCount,
            });
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.data.correct).toBe(true);
            expect(body.data.correctAnswer).toBe(q.reveal.correctAnswer);
            expect(body.data.pointsAwarded).toBeGreaterThan(0);

            correctCount += 1;
            totalPoints += body.data.pointsAwarded;
        }

        expect(correctCount).toBe(questions.length);
        expect(totalPoints).toBeGreaterThan(0);
    });

    it('marks a genuinely wrong option as incorrect with zero points', async () => {
        const session = await (await api('/session?count=1&difficulty=medium&artist=smokewrong')).json();
        const q = session.data.questions[0];
        const wrong = q.options.find((o: string) => o !== q.reveal.correctAnswer);

        const body = await (await postAnswer({
            songId: q.songId, answer: wrong, difficulty: 'medium', responseTimeMs: 800, streak: 0,
        })).json();

        expect(body.data.correct).toBe(false);
        expect(body.data.pointsAwarded).toBe(0);
    });

    // Correctness fix: server must agree with the client's exact-match check.
    it('does NOT score a partial-title substring as correct', async () => {
        const q = await startRound('smokesubstr');
        const full: string = q.reveal.correctAnswer;
        const substring = full.slice(0, Math.max(1, full.length - 1)); // proper substring, never === full

        const body = await (await postAnswer({
            songId: q.songId, answer: substring, difficulty: 'medium', responseTimeMs: 800, streak: 0,
        })).json();

        expect(body.data.correct).toBe(false);
    });

    // Correctness fix: the artist name (returned in the question) is not the title.
    it('does NOT score the artist name as correct', async () => {
        const q = await startRound('smokeartist');
        const body = await (await postAnswer({
            songId: q.songId, answer: q.artistName, difficulty: 'medium', responseTimeMs: 800, streak: 0,
        })).json();

        expect(body.data.correct).toBe(false);
    });

    // Leaderboard protection: impossible score inputs are rejected outright.
    it('rejects an impossible (negative) response time with 400', async () => {
        const q = await startRound('smokebadtime');
        const res = await postAnswer({
            songId: q.songId, answer: q.reveal.correctAnswer, difficulty: 'medium', responseTimeMs: -5, streak: 0,
        });
        expect(res.status).toBe(400);
    });

    it('rejects a non-finite streak with 400', async () => {
        const q = await startRound('smokebadstreak');
        const res = await postAnswer({
            songId: q.songId, answer: q.reveal.correctAnswer, difficulty: 'medium', responseTimeMs: 800, streak: 'NaN',
        });
        expect(res.status).toBe(400);
    });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

// A deterministic, network-free song pool. Titles/artists are distinct single
// words with no substring overlap, so an exact-title guess matches and any other
// option is unambiguously wrong. Defined via vi.hoisted so it exists before the
// hoisted vi.mock factory below runs.
const { TEST_POOL } = vi.hoisted(() => {
    const words = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
        'india', 'juliet', 'kilo', 'lima', 'papa', 'quebec', 'romeo', 'sierra',
    ];
    const pool = words.map((word, i) => ({
        id: `test-${i}`,
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

// Replace only the network fetch layer; everything else (token crypto, difficulty
// selection, scoring, the controller orchestration) runs for real.
vi.mock('../game/musicProviders', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../game/musicProviders')>();
    return {
        ...actual,
        fetchItunesSongPool: vi.fn(async () => TEST_POOL),
        fetchSpotifySongPool: vi.fn(async () => []),
    };
});

// Imported after the mock is registered (vi.mock is hoisted above imports).
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

beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /game/session', () => {
    it('returns a whole batch of rounds with reveal data in one request', async () => {
        const res = await api('/session?count=5&difficulty=medium&artist=sessionbatch');
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.questions)).toBe(true);
        expect(body.data.questions).toHaveLength(5);

        for (const q of body.data.questions) {
            // Four options, exactly one of which is the revealed answer.
            expect(q.options).toHaveLength(4);
            expect(q.options).toContain(q.reveal.correctAnswer);
            // The reveal is bundled up front (the batched-session contract) and the
            // song identity travels as an opaque token, not a plaintext id.
            expect(typeof q.songId).toBe('string');
            expect(q.songId).not.toContain(q.reveal.correctAnswer);
            expect(q.reveal.artworkUrl).toMatch(/^https:\/\//);
        }
    });

    it('does not repeat a correct answer within a single batch', async () => {
        const res = await api('/session?count=8&difficulty=easy&artist=norepeat');
        const body = await res.json();
        const answers = body.data.questions.map((q: { reveal: { correctAnswer: string } }) => q.reveal.correctAnswer);
        expect(new Set(answers).size).toBe(answers.length);
    });

    it('clamps the requested round count to the 1–10 range', async () => {
        const res = await api('/session?count=999&difficulty=medium&artist=clamp');
        const body = await res.json();
        expect(body.data.questions.length).toBeLessThanOrEqual(10);
    });
});

describe('POST /game/answer', () => {
    const startRound = async (artist: string) => {
        const res = await api(`/session?count=1&difficulty=medium&artist=${artist}`);
        const body = await res.json();
        return body.data.questions[0];
    };

    it('scores a correct guess with points and echoes the reveal', async () => {
        const q = await startRound('answercorrect');
        const res = await postAnswer({
            songId: q.songId,
            answer: q.reveal.correctAnswer,
            difficulty: 'medium',
            responseTimeMs: 500,
            streak: 0,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.correct).toBe(true);
        expect(body.data.correctAnswer).toBe(q.reveal.correctAnswer);
        expect(body.data.pointsAwarded).toBeGreaterThan(0);
        expect(body.data.xpEarned).toBeGreaterThan(0);
    });

    it('awards a larger speed bonus for a faster correct answer', async () => {
        const fast = await startRound('answerfast');
        const slow = await startRound('answerslow');
        const fastRes = await (await postAnswer({
            songId: fast.songId, answer: fast.reveal.correctAnswer, difficulty: 'medium', responseTimeMs: 100, streak: 0,
        })).json();
        const slowRes = await (await postAnswer({
            songId: slow.songId, answer: slow.reveal.correctAnswer, difficulty: 'medium', responseTimeMs: 6000, streak: 0,
        })).json();
        expect(fastRes.data.speedBonus).toBeGreaterThan(slowRes.data.speedBonus);
    });

    it('scores a wrong guess as incorrect with zero points', async () => {
        const q = await startRound('answerwrong');
        const wrong = q.options.find((o: string) => o !== q.reveal.correctAnswer);
        const res = await postAnswer({
            songId: q.songId,
            answer: wrong,
            difficulty: 'medium',
            responseTimeMs: 500,
            streak: 0,
        });
        const body = await res.json();
        expect(body.data.correct).toBe(false);
        expect(body.data.pointsAwarded).toBe(0);
        // The correct answer is still revealed on a miss.
        expect(body.data.correctAnswer).toBe(q.reveal.correctAnswer);
    });

    it('rejects a tampered / unparseable song token', async () => {
        const res = await postAnswer({ songId: 'garbage.token.value', answer: 'alpha' });
        expect(res.status).toBe(400);
    });

    it('rejects a request missing songId or answer', async () => {
        const res = await postAnswer({ answer: 'alpha' });
        expect(res.status).toBe(400);
    });
});

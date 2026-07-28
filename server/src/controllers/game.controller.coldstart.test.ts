import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

// Cold-start / provider-outage simulation: iTunes REJECTS and Spotify is empty,
// so the live song pool is unavailable. This is the exact failure that used to
// surface to a first-time visitor as a 503 "Game session unavailable". With the
// baked-in fallback pool wired into getSongPool, the session endpoint must now
// still return a full, playable batch instead of breaking the first impression.
vi.mock('../game/musicProviders', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../game/musicProviders')>();
    return {
        ...actual,
        fetchItunesSongPool: vi.fn(async () => {
            throw new Error('itunes unavailable (simulated cold-start outage)');
        }),
        fetchSpotifySongPool: vi.fn(async () => []),
    };
});

import app from '../app';

let server: http.Server;
let baseUrl: string;

const api = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}/api/v1/game${path}`, init);

beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /game/session — cold start with providers down', () => {
    it('serves a full playable batch from the fallback pool instead of 503', async () => {
        const res = await api('/session?count=5&difficulty=medium&artist=coldstart');
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.questions).toHaveLength(5);

        for (const q of body.data.questions) {
            expect(q.options).toHaveLength(4);
            expect(q.options).toContain(q.reveal.correctAnswer);
            // Fallback rows are real tracks: they carry playable audio + artwork,
            // which is what keeps the first clip from silently failing.
            expect(q.snippetUrl).toMatch(/^https:\/\//);
            expect(q.reveal.artworkUrl).toMatch(/^https:\/\//);
        }
    });

    it('honors a language/artist filter when the fallback pool can cover it', async () => {
        // The Weeknd is in the baked pool, so an explicit artist filter should still
        // resolve to that artist rather than collapsing the whole request.
        const res = await api('/session?count=3&difficulty=easy&artist=the%20weeknd');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.questions.length).toBeGreaterThanOrEqual(1);
        // Every revealed track in the batch is The Weeknd (the filtered fallback).
        for (const q of body.data.questions) {
            expect(q.reveal.correctArtist.toLowerCase()).toContain('weeknd');
        }
    });

    it('never 503s the single-question endpoint either', async () => {
        const res = await api('/question?difficulty=hard&artist=coldstartq');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.options).toHaveLength(4);
    });
});

/**
 * Raw XO - AI Knowledge Base Builder
 * Run: npm run embed
 *
 * One-time (re-runnable) script behind the /ai/trivia RAG pipeline:
 *   1. Snapshots the game's curated song pool (same iTunes/Spotify provider
 *      layer the game uses) into the Track collection.
 *   2. Renders every Track, Era, and Tour document into a retrieval-friendly
 *      sentence.
 *   3. Embeds those sentences locally with all-MiniLM-L6-v2 (no API key) and
 *      rebuilds the RagChunk collection, which ai/vectorStore serves at
 *      query time.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { env } from '../config/env';
import Track from '../models/Track';
import RagChunk from '../models/RagChunk';
import Era from '../models/Era';
import Tour from '../models/Tour';
import { fetchItunesSongPool, fetchSpotifySongPool, hasSpotifyCredentials, SPOTIFY_MARKET } from '../game/musicProviders';
import { CURATED_ARTISTS, GENRE_QUERY_MAP, INDIA_FOCUSED_LANGUAGES } from '../config/gameConstants';
import { embedTexts, EMBEDDING_MODEL } from '../ai/embeddings';
import type { SongPreview } from '../utils/songTokens';

const EMBED_BATCH_SIZE = 32;

// An artist's genre tag is the first specific bucket that lists them; artists
// only in the 'all' bucket keep 'all'.
const genreForArtist = (artistValue: string): string => {
    const specificGenres = Object.entries(GENRE_QUERY_MAP).filter(([genre]) => genre !== 'all');
    const match = specificGenres.find(([, artists]) => artists.includes(artistValue));
    return match ? match[0] : 'all';
};

const snapshotTracks = async (): Promise<number> => {
    let upserted = 0;

    for (const artist of CURATED_ARTISTS) {
        const country = INDIA_FOCUSED_LANGUAGES.includes(artist.language) ? 'in' : env.GAME_ITUNES_COUNTRY;
        const market = INDIA_FOCUSED_LANGUAGES.includes(artist.language) ? 'IN' : SPOTIFY_MARKET;

        const [itunesResult, spotifyResult] = await Promise.allSettled([
            fetchItunesSongPool([artist.value], country, artist.label),
            hasSpotifyCredentials
                ? fetchSpotifySongPool([artist.value], market, artist.label)
                : Promise.resolve([] as SongPreview[]),
        ]);
        const songs = [
            ...(spotifyResult.status === 'fulfilled' ? spotifyResult.value : []),
            ...(itunesResult.status === 'fulfilled' ? itunesResult.value : []),
        ];

        if (songs.length === 0) {
            console.warn(`⚠️  No tracks fetched for ${artist.label} — skipping`);
            continue;
        }

        const operations = songs.map((song) => ({
            updateOne: {
                filter: { trackId: song.id },
                update: {
                    $set: {
                        title: song.title,
                        artist: song.artist,
                        album: song.album,
                        releaseYear: song.releaseYear,
                        genre: genreForArtist(artist.value),
                        language: artist.language,
                        popularity: song.popularity,
                        artworkUrl: song.artworkUrl,
                        trackUrl: song.trackUrl,
                    },
                },
                upsert: true,
            },
        }));

        const result = await Track.bulkWrite(operations);
        upserted += result.upsertedCount + result.modifiedCount;
        console.log(`✅ ${artist.label}: ${songs.length} tracks snapshotted`);
    }

    return upserted;
};

// ─── Chunk rendering ─────────────────────────────────────────────────────────
// Each source doc becomes one natural-language sentence: MiniLM embeds prose
// far better than key:value soup, and the same text doubles as the context the
// LLM reads at answer time.

type PendingChunk = { source: 'track' | 'era' | 'tour'; refId: string; text: string };

const buildChunks = async (): Promise<PendingChunk[]> => {
    const [tracks, eras, tours] = await Promise.all([
        Track.find().lean(),
        Era.find().sort({ order: 1 }).lean(),
        Tour.find().sort({ date: 1 }).lean(),
    ]);

    const trackChunks: PendingChunk[] = tracks.map((track) => ({
        source: 'track',
        refId: track.trackId,
        text: [
            `"${track.title}" is a ${track.genre !== 'all' ? `${track.genre} ` : ''}song by ${track.artist}`,
            track.album ? `, from the album "${track.album}"` : '',
            track.releaseYear ? `, released in ${track.releaseYear}` : '',
            track.language !== 'all' && track.language !== 'english' ? `. It is a ${track.language}-language track` : '',
            track.popularity >= 0 ? `. Popularity score: ${track.popularity}/100.` : '.',
        ].join(''),
    }));

    const eraChunks: PendingChunk[] = eras.map((era) => ({
        source: 'era',
        refId: era.slug,
        text: `The Weeknd's "${era.name}" era (${era.year}): ${era.description}`,
    }));

    const tourChunks: PendingChunk[] = tours.map((tour) => ({
        source: 'tour',
        refId: String(tour._id),
        text: `${tour.eventName} tour date: ${tour.city}, ${tour.country}${tour.venue ? ` at ${tour.venue}` : ''} on ${new Date(tour.date).toDateString()}. Tickets are ${tour.ticketsAvailable ? 'available' : 'not available'}.`,
    }));

    return [...trackChunks, ...eraChunks, ...tourChunks];
};

const embedAndStore = async (chunks: PendingChunk[]): Promise<void> => {
    // Rebuild from scratch — chunks are derived data, so replace-all is simpler
    // and safer than diffing against a previous run.
    await RagChunk.deleteMany({});

    for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(offset, offset + EMBED_BATCH_SIZE);
        const embeddings = await embedTexts(batch.map((chunk) => chunk.text));

        await RagChunk.insertMany(batch.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index],
            embeddingModel: EMBEDDING_MODEL,
        })));

        console.log(`✅ Embedded ${Math.min(offset + EMBED_BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
    }
};

const run = async () => {
    try {
        if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('⏳ Snapshotting curated song pool into Track collection...');
        await snapshotTracks();

        console.log('⏳ Rendering Track/Era/Tour docs into chunks...');
        const chunks = await buildChunks();
        console.log(`⏳ Embedding ${chunks.length} chunks with ${EMBEDDING_MODEL} (first run downloads the model)...`);
        await embedAndStore(chunks);

        console.log('🎉 Knowledge base ready!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Embed failed:', err);
        process.exit(1);
    }
};

run();

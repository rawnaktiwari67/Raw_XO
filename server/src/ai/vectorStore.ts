import RagChunk from '../models/RagChunk';
import { embedText } from './embeddings';

/**
 * Retrieval half of the RAG pipeline. The whole knowledge base (a few hundred
 * chunks — see data/embed.ts) is cached in memory and scanned exactly with a
 * dot product; at this corpus size a brute-force scan is faster than any ANN
 * index would be to even load, and it has no extra infrastructure. The chunk
 * cache refreshes on a TTL so re-running the embed script is picked up without
 * a server restart.
 */

export type RetrievedChunk = {
    source: 'track' | 'era' | 'tour';
    refId: string;
    text: string;
    score: number;
};

type CachedChunk = Omit<RetrievedChunk, 'score'> & { embedding: number[] };

const CHUNK_CACHE_TTL_MS = 10 * 60_000;

// Below this cosine similarity a chunk is noise, not context — retrieval
// returning nothing is what lets the trivia prompt answer "I don't have info
// on that" instead of forcing the model to stretch an irrelevant match.
const MIN_SIMILARITY = 0.3;

let chunkCache: { chunks: CachedChunk[]; fetchedAt: number } | null = null;
let inFlightLoad: Promise<CachedChunk[]> | null = null;

const loadChunks = async (): Promise<CachedChunk[]> => {
    if (chunkCache && Date.now() - chunkCache.fetchedAt < CHUNK_CACHE_TTL_MS) {
        return chunkCache.chunks;
    }
    if (inFlightLoad) return inFlightLoad;

    inFlightLoad = RagChunk.find({}, { source: 1, refId: 1, text: 1, embedding: 1 })
        .lean()
        .then((docs) => {
            const chunks = docs.map((doc) => ({
                source: doc.source,
                refId: doc.refId,
                text: doc.text,
                embedding: doc.embedding,
            }));
            chunkCache = { chunks, fetchedAt: Date.now() };
            return chunks;
        })
        .finally(() => {
            inFlightLoad = null;
        });

    return inFlightLoad;
};

// Both vectors are unit-normalized by the embedding pipeline, so the dot
// product IS the cosine similarity.
const dot = (a: number[], b: number[]): number => {
    let sum = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) sum += a[i] * b[i];
    return sum;
};

/**
 * Embed the query with the same model the corpus was embedded with (a hard
 * requirement — vectors from different models live in unrelated spaces), score
 * every chunk, and return the top-k above the relevance floor.
 */
export const retrieveTopK = async (query: string, k = 6): Promise<RetrievedChunk[]> => {
    const [queryEmbedding, chunks] = await Promise.all([embedText(query), loadChunks()]);

    return chunks
        .map((chunk) => ({
            source: chunk.source,
            refId: chunk.refId,
            text: chunk.text,
            score: dot(queryEmbedding, chunk.embedding),
        }))
        .filter((chunk) => chunk.score >= MIN_SIMILARITY)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
};

export const hasKnowledgeBase = async (): Promise<boolean> => {
    const chunks = await loadChunks();
    return chunks.length > 0;
};

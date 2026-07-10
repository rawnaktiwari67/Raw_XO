import mongoose, { Document, Schema } from 'mongoose';

/**
 * One retrievable unit of the AI trivia knowledge base: a human-readable text
 * rendering of a source document (track / era / tour) plus its embedding.
 *
 * MongoDB doubles as the vector store here: the corpus is a few hundred docs of
 * 384 floats, so ai/vectorStore does an exact in-process cosine scan instead of
 * running a separate vector database. Swapping in Atlas Vector Search or an ANN
 * index later only means replacing vectorStore's retrieve() — writers and the
 * embed script stay unchanged.
 */
export interface IRagChunk extends Document {
    source: 'track' | 'era' | 'tour';
    refId: string;
    text: string;
    // Unit-normalized 384-dim vector from all-MiniLM-L6-v2, so cosine similarity
    // reduces to a dot product at query time.
    embedding: number[];
    embeddingModel: string;
    createdAt: Date;
    updatedAt: Date;
}

const RagChunkSchema = new Schema<IRagChunk>(
    {
        source: { type: String, required: true, enum: ['track', 'era', 'tour'] },
        refId: { type: String, required: true },
        text: { type: String, required: true },
        embedding: { type: [Number], required: true },
        embeddingModel: { type: String, required: true },
    },
    { timestamps: true }
);

RagChunkSchema.index({ source: 1, refId: 1 }, { unique: true });

export default mongoose.model<IRagChunk>('RagChunk', RagChunkSchema);

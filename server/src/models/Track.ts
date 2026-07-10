import mongoose, { Document, Schema } from 'mongoose';

/**
 * Canonical snapshot of the game's curated song pool. The game itself fetches
 * tracks live from iTunes/Spotify (see game/musicProviders), so this collection
 * exists for the AI features: the embed script (data/embed.ts) fills it from the
 * same provider pipeline, then turns each doc into a retrievable RagChunk.
 */
export interface ITrack extends Document {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    releaseYear: number;
    genre: string;
    language: string;
    popularity: number;
    artworkUrl: string;
    trackUrl: string;
    createdAt: Date;
    updatedAt: Date;
}

const TrackSchema = new Schema<ITrack>(
    {
        trackId: { type: String, required: true, unique: true },
        title: { type: String, required: true },
        artist: { type: String, required: true },
        album: { type: String, default: '' },
        releaseYear: { type: Number, default: 0 },
        genre: { type: String, default: 'all' },
        language: { type: String, default: 'all' },
        popularity: { type: Number, default: -1 },
        artworkUrl: { type: String, default: '' },
        trackUrl: { type: String, default: '' },
    },
    { timestamps: true }
);

TrackSchema.index({ artist: 1 });
TrackSchema.index({ genre: 1 });

export default mongoose.model<ITrack>('Track', TrackSchema);

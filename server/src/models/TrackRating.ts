import mongoose, { Document, Schema } from 'mongoose';

export interface ITrackRating extends Document {
    user: mongoose.Types.ObjectId;
    trackId: string;
    trackName: string;
    artistName: string;
    artworkUrl: string;
    trackUrl: string;
    rating: number;
    createdAt: Date;
    updatedAt: Date;
}

const TrackRatingSchema = new Schema<ITrackRating>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        trackId: { type: String, required: true },
        trackName: { type: String, default: '' },
        artistName: { type: String, default: '' },
        artworkUrl: { type: String, default: '' },
        trackUrl: { type: String, default: '' },
        rating: { type: Number, required: true, min: 1, max: 5 },
    },
    { timestamps: true }
);

TrackRatingSchema.index({ user: 1, trackId: 1 }, { unique: true });
TrackRatingSchema.index({ trackId: 1, rating: -1 });

export default mongoose.model<ITrackRating>('TrackRating', TrackRatingSchema);

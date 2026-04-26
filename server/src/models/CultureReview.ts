import mongoose, { Document, Schema } from 'mongoose';

export interface ICultureReview extends Document {
    trackId: string;
    user?: mongoose.Types.ObjectId;
    username: string;
    title: string;
    artist: string;
    albumArt: string;
    rating: number;
    moodTag: string;
    take: string;
    createdAt: Date;
    updatedAt: Date;
}

const CultureReviewSchema = new Schema<ICultureReview>(
    {
        trackId: { type: String, required: true, trim: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
        username: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        artist: { type: String, required: true, trim: true },
        albumArt: { type: String, default: '' },
        rating: { type: Number, required: true, min: 1, max: 5 },
        moodTag: { type: String, required: true, trim: true },
        take: { type: String, required: true, trim: true, maxlength: 220 },
    },
    { timestamps: true }
);

CultureReviewSchema.index({ trackId: 1, createdAt: -1 });
CultureReviewSchema.index({ username: 1, createdAt: -1 });

export default mongoose.model<ICultureReview>('CultureReview', CultureReviewSchema);

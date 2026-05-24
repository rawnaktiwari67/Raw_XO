import mongoose, { Document, Schema } from 'mongoose';

export interface ICultureSignal extends Document {
    trackId: string;
    meaningVotes: Record<string, number>;
    reactions: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}

const CultureSignalSchema = new Schema<ICultureSignal>(
    {
        trackId: { type: String, required: true, unique: true, trim: true },
        meaningVotes: { type: Schema.Types.Mixed, default: {} },
        reactions: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

export default mongoose.model<ICultureSignal>('CultureSignal', CultureSignalSchema);

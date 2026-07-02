import mongoose, { Document, Schema } from 'mongoose';

export interface ICultureSignal extends Document {
    trackId: string;
    meaningVotes: Record<string, number>;
    reactions: Record<string, number>;
    // Each voter's current single choice, keyed by user id or `guest:<id>`. Lets a
    // vote switch (move) rather than stack, and lets us tell a returning voter what
    // they already picked.
    meaningVoters: Record<string, string>;
    reactionVoters: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}

const CultureSignalSchema = new Schema<ICultureSignal>(
    {
        trackId: { type: String, required: true, unique: true, trim: true },
        meaningVotes: { type: Schema.Types.Mixed, default: {} },
        reactions: { type: Schema.Types.Mixed, default: {} },
        meaningVoters: { type: Schema.Types.Mixed, default: {} },
        reactionVoters: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

export default mongoose.model<ICultureSignal>('CultureSignal', CultureSignalSchema);

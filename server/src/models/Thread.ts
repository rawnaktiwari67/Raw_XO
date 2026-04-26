import mongoose, { Document, Schema } from 'mongoose';

export interface IThread extends Document {
    title: string;
    body: string;
    author: mongoose.Types.ObjectId;
    era: mongoose.Types.ObjectId;
    upvotes: mongoose.Types.ObjectId[];
    downvotes: mongoose.Types.ObjectId[];
    tags: string[];
    isPinned: boolean;
    isDeleted: boolean;
    commentCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
    {
        title: { type: String, required: true, maxlength: 200, trim: true },
        body: { type: String, required: true, maxlength: 10000 },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        era: { type: Schema.Types.ObjectId, ref: 'Era', required: true },
        upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        tags: [{ type: String, trim: true, maxlength: 30 }],
        isPinned: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        commentCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

ThreadSchema.index({ era: 1, createdAt: -1 });
ThreadSchema.index({ era: 1, upvotes: -1 });
ThreadSchema.index({ author: 1 });

export default mongoose.model<IThread>('Thread', ThreadSchema);

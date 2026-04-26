import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
    body: string;
    author: mongoose.Types.ObjectId;
    thread: mongoose.Types.ObjectId;
    parent: mongoose.Types.ObjectId | null;
    depth: number;
    upvotes: mongoose.Types.ObjectId[];
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
    {
        body: { type: String, required: true, maxlength: 2000 },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        thread: { type: Schema.Types.ObjectId, ref: 'Thread', required: true },
        parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
        depth: { type: Number, default: 0, max: 3 },
        upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

CommentSchema.index({ thread: 1, parent: 1, createdAt: 1 });
CommentSchema.index({ author: 1 });

export default mongoose.model<IComment>('Comment', CommentSchema);

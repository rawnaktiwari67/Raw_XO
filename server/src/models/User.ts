import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    clerkId?: string;
    username: string;
    email: string;
    passwordHash: string;
    avatar: string;
    bio: string;
    xp: number;
    level: number;
    levelBadge: string;
    threadHistory: mongoose.Types.ObjectId[];
    commentHistory: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        clerkId: { type: String, unique: true, sparse: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        avatar: { type: String, default: '' },
        bio: { type: String, default: '', maxlength: 300 },
        xp: { type: Number, default: 0, min: 0 },
        level: { type: Number, default: 1 },
        levelBadge: { type: String, default: 'XO Initiate' },
        threadHistory: [{ type: Schema.Types.ObjectId, ref: 'Thread' }],
        commentHistory: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    },
    { timestamps: true }
);

UserSchema.index({ xp: -1 });

export default mongoose.model<IUser>('User', UserSchema);

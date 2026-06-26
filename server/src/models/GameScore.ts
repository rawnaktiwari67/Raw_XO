import mongoose, { Document, Schema } from 'mongoose';

export interface IGameScore extends Document {
    user?: mongoose.Types.ObjectId;
    guestId?: string;
    guestName?: string;
    trackId: string;
    trackName: string;
    artistName: string;
    artworkUrl: string;
    trackUrl: string;
    genre: string;
    language: string;
    difficulty: string;
    artistFilter: string;
    correct: boolean;
    responseTimeMs: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    xpEarned: number;
    sessionDate: Date;
}

const GameScoreSchema = new Schema<IGameScore>({
    // Either user (signed-in) or guestId (anonymous) identifies the player.
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, index: true },
    guestName: { type: String, default: '' },
    trackId: { type: String, default: '', index: true },
    trackName: { type: String, default: '' },
    artistName: { type: String, default: '' },
    artworkUrl: { type: String, default: '' },
    trackUrl: { type: String, default: '' },
    genre: { type: String, default: 'all', index: true },
    language: { type: String, default: 'all' },
    difficulty: { type: String, default: 'medium' },
    artistFilter: { type: String, default: 'all', index: true },
    correct: { type: Boolean, default: false },
    responseTimeMs: { type: Number, default: 0 },
    score: { type: Number, required: true, default: 0 },
    correctCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    sessionDate: { type: Date, default: Date.now },
});

GameScoreSchema.index({ score: -1 });
GameScoreSchema.index({ user: 1, sessionDate: -1 });

export default mongoose.model<IGameScore>('GameScore', GameScoreSchema);

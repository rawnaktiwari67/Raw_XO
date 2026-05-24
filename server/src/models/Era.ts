import mongoose, { Document, Schema } from 'mongoose';

export interface IEra extends Document {
    slug: string;
    name: string;
    year: number;
    description: string;
    coverImage: string;
    accentColor: string;
    order: number;
}

const EraSchema = new Schema<IEra>({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    year: { type: Number },
    description: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    accentColor: { type: String, default: '#FF7A3D' },
    order: { type: Number, default: 0 },
});

EraSchema.index({ order: 1 });

export default mongoose.model<IEra>('Era', EraSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface ITour extends Document {
    eventName: string;
    city: string;
    country: string;
    venue: string;
    date: Date;
    ticketsAvailable: boolean;
    ticketUrl: string;
    isActive: boolean;
    createdAt: Date;
}

const TourSchema = new Schema<ITour>(
    {
        eventName: { type: String, required: true },
        city: { type: String, required: true },
        country: { type: String, required: true },
        venue: { type: String, default: '' },
        date: { type: Date, required: true },
        ticketsAvailable: { type: Boolean, default: false },
        ticketUrl: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

TourSchema.index({ date: 1 });
TourSchema.index({ city: 1 });
TourSchema.index({ isActive: 1, date: 1 });

export default mongoose.model<ITour>('Tour', TourSchema);

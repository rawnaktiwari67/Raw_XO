import mongoose from 'mongoose';
import { env } from './env';

export const isDbConnected = (): boolean => mongoose.connection.readyState === 1;

export const connectDB = async (): Promise<void> => {
    if (!env.MONGODB_URI) {
        console.warn('MONGODB_URI is not configured. Running with local dev-data.json fallback.');
        return;
    }

    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        return;
    }

    try {
        const conn = await mongoose.connect(env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (env.NODE_ENV === 'production') {
            console.error('MongoDB connection failed:', error);
            throw error;
        }
        console.warn(`MongoDB is unavailable. Running with dev-data fallback. ${message}`);
    }
};

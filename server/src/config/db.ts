import mongoose from 'mongoose';
import { env } from './env';

export const isDbConnected = (): boolean => mongoose.connection.readyState === 1;

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(env.MONGODB_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        console.warn('MongoDB is unavailable. Running with local dev-data.json fallback.');
    }
};

import mongoose from 'mongoose';
import { env } from './env';

export const isDbConnected = (): boolean => mongoose.connection.readyState === 1;

let lastDbError: string | null = null;
export const getLastDbError = (): string | null => lastDbError;

export const connectDB = async (): Promise<void> => {
    if (!env.MONGODB_URI) {
        lastDbError = 'MONGODB_URI is not configured';
        console.warn('MONGODB_URI is not configured. Running with local dev-data.json fallback.');
        return;
    }

    const readyState = (): number => mongoose.connection.readyState;
    if (readyState() === 1) return;
    // If a previous attempt is mid-flight, wait for it to settle rather than
    // returning early (which left callers thinking the DB was ready when it
    // never finished connecting).
    if (readyState() === 2) {
        await mongoose.connection.asPromise().catch(() => undefined);
        if (readyState() === 1) return;
    }

    try {
        const conn = await mongoose.connect(env.MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
        });
        lastDbError = null;
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastDbError = message;
        // Always log the real reason — silent fallback hid a production outage.
        console.error('MongoDB connection failed:', message);
    }
};

import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app';
import { connectDB } from '../server/src/config/db';
import { validateEnv } from '../server/src/config/env';

let bootstrapPromise: Promise<void> | null = null;

const startBackgroundBootstrap = () => {
    if (bootstrapPromise) return;

    bootstrapPromise = (async () => {
        try {
            validateEnv();
        } catch (error) {
            console.error('[api/bootstrap] Environment validation failed:', error);
        }
        await connectDB();
    })().catch((error) => {
        console.error('[api/bootstrap] Startup checks failed:', error);
    });
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    startBackgroundBootstrap();
    return app(req as any, res as any);
}

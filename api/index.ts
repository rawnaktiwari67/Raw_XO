import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app';
import { connectDB } from '../server/src/config/db';
import { validateEnv } from '../server/src/config/env';

validateEnv();

let dbConnectionPromise: Promise<void> | null = null;

const ensureDbConnection = (): Promise<void> => {
    if (!dbConnectionPromise) {
        dbConnectionPromise = connectDB().catch((err) => {
            dbConnectionPromise = null;
            throw err;
        });
    }
    return dbConnectionPromise;
};

// Kick off the Mongo connection during cold-start init so it overlaps with
// module evaluation instead of adding latency to the first request. The handler
// still awaits it so DB-dependent routes are safe.
ensureDbConnection().catch(() => { /* retried per-request below */ });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ensureDbConnection();
    return app(req as any, res as any);
}

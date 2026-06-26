import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app';
import { connectDB } from '../server/src/config/db';
import { validateEnv } from '../server/src/config/env';

validateEnv();

let dbConnectionPromise: Promise<void> | null = null;

const ensureDbConnection = async () => {
    if (!dbConnectionPromise) {
        dbConnectionPromise = connectDB().catch((err) => {
            dbConnectionPromise = null;
            throw err;
        });
    }
    await dbConnectionPromise;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ensureDbConnection();
    return app(req as any, res as any);
}

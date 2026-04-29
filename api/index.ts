import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app';
import { connectDB } from '../server/src/config/db';

let dbConnectionPromise: Promise<void> | null = null;

const ensureDbConnection = async () => {
    if (!dbConnectionPromise) {
        dbConnectionPromise = connectDB();
    }

    await dbConnectionPromise;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ensureDbConnection();
    return app(req as any, res as any);
}

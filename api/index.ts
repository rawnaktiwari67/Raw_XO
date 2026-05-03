import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    return app(req as any, res as any);
}

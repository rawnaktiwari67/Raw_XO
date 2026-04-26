import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { env } from '../config/env';
import { resolveClerkUser } from '../utils/clerkSync';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!env.CLERK_SECRET_KEY) {
            res.status(401).json({ success: false, error: 'Clerk is not configured on the server' });
            return;
        }

        const auth = getAuth(req);
        if (!auth.userId) {
            res.status(401).json({ success: false, error: 'Not authenticated' });
            return;
        }

        req.userId = await resolveClerkUser(auth.userId) ?? undefined;
        if (!req.userId) {
            res.status(401).json({ success: false, error: 'Unable to resolve user profile' });
            return;
        }

        next();
    } catch {
        res.status(401).json({ success: false, error: 'Token invalid or expired' });
    }
};

export const optionalProtect = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!env.CLERK_SECRET_KEY) {
            req.userId = undefined;
            next();
            return;
        }

        const auth = getAuth(req);
        if (!auth.userId) {
            next();
            return;
        }

        req.userId = await resolveClerkUser(auth.userId) ?? undefined;
    } catch {
        req.userId = undefined;
    }
    next();
};

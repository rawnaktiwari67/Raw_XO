import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { env } from '../config/env';
import { resolveClerkUser } from '../utils/clerkSync';
import { verifyToken } from '../utils/jwtUtils';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
            const auth = getAuth(req);
            if (auth.userId) {
                req.userId = await resolveClerkUser(auth.userId) ?? undefined;
                if (!req.userId) {
                    res.status(401).json({ success: false, error: 'Unable to resolve user profile' });
                    return;
                }

                next();
                return;
            }
        }

        const cookieToken = req.cookies?.token;
        if (typeof cookieToken === 'string' && cookieToken) {
            const payload = verifyToken(cookieToken);
            req.userId = payload.id;
            next();
            return;
        }

        res.status(401).json({ success: false, error: 'Not authenticated' });
    } catch {
        res.status(401).json({ success: false, error: 'Token invalid or expired' });
    }
};

export const optionalProtect = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
            const auth = getAuth(req);
            if (auth.userId) {
                req.userId = await resolveClerkUser(auth.userId) ?? undefined;
                next();
                return;
            }
        }

        const cookieToken = req.cookies?.token;
        if (typeof cookieToken === 'string' && cookieToken) {
            const payload = verifyToken(cookieToken);
            req.userId = payload.id;
            next();
            return;
        }
    } catch {
        req.userId = undefined;
    }
    next();
};

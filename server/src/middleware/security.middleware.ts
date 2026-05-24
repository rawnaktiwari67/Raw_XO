import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';

const adminUserIds = new Set(
    env.ADMIN_USER_IDS
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
);

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userId || !adminUserIds.has(req.userId)) {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
    }

    next();
};

export const validateParamObjectId = (paramName = 'id') =>
    (req: Request, res: Response, next: NextFunction): void => {
        const value = req.params[paramName];
        if (!mongoose.Types.ObjectId.isValid(value)) {
            res.status(400).json({ success: false, error: 'Invalid resource id' });
            return;
        }

        next();
    };

export const requireCultureWriteAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (env.REQUIRE_AUTH_FOR_CULTURE_WRITES && !req.userId) {
        res.status(401).json({ success: false, error: 'Sign in required' });
        return;
    }

    next();
};


import { Request, Response, NextFunction } from 'express';
import { reportError } from '../utils/errorReporting';

export const errorHandler = (
    err: Error & { statusCode?: number },
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    console.error(`[Error] ${err.message}`);
    // Only unexpected failures go to Sentry — expected 4xx noise stays out.
    if (statusCode >= 500) {
        reportError(err, { path: req.path, method: req.method });
    }
    res.status(statusCode).json({
        success: false,
        error: process.env.NODE_ENV === 'production' && statusCode >= 500
            ? 'Internal Server Error'
            : err.message || 'Internal Server Error',
    });
};

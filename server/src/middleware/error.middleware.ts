import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
    err: Error & { statusCode?: number },
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    console.error(`[Error] ${err.message}`);
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
};

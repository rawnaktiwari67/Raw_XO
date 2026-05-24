import { Request, Response } from 'express';
import CultureSignal from '../models/CultureSignal';
import CultureReview from '../models/CultureReview';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from '../utils/devStore';
import { successResponse, errorResponse } from '../utils/apiResponse';

const sanitizeSignal = (signal: { trackId: string; meaningVotes?: Record<string, number>; reactions?: Record<string, number> }) => ({
    trackId: signal.trackId,
    meaningVotes: signal.meaningVotes || {},
    reactions: signal.reactions || {},
});

const cleanText = (value: unknown, maxLength: number): string =>
    typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const safeKeyPattern = /^[a-zA-Z0-9:_-]{1,120}$/;

const getResolvedUsername = async (userId?: string, authorName?: string): Promise<string> => {
    if (authorName && authorName.trim()) return authorName.trim().slice(0, 40);
    if (!userId) return 'guest';

    if (!isDbConnected()) {
        return devStore.findUserById(userId)?.username || 'guest';
    }

    const user = await User.findById(userId).select('username');
    return user?.username || 'guest';
};

export const getSignals = async (req: Request, res: Response): Promise<void> => {
    try {
        const trackIds = String(req.query.trackIds || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        if (trackIds.length === 0) {
            res.json(successResponse([]));
            return;
        }

        const signals = !isDbConnected()
            ? devStore.getCultureSignals(trackIds)
            : await CultureSignal.find({ trackId: { $in: trackIds } }).lean();

        res.json(successResponse(signals.map((signal) => sanitizeSignal(signal))));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

export const voteMeaning = async (req: Request, res: Response): Promise<void> => {
    try {
        const trackId = cleanText(req.body.trackId, 120);
        const meaningId = cleanText(req.body.meaningId, 120);
        if (!trackId || !meaningId) {
            res.status(400).json(errorResponse('trackId and meaningId are required'));
            return;
        }
        if (!safeKeyPattern.test(trackId) || !safeKeyPattern.test(meaningId)) {
            res.status(400).json(errorResponse('Invalid vote payload'));
            return;
        }

        if (!isDbConnected()) {
            const signal = devStore.voteCultureMeaning(trackId, meaningId);
            res.json(successResponse(sanitizeSignal(signal), 'Meaning vote saved'));
            return;
        }

        const signal = await CultureSignal.findOneAndUpdate(
            { trackId },
            {
                $setOnInsert: { trackId },
                $inc: { [`meaningVotes.${meaningId}`]: 1 },
            },
            { new: true, upsert: true }
        ).lean();

        res.json(successResponse(signal ? sanitizeSignal(signal) : null, 'Meaning vote saved'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

export const reactToTrack = async (req: Request, res: Response): Promise<void> => {
    try {
        const trackId = cleanText(req.body.trackId, 120);
        const reactionId = cleanText(req.body.reactionId, 120);
        if (!trackId || !reactionId) {
            res.status(400).json(errorResponse('trackId and reactionId are required'));
            return;
        }
        if (!safeKeyPattern.test(trackId) || !safeKeyPattern.test(reactionId)) {
            res.status(400).json(errorResponse('Invalid reaction payload'));
            return;
        }

        if (!isDbConnected()) {
            const signal = devStore.reactCultureTrack(trackId, reactionId);
            res.json(successResponse(sanitizeSignal(signal), 'Reaction saved'));
            return;
        }

        const signal = await CultureSignal.findOneAndUpdate(
            { trackId },
            {
                $setOnInsert: { trackId },
                $inc: { [`reactions.${reactionId}`]: 1 },
            },
            { new: true, upsert: true }
        ).lean();

        res.json(successResponse(signal ? sanitizeSignal(signal) : null, 'Reaction saved'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

export const getReviews = async (req: Request, res: Response): Promise<void> => {
    try {
        const trackId = typeof req.query.trackId === 'string' ? req.query.trackId : undefined;
        const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));

        const reviews = !isDbConnected()
            ? devStore.getCultureReviews(trackId, limit)
            : await CultureReview.find(trackId ? { trackId } : {})
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

        res.json(successResponse(reviews));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

export const createReview = async (req: Request, res: Response): Promise<void> => {
    try {
        const trackId = cleanText(req.body.trackId, 120);
        const title = cleanText(req.body.title, 160);
        const artist = cleanText(req.body.artist, 120);
        const albumArt = cleanText(req.body.albumArt, 500);
        const rating = Number(req.body.rating);
        const moodTag = cleanText(req.body.moodTag, 40);
        const take = cleanText(req.body.take, 220);
        const authorName = cleanText(req.body.authorName, 40);

        if (!trackId || !title || !artist || !rating || !moodTag || !take) {
            res.status(400).json(errorResponse('trackId, title, artist, rating, moodTag, and take are required'));
            return;
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || take.length < 8) {
            res.status(400).json(errorResponse('Invalid review payload'));
            return;
        }

        const username = await getResolvedUsername(req.userId, authorName);

        if (!isDbConnected()) {
            const review = devStore.saveCultureReview({
                trackId,
                user: req.userId,
                username,
                title,
                artist,
                albumArt: albumArt || '',
                rating,
                moodTag,
                take: take.trim(),
            });
            res.status(201).json(successResponse(review, 'Review saved'));
            return;
        }

        const review = await CultureReview.create({
            trackId,
            user: req.userId,
            username,
            title,
            artist,
            albumArt: albumArt || '',
            rating,
            moodTag,
            take: take.trim(),
        });

        res.status(201).json(successResponse(review, 'Review saved'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

import { Request, Response } from 'express';
import CultureSignal from '../models/CultureSignal';
import CultureReview from '../models/CultureReview';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from '../utils/devStore';
import { successResponse, errorResponse } from '../utils/apiResponse';

type RawSignal = {
    trackId: string;
    meaningVotes?: Record<string, number>;
    reactions?: Record<string, number>;
    meaningVoters?: Record<string, string>;
    reactionVoters?: Record<string, string>;
};

// Identify the voter so a vote can switch rather than stack, and so a returning
// voter sees their own pick highlighted. Signed-in users key by id; anonymous
// players fall back to their stable guest cookie. No identity => no dedup.
const getVoterKey = (req: Request): string => {
    if (req.userId) return req.userId;
    const guest = typeof req.cookies?.xo_guest === 'string' ? req.cookies.xo_guest.trim() : '';
    return guest ? `guest:${guest}` : '';
};

const sanitizeSignal = (signal: RawSignal, voterKey = '') => ({
    trackId: signal.trackId,
    meaningVotes: signal.meaningVotes || {},
    reactions: signal.reactions || {},
    // The requester's own current selections — never expose the full voter maps.
    userMeaning: voterKey ? signal.meaningVoters?.[voterKey] || null : null,
    userReaction: voterKey ? signal.reactionVoters?.[voterKey] || null : null,
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

        const voterKey = getVoterKey(req);
        const signals = !isDbConnected()
            ? devStore.getCultureSignals(trackIds)
            : await CultureSignal.find({ trackId: { $in: trackIds } }).lean();

        res.json(successResponse(signals.map((signal) => sanitizeSignal(signal as RawSignal, voterKey))));
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

        const voterKey = getVoterKey(req);

        if (!isDbConnected()) {
            const signal = devStore.voteCultureMeaning(trackId, meaningId, voterKey);
            res.json(successResponse(sanitizeSignal(signal, voterKey), 'Meaning vote saved'));
            return;
        }

        // One meaning vote per voter per track: if they already picked a different
        // meaning, move the vote instead of adding a second one.
        const existing = voterKey
            ? await CultureSignal.findOne({ trackId }).select('meaningVoters').lean()
            : null;
        const previousMeaning = existing?.meaningVoters?.[voterKey];

        if (previousMeaning === meaningId) {
            const signal = await CultureSignal.findOne({ trackId }).lean();
            res.json(successResponse(signal ? sanitizeSignal(signal as RawSignal, voterKey) : null, 'Meaning vote saved'));
            return;
        }

        const inc: Record<string, number> = { [`meaningVotes.${meaningId}`]: 1 };
        if (previousMeaning) inc[`meaningVotes.${previousMeaning}`] = -1;
        const update: Record<string, unknown> = {
            $setOnInsert: { trackId },
            $inc: inc,
        };
        if (voterKey) update.$set = { [`meaningVoters.${voterKey}`]: meaningId };

        const signal = await CultureSignal.findOneAndUpdate(
            { trackId },
            update,
            { new: true, upsert: true }
        ).lean();

        res.json(successResponse(signal ? sanitizeSignal(signal as RawSignal, voterKey) : null, 'Meaning vote saved'));
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

        const voterKey = getVoterKey(req);

        if (!isDbConnected()) {
            const signal = devStore.reactCultureTrack(trackId, reactionId, voterKey);
            res.json(successResponse(sanitizeSignal(signal, voterKey), 'Reaction saved'));
            return;
        }

        // One reaction per voter per track: switch it if they tap a different one.
        const existing = voterKey
            ? await CultureSignal.findOne({ trackId }).select('reactionVoters').lean()
            : null;
        const previousReaction = existing?.reactionVoters?.[voterKey];

        if (previousReaction === reactionId) {
            const signal = await CultureSignal.findOne({ trackId }).lean();
            res.json(successResponse(signal ? sanitizeSignal(signal as RawSignal, voterKey) : null, 'Reaction saved'));
            return;
        }

        const inc: Record<string, number> = { [`reactions.${reactionId}`]: 1 };
        if (previousReaction) inc[`reactions.${previousReaction}`] = -1;
        const update: Record<string, unknown> = {
            $setOnInsert: { trackId },
            $inc: inc,
        };
        if (voterKey) update.$set = { [`reactionVoters.${voterKey}`]: reactionId };

        const signal = await CultureSignal.findOneAndUpdate(
            { trackId },
            update,
            { new: true, upsert: true }
        ).lean();

        res.json(successResponse(signal ? sanitizeSignal(signal as RawSignal, voterKey) : null, 'Reaction saved'));
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

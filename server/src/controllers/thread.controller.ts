import { Request, Response } from 'express';
import Thread from '../models/Thread';
import Era from '../models/Era';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { calculateLevel, ACTION_XP } from '../utils/xpUtils';

// GET /threads?era=&sort=&page=&limit=
export const getThreads = async (req: Request, res: Response): Promise<void> => {
    try {
        const { era: eraSlug, sort = 'latest', page = '1', limit = '15' } = req.query;
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
        const skip = (pageNum - 1) * limitNum;

        const query: Record<string, unknown> = { isDeleted: false };
        if (eraSlug) {
            const era = await Era.findOne({ slug: eraSlug });
            if (era) query.era = era._id;
        }

        const sortObj: Record<string, 1 | -1> = sort === 'top'
            ? { upvotes: -1, createdAt: -1 }
            : { createdAt: -1 };

        const [threads, total] = await Promise.all([
            Thread.find(query)
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum)
                .populate('author', 'username avatar levelBadge')
                .populate('era', 'name slug accentColor'),
            Thread.countDocuments(query),
        ]);

        res.json(successResponse({ threads, total, page: pageNum, totalPages: Math.ceil(total / limitNum) }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /threads/:id
export const getThread = async (req: Request, res: Response): Promise<void> => {
    try {
        const thread = await Thread.findOne({ _id: req.params.id, isDeleted: false })
            .populate('author', 'username avatar levelBadge xp level')
            .populate('era', 'name slug accentColor');
        if (!thread) {
            res.status(404).json(errorResponse('Thread not found'));
            return;
        }
        res.json(successResponse(thread));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /threads
export const createThread = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, body, eraId, tags } = req.body;
        if (!title || !body || !eraId) {
            res.status(400).json(errorResponse('Title, body, and era are required'));
            return;
        }
        const era = await Era.findById(eraId);
        if (!era) {
            res.status(404).json(errorResponse('Era not found'));
            return;
        }
        const thread = await Thread.create({
            title, body, tags: tags || [],
            author: req.userId,
            era: era._id,
        });
        await User.findByIdAndUpdate(req.userId, {
            $push: { threadHistory: thread._id },
            $inc: { xp: ACTION_XP.CREATE_THREAD },
        }).then(async (user) => {
            if (user) {
                const { level, badge } = calculateLevel(user.xp + ACTION_XP.CREATE_THREAD);
                await User.findByIdAndUpdate(req.userId, { level, levelBadge: badge });
            }
        });
        const populated = await thread.populate([
            { path: 'author', select: 'username avatar levelBadge' },
            { path: 'era', select: 'name slug accentColor' },
        ]);
        res.status(201).json(successResponse(populated, 'Thread created'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// PUT /threads/:id
export const updateThread = async (req: Request, res: Response): Promise<void> => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread || thread.isDeleted) {
            res.status(404).json(errorResponse('Thread not found'));
            return;
        }
        if (thread.author.toString() !== req.userId) {
            res.status(403).json(errorResponse('Not authorized'));
            return;
        }
        const { title, body, tags } = req.body;
        if (title) thread.title = title;
        if (body) thread.body = body;
        if (tags) thread.tags = tags;
        await thread.save();
        res.json(successResponse(thread, 'Thread updated'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// DELETE /threads/:id
export const deleteThread = async (req: Request, res: Response): Promise<void> => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread || thread.isDeleted) {
            res.status(404).json(errorResponse('Thread not found'));
            return;
        }
        if (thread.author.toString() !== req.userId) {
            res.status(403).json(errorResponse('Not authorized'));
            return;
        }
        thread.isDeleted = true;
        await thread.save();
        res.json(successResponse(null, 'Thread deleted'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /threads/:id/vote
export const voteThread = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type } = req.body; // 'up' | 'down'
        const thread = await Thread.findOne({ _id: req.params.id, isDeleted: false });
        if (!thread) {
            res.status(404).json(errorResponse('Thread not found'));
            return;
        }
        const userId = req.userId as string;
        const upIdx = thread.upvotes.findIndex((id) => id.toString() === userId);
        const downIdx = thread.downvotes.findIndex((id) => id.toString() === userId);

        if (type === 'up') {
            if (upIdx > -1) {
                thread.upvotes.splice(upIdx, 1);
            } else {
                thread.upvotes.push(new (require('mongoose').Types.ObjectId)(userId));
                if (downIdx > -1) thread.downvotes.splice(downIdx, 1);
                // Award XP to thread author
                if (thread.author.toString() !== userId) {
                    await User.findByIdAndUpdate(thread.author, { $inc: { xp: ACTION_XP.RECEIVE_UPVOTE } });
                }
            }
        } else {
            if (downIdx > -1) {
                thread.downvotes.splice(downIdx, 1);
            } else {
                thread.downvotes.push(new (require('mongoose').Types.ObjectId)(userId));
                if (upIdx > -1) thread.upvotes.splice(upIdx, 1);
            }
        }
        await thread.save();
        res.json(successResponse({ upvotes: thread.upvotes.length, downvotes: thread.downvotes.length }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

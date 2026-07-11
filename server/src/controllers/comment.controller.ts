import { Request, Response } from 'express';
import Comment from '../models/Comment';
import Thread from '../models/Thread';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { calculateLevel, ACTION_XP } from '../utils/xpUtils';
import mongoose from 'mongoose';

const cleanText = (value: unknown, maxLength: number): string =>
    typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

// GET /comments?thread=&page=
export const getComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { thread: threadId, page = '1', limit = '50' } = req.query;
        if (!threadId) {
            res.status(400).json(errorResponse('threadId is required'));
            return;
        }
        if (typeof threadId !== 'string' || !mongoose.Types.ObjectId.isValid(threadId)) {
            res.status(400).json(errorResponse('Invalid thread id'));
            return;
        }
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
        const skip = (pageNum - 1) * limitNum;

        // Soft-deleted comments are returned as redacted tombstones instead of
        // being filtered out — dropping them would orphan every reply nested
        // beneath them (replies only render inside their parent's card). The
        // client decides whether a tombstone is worth showing.
        const comments = await Comment.find({ thread: threadId })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limitNum)
            .populate('author', 'username avatar levelBadge')
            .lean();

        const redacted = comments.map((c) => (c.isDeleted ? { ...c, body: '' } : c));
        res.json(successResponse(redacted));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /comments
export const createComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const threadId = cleanText(req.body.threadId, 80);
        const parentId = cleanText(req.body.parentId, 80);
        const body = cleanText(req.body.body, 2000);
        if (!threadId || !body) {
            res.status(400).json(errorResponse('threadId and body are required'));
            return;
        }
        if (!mongoose.Types.ObjectId.isValid(threadId) || (parentId && !mongoose.Types.ObjectId.isValid(parentId))) {
            res.status(400).json(errorResponse('Invalid comment target'));
            return;
        }
        const thread = await Thread.findOne({ _id: threadId, isDeleted: false });
        if (!thread) {
            res.status(404).json(errorResponse('Thread not found'));
            return;
        }

        let depth = 0;
        if (parentId) {
            const parent = await Comment.findOne({ _id: parentId, thread: threadId, isDeleted: false });
            if (!parent) {
                res.status(404).json(errorResponse('Parent comment not found'));
                return;
            }
            depth = Math.min(parent.depth + 1, 3);
        }

        const comment = await Comment.create({
            body, thread: threadId,
            author: req.userId,
            parent: parentId || null,
            depth,
        });

        await Thread.findByIdAndUpdate(threadId, { $inc: { commentCount: 1 } });
        await User.findByIdAndUpdate(req.userId, {
            $push: { commentHistory: comment._id },
            $inc: { xp: ACTION_XP.CREATE_COMMENT },
        }).then(async (user) => {
            if (user) {
                const { level, badge } = calculateLevel(user.xp + ACTION_XP.CREATE_COMMENT);
                await User.findByIdAndUpdate(req.userId, { level, levelBadge: badge });
            }
        });

        const populated = await comment.populate('author', 'username avatar levelBadge');
        res.status(201).json(successResponse(populated, 'Comment created'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// PUT /comments/:id
export const updateComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment || comment.isDeleted) {
            res.status(404).json(errorResponse('Comment not found'));
            return;
        }
        if (comment.author.toString() !== req.userId) {
            res.status(403).json(errorResponse('Not authorized'));
            return;
        }
        const body = cleanText(req.body.body, 2000);
        if (!body) {
            res.status(400).json(errorResponse('Comment body is required'));
            return;
        }
        comment.body = body;
        await comment.save();
        // Populate the author like createComment does — the client swaps the
        // whole object into its store, so a raw ObjectId here would blank the
        // username/badge and hide the author's own Edit/Delete buttons.
        const populated = await comment.populate('author', 'username avatar levelBadge');
        res.json(successResponse(populated, 'Comment updated'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// DELETE /comments/:id
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment || comment.isDeleted) {
            res.status(404).json(errorResponse('Comment not found'));
            return;
        }
        if (comment.author.toString() !== req.userId) {
            res.status(403).json(errorResponse('Not authorized'));
            return;
        }
        comment.isDeleted = true;
        await comment.save();
        await Thread.findByIdAndUpdate(comment.thread, { $inc: { commentCount: -1 } });
        res.json(successResponse(null, 'Comment deleted'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /comments/:id/vote
export const voteComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const comment = await Comment.findOne({ _id: req.params.id, isDeleted: false });
        if (!comment) {
            res.status(404).json(errorResponse('Comment not found'));
            return;
        }
        const userId = req.userId as string;
        const idx = comment.upvotes.findIndex((id) => id.toString() === userId);
        if (idx > -1) {
            comment.upvotes.splice(idx, 1);
        } else {
            comment.upvotes.push(new mongoose.Types.ObjectId(userId));
        }
        await comment.save();
        res.json(successResponse({ upvotes: comment.upvotes.length }));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

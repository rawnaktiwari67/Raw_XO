import { Request, Response } from 'express';
import Comment from '../models/Comment';
import Thread from '../models/Thread';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { calculateLevel, ACTION_XP } from '../utils/xpUtils';
import mongoose from 'mongoose';

// GET /comments?thread=&page=
export const getComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { thread: threadId, page = '1', limit = '50' } = req.query;
        if (!threadId) {
            res.status(400).json(errorResponse('threadId is required'));
            return;
        }
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, parseInt(limit as string));
        const skip = (pageNum - 1) * limitNum;

        const comments = await Comment.find({ thread: threadId, isDeleted: false })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limitNum)
            .populate('author', 'username avatar levelBadge');

        res.json(successResponse(comments));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /comments
export const createComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { threadId, parentId, body } = req.body;
        if (!threadId || !body) {
            res.status(400).json(errorResponse('threadId and body are required'));
            return;
        }

        let depth = 0;
        if (parentId) {
            const parent = await Comment.findById(parentId);
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
        comment.body = req.body.body || comment.body;
        await comment.save();
        res.json(successResponse(comment, 'Comment updated'));
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

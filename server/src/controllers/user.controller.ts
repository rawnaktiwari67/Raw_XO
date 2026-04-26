import { Request, Response } from 'express';
import User from '../models/User';
import Thread from '../models/Thread';
import Comment from '../models/Comment';
import { successResponse, errorResponse } from '../utils/apiResponse';

// GET /users/:username
export const getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('-passwordHash -email');
        if (!user) {
            res.status(404).json(errorResponse('User not found'));
            return;
        }
        res.json(successResponse(user));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// PUT /users/me
export const updateMe = async (req: Request, res: Response): Promise<void> => {
    try {
        const { avatar, bio } = req.body;
        const user = await User.findByIdAndUpdate(
            req.userId,
            { ...(avatar !== undefined && { avatar }), ...(bio !== undefined && { bio }) },
            { new: true }
        ).select('-passwordHash');
        res.json(successResponse(user, 'Profile updated'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /users/me/threads
export const getMyThreads = async (req: Request, res: Response): Promise<void> => {
    try {
        const threads = await Thread.find({ author: req.userId, isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('era', 'name slug accentColor');
        res.json(successResponse(threads));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// GET /users/me/comments
export const getMyComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const comments = await Comment.find({ author: req.userId, isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('thread', 'title');
        res.json(successResponse(comments));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

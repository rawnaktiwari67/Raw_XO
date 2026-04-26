import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from '../utils/devStore';
import { signToken } from '../utils/jwtUtils';
import { successResponse, errorResponse } from '../utils/apiResponse';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            res.status(400).json(errorResponse('All fields are required'));
            return;
        }
        if (password.length < 6) {
            res.status(400).json(errorResponse('Password must be at least 6 characters'));
            return;
        }
        if (!isDbConnected()) {
            const existing = devStore.findUserByEmail(email) || devStore.findUserByUsername(username);
            if (existing) {
                res.status(409).json(errorResponse('Username or email already in use'));
                return;
            }
            const passwordHash = await bcrypt.hash(password, 12);
            const user = devStore.createUser({ username, email, passwordHash });
            const token = signToken(user._id);
            res.cookie('token', token, COOKIE_OPTIONS);
            res.status(201).json(successResponse(devStore.publicUser(user), 'Account created'));
            return;
        }
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            res.status(409).json(errorResponse('Username or email already in use'));
            return;
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ username, email, passwordHash });
        const token = signToken(user.id);
        res.cookie('token', token, COOKIE_OPTIONS);
        res.status(201).json(successResponse({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            xp: user.xp,
            level: user.level,
            levelBadge: user.levelBadge,
        }, 'Account created'));
    } catch (err) {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json(errorResponse('Email and password are required'));
            return;
        }
        if (!isDbConnected()) {
            const user = devStore.findUserByEmail(email);
            if (!user) {
                res.status(401).json(errorResponse('Invalid credentials'));
                return;
            }
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                res.status(401).json(errorResponse('Invalid credentials'));
                return;
            }
            const token = signToken(user._id);
            res.cookie('token', token, COOKIE_OPTIONS);
            res.json(successResponse(devStore.publicUser(user), 'Logged in'));
            return;
        }
        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json(errorResponse('Invalid credentials'));
            return;
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json(errorResponse('Invalid credentials'));
            return;
        }
        const token = signToken(user.id);
        res.cookie('token', token, COOKIE_OPTIONS);
        res.json(successResponse({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            bio: user.bio,
            xp: user.xp,
            level: user.level,
            levelBadge: user.levelBadge,
        }, 'Logged in'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /auth/logout
export const logout = (_req: Request, res: Response): void => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    res.json(successResponse(null, 'Logged out'));
};

// GET /auth/me
export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!isDbConnected()) {
            const user = devStore.findUserById(req.userId);
            if (!user) {
                res.status(404).json(errorResponse('User not found'));
                return;
            }
            res.json(successResponse(devStore.publicUser(user)));
            return;
        }
        const user = await User.findById(req.userId).select('-passwordHash');
        if (!user) {
            res.status(404).json(errorResponse('User not found'));
            return;
        }
        res.json(successResponse(user));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

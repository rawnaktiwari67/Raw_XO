import { Router } from 'express';
import {
    getThreads, getThread, createThread, updateThread, deleteThread, voteThread,
} from '../controllers/thread.controller';
import { protect } from '../middleware/auth.middleware';
import { voteLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', getThreads);
router.get('/:id', getThread);
router.post('/', protect, createThread);
router.put('/:id', protect, updateThread);
router.delete('/:id', protect, deleteThread);
router.post('/:id/vote', protect, voteLimiter, voteThread);

export default router;

import { Router } from 'express';
import {
    getThreads, getThread, createThread, updateThread, deleteThread, voteThread,
} from '../controllers/thread.controller';
import { protect } from '../middleware/auth.middleware';
import { voteLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validateParamObjectId } from '../middleware/security.middleware';

const router = Router();

router.get('/', getThreads);
router.get('/:id', validateParamObjectId(), getThread);
router.post('/', protect, writeLimiter, createThread);
router.put('/:id', protect, writeLimiter, validateParamObjectId(), updateThread);
router.delete('/:id', protect, writeLimiter, validateParamObjectId(), deleteThread);
router.post('/:id/vote', protect, voteLimiter, validateParamObjectId(), voteThread);

export default router;

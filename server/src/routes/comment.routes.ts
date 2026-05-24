import { Router } from 'express';
import {
    getComments, createComment, updateComment, deleteComment, voteComment,
} from '../controllers/comment.controller';
import { protect } from '../middleware/auth.middleware';
import { voteLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validateParamObjectId } from '../middleware/security.middleware';

const router = Router();

router.get('/', getComments);
router.post('/', protect, writeLimiter, createComment);
router.put('/:id', protect, writeLimiter, validateParamObjectId(), updateComment);
router.delete('/:id', protect, writeLimiter, validateParamObjectId(), deleteComment);
router.post('/:id/vote', protect, voteLimiter, validateParamObjectId(), voteComment);

export default router;

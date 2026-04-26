import { Router } from 'express';
import {
    getComments, createComment, updateComment, deleteComment, voteComment,
} from '../controllers/comment.controller';
import { protect } from '../middleware/auth.middleware';
import { voteLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', getComments);
router.post('/', protect, createComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);
router.post('/:id/vote', protect, voteLimiter, voteComment);

export default router;

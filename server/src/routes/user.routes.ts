import { Router } from 'express';
import { getProfile, updateMe, getMyThreads, getMyComments } from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/me/threads', protect, getMyThreads);
router.get('/me/comments', protect, getMyComments);
router.put('/me', protect, updateMe);
router.get('/:username', getProfile);

export default router;

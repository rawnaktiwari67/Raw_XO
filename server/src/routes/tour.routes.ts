import { Router } from 'express';
import { getTours, createTour, updateTour } from '../controllers/tour.controller';
import { protect } from '../middleware/auth.middleware';
import { requireAdmin, validateParamObjectId } from '../middleware/security.middleware';
import { writeLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', getTours);
router.post('/', protect, requireAdmin, writeLimiter, createTour);
router.put('/:id', protect, requireAdmin, writeLimiter, validateParamObjectId(), updateTour);

export default router;

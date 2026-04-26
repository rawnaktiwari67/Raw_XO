import { Router } from 'express';
import { getTours, createTour, updateTour } from '../controllers/tour.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getTours);
router.post('/', protect, createTour);
router.put('/:id', protect, updateTour);

export default router;

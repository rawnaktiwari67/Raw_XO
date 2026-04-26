import { Router } from 'express';
import {
    createReview,
    getReviews,
    getSignals,
    reactToTrack,
    voteMeaning,
} from '../controllers/culture.controller';
import { optionalProtect } from '../middleware/auth.middleware';

const router = Router();

router.get('/signals', getSignals);
router.get('/reviews', getReviews);
router.post('/meaning', optionalProtect, voteMeaning);
router.post('/reaction', optionalProtect, reactToTrack);
router.post('/reviews', optionalProtect, createReview);

export default router;

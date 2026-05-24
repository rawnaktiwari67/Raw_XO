import { Router } from 'express';
import {
    createReview,
    getReviews,
    getSignals,
    reactToTrack,
    voteMeaning,
} from '../controllers/culture.controller';
import { optionalProtect } from '../middleware/auth.middleware';
import { cultureWriteLimiter } from '../middleware/rateLimiter';
import { requireCultureWriteAuth } from '../middleware/security.middleware';

const router = Router();

router.get('/signals', getSignals);
router.get('/reviews', getReviews);
router.post('/meaning', optionalProtect, requireCultureWriteAuth, cultureWriteLimiter, voteMeaning);
router.post('/reaction', optionalProtect, requireCultureWriteAuth, cultureWriteLimiter, reactToTrack);
router.post('/reviews', optionalProtect, requireCultureWriteAuth, cultureWriteLimiter, createReview);

export default router;

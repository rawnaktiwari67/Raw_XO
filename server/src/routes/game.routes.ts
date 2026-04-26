import { Router } from 'express';
import { getQuestion, submitAnswer, getLeaderboard, getHistory, getStats, rateTrack, getArtists } from '../controllers/game.controller';
import { optionalProtect } from '../middleware/auth.middleware';
import { gameLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/question', optionalProtect, getQuestion);
router.get('/artists', getArtists);
router.post('/answer', optionalProtect, gameLimiter, submitAnswer);
router.post('/rating', optionalProtect, rateTrack);
router.get('/leaderboard', optionalProtect, getLeaderboard);
router.get('/history', optionalProtect, getHistory);
router.get('/stats', optionalProtect, getStats);

export default router;

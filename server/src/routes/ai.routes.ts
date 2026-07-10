import { Router } from 'express';
import { askTrivia, generateHint } from '../controllers/ai.controller';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/trivia', aiLimiter, askTrivia);
router.post('/hint', aiLimiter, generateHint);

export default router;

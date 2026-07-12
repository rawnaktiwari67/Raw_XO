import { Router } from 'express';
import { generateHint } from '../controllers/ai.controller';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/hint', aiLimiter, generateHint);

export default router;

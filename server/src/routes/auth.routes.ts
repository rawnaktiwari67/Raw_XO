import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import { shouldUseClerkServer } from '../config/env';

const router = Router();

// Password-based sign-up/sign-in is a fallback for keyless/local runs only. When
// Clerk is the active auth provider (i.e. production), these endpoints are NOT
// mounted — Clerk owns registration and login — so there is no parallel password
// surface to brute-force or attack. /me and /logout stay mounted in both modes:
// the client loads its DB-synced profile via /me even under Clerk, and /logout is
// a harmless cookie clear.
if (!shouldUseClerkServer) {
    router.post('/register', authLimiter, register);
    router.post('/login', authLimiter, login);
}
router.post('/logout', authLimiter, protect, logout);
router.get('/me', protect, getMe);

export default router;

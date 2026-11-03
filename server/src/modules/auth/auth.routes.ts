import { Router } from 'express';
import { login, getCurrentUser, changePassword, refreshToken } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rate-limiter.js';

const router = Router();

router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refreshToken);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/change-password', authenticateToken, changePassword);

export default router;

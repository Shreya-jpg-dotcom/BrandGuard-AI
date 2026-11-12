import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, registerEmployee, acceptInvitation } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });
router.post('/register', authLimiter, registerEmployee);
router.post('/accept-invitation', authLimiter, acceptInvitation);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
export default router;

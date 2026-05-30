import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 公开接口
router.post('/register', userController.register);
router.post('/login', userController.login);

// 需要登录的接口
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/password', authMiddleware, userController.changePassword);
router.get('/pricing', authMiddleware, userController.getPricing);
router.get('/billing', authMiddleware, userController.getBillingLogs);
router.post('/vip/buy', authMiddleware, userController.buyVip);
router.get('/usage', authMiddleware, userController.getUsage);

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// BUG-127 (v3.0.57): login/register 单独严格限流 (防爆破), 不跟全局 /api/* 共享额度
// 全局限流 500 reqs/min 太宽松, 防爆破需要更严
// 失败请求也计数 (skipSuccessfulRequests: false), 防止攻击者用失败请求消耗额度
const authLimiter = rateLimit({
  windowMs: 60_000,    // 60s window
  max: 10,             // 每 60s 10 次 (足够正常用户重试, 阻止爆破)
  skipSuccessfulRequests: true,  // 成功登录不计 (用户连点 5 次成功不影响后续)
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: '登录尝试过于频繁, 请 1 分钟后再试',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'unknown',
    },
  },
});

// 公开接口
router.post('/register', authLimiter, userController.register);
router.post('/login', authLimiter, userController.login);

// 需要登录的接口
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/password', authMiddleware, userController.changePassword);
router.get('/pricing', authMiddleware, userController.getPricing);
router.get('/billing', authMiddleware, userController.getBillingLogs);
router.post('/vip/buy', authMiddleware, userController.buyVip);
router.get('/usage', authMiddleware, userController.getUsage);
router.get('/history', authMiddleware, userController.getHistory);

export default router;

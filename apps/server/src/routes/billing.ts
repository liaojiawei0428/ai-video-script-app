// apps/server/src/routes/billing.ts
// v3.0.32 (S71 BUG-078): 账单明细 API (web 端"账单明细"页面核心)
// - GET /api/billing/transactions  查当前用户的全部交易记录 (充值 + 消费 + 免费)
// - GET /api/billing/summary       汇总 (总充值 / 总消费 / 总免费 / 当前余额)
// 鉴权: 所有端点必须 JWT auth (跟 /api/recharge/my 一致)
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { billingService } from '../services/billingService';

const router = Router();
// v3.0.32 BUG-078 S71: 所有 billing 端点都要 auth (跟 /api/recharge/my 一致)
router.use(authMiddleware);

/**
 * GET /api/billing/transactions
 * Query:
 *   limit?: number  默认 50, 最大 200
 *   offset?: number 默认 0
 *   type?: 'charge' | 'consumption' | 'refund'  筛选
 *   refType?: string  按消费类型筛选 (novel_analyze/episode/shot/comic/character_variant/image/video/prompt_optimize)
 * Response: { success, data: { items: BillingLog[], total: number } }
 */
router.get('/transactions', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const type = (req.query.type as string) || undefined;
    const refType = (req.query.refType as string) || undefined;
    const result = await billingService.getTransactions(userId, { limit, offset, type, refType });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '查询失败' } });
  }
});

/**
 * GET /api/billing/summary
 * Response: { success, data: { totalCharge, totalConsumption, totalFree, balance, todayConsumption, todayFree } }
 * - totalCharge: 累计充值金额 (¥)
 * - totalConsumption: 累计扣费 (¥, 不含免费)
 * - totalFree: 累计免费生成次数
 * - balance: 当前余额 (¥)
 * - todayConsumption: 今日扣费 (¥)
 * - todayFree: 今日免费次数
 */
router.get('/summary', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { queryOne } = await import('../models/db');
    const start = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const totalChargeRow = await queryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'charge'`, [userId]
    );
    const totalConsRow = await queryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 0`, [userId]
    );
    const totalFreeRow = await queryOne<any>(
      `SELECT COUNT(*) AS c FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 1`, [userId]
    );
    const todayConsRow = await queryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 0 AND created_at >= ?`, [userId, start]
    );
    const todayFreeRow = await queryOne<any>(
      `SELECT COUNT(*) AS c FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 1 AND created_at >= ?`, [userId, start]
    );
    const { userModel } = await import('../models/user');
    const user = await userModel.findById(userId);
    const balance = user?.balance || 0;
    res.json({
      success: true,
      data: {
        totalCharge: parseFloat(totalChargeRow?.s || 0),
        totalConsumption: parseFloat(totalConsRow?.s || 0),
        totalFree: totalFreeRow?.c || 0,
        balance,
        todayConsumption: parseFloat(todayConsRow?.s || 0),
        todayFree: todayFreeRow?.c || 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '查询失败' } });
  }
});

export default router;
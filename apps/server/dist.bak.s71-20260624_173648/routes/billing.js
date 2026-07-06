"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// apps/server/src/routes/billing.ts
// v3.0.32 (S71 BUG-078): 账单明细 API (web 端"账单明细"页面核心)
// - GET /api/billing/transactions  查当前用户的全部交易记录 (充值 + 消费 + 免费)
// - GET /api/billing/summary       汇总 (总充值 / 总消费 / 总免费 / 当前余额)
// 鉴权: 所有端点必须 JWT auth (跟 /api/recharge/my 一致)
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const billingService_1 = require("../services/billingService");
const router = (0, express_1.Router)();
// v3.0.32 BUG-078 S71: 所有 billing 端点都要 auth (跟 /api/recharge/my 一致)
router.use(auth_1.authMiddleware);
/**
 * GET /api/billing/transactions
 * Query:
 *   limit?: number  默认 50, 最大 200
 *   offset?: number 默认 0
 *   type?: 'charge' | 'consumption' | 'refund'  筛选
 *   refType?: string  按消费类型筛选 (novel_analyze/episode/shot/comic/character_variant/image/video/prompt_optimize)
 * Response: { success, data: { items: BillingLog[], total: number } }
 */
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        const type = req.query.type || undefined;
        const refType = req.query.refType || undefined;
        const result = await billingService_1.billingService.getTransactions(userId, { limit, offset, type, refType });
        res.json({ success: true, data: result });
    }
    catch (e) {
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
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { queryOne } = await Promise.resolve().then(() => __importStar(require('../models/db')));
        const start = (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })();
        const totalChargeRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'charge'`, [userId]);
        const totalConsRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 0`, [userId]);
        const totalFreeRow = await queryOne(`SELECT COUNT(*) AS c FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 1`, [userId]);
        const todayConsRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) AS s FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 0 AND created_at >= ?`, [userId, start]);
        const todayFreeRow = await queryOne(`SELECT COUNT(*) AS c FROM billing_logs WHERE user_id = ? AND type = 'consumption' AND is_free = 1 AND created_at >= ?`, [userId, start]);
        const { userModel } = await Promise.resolve().then(() => __importStar(require('../models/user')));
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
    }
    catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '查询失败' } });
    }
});
exports.default = router;

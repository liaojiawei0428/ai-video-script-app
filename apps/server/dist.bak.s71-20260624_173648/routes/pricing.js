"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/server/src/routes/pricing.ts
// v3.0.1 (S56): 公开端点 - 返回当前计费矩阵 (视频 + 图片)
// 公开不需 auth, 让 web 端 PricingPage 直接展示
// v3.0.31 (S69 BUG-072 A): 显式列出 characterVariant + shot (角色三视图 + 镜头图, ¥0.1/张, 不限额)
const express_1 = require("express");
const billingService_1 = require("../services/billingService");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    const pricing = billingService_1.billingService.getPricing();
    res.json({
        success: true,
        data: {
            // 视频计费矩阵
            video: {
                standard: billingService_1.VIDEO_CHARGING_MATRIX.standard,
                vip: billingService_1.VIDEO_CHARGING_MATRIX.vip,
                // 兜底: 不在白名单的 (e.g. 7/12) 走最接近
                allowedDurations: [5, 10, 15],
            },
            // 图片生成
            image: {
                standard: {
                    // v3.0.0.31 (S51): 生图免费, 走日限额
                    t2i: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_STANDARD },
                    i2i: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_STANDARD },
                    multiRef: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_STANDARD },
                    // v3.0.31 (S69 BUG-072 A): 角色三视图 + 镜头图, ¥0.1/张 GLM-Image 收费, 不限额 (普通/VIP 同价)
                    characterVariant: { amount: billingService_1.CHARACTER_VARIANT_PRICE, daily: 'unlimited' },
                    shot: { amount: billingService_1.CHARACTER_VARIANT_PRICE, daily: 'unlimited' },
                },
                vip: {
                    t2i: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : billingService_1.IMAGE_DAILY_QUOTA_VIP },
                    i2i: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : billingService_1.IMAGE_DAILY_QUOTA_VIP },
                    multiRef: { amount: 0, daily: billingService_1.IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : billingService_1.IMAGE_DAILY_QUOTA_VIP },
                    characterVariant: { amount: billingService_1.CHARACTER_VARIANT_PRICE, daily: 'unlimited' },
                    shot: { amount: billingService_1.CHARACTER_VARIANT_PRICE, daily: 'unlimited' },
                },
            },
            // 其它: 老的 analyze/shot/comic 定价 (兼容性)
            pricing,
            // 退款政策
            refundPolicy: '24 小时内被多扣的费用, 可联系客服申请退款到钱包',
            // 版本
            version: process.env.APP_VERSION || '3.0.0',
            updatedAt: new Date().toISOString(),
        },
    });
});
exports.default = router;

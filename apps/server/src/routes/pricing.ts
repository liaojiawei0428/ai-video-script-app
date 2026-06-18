// apps/server/src/routes/pricing.ts
// v3.0.1 (S56): 公开端点 - 返回当前计费矩阵 (视频 + 图片)
// 公开不需 auth, 让 web 端 PricingPage 直接展示
import { Router } from 'express';
import { billingService, VIDEO_CHARGING_MATRIX, IMAGE_DAILY_QUOTA_STANDARD, IMAGE_DAILY_QUOTA_VIP } from '../services/billingService';

const router = Router();

router.get('/', (_req, res) => {
  const pricing = billingService.getPricing();
  res.json({
    success: true,
    data: {
      // 视频计费矩阵
      video: {
        standard: VIDEO_CHARGING_MATRIX.standard,
        vip: VIDEO_CHARGING_MATRIX.vip,
        // 兜底: 不在白名单的 (e.g. 7/12) 走最接近
        allowedDurations: [5, 10, 15],
      },
      // 图片生成
      image: {
        standard: {
          // v3.0.0.31 (S51): 生图免费, 走日限额
          t2i: { amount: 0, daily: IMAGE_DAILY_QUOTA_STANDARD },
          i2i: { amount: 0, daily: IMAGE_DAILY_QUOTA_STANDARD },
          multiRef: { amount: 0, daily: IMAGE_DAILY_QUOTA_STANDARD },
        },
        vip: {
          t2i: { amount: 0, daily: IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : IMAGE_DAILY_QUOTA_VIP },
          i2i: { amount: 0, daily: IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : IMAGE_DAILY_QUOTA_VIP },
          multiRef: { amount: 0, daily: IMAGE_DAILY_QUOTA_VIP === Infinity ? 'unlimited' : IMAGE_DAILY_QUOTA_VIP },
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

export default router;

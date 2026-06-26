import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rechargeRequestModel } from '../models/rechargeRequest';
import { config } from '../config';
import { lookupIp } from '../services/ipService';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/qrcode', async (req: Request, res: Response) => {
  res.json({ success: true, data: { qrCodeUrl: config.qrCodeUrl } });
});

/** 直接返回收款码图片（手机无法访问 maque.uno 时通过 API 中转） */
router.get('/qr-image', (req: Request, res: Response) => {
  // v2.5.36: 路径从 config.qrLocalPath 读, 避免硬编码
  const imgPath = path.resolve(config.qrLocalPath);
  if (fs.existsSync(imgPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(imgPath).pipe(res);
  } else {
    res.status(404).send('QR code not found');
  }
});

router.post('/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { amount } = req.body;
    const topUpAmount = parseFloat(amount || '0');
    if (isNaN(topUpAmount) || topUpAmount <= 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '金额无效' } });
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const ipLocation = await lookupIp(ip);

    const { userModel } = await import('../models/user');
    const user = await userModel.findById(userId);

    const record = await rechargeRequestModel.create(userId, user?.username || '', topUpAmount, ip, ipLocation);

    res.json({
      success: true,
      data: {
        id: record.id,
        amount: record.amount,
        qrCodeUrl: config.qrCodeUrl,
        message: '请使用支付宝扫描收款码支付 ¥' + topUpAmount.toFixed(2) + '，完成后点击"我已付款"提交审核',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '提交失败' } });
  }
});

router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const records = await rechargeRequestModel.findByUserId(userId);
  res.json({ success: true, data: { records } });
});

// v3.0.37 (S72 batch 7 BUG-092): 用户点"我已付款"通知 admin 端点
// 修法: 1) 鉴权 authMiddleware 2) 验证订单属于该 user (防止越权) 3) 验证 status='pending' 4) 调用 model.markUserNotified() 5) 返更新后的 record 给前端 (跟 BUG-082 铁律 8 一致, schema 归一)
router.post('/:id/notify-paid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const record = await rechargeRequestModel.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    }
    // 越权保护: 订单必须属于该 user (跟 BUG-080 跨 user 数据泄漏同类教训)
    if (record.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作他人订单' } });
    }
    // 状态校验: 只有 pending 订单可以"我已付款"
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `订单已${record.status === 'approved' ? '通过' : '被拒绝'}, 无需重复通知` } });
    }
    // 标记 user_notified_at = now (admin 看板可优先处理)
    await rechargeRequestModel.markUserNotified(id);
    const updated = await rechargeRequestModel.findById(id);
    res.json({
      success: true,
      data: {
        message: '已通知管理员, 请耐心等待审核 (通常 5 分钟内到账, 重复充值请先联系客服)',
        record: updated,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '通知失败' } });
  }
});

export default router;

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

export default router;

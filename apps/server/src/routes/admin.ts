import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminAuth } from '../middleware/adminAuth';
import { userModel } from '../models/user';
import { rechargeRequestModel } from '../models/rechargeRequest';
import { billingService } from '../services/billingService';
import { logger } from '../utils/logger';
import { getMaintenance, setMaintenance } from '../shared/maintenance';
import { queryOne } from '../models/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';

/** 管理员登录 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入用户名和密码' } });
    }
    const user = await userModel.findByUsername(username);
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' } });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' } });
    }
    const token = jwt.sign({ userId: user.id, role: 'admin' }, JWT_SECRET, { expiresIn: '365d' });
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, nickname: user.nickname, role: 'admin' as const },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '登录失败' } });
  }
});

/** 仪表盘 */
router.get('/dashboard', adminAuth, async (req: Request, res: Response) => {
  const [totalUsers, todayUsers, pendingOrders, todayOrders] = await Promise.all([
    userModel.countAll(),
    userModel.countToday(),
    rechargeRequestModel.countByStatus('pending'),
    rechargeRequestModel.countToday(),
  ]);
  res.json({
    success: true,
    data: { totalUsers, todayUsers, pendingOrders, todayOrders },
  });
});

/** 订单列表 */
router.get('/orders', adminAuth, async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const orders = status === 'all'
    ? await rechargeRequestModel.findAll()
    : await rechargeRequestModel.findByStatus(status);
  res.json({ success: true, data: { orders } });
});

/** 确认到账 */
router.post('/orders/:id/approve', adminAuth, async (req: Request, res: Response) => {
  try {
    const item = await rechargeRequestModel.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    if (item.status !== 'pending') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单已处理' } });

    await rechargeRequestModel.updateStatus(item.id, 'approved', '管理员确认到账');
    await billingService.topUp(item.userId, item.amount, `充值申请：¥${item.amount.toFixed(2)}`);
    logger.info('Admin approved recharge', { orderId: item.id, userId: item.userId, amount: item.amount });

    res.json({ success: true, data: { message: '已确认到账，余额已增加' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

/** 拒绝 */
router.post('/orders/:id/reject', adminAuth, async (req: Request, res: Response) => {
  try {
    const item = await rechargeRequestModel.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    if (item.status !== 'pending') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单已处理' } });

    await rechargeRequestModel.updateStatus(item.id, 'rejected', req.body.remark || '管理员拒绝');
    logger.info('Admin rejected recharge', { orderId: item.id, userId: item.userId });

    res.json({ success: true, data: { message: '已拒绝' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

/** 用户列表 */
router.get('/users', adminAuth, async (req: Request, res: Response) => {
  const users = await userModel.list();
  const safe = users.map(u => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    email: u.email,
    balance: u.balance,
    totalGenerations: u.totalGenerations,
    vipLevel: u.vipLevel,
    createdAt: u.createdAt,
  }));
  res.json({ success: true, data: { users: safe } });
});

/** 用户详情列表（含统计：书架数/充值/消费/IP） */
router.get('/users-detail', adminAuth, async (req: Request, res: Response) => {
  const users = await userModel.listDetail();
  res.json({ success: true, data: { users } });
});

/** 活跃任务数（用于部署前检查） */
router.get('/active-tasks', adminAuth, async (req: Request, res: Response) => {
  const row = await queryOne<any>(
    "SELECT COUNT(*) as cnt FROM task_jobs WHERE status IN ('running','queued')"
  );
  res.json({ success: true, data: { count: row?.cnt || 0 } });
});

/** 维护模式开关 */
router.put('/maintenance', adminAuth, (req: Request, res: Response) => {
  const enable = req.query.enable === 'true';
  setMaintenance(enable);
  logger.info(`Maintenance mode ${enable ? 'enabled' : 'disabled'}`);
  res.json({ success: true, data: { maintenance: enable } });
});

/** 发送系统消息给单个用户 */
router.post('/send-message', adminAuth, async (req: Request, res: Response) => {
  try {
    const { userId, title, content } = req.body;
    if (!userId || !title || !content) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请填写完整信息' } });
    }
    const { execute } = await import('../models/db');
    const { generateUUID } = await import('../shared/utils');
    const id = generateUUID();
    await execute(
      `INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, 'system', ?, ?, 0, ?)`,
      [id, userId, title, content, Date.now()]
    );
    logger.info('Admin sent message to user', { userId, title });
    res.json({ success: true, data: { message: '消息已发送' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '发送失败' } });
  }
});

export default router;

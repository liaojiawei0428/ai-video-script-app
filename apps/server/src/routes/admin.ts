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

/** 订单列表 (v3.0.37 S72 batch 7 BUG-094 修法: default 'user_notified' 取代 'pending', 'all' 强制 IN 3 状态, 'pending' 强制返空) */
router.get('/orders', adminAuth, async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'user_notified';
  // BUG-094 修法: pending 状态订单不进 admin 看板, 必须 user 点"我已付款"才会变 user_notified, admin 才能看到
  // 'all' 查 user_notified + approved + rejected (永远不含 pending, server 端硬过滤, 防前端 query 绕过)
  let orders: any[];  // v3.0.37 BUG-094: 显式 any[] type, 防 TS7034/TS7005 (let 推断失败, 跟 BUG-082 铁律 8 一样必显式 type)
  if (status === 'all') {
    orders = await rechargeRequestModel.findByStatuses(['user_notified', 'approved', 'rejected']);
  } else if (status === 'pending') {
    // pending 状态不暴露给 admin (audit 仍可用 DB 直查, 但 admin 看板永不显示)
    orders = [];
  } else {
    orders = await rechargeRequestModel.findByStatus(status);
  }
  res.json({ success: true, data: { orders } });
});

/** 确认到账 */
router.post('/orders/:id/approve', adminAuth, async (req: Request, res: Response) => {
  try {
    const item = await rechargeRequestModel.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    if (item.status !== 'user_notified') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单未到 user_notified 状态, 请先让用户点"我已付款"' } });

    await rechargeRequestModel.updateStatus(item.id, 'approved', '管理员确认到账');
    await billingService.topUp(item.userId, item.amount, `充值申请：¥${item.amount.toFixed(2)}`);
    logger.info('Admin approved recharge', { orderId: item.id, userId: item.userId, amount: item.amount });

    // v2.5.17: 通知用户充值成功
    try {
      const { notifySuccess } = await import('../services/notify');
      await notifySuccess(item.userId, '充值成功',
        `您的 ¥${item.amount.toFixed(2)} 充值申请已通过审核，余额已到账。`, item.id);
    } catch {}

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
    if (item.status !== 'user_notified') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单未到 user_notified 状态, 请先让用户点"我已付款"' } });

    await rechargeRequestModel.updateStatus(item.id, 'rejected', req.body.remark || '管理员拒绝');
    logger.info('Admin rejected recharge', { orderId: item.id, userId: item.userId });

    // v2.5.17: 通知用户充值被拒
    try {
      const { notifyWarning } = await import('../services/notify');
      await notifyWarning(item.userId, '充值申请被拒绝',
        `您的 ¥${item.amount.toFixed(2)} 充值申请被拒绝。${req.body.remark ? '\n原因：' + req.body.remark : ''}`, item.id);
    } catch {}

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

/** 手动触发续集生成（管理员） */
router.post('/resume-novel/:novelId', adminAuth, async (req: Request, res: Response) => {
  try {
    const { novelId } = req.params;
    const { targetDuration = 120 } = req.body;
    const { scriptService } = await import('../services/scriptService');
    const task = await scriptService.continueEpisodeGeneration(novelId, targetDuration);
    logger.info('Admin triggered resume', { novelId, taskId: task.id });
    res.json({ success: true, data: { taskId: task.id, status: task.status } });
  } catch (err: any) {
    logger.error('Admin resume failed', { novelId: req.params.novelId, error: err?.message || String(err) });
    res.status(500).json({ success: false, error: { code: 'RESUME_FAILED', message: err?.message || '续集失败' } });
  }
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

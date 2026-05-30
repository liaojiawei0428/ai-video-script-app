import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { feedbackModel } from '../models/feedback';
import { notificationModel } from '../models/notification';
import { userModel } from '../models/user';

const router = Router();

/** 用户提交反馈 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { content, contact } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入反馈内容' } });
    }
    const user = await userModel.findById(userId);
    const feedback = await feedbackModel.create(userId, user?.username || '', content.trim(), contact || '');
    res.json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '提交失败' } });
  }
});

/** 用户查看自己的反馈 */
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const feedbacks = await feedbackModel.findByUserId(userId);
    res.json({ success: true, data: { feedbacks } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
  }
});

/** 管理员查看所有反馈 */
router.get('/admin/list', adminAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const feedbacks = status && status !== 'all'
      ? await feedbackModel.findByStatus(status)
      : await feedbackModel.findAll();
    const total = await feedbackModel.countAll();
    const pending = await feedbackModel.countByStatus('pending');
    res.json({ success: true, data: { feedbacks, total, pending } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
  }
});

/** 管理员标记已读 */
router.post('/admin/:id/read', adminAuth, async (req: Request, res: Response) => {
  try {
    await feedbackModel.updateStatus(req.params.id, 'read');
    res.json({ success: true, data: { message: '已标记为已读' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

/** 管理员回复反馈 */
router.post('/admin/:id/reply', adminAuth, async (req: Request, res: Response) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入回复内容' } });
    }
    // 获取反馈信息
    const feedback = await feedbackModel.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '反馈不存在' } });
    }
    await feedbackModel.reply(req.params.id, reply.trim());
    // 创建通知给用户
    await notificationModel.create(
      feedback.userId,
      'feedback_reply',
      '反馈回复',
      `您提交的反馈「${feedback.content.slice(0, 50)}${feedback.content.length > 50 ? '...' : ''}」已收到管理员回复：\n\n${reply.trim()}`,
      req.params.id
    );
    res.json({ success: true, data: { message: '回复成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

export default router;

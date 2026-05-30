import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { notificationModel } from '../models/notification';

const router = Router();

/** 用户获取自己的通知 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const notifications = await notificationModel.findByUserId(userId);
    const unreadCount = await notificationModel.countUnread(userId);
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
  }
});

/** 用户获取未读数量 */
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const unreadCount = await notificationModel.countUnread(userId);
    res.json({ success: true, data: { unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
  }
});

/** 用户标记单条已读 */
router.post('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    await notificationModel.markRead(req.params.id);
    res.json({ success: true, data: { message: '已标记已读' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

/** 用户标记全部已读 */
router.post('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    await notificationModel.markAllRead(userId);
    res.json({ success: true, data: { message: '已全部标记已读' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

/** 管理员发送公告 */
router.post('/admin/announcement', adminAuth, async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '标题和内容不能为空' } });
    }
    const count = await notificationModel.createAnnouncement(title.trim(), content.trim());
    res.json({ success: true, data: { message: `公告已发送给 ${count} 位用户`, count } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '发送失败' } });
  }
});

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const notification_1 = require("../models/notification");
const router = (0, express_1.Router)();
/** 用户获取自己的通知 */
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const notifications = await notification_1.notificationModel.findByUserId(userId);
        const unreadCount = await notification_1.notificationModel.countUnread(userId);
        res.json({ success: true, data: { notifications, unreadCount } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
    }
});
/** 用户获取未读数量 */
router.get('/unread-count', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const unreadCount = await notification_1.notificationModel.countUnread(userId);
        res.json({ success: true, data: { unreadCount } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
    }
});
/** 用户标记单条已读 */
router.post('/:id/read', auth_1.authMiddleware, async (req, res) => {
    try {
        await notification_1.notificationModel.markRead(req.params.id);
        res.json({ success: true, data: { message: '已标记已读' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
/** 用户标记全部已读 */
router.post('/read-all', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        await notification_1.notificationModel.markAllRead(userId);
        res.json({ success: true, data: { message: '已全部标记已读' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
/** 管理员发送公告 */
router.post('/admin/announcement', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '标题和内容不能为空' } });
        }
        const count = await notification_1.notificationModel.createAnnouncement(title.trim(), content.trim());
        res.json({ success: true, data: { message: `公告已发送给 ${count} 位用户`, count } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '发送失败' } });
    }
});
exports.default = router;

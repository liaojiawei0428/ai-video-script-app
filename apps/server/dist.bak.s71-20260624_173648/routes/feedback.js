"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const feedback_1 = require("../models/feedback");
const notification_1 = require("../models/notification");
const user_1 = require("../models/user");
const router = (0, express_1.Router)();
/** 用户提交反馈 */
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { content, contact } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入反馈内容' } });
        }
        const user = await user_1.userModel.findById(userId);
        const feedback = await feedback_1.feedbackModel.create(userId, user?.username || '', content.trim(), contact || '');
        res.json({ success: true, data: { feedback } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '提交失败' } });
    }
});
/** 用户查看自己的反馈 */
router.get('/my', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const feedbacks = await feedback_1.feedbackModel.findByUserId(userId);
        res.json({ success: true, data: { feedbacks } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
    }
});
/** 管理员查看所有反馈 */
router.get('/admin/list', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const status = req.query.status;
        const feedbacks = status && status !== 'all'
            ? await feedback_1.feedbackModel.findByStatus(status)
            : await feedback_1.feedbackModel.findAll();
        const total = await feedback_1.feedbackModel.countAll();
        const pending = await feedback_1.feedbackModel.countByStatus('pending');
        res.json({ success: true, data: { feedbacks, total, pending } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
    }
});
/** 管理员标记已读 */
router.post('/admin/:id/read', adminAuth_1.adminAuth, async (req, res) => {
    try {
        await feedback_1.feedbackModel.updateStatus(req.params.id, 'read');
        res.json({ success: true, data: { message: '已标记为已读' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
/** 管理员回复反馈 */
router.post('/admin/:id/reply', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply || !reply.trim()) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入回复内容' } });
        }
        // 获取反馈信息
        const feedback = await feedback_1.feedbackModel.findById(req.params.id);
        if (!feedback) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '反馈不存在' } });
        }
        await feedback_1.feedbackModel.reply(req.params.id, reply.trim());
        // 创建通知给用户
        await notification_1.notificationModel.create(feedback.userId, 'feedback_reply', '反馈回复', `您提交的反馈「${feedback.content.slice(0, 50)}${feedback.content.length > 50 ? '...' : ''}」已收到管理员回复：\n\n${reply.trim()}`, req.params.id);
        res.json({ success: true, data: { message: '回复成功' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
exports.default = router;

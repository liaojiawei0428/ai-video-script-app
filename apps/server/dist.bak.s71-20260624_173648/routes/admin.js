"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const adminAuth_1 = require("../middleware/adminAuth");
const user_1 = require("../models/user");
const rechargeRequest_1 = require("../models/rechargeRequest");
const billingService_1 = require("../services/billingService");
const logger_1 = require("../utils/logger");
const maintenance_1 = require("../shared/maintenance");
const db_1 = require("../models/db");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';
/** 管理员登录 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请输入用户名和密码' } });
        }
        const user = await user_1.userModel.findByUsername(username);
        if (!user || user.role !== 'admin') {
            return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' } });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' } });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: 'admin' }, JWT_SECRET, { expiresIn: '365d' });
        res.json({
            success: true,
            data: {
                token,
                user: { id: user.id, username: user.username, nickname: user.nickname, role: 'admin' },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '登录失败' } });
    }
});
/** 仪表盘 */
router.get('/dashboard', adminAuth_1.adminAuth, async (req, res) => {
    const [totalUsers, todayUsers, pendingOrders, todayOrders] = await Promise.all([
        user_1.userModel.countAll(),
        user_1.userModel.countToday(),
        rechargeRequest_1.rechargeRequestModel.countByStatus('pending'),
        rechargeRequest_1.rechargeRequestModel.countToday(),
    ]);
    res.json({
        success: true,
        data: { totalUsers, todayUsers, pendingOrders, todayOrders },
    });
});
/** 订单列表 */
router.get('/orders', adminAuth_1.adminAuth, async (req, res) => {
    const status = req.query.status || 'pending';
    const orders = status === 'all'
        ? await rechargeRequest_1.rechargeRequestModel.findAll()
        : await rechargeRequest_1.rechargeRequestModel.findByStatus(status);
    res.json({ success: true, data: { orders } });
});
/** 确认到账 */
router.post('/orders/:id/approve', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const item = await rechargeRequest_1.rechargeRequestModel.findById(req.params.id);
        if (!item)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
        if (item.status !== 'pending')
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单已处理' } });
        await rechargeRequest_1.rechargeRequestModel.updateStatus(item.id, 'approved', '管理员确认到账');
        await billingService_1.billingService.topUp(item.userId, item.amount, `充值申请：¥${item.amount.toFixed(2)}`);
        logger_1.logger.info('Admin approved recharge', { orderId: item.id, userId: item.userId, amount: item.amount });
        // v2.5.17: 通知用户充值成功
        try {
            const { notifySuccess } = await Promise.resolve().then(() => __importStar(require('../services/notify')));
            await notifySuccess(item.userId, '充值成功', `您的 ¥${item.amount.toFixed(2)} 充值申请已通过审核，余额已到账。`, item.id);
        }
        catch { }
        res.json({ success: true, data: { message: '已确认到账，余额已增加' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
/** 拒绝 */
router.post('/orders/:id/reject', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const item = await rechargeRequest_1.rechargeRequestModel.findById(req.params.id);
        if (!item)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
        if (item.status !== 'pending')
            return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '订单已处理' } });
        await rechargeRequest_1.rechargeRequestModel.updateStatus(item.id, 'rejected', req.body.remark || '管理员拒绝');
        logger_1.logger.info('Admin rejected recharge', { orderId: item.id, userId: item.userId });
        // v2.5.17: 通知用户充值被拒
        try {
            const { notifyWarning } = await Promise.resolve().then(() => __importStar(require('../services/notify')));
            await notifyWarning(item.userId, '充值申请被拒绝', `您的 ¥${item.amount.toFixed(2)} 充值申请被拒绝。${req.body.remark ? '\n原因：' + req.body.remark : ''}`, item.id);
        }
        catch { }
        res.json({ success: true, data: { message: '已拒绝' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
    }
});
/** 用户列表 */
router.get('/users', adminAuth_1.adminAuth, async (req, res) => {
    const users = await user_1.userModel.list();
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
router.get('/users-detail', adminAuth_1.adminAuth, async (req, res) => {
    const users = await user_1.userModel.listDetail();
    res.json({ success: true, data: { users } });
});
/** 活跃任务数（用于部署前检查） */
router.get('/active-tasks', adminAuth_1.adminAuth, async (req, res) => {
    const row = await (0, db_1.queryOne)("SELECT COUNT(*) as cnt FROM task_jobs WHERE status IN ('running','queued')");
    res.json({ success: true, data: { count: row?.cnt || 0 } });
});
/** 维护模式开关 */
router.put('/maintenance', adminAuth_1.adminAuth, (req, res) => {
    const enable = req.query.enable === 'true';
    (0, maintenance_1.setMaintenance)(enable);
    logger_1.logger.info(`Maintenance mode ${enable ? 'enabled' : 'disabled'}`);
    res.json({ success: true, data: { maintenance: enable } });
});
/** 手动触发续集生成（管理员） */
router.post('/resume-novel/:novelId', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { novelId } = req.params;
        const { targetDuration = 120 } = req.body;
        const { scriptService } = await Promise.resolve().then(() => __importStar(require('../services/scriptService')));
        const task = await scriptService.continueEpisodeGeneration(novelId, targetDuration);
        logger_1.logger.info('Admin triggered resume', { novelId, taskId: task.id });
        res.json({ success: true, data: { taskId: task.id, status: task.status } });
    }
    catch (err) {
        logger_1.logger.error('Admin resume failed', { novelId: req.params.novelId, error: err?.message || String(err) });
        res.status(500).json({ success: false, error: { code: 'RESUME_FAILED', message: err?.message || '续集失败' } });
    }
});
/** 发送系统消息给单个用户 */
router.post('/send-message', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { userId, title, content } = req.body;
        if (!userId || !title || !content) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请填写完整信息' } });
        }
        const { execute } = await Promise.resolve().then(() => __importStar(require('../models/db')));
        const { generateUUID } = await Promise.resolve().then(() => __importStar(require('../shared/utils')));
        const id = generateUUID();
        await execute(`INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, 'system', ?, ?, 0, ?)`, [id, userId, title, content, Date.now()]);
        logger_1.logger.info('Admin sent message to user', { userId, title });
        res.json({ success: true, data: { message: '消息已发送' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '发送失败' } });
    }
});
exports.default = router;

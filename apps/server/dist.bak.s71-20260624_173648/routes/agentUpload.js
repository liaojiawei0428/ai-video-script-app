"use strict";
// apps/server/src/routes/agentUpload.ts
// v3.0.0: Agent 通用文件上传 (图片参考图, 给 image-agent / video-agent 用)
//
// 流程:
//   POST /api/agent/upload (multipart 'file' 字段) → 存盘 → 返回 { url, publicUrl }
//   GET  /api/agent/uploads/:userId/:filename  → res.sendFile 鉴权后返回
//
// 为什么不用 /uploads/ 静态目录?
//   - ab.maque.uno 的 nginx 没代理 /uploads/ → shipin-APP, web 端跨域拿不到图
//   - 用 /api/agent/uploads/ 同源 + 走 authMiddleware 鉴权, 安全 + 一致
//
// 文件名: agent-references/{userId}/{timestamp}-{random}.{ext}
// 大小限制: 10MB (图片够用)
// 类型限制: image/jpeg | image/png | image/webp
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const billingService_1 = require("../services/billingService");
const user_1 = require("../models/user");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// 存盘根目录 (单层, 跟 novel upload 一致, 不跟 UPLOAD_DIR/exports/ 冲突)
const UPLOAD_BASE = path_1.default.resolve(config_1.config.uploadDir, 'agent-references');
// 启动时确保目录存在
if (!fs_1.default.existsSync(UPLOAD_BASE)) {
    fs_1.default.mkdirSync(UPLOAD_BASE, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId || 'anonymous';
        const userDir = path_1.default.join(UPLOAD_BASE, userId);
        if (!fs_1.default.existsSync(userDir)) {
            fs_1.default.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `ref-${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}, only JPEG/PNG/WebP allowed`));
        }
    },
});
/** POST /api/agent/upload — 上传单张图片 (form field 'file') */
router.post('/upload', auth_1.authMiddleware, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        const userId = req.userId;
        const relativePath = `${userId}/${req.file.filename}`;
        // 相对路径 URL (web 端用, 走 /api/agent/uploads/ 鉴权读)
        const url = `/api/agent/uploads/${relativePath}`;
        logger_1.logger.info('Agent upload success', {
            userId, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype,
        });
        res.json({
            success: true,
            data: {
                url,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                originalName: req.file.originalname,
            },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    catch (err) {
        logger_1.logger.error('Agent upload error', { error: err.message });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: '上传失败: ' + err.message },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
});
/** GET /api/agent/uploads/:userId/:filename — 鉴权后返回文件 */
router.get('/uploads/:userId/:filename', auth_1.authMiddleware, (req, res) => {
    const { userId, filename } = req.params;
    // 鉴权: 只能看自己的图 (admin 角色可看任意, 暂不开)
    const reqUserId = req.userId;
    if (userId !== reqUserId) {
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: '无权访问该文件' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    // 防止路径穿越
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'invalid filename' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    const filePath = path_1.default.join(UPLOAD_BASE, userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: '文件不存在' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    // 推断 mimetype
    const ext = path_1.default.extname(filename).toLowerCase();
    const mimeMap = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
});
/** v3.0.0.1: GET /api/agent/video-local/:userId/:filename — 视频本地缓存 (shipin-APP 拉过一次后, 用户从这里读, 0 外网)
 *  路径: {UPLOAD_DIR}/videos/{userId}/{filename} (跟 image-upload 同一 UPLOAD_BASE 父目录)
 *  支持 Range: sendFile 自动处理 (Node 内置)
 *  Content-Type: video/mp4 */
const VIDEO_DIR = path_1.default.resolve(config_1.config.uploadDir, 'videos');
router.get('/video-local/:userId/:filename', auth_1.authMiddleware, (req, res) => {
    const { userId, filename } = req.params;
    const reqUserId = req.userId;
    if (userId !== reqUserId) {
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: '无权访问该文件' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'invalid filename' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    const filePath = path_1.default.join(VIDEO_DIR, userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: '本地视频缓存不存在 (后端尚未从 agens 拉下来)' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    // Range: sendFile 默认就支持 (Node http 自动处理 Range header)
    const stat = fs_1.default.statSync(filePath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // inline: 让浏览器 <video> 播放, 不下载
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
});
/**
 * v3.0.0.31 (S51): 平台定价 — 用户今日生图/视频限额查询
 * GET /api/agent/daily-stats?kind=image|video
 * Response: { kind, todayCount, dailyLimit (number|null), isVip }
 *   - image: dailyLimit=30 普通 / null VIP 无限
 *   - video: dailyLimit=null (当前无视频日限额, 只返 todayCount 给前端参考)
 */
router.get('/daily-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const kind = String(req.query.kind || 'image');
        if (kind !== 'image' && kind !== 'video') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_KIND', message: 'kind 必须是 image 或 video' },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { code: 'AUTH_REQUIRED', message: '请先登录' },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        const user = await user_1.userModel.findById(userId);
        const isVip = (0, billingService_1.isVipActive)(user);
        const todayCount = kind === 'image'
            ? await billingService_1.billingService.imageDailyCount(userId)
            : await billingService_1.billingService.videoDailyCount(userId);
        const dailyLimit = kind === 'image'
            ? (isVip ? null : billingService_1.IMAGE_DAILY_QUOTA_STANDARD)
            : null;
        res.json({
            success: true,
            data: { kind, todayCount, dailyLimit, isVip },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    catch (err) {
        logger_1.logger.error('daily-stats: failed', { error: err.message });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: err.message },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
});
exports.default = router;

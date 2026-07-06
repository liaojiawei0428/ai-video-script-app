"use strict";
// apps/server/src/routes/avatar.ts
// v3.0.2 (S57): 用户头像上传 (multer multipart/form-data 'file' 字段)
//
// 流程 (严格复用 agentUpload.ts pattern, 改 storage path):
//   POST /api/users/avatar/upload         multipart 'file' → 存盘 → 返 { url, publicUrl }
//   GET  /api/users/avatar/file/:userId/:filename  鉴权后返回图片 (同源, web 端不跨域)
//
// 为什么不用 /uploads/ 静态目录?
//   - 跟 agentUpload 一样的考量: 鉴权 + 同源, 安全 + 一致
//   - 头像可被其他用户看 (用户中心展示), 但限制为登录态 + 自己只能改自己
//
// 目录: {UPLOAD_DIR}/avatars/{userId}/{timestamp}-{random}.{ext}
// 大小: 2MB (头像够用)
// 类型: image/jpeg | image/png | image/webp
// 客户端用: PATCH /api/users/profile { avatarUrl: <返回的url> } 把 URL 存到 user.avatarUrl
//
// 重要: 这个文件是 router (不是 controller), 挂载到 /api/users/avatar,
//   跟 userRoutes (/api/users/*) 平行, 不冲突.
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
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// 存盘根目录 (跟 agentUpload 平行, 都是 uploadDir 的子目录)
const AVATAR_BASE = path_1.default.resolve(config_1.config.uploadDir, 'avatars');
// 启动时确保目录存在
if (!fs_1.default.existsSync(AVATAR_BASE)) {
    fs_1.default.mkdirSync(AVATAR_BASE, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId || 'anonymous';
        const userDir = path_1.default.join(AVATAR_BASE, userId);
        if (!fs_1.default.existsSync(userDir)) {
            fs_1.default.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `avatar-${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB (头像够用, 避免 1080p 大图)
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
/** POST /api/users/avatar/upload — 上传头像 (form field 'file'), 返 { url } */
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
        // 相对路径 URL (web 端用, 走 /api/users/avatar/file/ 鉴权读)
        const url = `/api/users/avatar/file/${relativePath}`;
        logger_1.logger.info('Avatar upload success', {
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
        logger_1.logger.error('Avatar upload error', { error: err.message });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: '上传失败: ' + err.message },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
});
/** GET /api/users/avatar/file/:userId/:filename — 鉴权后返回图片
 *  鉴权策略: 任何登录用户都能看 (用户中心展示). 防止路径穿越. */
router.get('/file/:userId/:filename', auth_1.authMiddleware, (req, res) => {
    const { userId, filename } = req.params;
    // 防止路径穿越
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\') ||
        filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'invalid path' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
    }
    const filePath = path_1.default.join(AVATAR_BASE, userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: '头像文件不存在' },
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
    // 头像缓存 1 天 (用户头像改频率低)
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(filePath);
});
exports.default = router;

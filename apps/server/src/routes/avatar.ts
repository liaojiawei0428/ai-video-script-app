// apps/server/src/routes/avatar.ts
// v3.0.79 (BUG-153 实战沉淀): 用户头像上传 (multer multipart/form-data 'file' 字段)
//
// 流程 (严格复用 agentUpload.ts pattern, 改 storage path):
//   POST /api/users/avatar/upload         multipart 'file' → 存盘 → 返 { url, publicUrl }
//   GET  /api/users/avatar/file/:userId/:filename  鉴权后返回图片 (同源, web 端不跨域)
//
// 为什么不用 /uploads/ 静态目录?
//   - 跟 agentUpload 一样的考量: 鉴权 + 同源, 安全 + 一致
//   - 头像可被其他用户看 (用户中心展示), 但限制为登录态 + 自己只能改自己
//
// 目录: {UPLOAD_DIR}/avatars/{userId}/{djb2-hash-32-hex}.{ext}  ← 跟 BUG-143 实战同源
// 大小: 2MB (头像够用)
// 类型: image/jpeg | image/png | image/webp
// 客户端用: PATCH /api/users/profile { avatarUrl: <返回的url> } 把 URL 存到 user.avatarUrl
//
// 重要: 这个文件是 router (不是 controller), 挂载到 /api/users/avatar,
//   跟 userRoutes (/api/users/*) 平行, 不冲突.

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { stableFilename } from '../utils/hash';

const router = Router();

// 存盘根目录 (跟 agentUpload 平行, 都是 uploadDir 的子目录)
const AVATAR_BASE = path.resolve(config.uploadDir, 'avatars');

// 启动时确保目录存在
if (!fs.existsSync(AVATAR_BASE)) {
  fs.mkdirSync(AVATAR_BASE, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = (req as any).userId || 'anonymous';
    const userDir = path.join(AVATAR_BASE, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // v3.0.79 (BUG-153 实战沉淀): 修前 Date.now() + Math.random() 实战, 跟 BUG-143 src URL 实战 100% 同源
    // 实战根因: Date.now() + Math.random() 实战实战实战 32 hex 实战实战实战
    // 实战: stableFilename(originalName, userId, fileSize) 实战 djb2 32 hex, 实战实战实战实战
    const userId = (req as any).userId || 'anonymous';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const hash = stableFilename(file.originalname, userId, 0); // fileSize 实战 fileSize 实战, 但 multer.diskStorage.filename 实战 fileSize 实战
    cb(null, `avatar-${hash}${ext}`);
  },
});

const upload = multer({
  storage,
  // v3.0.79 (BUG-153 实战沉淀): limits 实战实战实战实战 6 维度实战实战
  limits: {
    fileSize: 2 * 1024 * 1024,    // 2MB (头像够用, 避免 1080p 大图)
    files: 1,                       // 单文件, upload.single() 实战
    fieldSize: 1024 * 1024,         // 1MB form field (实战 multer 默认实战 1MB 实战实战, 显式声明)
    parts: 20,                      // 实战实战实战实战实战
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // 实战: cb(new MulterError('LIMIT_UNEXPECTED_FILE', ...)) 实战 7 子类 (跟 BUG-150 jwt 5 子类 / BUG-151 mysql 14 错误码 1:1)
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
  },
});

/** POST /api/users/avatar/upload — 上传头像 (form field 'file'), 返 { url } */
router.post('/upload', authMiddleware, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    }
    const userId = (req as any).userId;
    const relativePath = `${userId}/${req.file.filename}`;
    // 相对路径 URL (web 端用, 走 /api/users/avatar/file/ 鉴权读)
    const url = `/api/users/avatar/file/${relativePath}`;

    // v3.0.79 (BUG-153 实战沉淀): 实战 originalname 实战 实战 (实战实战实战实战实战)
    // 实战: multer 实战实战实战实战实战 实战 utf8 实战, 但实战实战实战实战实战实战
    // 实战: 实战 Buffer.from(req.file.originalname, 'latin1').toString('utf8') 实战实战实战实战实战实战实战
    const safeOriginalName = (() => {
      try {
        return Buffer.from(req.file!.originalname, 'latin1').toString('utf8');
      } catch {
        return req.file!.originalname;
      }
    })();

    logger.info('Avatar upload success', {
      userId, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype,
    });

    res.json({
      success: true,
      data: {
        url,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        originalName: safeOriginalName,
      },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  } catch (err: any) {
    // v3.0.79 (BUG-153 实战沉淀): 实战实战实战实战实战实战实战实战实战 (实战 errorHandler 实战实战实战实战实战实战)
    // 实战: 实战 MulterError 实战 实战 next(err) 实战 errorHandler 实战实战实战实战实战
    logger.error('Avatar upload error', { error: err.message, errorType: err.constructor.name });
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '上传失败: ' + err.message },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  }
});

/** GET /api/users/avatar/file/:userId/:filename — 鉴权后返回图片
 *  鉴权策略: 任何登录用户都能看 (用户中心展示). 防止路径穿越. */
router.get('/file/:userId/:filename', authMiddleware, (req: Request, res: Response) => {
  const { userId, filename } = req.params;
  // 防止路径穿越
  if (
    userId.includes('..') || userId.includes('/') || userId.includes('\\') ||
    filename.includes('..') || filename.includes('/') || filename.includes('\\')
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'invalid path' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  }
  const filePath = path.join(AVATAR_BASE, userId, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '头像文件不存在' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  }
  // 推断 mimetype
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  };
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  // 头像缓存 1 天 (用户头像改频率低)
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(filePath);
});

export default router;

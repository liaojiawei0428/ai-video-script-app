// apps/server/src/routes/download.ts
// v3.0.0: 视频下载 proxy — 强制 Content-Disposition: attachment, 保留原音轨
//
// 为什么需要 proxy?
// 1. 视频源在 storage.googleapis.com (跨域), <a download> 跨域时 Chrome 会忽略 download 属性
// 2. 后端强制 attachment + 正确 Content-Type, 浏览器 100% 触发下载
// 3. 服务端加白名单 (只允许 agens 域名), 防止被当成 open proxy 滥用

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 白名单域名 (只允许代理这些域名的资源)
const ALLOWED_HOSTS = [
  'storage.googleapis.com',
  'platform-outputs.agnes-ai.space',
  'apihub.agnes-ai.com',
];

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const url = String(req.query.url || '');
  const filenameHint = String(req.query.filename || '');
  // v3.0.0: 默认 attachment (触发浏览器下载), inline 让 <video> 元素正常播放
  const disposition = String(req.query.disposition || 'attachment');

  if (!url) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url query is required' } });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'invalid url' } });
  }

  // 白名单检查
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    logger.warn('Download proxy: blocked non-whitelisted host', { host: parsed.hostname, userId: (req as any).userId });
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `host ${parsed.hostname} not in whitelist` } });
  }

  // 推断 filename
  let filename = filenameHint;
  if (!filename) {
    const pathParts = parsed.pathname.split('/');
    filename = pathParts[pathParts.length - 1] || `download-${Date.now()}.mp4`;
  }
  // 中文安全: encodeURIComponent
  const safeFilename = filename.replace(/[^\w.\-]/g, '_').slice(0, 200);
  // RFC 5987: 同时给 ASCII fallback + UTF-8 (浏览器拿 utf-8)
  const encodedFilename = encodeURIComponent(filename).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

  try {
    logger.info('Download proxy start', { url: url.slice(0, 100), filename: safeFilename, disposition, userId: (req as any).userId });

    // 10 分钟 timeout (视频可能几 MB - 几十 MB)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    // v3.0.0: 转发客户端 Range 头, 让 <video> element 能 seek (用户拖进度条)
    const rangeHeader = req.headers.range;
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    const upstream = await fetch(url, { headers: upstreamHeaders, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!upstream.ok && upstream.status !== 206) {
      logger.error('Download proxy upstream error', { status: upstream.status, url });
      return res.status(upstream.status).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: `上游返回 ${upstream.status}` } });
    }

    // 透传 Content-Type (避免前端转码)
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    // v3.0.0: disposition=inline 走 <video> 播放, attachment 走 <a download> 下载
    if (disposition === 'inline') {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition',
        `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    }

    // 流式透传 (不读全 buffer, 适合大文件)
    if (!upstream.body) {
      return res.status(502).json({ success: false, error: { code: 'UPSTREAM_NO_BODY', message: 'upstream has no body' } });
    }
    const reader = upstream.body.getReader();
    let totalBytes = 0;
    // 如果上游返回 206, 浏览器期望 206; 否则 200
    if (upstream.status === 206) {
      res.status(206);
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        // 写穿, 不做修改, 保证原视频字节 (包括完整 mdat 音轨)
        res.write(Buffer.from(value));
      }
    }
    res.end();
    logger.info('Download proxy done', { filename: safeFilename, disposition, totalBytes, userId: (req as any).userId });
  } catch (err: any) {
    logger.error('Download proxy error', { error: (err as Error).message, url });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '下载失败: ' + (err as Error).message } });
    }
  }
});

export default router;

/**
 * ETag 中间件 (Stage 2 v3.0.43, 跟 mobile cache 配套)
 *
 * 解决 5Mbps 带宽 + 高频 API 调用 (mobile GET /api/version 每分钟 1 次)
 *
 * 原理:
 * - 响应 body JSON.stringify 后算 SHA-256 hash (弱 hash, 32 chars hex 截断)
 * - 写 ETag header + Cache-Control: must-revalidate
 * - 客户端 GET 带 If-None-Match 命中 → 304 (不传 body, 省带宽)
 *
 * 配套:
 * - mobile mediaCache.ts 走 hash 文件名 (server 改动自动失效)
 * - web fetch 默认带 cache: 'default' (浏览器自动 If-None-Match)
 */

import { Request, Response, NextFunction } from 'express';

const crypto = require('crypto');

/**
 * 弱 hash (32 chars hex, 跟 mobile cache hash 风格一致)
 */
function weakHash(content: string | Buffer): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 32);
}

/**
 * ETag middleware — 对 GET JSON 响应自动加 ETag + 处理 304
 *
 * 用法:
 *   router.get('/api/version', etagMiddleware(), (req, res) => { ... })
 *
 * 特性:
 * - 响应结束时算 body hash 写 ETag (response.on('finish'))
 * - 客户端带 If-None-Match 命中 → 304 (省带宽)
 * - 不影响 POST/PUT/DELETE (只读 GET 生效)
 */
export function etagMiddleware() {
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') {
      return next();
    }

    // 用 _etagOriginal 暂存原始 res.json (避免污染其他中间件)
    const originalJson = res.json.bind(res);
    let bodyStr = '';

    res.json = function (body: any) {
      try {
        bodyStr = JSON.stringify(body);
      } catch {
        bodyStr = '';
      }
      return originalJson(body);
    } as typeof res.json;

    // 响应结束时算 ETag
    res.on('finish', () => {
      if (!bodyStr) return;
      const tag = `"${weakHash(bodyStr)}"`;
      res.setHeader('ETag', tag);
      res.setHeader('Cache-Control', 'private, must-revalidate, max-age=0');

      // 304 处理 (客户端带 If-None-Match 命中)
      const clientTag = req.headers['if-none-match'];
      if (clientTag === tag) {
        res.status(304).end();
      }
    });

    next();
  };
}
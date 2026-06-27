/**
 * ETag 中间件 (v3.0.43 BUG-109 修版, 修 v3.0.43 BUG-111: ERR_HTTP_HEADERS_SENT)
 *
 * 修法 (S72 batch 12 v3.0.43 hotfix):
 *   错误做法 (v3.0.43): 在 res.on('finish') 事件里 setHeader → ERR_HTTP_HEADERS_SENT
 *     (Node.js 在 'finish' 时已经把 header 写入 socket, setHeader 抛错)
 *   正确做法: 在 res.json(body) 调用前算 ETag + setHeader, 然后比较 If-None-Match → 304
 *
 * 用法:
 *   app.get('/api/version', etagMiddleware, handler)
 */

import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

const WEAK_PREFIX = 'W/';

function weakHash(body: string): string {
  // weak ETag: SHA-256 前 16 hex chars (跟 web ETag 一致, 跨端铁律 4++)
  const full = createHash('sha256').update(body).digest('hex');
  return `${WEAK_PREFIX}"${full.slice(0, 16)}"`;
}

export function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 只对 GET 请求做 ETag (POST/PUT/DELETE 不缓存)
  if (req.method !== 'GET') {
    return next();
  }

  // 拦截 res.json, 在写 body 之前算 ETag + 304
  const originalJson = res.json.bind(res);
  let bodyStr = '';

  res.json = function (body: any): Response {
    try {
      bodyStr = JSON.stringify(body);
    } catch {
      bodyStr = '';
    }
    if (bodyStr) {
      const tag = weakHash(bodyStr);
      // setHeader 必须在 send body 之前
      res.setHeader('ETag', tag);
      res.setHeader('Cache-Control', 'private, must-revalidate, max-age=0');

      // 304 处理: 客户端带 If-None-Match 命中
      const clientTag = req.headers['if-none-match'];
      if (clientTag && clientTag === tag) {
        return res.status(304).end();
      }
    }
    return originalJson(body);
  } as typeof res.json;

  next();
}
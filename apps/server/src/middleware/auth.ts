import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';

// v2.5.36: 生产环境强制要求 JWT_SECRET, 不能用 dev 默认值 (安全防护)
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'ai-script-jwt-secret-dev') {
  throw new Error('JWT_SECRET is required in production (dev default is not allowed)');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // v3.0.0: 同时支持 Authorization header + ?token= query (供 <a download href> 用, 因为浏览器 GET 不会自动带 Authorization 头)
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  } else {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: '登录已过期，请重新登录' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  }
}

/** 可选认证：有 token 就解析 userId，没有也不拒绝 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: string };
      (req as any).userId = decoded.userId;
    } catch { /* token 无效，忽略 */ }
  }
  next();
}

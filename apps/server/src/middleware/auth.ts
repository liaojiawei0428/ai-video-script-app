import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
    return;
  }

  const token = authHeader.slice(7);
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

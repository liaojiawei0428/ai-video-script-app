import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '请先登录' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    return;
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: string; role?: string };
    if (decoded.role !== 'admin') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无管理员权限' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
      return;
    }
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID', message: '登录已过期' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
  }
}

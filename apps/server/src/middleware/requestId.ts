import { Request, Response, NextFunction } from 'express';
import { generateRequestId } from '../utils/logger';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

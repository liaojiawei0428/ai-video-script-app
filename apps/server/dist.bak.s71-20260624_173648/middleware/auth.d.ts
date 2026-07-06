import { Request, Response, NextFunction } from 'express';
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/** 可选认证：有 token 就解析 userId，没有也不拒绝 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): void;

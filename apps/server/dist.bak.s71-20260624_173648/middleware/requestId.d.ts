import { Request, Response, NextFunction } from 'express';
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

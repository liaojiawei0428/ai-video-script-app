import { Request, Response, NextFunction } from 'express';
export declare const chatController: {
    /** v3.0.0: 支持一次性 + SSE 流式 (?stream=true) */
    send(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};

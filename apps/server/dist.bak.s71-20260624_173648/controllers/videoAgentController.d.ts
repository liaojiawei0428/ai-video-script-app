import { Request, Response, NextFunction } from 'express';
export declare const videoAgentController: {
    createConversation(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    chat(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    confirm(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    history(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getById(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** v3.0.0.17: DELETE /api/video-agent/conversations/:id - 永久删除 (含 video_generations 审计) */
    deleteConversation(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};

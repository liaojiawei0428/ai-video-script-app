/**
 * v2.0.0 - 大纲 + 事件图谱 controller
 */
import { Request, Response, NextFunction } from 'express';
export declare const outlineController: {
    generateOutline(req: Request, res: Response, next: NextFunction): Promise<void>;
    getOutline(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateOutline(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    confirmOutline(req: Request, res: Response, next: NextFunction): Promise<void>;
    generatePlotGraph(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPlotGraph(req: Request, res: Response, next: NextFunction): Promise<void>;
};

import { Request, Response, NextFunction } from 'express';
export declare const episodeController: {
    getEpisode(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getShots(req: Request, res: Response, next: NextFunction): Promise<void>;
    generateShots(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateEpisode(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateShot(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    exportEpisode(req: Request, res: Response, next: NextFunction): Promise<void>;
    generateComic(req: Request, res: Response, next: NextFunction): Promise<void>;
    getComic(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};

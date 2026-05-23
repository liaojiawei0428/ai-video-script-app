import { Request, Response, NextFunction } from 'express';
import { scriptService } from '../services/scriptService';
import { episodeModel } from '../models/episode';
import { shotModel } from '../models/shot';
import { logger } from '../utils/logger';

export const episodeController = {
  async getEpisode(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      const episode = await episodeModel.findById(episodeId);
      if (!episode) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Episode not found' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      res.json({ success: true, data: { episode }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  async getShots(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      const shots = await shotModel.findByEpisodeId(episodeId);
      res.json({ success: true, data: { shots }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  async generateShots(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      logger.info('Starting shot generation', { episodeId });
      const task = await scriptService.generateShots(episodeId);
      res.json({ success: true, data: { taskId: task.id, status: task.status }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  async updateEpisode(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      const updates = req.body;
      await episodeModel.update(episodeId, updates);
      res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  async updateShot(req: Request, res: Response, next: NextFunction) {
    try {
      const { shotId } = req.params;
      const updates = req.body;
      await shotModel.update(shotId, updates);
      res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },
};

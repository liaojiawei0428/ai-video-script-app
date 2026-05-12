import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { novelService } from '../services/novelService';
import { scriptService } from '../services/scriptService';
import { episodeModel } from '../models/episode';
import { characterModel } from '../models/character';
import { logger } from '../utils/logger';

export const novelController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file uploaded',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      }

      const filePath = req.file.path;
      const title = req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
      const author = req.body.author || 'Unknown';

      logger.info('Uploading novel', { title, author, filePath });
      const novel = await novelService.createNovel(title, author, filePath);

      // Clean up temp upload file
      try {
        await fs.unlink(filePath);
      } catch {
        logger.warn('Failed to clean up temp file', { filePath });
      }

      res.json({
        success: true,
        data: {
          novelId: novel.id,
          title: novel.title,
          totalChars: novel.totalChars,
          status: novel.status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async analyze(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      logger.info('Starting analysis', { novelId });
      const task = await novelService.analyzeNovel(novelId);
      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const novel = await novelService.getNovel(novelId);
      if (!novel) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOVEL_NOT_FOUND',
            message: 'Novel not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      }

      const characters = await characterModel.findByNovelId(novelId);

      res.json({
        success: true,
        data: {
          genre: novel.genre,
          theme: novel.theme,
          style: novel.style,
          tone: novel.tone,
          characters,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getEpisodes(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const episodes = await episodeModel.findByNovelId(novelId);
      res.json({
        success: true,
        data: { episodes },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async generateEpisodes(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const { targetDuration = 120, tolerance = 10 } = req.body;
      logger.info('Starting episode generation', { novelId, targetDuration, tolerance });
      const task = await scriptService.generateEpisodes(novelId, targetDuration, tolerance);
      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async exportNovel(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const { format = 'json' } = req.query;
      const episodes = await episodeModel.findByNovelId(novelId);

      if (format === 'json') {
        res.json({
          success: true,
          data: { episodes },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Unsupported format',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const novels = await novelService.listNovels();
      res.json({
        success: true,
        data: { novels },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

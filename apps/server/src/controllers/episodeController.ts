import { Request, Response, NextFunction } from 'express';
import { scriptService } from '../services/scriptService';
import { episodeModel } from '../models/episode';
import { shotModel } from '../models/shot';
import { novelModel } from '../models/novel';
import { exportService } from '../services/exportService';
import { comicService } from '../services/comicService';
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

  // v2.5.12: 编辑剧集 (含完整越权校验)
  async updateEpisode(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      const userId = (req as any).userId;
      const ep = await episodeModel.findById(episodeId);
      if (!ep) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '剧集不存在' } });
      if (ep.novelId) {
        const novel = await novelModel.findById(ep.novelId);
        if (novel?.userId && userId && novel.userId !== userId) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权编辑此剧集' } });
        }
      }
      const updates = req.body;
      await episodeModel.update(episodeId, updates);
      logger.info('Episode update', { episodeId, userId, fields: Object.keys(updates) });
      res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  // v2.5.12: 编辑镜头 (含完整越权校验)
  async updateShot(req: Request, res: Response, next: NextFunction) {
    try {
      const { shotId } = req.params;
      const userId = (req as any).userId;
      const shot = await shotModel.findById(shotId);
      if (!shot) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '镜头不存在' } });
      if (shot.episodeId) {
        const ep = await episodeModel.findById(shot.episodeId);
        if (ep?.novelId) {
          const novel = await novelModel.findById(ep.novelId);
          if (novel?.userId && userId && novel.userId !== userId) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权编辑此镜头' } });
          }
        }
      }
      const updates = req.body;
      await shotModel.update(shotId, updates);
      logger.info('Shot update', { shotId, userId, fields: Object.keys(updates) });
      res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  },

  async exportEpisode(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      const format = (req.query.format === 'docx' ? 'docx' : 'pdf') as 'pdf' | 'docx';
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.headers.host || 'localhost';
      const baseUrl = `${proto}://${host}`;
      const result = await exportService.exportEpisode(episodeId, format, baseUrl);
      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  // ──────────────────────────────────────────────────
  // v2.5.19: 漫画生成
  // ──────────────────────────────────────────────────

  async generateComic(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      // v2.5.27: 用户可选择是否使用角色库 (默认 true)
      // false 时: 纯剧本+风格生成, 不注入角色视觉 DNA
      const useCharacterLibrary = req.body?.useCharacterLibrary !== false;
      logger.info('Starting comic generation', { episodeId, useCharacterLibrary });
      const task = await comicService.generateComic(episodeId, useCharacterLibrary);
      res.json({
        success: true,
        data: { taskId: task.id, status: task.status, useCharacterLibrary },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async getComic(req: Request, res: Response, next: NextFunction) {
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
      const rawUrl = (episode as any).comicImageUrl as string | undefined;
      // 兼容多页 (JSON 数组) 和单页
      let images: string[] = [];
      if (rawUrl) {
        if (rawUrl.startsWith('[')) {
          try { images = JSON.parse(rawUrl); } catch { images = [rawUrl]; }
        } else {
          images = [rawUrl];
        }
      }
      res.json({
        success: true,
        data: {
          images,
          layout: (episode as any).comicLayout || null,
          totalPages: (episode as any).comicTotalPages || (images.length || 0),
          generatedAt: (episode as any).comicGeneratedAt || null,
        },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },
};

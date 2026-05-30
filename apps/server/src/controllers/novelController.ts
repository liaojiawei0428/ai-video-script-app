import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { novelService } from '../services/novelService';
import { scriptService } from '../services/scriptService';
import { billingService } from '../services/billingService';
import { userModel } from '../models/user';
import { novelModel } from '../models/novel';
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
      let title = req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
      // 兜底：标题太短或为"by"等无意义值时，用默认标题
      if (!title || title.toLowerCase() === 'by' || title.length < 2) {
        title = `未命名剧本 ${new Date().toLocaleDateString('zh-CN')}`;
      }
      const author = req.body.author || 'Unknown';

      logger.info('Uploading novel', { title, author, filePath });
      const userId = (req as any).userId;
      const novel = await novelService.createNovel(title, author, filePath, userId);

      // Clean up temp upload file
      try {
        await fs.unlink(filePath);
      } catch {
        logger.warn('Failed to clean up temp file', { filePath });
      }

      // Auto-start analysis in background
      let taskId: string | undefined;
      try {
        const task = await novelService.analyzeNovel(novel.id);
        taskId = task.id;
      } catch (analysisError) {
        logger.warn('Auto-analysis trigger failed', { novelId: novel.id, error: analysisError });
      }

      res.json({
        success: true,
        data: {
          novelId: novel.id,
          title: novel.title,
          totalChars: novel.totalChars,
          status: novel.status,
          taskId,
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
          scenes: novel.scenes || [],
          plotPoints: novel.plotPoints || [],
          analysisReport: (novel as any).analysisReport || '',
          fullSummary: (novel as any).fullSummary || '',
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
      const light = req.query.light !== 'false';
      const episodes = light
        ? await episodeModel.findByNovelIdLight(novelId)
        : await episodeModel.findByNovelId(novelId);
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

  async regenerateEpisode(req: Request, res: Response, next: NextFunction) {
    try {
      const { episodeId } = req.params;
      logger.info('Starting episode regeneration', { episodeId });
      const task = await scriptService.regenerateEpisode(episodeId);
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
      } else if (format === 'txt') {
        const txt = episodes.map((ep: any) => {
          return `=== 第${ep.episodeNumber}集：${ep.title || ''} ===
时长：${ep.durationSec}秒
摘要：${ep.summary || ''}

${ep.scriptContent || ''}`;
        }).join('\n\n\n');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="script-${novelId}.txt"`);
        res.send(txt);
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

  async estimateFee(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const wordCount = parseInt(req.query.wordCount as string) || 0;
      const charCount = parseInt(req.query.charCount as string) || wordCount;
      const novelId = req.query.novelId as string || '';
      const estEpisodes = Math.max(1, Math.ceil((charCount || wordCount) / (1050 * 3.5)));
      
      let result;
      if (novelId) {
        result = await billingService.estimate(novelId, wordCount, estEpisodes);
      } else {
        // 从当前登录用户获取余额和VIP状态
        const user = userId ? await userModel.findById(userId) : null;
        const vip = user?.vipLevel && user.vipLevel >= 1;
        const unitPrice = vip ? 0.01 : 0.012;
        const analyzeFee = Math.max(0.01, Math.round(wordCount * unitPrice / 1000 * 100) / 100);
        result = { analyzeFee, shotFee: 0, total: analyzeFee, balance: user?.balance || 0, isVip: !!vip };
      }
      
      res.json({
        success: true,
        data: {
          ...result,
          amount: result.total,
          unitPrice: result.isVip ? 0.01 : 0.012,
          sufficient: (result.balance || 0) >= result.total,
        },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) { next(error); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const novels = userId
        ? await novelModel.findByUserId(userId)
        : await novelService.listNovels();
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

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      await novelService.deleteNovel(novelId);
      res.json({
        success: true,
        data: { deleted: true },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateNovel(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const { genre, theme, style, tone } = req.body;
      await novelModel.updateAnalysis(novelId, { genre, theme, style, tone } as any);
      res.json({
        success: true,
        data: { updated: true },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateCharacter(req: Request, res: Response, next: NextFunction) {
    try {
      const { characterId } = req.params;
      const { name, appearance, personality, roleType } = req.body;
      await characterModel.update(characterId, { name, appearance, personality, roleType });
      res.json({
        success: true,
        data: { updated: true },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },
};

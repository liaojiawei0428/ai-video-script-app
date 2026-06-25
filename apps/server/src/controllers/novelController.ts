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
import { getMaintenance } from '../shared/maintenance';

export const novelController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (getMaintenance()) {
        return res.status(503).json({
          success: false,
          error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' },
        });
      }
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
      const styleId = req.body.styleId as string | undefined; // v2.0.0
      const novel = await novelService.createNovel(title, author, filePath, userId, styleId);

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
      if (getMaintenance()) {
        return res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' } });
      }
      const { novelId } = req.params;
      const userId = (req as any).userId;
      // S72 v3.0.33 P2 #10 修复 (ADR-0002): 加 userId 校验, 防止用户 A analyze 用户 B 的 novel
      const novel = await novelModel.findById(novelId);
      if (!novel) return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
      if (novel.userId !== userId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权访问该小说' } });
      logger.info('Starting analysis', { novelId, userId });
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

  // v2.5.10: 从已有 analysis_report 回填角色 (不重跑 LLM)
  async backfillCharacters(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      if (!novelId) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: '缺少 novelId' } });
      }
      const novel = await novelModel.findById(novelId);
      if (!novel) {
        return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
      }
      if (userId && novel.userId && novel.userId !== userId) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
      }
      const result = await novelService.backfillCharactersFromReport(novelId);
      logger.info('backfillCharacters completed', { novelId, userId, ...result });
      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
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
      if (getMaintenance()) {
        return res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' } });
      }
      const { novelId } = req.params;
      const { targetDuration = 120, tolerance = 10, continue: continueFlag } = req.body;
      logger.info('Starting episode generation', { novelId, targetDuration, tolerance, continueFlag });
      const task = continueFlag
        ? await scriptService.continueEpisodeGeneration(novelId, targetDuration)
        : await scriptService.generateEpisodes(novelId, targetDuration, tolerance);
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
      const q = (req.query.q as string) || undefined; // v2.0.0
      const status = (req.query.status as string) || undefined; // v2.0.0
      const novels = userId
        ? await novelModel.findByUserId(userId, { q, status })
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

  // v2.0.1 补: 获取单本小说详情
  async getNovel(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      const novel = await novelService.getNovel(novelId);
      if (!novel) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      // 越权保护: 只能看自己的小说 (v2.0)
      if (userId && (novel as any).userId && (novel as any).userId !== userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此小说' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      res.json({
        success: true,
        data: novel,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
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

  // v2.5.11: 全字段更新 (含 description/extraDescription JSON)
  async updateCharacterFull(req: Request, res: Response, next: NextFunction) {
    try {
      const { characterId } = req.params;
      const userId = (req as any).userId;
      const { name, aliases, appearance, personality, roleType, description, extraDescription } = req.body;

      // 越权校验: 通过 character → novel 链路确认所有权
      const char = await characterModel.findById(characterId);
      if (!char) {
        return res.status(404).json({
          success: false,
          error: { code: 'CHARACTER_NOT_FOUND', message: '角色不存在' },
        });
      }
      if (char.novelId) {
        const novel = await novelModel.findById(char.novelId);
        if (novel?.userId && userId && novel.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: '无权编辑此角色' },
          });
        }
      }

      // v2.5.34: aliases 数组, description/extraDescription 字符串
      await characterModel.updateFull(characterId, { name, aliases, appearance, personality, roleType, description, extraDescription });
      logger.info('Character full update', { characterId, userId, hasDesc: !!description, descLen: typeof description === 'string' ? description.length : 0 });
      res.json({
        success: true,
        data: { updated: true },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  // v2.5.11: 编辑小说元信息 (genre/theme/style/tone)
  async updateNovelMeta(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      const novel = await novelModel.findById(novelId);
      if (!novel) {
        return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
      }
      if (userId && novel.userId && novel.userId !== userId) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
      }
      const { genre, theme, style, tone } = req.body;
      await novelModel.updateAnalysis(novelId, { genre, theme, style, tone } as any);
      logger.info('Novel meta update', { novelId, userId });
      res.json({
        success: true,
        data: { updated: true },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  // v2.5.11: 编辑完整 analysis_report
  async updateAnalysisReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      const novel = await novelModel.findById(novelId);
      if (!novel) {
        return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
      }
      if (userId && novel.userId && novel.userId !== userId) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
      }
      const { analysisReport } = req.body;
      if (typeof analysisReport !== 'string') {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'analysisReport 必须是字符串' } });
      }
      await novelModel.updateAnalysisReport(novelId, analysisReport);
      logger.info('Analysis report update', { novelId, userId, length: analysisReport.length });
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

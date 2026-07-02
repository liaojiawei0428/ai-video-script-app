/**
 * v2.0.0 - 大纲 + 事件图谱 controller
 */
import { Request, Response, NextFunction } from 'express';
import { outlineService } from '../services/outlineService';
import { logger } from '../utils/logger';

export const outlineController = {
  async generateOutline(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      // BUG-148: 传 userId 给 outlineService 用于 DeepSeek user_id 隔离
      const outline = await outlineService.generateOutline(novelId, userId);
      res.json({
        success: true,
        data: outline,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },

  async getOutline(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const outline = await outlineService.getOutline(novelId);
      res.json({
        success: true,
        data: outline,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },

  async updateOutline(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'items 必须为数组' } });
      }
      const existing = await outlineService.getOutline(novelId);
      if (!existing) {
        return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
      }
      // 用户编辑后取消确认状态, 需重新确认
      const updated = { ...existing, items, generatedAt: Date.now(), confirmedAt: undefined };
      const { novelModel } = await import('../models/novel');
      await novelModel.updateOutline(novelId, JSON.stringify(updated));
      res.json({
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },

  async confirmOutline(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const outline = await outlineService.confirmOutline(novelId);
      logger.info('Outline confirmed', { novelId });
      res.json({
        success: true,
        data: outline,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },

  async generatePlotGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const userId = (req as any).userId;
      // BUG-148: 传 userId 给 outlineService 用于 DeepSeek user_id 隔离
      const graph = await outlineService.generatePlotGraph(novelId, userId);
      res.json({
        success: true,
        data: graph,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },

  async getPlotGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const { novelId } = req.params;
      const graph = await outlineService.getPlotGraph(novelId);
      res.json({
        success: true,
        data: graph,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (e) { next(e); }
  },
};

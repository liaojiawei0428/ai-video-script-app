// apps/server/src/controllers/imageAgentController.ts
// v3.0.0.2: 生图 Agent 控制器 (POST /api/image-agent/*) — 加 translate-plan / update-plan-fields

import { Request, Response, NextFunction } from 'express';
import { imageAgentService } from '../services/imageAgentService';
import { imageConversationModel, imageGenerationModel } from '../models/imageConversation';
import { logger } from '../utils/logger';
import { AgentPart, AgentMessage } from '../shared/types';

export const imageAgentController = {
  /** POST /api/image-agent/conversations - 创建新会话 */
  async createConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });

      const result = await imageAgentService.createConversation(userId);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** POST /api/image-agent/chat - 处理一轮对话 (LLM 自适应) */
  async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId, parts, aspectRatio } = req.body;  // v3.0.0.8: 加 aspectRatio (前端比例选择器直接传, 不再混入 text)
      if (!conversationId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId is required' } });
      }
      if (!Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'parts must be non-empty array' } });
      }

      const result = await imageAgentService.processTurn(conversationId, parts as AgentPart[], aspectRatio);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** v3.0.0.2: POST /api/image-agent/translate-plan - 中文方案 → 英文 prompt 翻译 */
  async translatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId is required' } });
      }
      const result = await imageAgentService.translatePlan(conversationId);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** v3.0.0.2: PUT /api/image-agent/plan-fields - 用户在 plan_cn_ready 状态下修改字段 */
  async updatePlanFields(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId, fields } = req.body;
      if (!conversationId || !fields) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId and fields are required' } });
      }
      const result = await imageAgentService.updatePlanFields(conversationId, fields);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** POST /api/image-agent/confirm - 用户确认英文 prompt, 调 agnes image */
  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId is required' } });
      }
      const result = await imageAgentService.confirm(conversationId);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** GET /api/image-agent/conversations - 历史会话 */
  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
      const limit = parseInt(req.query.limit as string) || 50;

      const rows = await imageConversationModel.findByUserId(userId, limit);
      res.json({ success: true, data: { conversations: rows }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** GET /api/image-agent/conversations/:id - 会话详情 (含 messages.parts) */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const conv = await imageConversationModel.findById(req.params.id);
      if (!conv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
      res.json({ success: true, data: { conversation: conv }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },

  /** v3.0.0.17: DELETE /api/image-agent/conversations/:id - 永久删除 (含 image_generations 审计)
   *  鉴权: 只能删自己的 (admin 可删任意, 暂不开) */
  async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
      const conv = await imageConversationModel.findById(req.params.id);
      if (!conv) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
      if (conv.user_id !== userId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权删除该会话' } });

      // 删 image_generations 审计
      try {
        const mysql = require('../models/db');
        await mysql.execute('DELETE FROM image_generations WHERE conversation_id = ?', [conv.id]);
      } catch (err) {
        logger.warn('ImageAgent: failed to clean image_generations', { conversationId: conv.id, error: (err as Error).message });
      }
      await imageConversationModel.delete(conv.id);
      logger.info('ImageAgent: conversation deleted', { userId, conversationId: conv.id });

      res.json({ success: true, data: { conversationId: conv.id }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    } catch (err) { next(err); }
  },
};

import { Request, Response, NextFunction } from 'express';
import { deepseekPool } from '../services/deepseekPool';
import { logger } from '../utils/logger';

export const chatController = {
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'messages is required' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const systemMsg = messages.find((m: any) => m.role === 'system');
      const userMsgs = messages.filter((m: any) => m.role === 'user');
      const assistantMsgs = messages.filter((m: any) => m.role === 'assistant');

      if (userMsgs.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one user message required' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const systemPrompt = '【重要】接下来所有对话和思考过程都必须使用中文进行，禁止使用英文。\n\n' + (systemMsg?.content || '你是一个有帮助的AI助手，请用中文回答用户的问题。');
      const conversationHistory = [...userMsgs, ...assistantMsgs]
        .sort((a: any, b: any) => 0)
        .map((m: any) => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
        .join('\n\n');

      const userPrompt = `${conversationHistory}\n\n请回复用户的最新问题。`;

      logger.info('Chat API called', { messageCount: messages.length });

      const llmResult = await deepseekPool.chatCompletionWithRetry(
        systemPrompt,
        userPrompt,
        0.7
      );

      res.json({
        success: true,
        data: {
          reply: llmResult.content,
          reasoning: llmResult.reasoning,
          usage: {
            promptTokens: llmResult.promptTokens,
            completionTokens: llmResult.completionTokens,
            totalTokens: llmResult.totalTokens,
          },
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
};

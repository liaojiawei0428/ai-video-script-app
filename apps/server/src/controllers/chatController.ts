// apps/server/src/controllers/chatController.ts
// v3.0.0: 从 deepseekPool 切到 agnesTextProvider
// v3.0.0: 支持 ?stream=true SSE 端点 (同 / 路由, query 切换)
// v3.0.0: 去掉 hardcode 中文 system prompt, 让调用方传
// v3.0.0: 去掉手工拼 messages, 直接用 OpenAI 标准 messages 数组

import { Request, Response, NextFunction } from 'express';
import { agnesTextProvider } from '../services/agnesTextProvider';
import { logger } from '../utils/logger';

export const chatController = {
  /** v3.0.0: 支持一次性 + SSE 流式 (?stream=true) */
  async send(req: Request, res: Response, next: NextFunction) {
    const isStream = req.query.stream === 'true' || req.query.stream === '1';

    try {
      const { messages, temperature, max_tokens, enable_thinking } = req.body || {};

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'messages is required' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const opts = {
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        maxTokens: typeof max_tokens === 'number' ? max_tokens : 2048,
        enableThinking: enable_thinking !== false,   // 默认 true
      };

      logger.info('Chat API called', {
        messageCount: messages.length,
        stream: isStream,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        enableThinking: opts.enableThinking,
      });

      if (isStream) {
        // ── v3.0.0: SSE 流式响应 (借鉴 Vercel AI SDK UIMessageStreamResponse) ──
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');   // 禁用 nginx 缓冲

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // 事件 1: start
        res.write(`event: start\ndata: ${JSON.stringify({ messageId })}\n\n`);

        // 事件 2..N: text-delta / reasoning-delta / finish
        for await (const chunk of agnesTextProvider.streamChatCompletion(opts)) {
          if (chunk.type === 'reasoning') {
            res.write(`event: reasoning-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
          } else if (chunk.type === 'text') {
            res.write(`event: text-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
          } else if (chunk.type === 'done') {
            res.write(`event: finish\ndata: ${JSON.stringify({ usage: chunk.usage })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // ── 一次性响应 (向后兼容 v2.5.x 客户端) ──
      const llmResult = await agnesTextProvider.chatCompletion(opts);

      res.json({
        success: true,
        data: {
          reply: llmResult.content,
          reasoning: llmResult.reasoning,
          usage: llmResult.usage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      // 流式响应已 sendHeader, 不能改 status, 直接结束
      if (isStream && res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: (error as Error).message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      next(error);
    }
  },
};

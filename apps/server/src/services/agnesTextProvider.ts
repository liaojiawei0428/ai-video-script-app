// apps/server/src/services/agnesTextProvider.ts
// v3.0.0: 首次实现 agnes-2.0-flash 文本生成 Provider
// v3.0.0: 借鉴 Vercel AI SDK streamText 思路 + OpenAI Chat Completions 协议 (Agnes 端点兼容)
// v3.0.0: 统一环境变量名 AGNES_API_KEY (兼容旧名 AGNES_IMAGE_API_KEY, 一个 key 通用 3 个模型)
// v3.0.0: 实测发现的 2 个坑:
//   1. Thinking 模式下 message.content 可能为 null, 所有 token 都在 reasoning_content 字段
//      -> 必须 fallback: content ?? reasoning_content, 并 logger.warn 提示
//   2. 图片 key 通用文本接口 (curl 验证 AGNES_IMAGE_API_KEY 也能调 chat/completions)

import { logger } from '../utils/logger';

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
// v3.0.0: 文本模型 agnes-2.0-flash (用于理解/对话/分析/剧本生成)
// vs 图片模型 agnes-image-2.1-flash (images/generations, 用于生图)
const AGNES_MODEL = 'agnes-2.0-flash';

export interface AgnesChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
}

export interface AgnesChatResult {
  content: string;
  reasoning?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AgnesStreamChunk =
  | { type: 'reasoning'; text: string }
  | { type: 'text'; text: string }
  | { type: 'done'; usage: { promptTokens: number; completionTokens: number; totalTokens: number } };

export class AgnesTextProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    // v3.0.0: 优先用统一名 AGNES_API_KEY, 兼容旧名 AGNES_IMAGE_API_KEY (v2.5.x 历史)
    this.apiKey = apiKey || process.env.AGNES_API_KEY || process.env.AGNES_IMAGE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('AGNES_API_KEY (或 AGNES_IMAGE_API_KEY) not set');
    }
  }

  async chatCompletion(opts: AgnesChatOptions): Promise<AgnesChatResult> {
    if (!this.apiKey) {
      throw new Error('Agnes API Key 未配置 (AGNES_API_KEY 或 AGNES_IMAGE_API_KEY)');
    }

    const temperature = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens ?? 2048;
    const enableThinking = opts.enableThinking ?? true;

    const body: any = {
      model: AGNES_MODEL,
      messages: opts.messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    // v3.0.0: chat_template_kwargs 顶层传, 启用 Thinking
    if (enableThinking) {
      body.chat_template_kwargs = { enable_thinking: true };
    }

    logger.info('AgnesTextProvider: chatCompletion', {
      messageCount: opts.messages.length,
      temperature,
      maxTokens,
      enableThinking,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // v3.0.0: 5 分钟超时 (长上下文 + Thinking 思考可能慢)
        const controller = new AbortController();
        const timeoutMs = 5 * 60 * 1000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(AGNES_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 429) {
          lastError = new Error('Agnes API 速率限制(429)');
          const waitMs = 5000 + attempt * 10000;
          logger.warn('AgnesTextProvider: rate limited', { attempt: attempt + 1, waitMs });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('Agnes API error', { status: response.status, errorText });
          throw new Error(`Agnes API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
        }

        const data = await response.json() as {
          choices: Array<{
            message: { content: string | null; reasoning_content?: string };
            finish_reason: string;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error('Agnes API 未返回 choices');
        }

        // v3.0.0: 处理 content null fallback (Thinking 模式坑 #1)
        // 实测: enable_thinking=true 时, message.content 可能为 null, 所有 token 都在 reasoning_content
        // 兜底: content ?? reasoning_content
        let content = choice.message.content;
        const reasoning = choice.message.reasoning_content;

        if (content === null || content === undefined || content === '') {
          if (reasoning && reasoning.trim().length > 0) {
            logger.warn('AgnesTextProvider: content is null, fallback to reasoning_content', {
              reasoningLen: reasoning.length,
            });
            content = reasoning;
          } else {
            content = '';
          }
        }

        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        logger.info('AgnesTextProvider: chatCompletion done', {
          contentLen: content.length,
          reasoningLen: reasoning?.length || 0,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        });

        return {
          content,
          reasoning,
          usage: {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
        };
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('429') || err.message?.includes('速率限制')) {
          const waitMs = 5000 + attempt * 10000;
          logger.warn('AgnesTextProvider: retrying', { attempt: attempt + 1, waitMs });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }

    logger.error('AgnesTextProvider: all retries exhausted', { lastError: lastError?.message });
    throw lastError || new Error('Agnes 文本生成失败（已重试3次）');
  }

  async *streamChatCompletion(opts: AgnesChatOptions): AsyncGenerator<AgnesStreamChunk> {
    if (!this.apiKey) {
      throw new Error('Agnes API Key 未配置 (AGNES_API_KEY 或 AGNES_IMAGE_API_KEY)');
    }

    const temperature = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens ?? 2048;
    const enableThinking = opts.enableThinking ?? true;

    const body: any = {
      model: AGNES_MODEL,
      messages: opts.messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    if (enableThinking) {
      body.chat_template_kwargs = { enable_thinking: true };
    }

    logger.info('AgnesTextProvider: streamChatCompletion start', {
      messageCount: opts.messages.length,
      temperature,
      maxTokens,
      enableThinking,
    });

    // v3.0.0: 5 分钟超时 (流式可能更长)
    const controller = new AbortController();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(AGNES_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    if (response.status === 429) {
      clearTimeout(timeoutId);
      throw new Error('Agnes API 速率限制(429)');
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text();
      logger.error('Agnes stream API error', { status: response.status, errorText });
      throw new Error(`Agnes API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('Agnes API 响应无 body');
    }

    // v3.0.0: 解析 SSE 流 (OpenAI 标准 data: {...}\n\n)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    let hasYieldedDone = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 事件以 \n\n 分隔
        const events = buffer.split('\n\n');
        // 最后一个可能是不完整的事件, 留到下次处理
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (!trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            if (dataStr === '[DONE]') continue;

            let chunk: any;
            try {
              chunk = JSON.parse(dataStr);
            } catch (parseErr) {
              logger.warn('AgnesTextProvider: SSE chunk parse failed', { dataStr: dataStr.slice(0, 100) });
              continue;
            }

            // v3.0.0: 检测 usage (通常在最后一个 chunk)
            if (chunk.usage) {
              finalUsage = {
                promptTokens: chunk.usage.prompt_tokens || 0,
                completionTokens: chunk.usage.completion_tokens || 0,
                totalTokens: chunk.usage.total_tokens || 0,
              };
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // v3.0.0: reasoning_content (Thinking token) - 优先 yield, 让前端先展示思考过程
            if (delta.reasoning_content && delta.reasoning_content.length > 0) {
              yield { type: 'reasoning', text: delta.reasoning_content };
            }

            // v3.0.0: text content
            if (delta.content && delta.content.length > 0) {
              yield { type: 'text', text: delta.content };
            }

            // v3.0.0: finish_reason 触发 done (即使 usage 还没到也先 yield, usage 后续补)
            if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
              const usage = finalUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
              yield { type: 'done', usage };
              hasYieldedDone = true;
            }
          }
        }
      }

      // v3.0.0: 处理 buffer 残留
      if (buffer.trim().length > 0) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:') && trimmed !== 'data: [DONE]') {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const chunk = JSON.parse(dataStr);
              if (chunk.usage) {
                finalUsage = {
                  promptTokens: chunk.usage.prompt_tokens || 0,
                  completionTokens: chunk.usage.completion_tokens || 0,
                  totalTokens: chunk.usage.total_tokens || 0,
                };
              }
              const choice = chunk.choices?.[0];
              if (choice?.delta) {
                if (choice.delta.reasoning_content) {
                  yield { type: 'reasoning', text: choice.delta.reasoning_content };
                }
                if (choice.delta.content) {
                  yield { type: 'text', text: choice.delta.content };
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      try { reader.releaseLock(); } catch (e) { /* ignore */ }
    }

    // v3.0.0: 兜底 - 如果流结束还没 yield done (某些 API 不返回 finish_reason), 补一个
    if (!hasYieldedDone) {
      const usage = finalUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      yield { type: 'done', usage };
    }

    logger.info('AgnesTextProvider: streamChatCompletion done', { finalUsage });
  }
}

export const agnesTextProvider = new AgnesTextProvider();

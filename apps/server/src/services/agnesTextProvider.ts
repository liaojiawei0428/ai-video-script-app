// apps/server/src/services/agnesTextProvider.ts
// v3.0.0: 首次实现 agnes-2.0-flash 文本生成 Provider
// v3.0.0: 借鉴 Vercel AI SDK streamText 思路 + OpenAI Chat Completions 协议 (Agnes 端点兼容)
// v3.0.0: 统一环境变量名 AGNES_API_KEY (兼容旧名 AGNES_IMAGE_API_KEY, 一个 key 通用 3 个模型)
// v3.0.0: 实测发现的 2 个坑:
//   1. Thinking 模式下 message.content 可能为 null, 所有 token 都在 reasoning_content 字段
//      -> 必须 fallback: content ?? reasoning_content, 并 logger.warn 提示
//   2. 图片 key 通用文本接口 (curl 验证 AGNES_IMAGE_API_KEY 也能调 chat/completions)
// v3.0.51 (BUG-122): 拆 3 个企业 key, text 优先读 AGNES_TEXT_API_KEY (企业配额独立, 并发更高)
//   - 优先级: AGNES_TEXT_API_KEY (企业 text 专用) > AGNES_API_KEY (统一) > AGNES_IMAGE_API_KEY (老兼容)
// v3.0.78 (BUG-149): 错误码严格映射 (跟 image/video BUG-132/137 1:1 镜像, 修前只判断 429 其他包装错误信息丢失)
//   - 加 AgnesTextErrorType + AgnesTextError + classifyAgnesTextError (跟 AgnesImageErrorType 1:1)
//   - 加 user 字段 (OpenAI 协议标准, shipin-app 透传 userId, 跟 BUG-148 deepseek user_id 1:1 镜像)
//   - 加 stream_options.include_usage (OpenAI 协议标准, 修前流式经常拿不到 usage 块, 计费偏低)
//   - 错误信息透传 upstream (跟 deepseek mapDeepseekError 1:1 镜像, 修前 shipin-app `Agnes API 错误 (...)` prefix 包装 upstream 错误信息)

import { logger } from '../utils/logger';

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
// v3.0.0: 文本模型 agnes-2.0-flash (用于理解/对话/分析/剧本生成)
// vs 图片模型 agnes-image-2.1-flash (images/generations, 用于生图)
const AGNES_MODEL = 'agnes-2.0-flash';

/**
 * v3.0.78 (BUG-149): text 错误类型 (跟 image/video BUG-132/137 1:1 镜像)
 * 官方错误码 18 种: 400/401/402/403/404/405/408/409/413/415/422/429/431/499/500/502/503/504/520/522/524
 */
export enum AgnesTextErrorType {
  CONTENT_POLICY = 'content_policy',
  AUTH_ERROR = 'auth_error',         // 401 API key 错/过期
  BALANCE_ERROR = 'balance_error',   // 402 余额不足
  FORBIDDEN_ERROR = 'forbidden_error', // 403 权限/IP 限制
  NOT_FOUND = 'not_found',           // 404 模型错/路径错
  RATE_LIMIT = 'rate_limit',         // 429 RPM 限流
  INVALID_INPUT = 'invalid_input',   // 400/422 参数错
  PAYLOAD_TOO_LARGE = 'payload_too_large', // 413 请求体过大
  UNSUPPORTED_MEDIA = 'unsupported_media', // 415 文件格式错
  UPSTREAM_BUSY = 'upstream_busy',   // 503/5xx
  TIMEOUT = 'timeout',               // 408/504/524
  NETWORK = 'network',               // fetch failed
  UNKNOWN = 'unknown',
}

export class AgnesTextError extends Error {
  constructor(
    public readonly type: AgnesTextErrorType,
    public readonly agensStatus: number,
    message: string,
    public readonly agensRaw?: string,
  ) {
    super(message);
    this.name = 'AgnesTextError';
  }
}

/**
 * v3.0.78 (BUG-149): 根据 agens 错误判断类型 (跟 agnesImageProvider classifyAgnesImageError 1:1)
 * 官方错误码: https://wiki.agnes-ai.com/en/docs/code.md
 */
function classifyAgnesTextError(status: number, rawText: string): AgnesTextErrorType {
  if (status === 401) return AgnesTextErrorType.AUTH_ERROR;
  if (status === 402) return AgnesTextErrorType.BALANCE_ERROR;
  if (status === 403) return AgnesTextErrorType.FORBIDDEN_ERROR;
  if (status === 404) return AgnesTextErrorType.NOT_FOUND;
  if (status === 413) return AgnesTextErrorType.PAYLOAD_TOO_LARGE;
  if (status === 415) return AgnesTextErrorType.UNSUPPORTED_MEDIA;
  if (status === 429) return AgnesTextErrorType.RATE_LIMIT;
  if (status === 408 || status === 504 || status === 524) return AgnesTextErrorType.TIMEOUT;
  if (status === 503 || (status >= 500 && status < 600)) return AgnesTextErrorType.UPSTREAM_BUSY;
  if (status === 400 || status === 422) {
    if (rawText.includes('content_policy') || rawText.includes('content_safety')) return AgnesTextErrorType.CONTENT_POLICY;
    return AgnesTextErrorType.INVALID_INPUT;
  }
  return AgnesTextErrorType.UNKNOWN;
}

export interface AgnesChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  /** v3.0.78 (BUG-149): OpenAI 协议标准 user 字段, shipin-app 透传 userId 整条链 */
  userId?: string;
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
    this.apiKey = apiKey || process.env.AGNES_TEXT_API_KEY || process.env.AGNES_API_KEY || process.env.AGNES_IMAGE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('AGNES_TEXT_API_KEY (或 AGNES_API_KEY / AGNES_IMAGE_API_KEY) not set');
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

    // v3.0.78 (BUG-149): OpenAI 协议标准 user 字段, shipin-app 透传 userId (跟 BUG-148 deepseek user_id 1:1 镜像)
    // Agnes 官方文档未明确列 user 字段, 但 OpenAI 兼容协议 + 多 provider 实践, Agnes 端通常默默支持 (忽略但不报错)
    if (opts.userId) {
      body.user = opts.userId;
    }

    logger.info('AgnesTextProvider: chatCompletion', {
      messageCount: opts.messages.length,
      temperature,
      maxTokens,
      enableThinking,
      userId: opts.userId,
    });

    let lastError: AgnesTextError | null = null;

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

        // v3.0.78 (BUG-149): 错误码严格映射 (跟 BUG-148 deepseek mapDeepseekError 1:1 镜像, 跟 BUG-132/137 agnes image/video 1:1 镜像)
        if (!response.ok) {
          // v3.0.69 BUG-137 实战: body 只能读一次, !ok 走 text() 读 errText
          const errText = await response.text().catch(() => '');
          const errorType = classifyAgnesTextError(response.status, errText);

          // v3.0.78 (BUG-149): CONTENT_POLICY/INVALID_INPUT 不 retry (跟 BUG-132 image/video 1:1 镜像, retry 永远解不了)
          if (errorType === AgnesTextErrorType.CONTENT_POLICY || errorType === AgnesTextErrorType.INVALID_INPUT) {
            logger.error('AgnesTextProvider: non-retryable error', {
              attempt, status: response.status, type: errorType, errorText: errText.slice(0, 100),
            });
            throw new AgnesTextError(errorType, response.status, `Agnes API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
          }

          // v3.0.78 (BUG-149): RATE_LIMIT/UPSTREAM_BUSY retryable (跟 BUG-132 image/video 1:1 镜像)
          if (response.status === 429 || errorType === AgnesTextErrorType.UPSTREAM_BUSY || errorType === AgnesTextErrorType.RATE_LIMIT) {
            lastError = new AgnesTextError(errorType, response.status, `Agnes API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
            logger.warn('AgnesTextProvider: rate limited / upstream busy', { attempt: attempt + 1, type: errorType, status: response.status });
            if (attempt < 2) {
              const waitMs = 5000 + attempt * 10000;
              await new Promise(r => setTimeout(r, waitMs));
              continue;
            }
            throw lastError;
          }

          // v3.0.78 (BUG-149): 其他错误 (401/402/403/404/413/415/408/504/TIMEOUT/UNKNOWN) 透传 upstream errText (跟 deepseek mapDeepseekError 1:1)
          logger.error('AgnesTextProvider: non-retryable classified error', {
            attempt, status: response.status, type: errorType, errorText: errText.slice(0, 200),
          });
          throw new AgnesTextError(errorType, response.status, `Agnes API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
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
        // v3.0.78 (BUG-149): 类型化错误直接抛出不再 retry (跟 BUG-132 image/video 1:1 镜像)
        if (err instanceof AgnesTextError) {
          throw err;
        }
        // AbortError (timeout) 或网络错 → retry
        lastError = err instanceof AgnesTextError ? err : new AgnesTextError(
          err?.name === 'AbortError' ? AgnesTextErrorType.TIMEOUT : AgnesTextErrorType.NETWORK,
          0,
          err?.message || String(err),
        );
        if (attempt < 2) {
          const waitMs = 5000 + attempt * 10000;
          logger.warn('AgnesTextProvider: timeout/network, will retry', { attempt: attempt + 1, type: lastError.type });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw lastError;
      }
    }

    logger.error('AgnesTextProvider: all retries exhausted', { lastError: lastError?.message });
    throw lastError || new AgnesTextError(AgnesTextErrorType.UNKNOWN, 0, 'Agnes 文本生成失败（已重试3次）');
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
      // v3.0.78 (BUG-149): OpenAI 协议标准 stream_options.include_usage (跟 BUG-148 deepseek 1:1 镜像)
      // Agnes 文档未明确列, 但 OpenAI 兼容协议 + 多 provider 实践, Agnes 端通常默默支持 (流式末尾返回 usage 块)
      stream_options: { include_usage: true },
    };

    if (enableThinking) {
      body.chat_template_kwargs = { enable_thinking: true };
    }

    // v3.0.78 (BUG-149): OpenAI 协议标准 user 字段 (跟 BUG-148 deepseek user_id 1:1 镜像)
    if (opts.userId) {
      body.user = opts.userId;
    }

    logger.info('AgnesTextProvider: streamChatCompletion start', {
      messageCount: opts.messages.length,
      temperature,
      maxTokens,
      enableThinking,
      userId: opts.userId,
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
      throw new AgnesTextError(AgnesTextErrorType.RATE_LIMIT, 429, `Agnes API 速率限制(429)`);
    }

    // v3.0.78 (BUG-149): 错误码严格映射 (跟 chatCompletion 1:1 镜像, 跟 BUG-148 deepseek 1:1 镜像)
    if (!response.ok) {
      clearTimeout(timeoutId);
      // v3.0.69 BUG-137 实战: body 只能读一次, !ok 走 text() 读 errText
      const errText = await response.text().catch(() => '');
      const errorType = classifyAgnesTextError(response.status, errText);
      logger.error('Agnes stream API error', { status: response.status, type: errorType, errorText: errText.slice(0, 200) });
      throw new AgnesTextError(errorType, response.status, `Agnes API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new AgnesTextError(AgnesTextErrorType.UNKNOWN, 0, 'Agnes API 响应无 body');
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

import axios, { AxiosInstance, isAxiosError } from 'axios';
import http from 'http';
import https from 'https';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 120000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 120000 });

export interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

export interface LlmResult {
  content: string;
  reasoning: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
  reasoningTokens?: number;
}

export interface DeepseekStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  // 流式响应最后一块含 usage (需 stream_options.include_usage=true)
  usage?: DeepseekResponse['usage'];
}

export interface ApiCallRecord {
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

/**
 * 统一错误码映射 (BUG-148 修法 1)
 *
 * 官方错误码 (https://api-docs.deepseek.com/zh-cn/quick_start/error_codes):
 * - 400 - 格式错误
 * - 401 - 认证失败 (API key 错误)
 * - 402 - 余额不足
 * - 422 - 参数错误
 * - 429 - 请求速率达到上限 (TPM/RPM)
 * - 500/503 - 服务器故障/繁忙
 *
 * 透传 statusCode 让前端按 HTTP 状态码做对应处理 (401 重试登录 / 429 限流提示 / 5xx 等待重试)
 * 透传 response.data 让前端看到 deepseek 真实错误信息 (key is invalid 等)
 */
function mapDeepseekError(error: unknown): AppError {
  if (isAxiosError(error) && error.response) {
    const status = error.response.status;
    const data = error.response.data;
    const upstreamDetail = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : data;

    if (status === 401) {
      return new AppError(
        'DEEPSEEK_AUTH_ERROR',
        'DeepSeek API key 错误, 认证失败',
        401,
        { upstream: upstreamDetail, originalMessage: upstreamDetail?.message }
      );
    }
    if (status === 402) {
      return new AppError(
        'DEEPSEEK_BALANCE_ERROR',
        'DeepSeek 账户余额不足, 请充值',
        402,
        { upstream: upstreamDetail, originalMessage: upstreamDetail?.message }
      );
    }
    if (status === 429) {
      return new AppError(
        'DEEPSEEK_RATE_LIMIT',
        'DeepSeek API 请求速率达到上限 (TPM/RPM)',
        429,
        { upstream: upstreamDetail, originalMessage: upstreamDetail?.message, retryAfter: error.response.headers?.['retry-after'] }
      );
    }
    if (status === 400 || status === 422) {
      return new AppError(
        'DEEPSEEK_BAD_REQUEST',
        `DeepSeek API 请求格式/参数错误 (HTTP ${status})`,
        status,
        { upstream: upstreamDetail, originalMessage: upstreamDetail?.message }
      );
    }
    if (status === 500 || status === 503) {
      return new AppError(
        'DEEPSEEK_SERVER_ERROR',
        `DeepSeek API 服务器错误 (HTTP ${status})`,
        status,
        { upstream: upstreamDetail, originalMessage: upstreamDetail?.message }
      );
    }
    if (status >= 500) {
      return new AppError(
        'DEEPSEEK_UPSTREAM_ERROR',
        `DeepSeek 上游错误 (HTTP ${status})`,
        status,
        { upstream: upstreamDetail }
      );
    }
  }
  // 网络错误 / 未知错误
  const msg = error instanceof Error ? error.message : String(error);
  return new AppError('DEEPSEEK_NETWORK_ERROR', `DeepSeek API 网络/未知错误: ${msg}`, 502);
}

/**
 * 构造请求体 (BUG-148 修法 2 + 3 + 5)
 *
 * - max_tokens: 32768 (v4-flash 输出上限 384K, 32K 安全范围内)
 * - user_id: 必传 (内容安全 + KVCache + 调度隔离, 官方强烈建议)
 * - thinking: 思考模式开关 (v4-flash/v4-pro 默认 enabled)
 * - stream_options.include_usage: 流式响应拿 usage 统计 (准确计费)
 * - temperature: 思考模式下不传 (官方说设置不报错但不生效, 避免误导)
 */
function buildRequestBody(
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  stream: boolean,
  userId?: string,
): Record<string, unknown> {
  const isThinkingModel = model.startsWith('deepseek-v4');
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 32768,
  };

  // BUG-148 修法 5: 必传 user_id (内容安全 + KVCache + 调度隔离)
  if (userId) {
    body.user_id = userId;
  }

  if (stream) {
    body.stream = true;
    // BUG-148 修法 2: 流式响应拿 usage 统计 (准确计费)
    body.stream_options = { include_usage: true };
  }

  if (isThinkingModel) {
    // BUG-148 修法 3: 思考模式下不传 temperature (官方说设置无效但不报错, 避免误导)
    // 显式传 thinking: { type: 'enabled' } 确保行为可预期
    body.thinking = { type: 'enabled' };
  } else {
    // 非思考模式 (老模型兼容, 当前 shipin-APP 用 v4-flash 不走这里)
    body.temperature = temperature;
  }

  return body;
}

export class DeepseekService {
  private client: AxiosInstance;
  private callHistory: ApiCallRecord[] = [];
  private maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT || '10', 10);
  private currentConcurrent = 0;
  private requestQueue: Array<() => void> = [];

  constructor(apiKey?: string) {
    this.client = axios.create({
      baseURL: config.deepseekApiUrl,
      headers: {
        Authorization: `Bearer ${apiKey || config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
      httpAgent,
      httpsAgent,
    });
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, n);
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  getCurrentConcurrent(): number {
    return this.currentConcurrent;
  }

  private async acquireSlot(): Promise<void> {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
    });
  }

  private releaseSlot(): void {
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      next?.();
    } else {
      this.currentConcurrent--;
    }
  }

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    userId?: string,
  ): Promise<LlmResult> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      const body = buildRequestBody(
        config.deepseekModel,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        false,
        userId,
      );

      logger.info('Deepseek API call started', { model: config.deepseekModel, userId, promptLength: userPrompt.length });

      const response = await this.client.post<DeepseekResponse>('/chat/completions', body);

      const duration = Date.now() - startTime;
      const usage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);
      const msg = response.data.choices[0].message;

      this.callHistory.push({
        timestamp: Date.now(),
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
      });

      logger.info('Deepseek API call completed', {
        duration, userId,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        promptCacheHitTokens: usage.prompt_cache_hit_tokens,
        promptCacheMissTokens: usage.prompt_cache_miss_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
        cost,
      });

      return {
        content: msg.content || '',
        reasoning: msg.reasoning_content || '',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        promptCacheHitTokens: usage.prompt_cache_hit_tokens,
        promptCacheMissTokens: usage.prompt_cache_miss_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      };
    } catch (error) {
      logger.error('Deepseek API call failed', { userId, error: isAxiosError(error) ? error.message : String(error) });
      throw mapDeepseekError(error);
    } finally {
      this.releaseSlot();
    }
  }

  async chatCompletionWithRetry(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    maxRetries: number = 3,
    userId?: string,
  ): Promise<LlmResult> {
    return this.chatCompletionWithMessagesRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      maxRetries,
      userId,
    );
  }

  /** 多轮对话版：接受完整 messages 数组（OpenAI 格式） */
  async chatCompletionWithMessages(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7,
    userId?: string,
  ): Promise<LlmResult> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      const body = buildRequestBody(config.deepseekModel, messages, temperature, false, userId);

      logger.info('Deepseek API call started', { model: config.deepseekModel, userId, messageCount: messages.length, promptLength: messages.reduce((s, m) => s + m.content.length, 0) });

      const response = await this.client.post<DeepseekResponse>('/chat/completions', body);

      const duration = Date.now() - startTime;
      const usage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);
      const msg = response.data.choices[0].message;

      this.callHistory.push({
        timestamp: Date.now(), promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens, cost,
      });

      logger.info('Deepseek API call completed', {
        duration, userId,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        promptCacheHitTokens: usage.prompt_cache_hit_tokens,
        promptCacheMissTokens: usage.prompt_cache_miss_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
        cost,
      });

      return {
        content: msg.content || '',
        reasoning: msg.reasoning_content || '',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        promptCacheHitTokens: usage.prompt_cache_hit_tokens,
        promptCacheMissTokens: usage.prompt_cache_miss_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      };
    } catch (error) {
      logger.error('Deepseek API call failed', { userId, error: isAxiosError(error) ? error.message : String(error) });
      throw mapDeepseekError(error);
    } finally {
      this.releaseSlot();
    }
  }

  async chatCompletionWithMessagesRetry(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7,
    maxRetries: number = 3,
    userId?: string,
  ): Promise<LlmResult> {
    let lastError: AppError | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.chatCompletionWithMessages(messages, temperature, userId);
      } catch (error) {
        lastError = error instanceof AppError ? error : mapDeepseekError(error);
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Deepseek API retry ${attempt + 1}/${maxRetries}`, { userId, delay, errorCode: lastError.code, errorMessage: lastError.message });
        await this.sleep(delay);
      }
    }
    throw lastError || new AppError('DEEPSEEK_API_ERROR', 'Deepseek API failed after retries', 502);
  }

  async chatCompletionStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    userId?: string,
  ): Promise<void> {
    return this.chatCompletionStreamWithMessages(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      onChunk,
      temperature,
      userId,
    );
  }

  /** 流式版（多轮对话版）：支持完整 messages 数组 */
  async chatCompletionStreamWithMessages(
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    userId?: string,
  ): Promise<void> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      const body = buildRequestBody(config.deepseekModel, messages, temperature, true, userId);

      const response = await this.client.post(
        '/chat/completions',
        body,
        { responseType: 'stream' }
      );

      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      let promptCacheHitTokens = 0;
      let promptCacheMissTokens = 0;
      let reasoningTokens = 0;
      let lastUsage: DeepseekResponse['usage'] | undefined;

      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }
              try {
                const parsed = JSON.parse(data) as DeepseekStreamChunk;
                const content = parsed.choices?.[0]?.delta?.content;
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
                if (content) onChunk(content);
                // v3.0.99 BUG-176 修: reasoning_content (DeepSeek 思考模式输出) 不再通过 onChunk 暴露给调用方
                //   修前: onChunk(reasoning) → fullContent += chunk → analysis_report 含思考过程草稿
                //   修后: reasoning 只在 logger debug 留痕, 永远不污染 analysis_report
                //   跨项目通用铁律 #34 (跟 BUG-079 假报告 100% 同源): AI 思考内容 (reasoning_content / chain-of-thought) 必滤, 不能进入用户可见输出
                if (reasoning) {
                  logger.debug('DeepSeek reasoning_content chunk (not exposed to caller)', {
                    userId,
                    reasoningLen: reasoning.length,
                    reasoningPreview: reasoning.slice(0, 80),
                  });
                }
                // BUG-148 修法 2: 解析流式响应末尾的 usage 块
                if (parsed.usage) {
                  lastUsage = parsed.usage;
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          if (lastUsage) {
            promptTokens = lastUsage.prompt_tokens || 0;
            completionTokens = lastUsage.completion_tokens || 0;
            totalTokens = lastUsage.total_tokens || 0;
            promptCacheHitTokens = lastUsage.prompt_cache_hit_tokens || 0;
            promptCacheMissTokens = lastUsage.prompt_cache_miss_tokens || 0;
            reasoningTokens = lastUsage.completion_tokens_details?.reasoning_tokens || 0;
            const cost = this.calculateCost(promptTokens, completionTokens);
            this.callHistory.push({
              timestamp: Date.now(), promptTokens, completionTokens, totalTokens, cost,
            });
            logger.info('Deepseek stream API call completed (with usage)', {
              userId, durationMs: Date.now() - startTime,
              promptTokens, completionTokens, totalTokens,
              promptCacheHitTokens, promptCacheMissTokens, reasoningTokens, cost,
            });
          } else {
            logger.warn('Deepseek stream API call completed (NO usage block — stream_options.include_usage may be missing)', {
              userId, durationMs: Date.now() - startTime,
            });
          }
          resolve();
        });

        response.data.on('error', reject);
      });
    } catch (error) {
      logger.error('Deepseek stream API call failed', { userId, error: isAxiosError(error) ? error.message : String(error) });
      throw mapDeepseekError(error);
    } finally {
      this.releaseSlot();
    }
  }

  /** 流式版（带重试） */
  async chatCompletionStreamWithRetry(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    maxRetries: number = 2,
    userId?: string,
  ): Promise<void> {
    let lastError: AppError | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature, userId);
      } catch (error) {
        lastError = error instanceof AppError ? error : mapDeepseekError(error);
        if (lastError.message.includes('CANCELLED_BY_USER')) {
          throw lastError;
        }
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Deepseek stream API retry ${attempt + 1}/${maxRetries}`, { userId, delay, errorCode: lastError.code, errorMessage: lastError.message });
        await this.sleep(delay);
      }
    }
    throw lastError || new AppError('DEEPSEEK_API_ERROR', 'Deepseek stream API failed after retries', 502);
  }

  getTotalCost(): number {
    return this.callHistory.reduce((sum, record) => sum + record.cost, 0);
  }

  getTotalTokens(): number {
    return this.callHistory.reduce((sum, record) => sum + record.totalTokens, 0);
  }

  getCallHistory(): ApiCallRecord[] {
    return [...this.callHistory];
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // DeepSeek V4 Flash pricing: ¥1/M input (cache miss), ¥0.02/M (cache hit), ¥2/M output
    const inputCost = (inputTokens / 1000000) * 1;
    const outputCost = (outputTokens / 1000000) * 2;
    return Math.round((inputCost + outputCost) * 100) / 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 从 LLM 响应中提取 JSON 字符串
 * 处理多种格式：```json...```、纯 JSON、以及带有前缀文本的 JSON
 */
export function extractJsonFromResponse(raw: string): string {
  const trimmed = raw.trim();

  // 1. 尝试提取 ```json ... ``` 或 ``` ... ``` 代码块
  const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // 2. 尝试查找 JSON 对象 { ... }
  const jsonObj = trimmed.match(/\{[\s\S]*\}/);
  if (jsonObj) return jsonObj[0];

  // 3. 尝试查找 JSON 数组 [ ... ]
  const jsonArr = trimmed.match(/\[[\s\S]*\]/);
  if (jsonArr) return jsonArr[0];

  // 4. 返回原文本（让调用方处理错误）
  return trimmed;
}

/** 安全解析 LLM 返回的 JSON，失败时返回默认值 */
export function safeParseJson<T>(raw: string, defaultVal: T): { parsed: T; raw: string } {
  try {
    const cleaned = extractJsonFromResponse(raw);
    const parsed = JSON.parse(cleaned) as T;
    return { parsed, raw: cleaned };
  } catch {
    return { parsed: defaultVal, raw };
  }
}

export const deepseekService = new DeepseekService();
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { generateUUID } from '../shared/utils';
import { queryAll, queryOne, execute } from '../models/db';

export interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning_content?: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LlmResult {
  content: string;
  reasoning: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DeepseekStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

export interface ApiCallRecord {
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export class DeepseekService {
  private client: AxiosInstance;
  private callHistory: ApiCallRecord[] = [];
  private maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT || '3', 10);
  private currentConcurrent = 0;
  private requestQueue: Array<() => void> = [];
  private initialized = false;

  constructor() {
    this.client = axios.create({
      baseURL: config.deepseekApiUrl,
      headers: {
        Authorization: `Bearer ${config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 300000,
    });
  }

  /** 初始化：重置所有 processing 状态为 queued（下次启动可恢复） */
  async initQueue(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await execute(
        "UPDATE ai_task_queue SET status = 'queued', started_at = 0 WHERE status = 'processing'"
      );
      const count = await queryOne<any>(
        "SELECT COUNT(*) as c FROM ai_task_queue WHERE status = 'queued'"
      );
      if (count?.c > 0) {
        logger.info(`AI queue recovered ${count.c} pending tasks`);
        // 启动后台恢复
        this.recoverLoop();
      }
    } catch {} // 表可能还不存在
  }

  /** 后台恢复：把队列中的任务逐个推入处理 */
  private async recoverLoop(): Promise<void> {
    while (true) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const next = await queryOne<any>(
          "SELECT id FROM ai_task_queue WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
        );
        if (!next) break; // 队列处理完毕
        // 等待有 slot 后去取
      } catch { break; }
    }
  }

  private async acquireSlot(novelId?: string): Promise<void> {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }
    // 没有可用 slot，写入 DB 队列后等待
    const queueId = generateUUID();
    try {
      await execute(
        'INSERT INTO ai_task_queue (id, novel_id, task_type, status, params, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [queueId, novelId || 'unknown', 'ai_call', 'queued', '{}', Date.now()]
      );
    } catch {} // 表不可用则降级为内存等待
    return new Promise((resolve) => {
      this.requestQueue.push(() => {
        try { execute("UPDATE ai_task_queue SET status='processing', started_at=? WHERE id=?", [Date.now(), queueId]).catch(() => {}); } catch {}
        resolve();
      });
    });
  }

  private releaseSlot(novelId?: string): void {
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      next?.();
    } else {
      this.currentConcurrent--;
      // 检查 DB 是否有排队任务
      this.dequeueDbTask().catch(() => {});
    }
  }

  /** 从 DB 队列取出下一个任务执行 */
  private async dequeueDbTask(): Promise<void> {
    const next = await queryOne<any>(
      "SELECT id FROM ai_task_queue WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
    );
    if (next) {
      await execute("UPDATE ai_task_queue SET status='processing', started_at=? WHERE id=?", [Date.now(), next.id]);
      this.currentConcurrent++;
      this.requestQueue.push(() => {});
      this.requestQueue.shift()?.(); // 立即执行
    }
  }

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7
  ): Promise<LlmResult> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      logger.info('Deepseek API call started', { temperature, promptLength: userPrompt.length });

      const response = await this.client.post<DeepseekResponse>('/chat/completions', {
        model: config.deepseekModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 8192,
      });

      const duration = Date.now() - startTime;
      const usage = response.data.usage;
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
        duration, promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens, cost,
      });

      return {
        content: msg.content || '',
        reasoning: msg.reasoning_content || '',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };
    } catch (error) {
      logger.error('Deepseek API call failed', { error });
      throw new AppError('DEEPSEEK_API_ERROR', 'Failed to call Deepseek API', 502,
        { originalError: error instanceof Error ? error.message : String(error) });
    } finally {
      this.releaseSlot();
    }
  }

  async chatCompletionWithRetry(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    maxRetries: number = 3
  ): Promise<LlmResult> {
    return this.chatCompletionWithMessagesRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      maxRetries
    );
  }

  /** 多轮对话版：接受完整 messages 数组（OpenAI 格式） */
  async chatCompletionWithMessages(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7
  ): Promise<LlmResult> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      logger.info('Deepseek API call started', { messageCount: messages.length, promptLength: messages.reduce((s, m) => s + m.content.length, 0) });

      const response = await this.client.post<DeepseekResponse>('/chat/completions', {
        model: config.deepseekModel,
        messages,
        temperature,
        max_tokens: 8192,
      });

      const duration = Date.now() - startTime;
      const usage = response.data.usage;
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);
      const msg = response.data.choices[0].message;

      this.callHistory.push({
        timestamp: Date.now(), promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens, cost,
      });

      logger.info('Deepseek API call completed', {
        duration, promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens, cost,
      });

      return {
        content: msg.content || '',
        reasoning: msg.reasoning_content || '',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };
    } catch (error) {
      logger.error('Deepseek API call failed', { error });
      throw new AppError('DEEPSEEK_API_ERROR', 'Failed to call Deepseek API', 502,
        { originalError: error instanceof Error ? error.message : String(error) });
    } finally {
      this.releaseSlot();
    }
  }

  async chatCompletionWithMessagesRetry(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7,
    maxRetries: number = 3
  ): Promise<LlmResult> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.chatCompletionWithMessages(messages, temperature);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Deepseek API retry ${attempt + 1}/${maxRetries}`, { delay, error: lastError.message });
        await this.sleep(delay);
      }
    }
    throw new AppError('DEEPSEEK_API_ERROR',
      `Deepseek API failed after ${maxRetries} retries: ${lastError?.message}`, 502);
  }

  async chatCompletionStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    return this.chatCompletionStreamWithMessages(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      onChunk,
      temperature
    );
  }

  /** 流式版（多轮对话版）：支持完整 messages 数组 */
  async chatCompletionStreamWithMessages(
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    await this.acquireSlot();

    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model: config.deepseekModel,
          messages,
          temperature,
          max_tokens: 8192,
          stream: true,
        },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              try {
                const parsed = JSON.parse(data) as DeepseekStreamChunk;
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
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
    maxRetries: number = 2
  ): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Deepseek stream API retry ${attempt + 1}/${maxRetries}`, { delay, error: lastError.message });
        await this.sleep(delay);
      }
    }
    throw new AppError('DEEPSEEK_API_ERROR',
      `Deepseek stream API failed after ${maxRetries} retries: ${lastError?.message}`, 502);
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
    // Deepseek pricing (approximate)
    const inputCost = (inputTokens / 1000000) * 0.5;
    const outputCost = (outputTokens / 1000000) * 2.0;
    return Math.round((inputCost + outputCost) * 100) / 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

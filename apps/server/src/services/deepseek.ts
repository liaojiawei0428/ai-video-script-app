import axios, { AxiosInstance } from 'axios';
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
        max_tokens: 32768,
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
        max_tokens: 32768,
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
          max_tokens: 32768,
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
        if (lastError.message.includes('CANCELLED_BY_USER')) {
          throw lastError;
        }
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
    // DeepSeek V4 Flash pricing: $0.14 / 1M input, $0.28 / 1M output
    const inputCost = (inputTokens / 1000000) * 0.14;
    const outputCost = (outputTokens / 1000000) * 0.28;
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

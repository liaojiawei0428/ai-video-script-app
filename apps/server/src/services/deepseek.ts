import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
  private maxConcurrent = 3;
  private currentConcurrent = 0;
  private requestQueue: Array<() => void> = [];

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
  ): Promise<string> {
    await this.acquireSlot();
    const startTime = Date.now();

    try {
      logger.info('Deepseek API call started', {
        temperature,
        promptLength: userPrompt.length,
      });

      const response = await this.client.post<DeepseekResponse>('/chat/completions', {
        model: config.deepseekModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      });

      const duration = Date.now() - startTime;
      const usage = response.data.usage;
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

      this.callHistory.push({
        timestamp: Date.now(),
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
      });

      logger.info('Deepseek API call completed', {
        duration,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('Deepseek API call failed', { error });
      throw new AppError(
        'DEEPSEEK_API_ERROR',
        'Failed to call Deepseek API',
        502,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      this.releaseSlot();
    }
  }

  async chatCompletionWithRetry(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.chatCompletion(systemPrompt, userPrompt, temperature);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`Deepseek API retry ${attempt + 1}/${maxRetries}`, {
          delay,
          error: lastError.message,
        });
        await this.sleep(delay);
      }
    }

    throw new AppError(
      'DEEPSEEK_API_ERROR',
      `Deepseek API failed after ${maxRetries} retries: ${lastError?.message}`,
      502
    );
  }

  async chatCompletionStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    await this.acquireSlot();

    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model: config.deepseekModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: 8192,
          stream: true,
        },
        {
          responseType: 'stream',
        }
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

export const deepseekService = new DeepseekService();

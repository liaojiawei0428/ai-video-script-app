import { config } from '../config';
import { logger } from '../utils/logger';
import { DeepseekService, DeepseekResponse, DeepseekStreamChunk, LlmResult, ApiCallRecord } from './deepseek';

export class DeepseekPool {
  private instances: DeepseekService[] = [];
  private index = 0;

  constructor() {
    const keys = config.deepseekApiKeys;
    if (keys.length === 0) {
      logger.warn('No Deepseek API keys configured, pool will be empty');
      return;
    }
    for (let i = 0; i < keys.length; i++) {
      this.instances.push(new DeepseekService(keys[i]));
    }
    logger.info(`Deepseek pool initialized with ${this.instances.length} key(s), ${this.instances.length * (parseInt(process.env.AI_MAX_CONCURRENT || '10', 10))} total AI slots`);
  }

  get keyCount(): number {
    return this.instances.length;
  }

  get totalMaxConcurrent(): number {
    return this.instances.reduce((s, inst) => s + inst.getMaxConcurrent(), 0);
  }

  get totalActiveConcurrent(): number {
    return this.instances.reduce((s, inst) => s + inst.getCurrentConcurrent(), 0);
  }

  getTotalCost(): number {
    return this.instances.reduce((s, inst) => s + inst.getTotalCost(), 0);
  }

  getTotalTokens(): number {
    return this.instances.reduce((s, inst) => s + inst.getTotalTokens(), 0);
  }

  private nextInstance(): DeepseekService {
    if (this.instances.length === 0) {
      throw new Error('No Deepseek API keys configured');
    }
    const inst = this.instances[this.index];
    this.index = (this.index + 1) % this.instances.length;
    return inst;
  }

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7
  ): Promise<LlmResult> {
    return this.nextInstance().chatCompletion(systemPrompt, userPrompt, temperature);
  }

  async chatCompletionWithRetry(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    maxRetries: number = 3
  ): Promise<LlmResult> {
    return this.nextInstance().chatCompletionWithRetry(systemPrompt, userPrompt, temperature, maxRetries);
  }

  async chatCompletionWithMessages(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7
  ): Promise<LlmResult> {
    return this.nextInstance().chatCompletionWithMessages(messages, temperature);
  }

  async chatCompletionWithMessagesRetry(
    messages: Array<{ role: string; content: string }>,
    temperature: number = 0.7,
    maxRetries: number = 3
  ): Promise<LlmResult> {
    return this.nextInstance().chatCompletionWithMessagesRetry(messages, temperature, maxRetries);
  }

  async chatCompletionStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    return this.nextInstance().chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature);
  }

  async chatCompletionStreamWithMessages(
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    return this.nextInstance().chatCompletionStreamWithMessages(messages, onChunk, temperature);
  }

  async chatCompletionStreamWithRetry(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    maxRetries: number = 2
  ): Promise<void> {
    return this.nextInstance().chatCompletionStreamWithRetry(systemPrompt, userPrompt, onChunk, temperature, maxRetries);
  }
}

export const deepseekPool = new DeepseekPool();

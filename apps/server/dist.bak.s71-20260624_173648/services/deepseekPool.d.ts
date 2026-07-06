import { LlmResult } from './deepseek';
export declare class DeepseekPool {
    private instances;
    private index;
    constructor();
    get keyCount(): number;
    get totalMaxConcurrent(): number;
    get totalActiveConcurrent(): number;
    getTotalCost(): number;
    getTotalTokens(): number;
    private nextInstance;
    chatCompletion(systemPrompt: string, userPrompt: string, temperature?: number): Promise<LlmResult>;
    chatCompletionWithRetry(systemPrompt: string, userPrompt: string, temperature?: number, maxRetries?: number): Promise<LlmResult>;
    chatCompletionWithMessages(messages: Array<{
        role: string;
        content: string;
    }>, temperature?: number): Promise<LlmResult>;
    chatCompletionWithMessagesRetry(messages: Array<{
        role: string;
        content: string;
    }>, temperature?: number, maxRetries?: number): Promise<LlmResult>;
    chatCompletionStream(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void, temperature?: number): Promise<void>;
    chatCompletionStreamWithMessages(messages: Array<{
        role: string;
        content: string;
    }>, onChunk: (chunk: string) => void, temperature?: number): Promise<void>;
    chatCompletionStreamWithRetry(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void, temperature?: number, maxRetries?: number): Promise<void>;
}
export declare const deepseekPool: DeepseekPool;

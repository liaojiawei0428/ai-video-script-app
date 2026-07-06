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
export declare class DeepseekService {
    private client;
    private callHistory;
    private maxConcurrent;
    private currentConcurrent;
    private requestQueue;
    constructor(apiKey?: string);
    setMaxConcurrent(n: number): void;
    getMaxConcurrent(): number;
    getCurrentConcurrent(): number;
    private acquireSlot;
    private releaseSlot;
    chatCompletion(systemPrompt: string, userPrompt: string, temperature?: number): Promise<LlmResult>;
    chatCompletionWithRetry(systemPrompt: string, userPrompt: string, temperature?: number, maxRetries?: number): Promise<LlmResult>;
    /** 多轮对话版：接受完整 messages 数组（OpenAI 格式） */
    chatCompletionWithMessages(messages: Array<{
        role: string;
        content: string;
    }>, temperature?: number): Promise<LlmResult>;
    chatCompletionWithMessagesRetry(messages: Array<{
        role: string;
        content: string;
    }>, temperature?: number, maxRetries?: number): Promise<LlmResult>;
    chatCompletionStream(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void, temperature?: number): Promise<void>;
    /** 流式版（多轮对话版）：支持完整 messages 数组 */
    chatCompletionStreamWithMessages(messages: Array<{
        role: string;
        content: string;
    }>, onChunk: (chunk: string) => void, temperature?: number): Promise<void>;
    /** 流式版（带重试） */
    chatCompletionStreamWithRetry(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void, temperature?: number, maxRetries?: number): Promise<void>;
    getTotalCost(): number;
    getTotalTokens(): number;
    getCallHistory(): ApiCallRecord[];
    private calculateCost;
    private sleep;
}
/**
 * 从 LLM 响应中提取 JSON 字符串
 * 处理多种格式：```json...```、纯 JSON、以及带有前缀文本的 JSON
 */
export declare function extractJsonFromResponse(raw: string): string;
/** 安全解析 LLM 返回的 JSON，失败时返回默认值 */
export declare function safeParseJson<T>(raw: string, defaultVal: T): {
    parsed: T;
    raw: string;
};
export declare const deepseekService: DeepseekService;

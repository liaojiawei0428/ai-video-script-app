export interface AgnesChatOptions {
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
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
export type AgnesStreamChunk = {
    type: 'reasoning';
    text: string;
} | {
    type: 'text';
    text: string;
} | {
    type: 'done';
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
};
export declare class AgnesTextProvider {
    private apiKey;
    constructor(apiKey?: string);
    chatCompletion(opts: AgnesChatOptions): Promise<AgnesChatResult>;
    streamChatCompletion(opts: AgnesChatOptions): AsyncGenerator<AgnesStreamChunk>;
}
export declare const agnesTextProvider: AgnesTextProvider;

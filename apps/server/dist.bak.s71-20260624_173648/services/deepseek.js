"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepseekService = exports.DeepseekService = void 0;
exports.extractJsonFromResponse = extractJsonFromResponse;
exports.safeParseJson = safeParseJson;
const axios_1 = __importDefault(require("axios"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const httpAgent = new http_1.default.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 120000 });
const httpsAgent = new https_1.default.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 120000 });
class DeepseekService {
    client;
    callHistory = [];
    maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT || '10', 10);
    currentConcurrent = 0;
    requestQueue = [];
    constructor(apiKey) {
        this.client = axios_1.default.create({
            baseURL: config_1.config.deepseekApiUrl,
            headers: {
                Authorization: `Bearer ${apiKey || config_1.config.deepseekApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000,
            httpAgent,
            httpsAgent,
        });
    }
    setMaxConcurrent(n) {
        this.maxConcurrent = Math.max(1, n);
    }
    getMaxConcurrent() {
        return this.maxConcurrent;
    }
    getCurrentConcurrent() {
        return this.currentConcurrent;
    }
    async acquireSlot() {
        if (this.currentConcurrent < this.maxConcurrent) {
            this.currentConcurrent++;
            return;
        }
        return new Promise((resolve) => {
            this.requestQueue.push(resolve);
        });
    }
    releaseSlot() {
        if (this.requestQueue.length > 0) {
            const next = this.requestQueue.shift();
            next?.();
        }
        else {
            this.currentConcurrent--;
        }
    }
    async chatCompletion(systemPrompt, userPrompt, temperature = 0.7) {
        await this.acquireSlot();
        const startTime = Date.now();
        try {
            logger_1.logger.info('Deepseek API call started', { temperature, promptLength: userPrompt.length });
            const response = await this.client.post('/chat/completions', {
                model: config_1.config.deepseekModel,
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
            logger_1.logger.info('Deepseek API call completed', {
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
        }
        catch (error) {
            logger_1.logger.error('Deepseek API call failed', { error });
            throw new errors_1.AppError('DEEPSEEK_API_ERROR', 'Failed to call Deepseek API', 502, { originalError: error instanceof Error ? error.message : String(error) });
        }
        finally {
            this.releaseSlot();
        }
    }
    async chatCompletionWithRetry(systemPrompt, userPrompt, temperature = 0.7, maxRetries = 3) {
        return this.chatCompletionWithMessagesRetry([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], temperature, maxRetries);
    }
    /** 多轮对话版：接受完整 messages 数组（OpenAI 格式） */
    async chatCompletionWithMessages(messages, temperature = 0.7) {
        await this.acquireSlot();
        const startTime = Date.now();
        try {
            logger_1.logger.info('Deepseek API call started', { messageCount: messages.length, promptLength: messages.reduce((s, m) => s + m.content.length, 0) });
            const response = await this.client.post('/chat/completions', {
                model: config_1.config.deepseekModel,
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
            logger_1.logger.info('Deepseek API call completed', {
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
        }
        catch (error) {
            logger_1.logger.error('Deepseek API call failed', { error });
            throw new errors_1.AppError('DEEPSEEK_API_ERROR', 'Failed to call Deepseek API', 502, { originalError: error instanceof Error ? error.message : String(error) });
        }
        finally {
            this.releaseSlot();
        }
    }
    async chatCompletionWithMessagesRetry(messages, temperature = 0.7, maxRetries = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.chatCompletionWithMessages(messages, temperature);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const delay = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn(`Deepseek API retry ${attempt + 1}/${maxRetries}`, { delay, error: lastError.message });
                await this.sleep(delay);
            }
        }
        throw new errors_1.AppError('DEEPSEEK_API_ERROR', `Deepseek API failed after ${maxRetries} retries: ${lastError?.message}`, 502);
    }
    async chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature = 0.7) {
        return this.chatCompletionStreamWithMessages([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], onChunk, temperature);
    }
    /** 流式版（多轮对话版）：支持完整 messages 数组 */
    async chatCompletionStreamWithMessages(messages, onChunk, temperature = 0.7) {
        await this.acquireSlot();
        try {
            const response = await this.client.post('/chat/completions', {
                model: config_1.config.deepseekModel,
                messages,
                temperature,
                max_tokens: 32768,
                stream: true,
            }, { responseType: 'stream' });
            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]')
                                return;
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content)
                                    onChunk(content);
                            }
                            catch {
                                // Ignore parse errors for incomplete chunks
                            }
                        }
                    }
                });
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
        }
        finally {
            this.releaseSlot();
        }
    }
    /** 流式版（带重试） */
    async chatCompletionStreamWithRetry(systemPrompt, userPrompt, onChunk, temperature = 0.7, maxRetries = 2) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (lastError.message.includes('CANCELLED_BY_USER')) {
                    throw lastError;
                }
                const delay = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn(`Deepseek stream API retry ${attempt + 1}/${maxRetries}`, { delay, error: lastError.message });
                await this.sleep(delay);
            }
        }
        throw new errors_1.AppError('DEEPSEEK_API_ERROR', `Deepseek stream API failed after ${maxRetries} retries: ${lastError?.message}`, 502);
    }
    getTotalCost() {
        return this.callHistory.reduce((sum, record) => sum + record.cost, 0);
    }
    getTotalTokens() {
        return this.callHistory.reduce((sum, record) => sum + record.totalTokens, 0);
    }
    getCallHistory() {
        return [...this.callHistory];
    }
    calculateCost(inputTokens, outputTokens) {
        // DeepSeek V4 Flash pricing: $0.14 / 1M input, $0.28 / 1M output
        const inputCost = (inputTokens / 1000000) * 0.14;
        const outputCost = (outputTokens / 1000000) * 0.28;
        return Math.round((inputCost + outputCost) * 100) / 100;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DeepseekService = DeepseekService;
/**
 * 从 LLM 响应中提取 JSON 字符串
 * 处理多种格式：```json...```、纯 JSON、以及带有前缀文本的 JSON
 */
function extractJsonFromResponse(raw) {
    const trimmed = raw.trim();
    // 1. 尝试提取 ```json ... ``` 或 ``` ... ``` 代码块
    const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlock)
        return codeBlock[1].trim();
    // 2. 尝试查找 JSON 对象 { ... }
    const jsonObj = trimmed.match(/\{[\s\S]*\}/);
    if (jsonObj)
        return jsonObj[0];
    // 3. 尝试查找 JSON 数组 [ ... ]
    const jsonArr = trimmed.match(/\[[\s\S]*\]/);
    if (jsonArr)
        return jsonArr[0];
    // 4. 返回原文本（让调用方处理错误）
    return trimmed;
}
/** 安全解析 LLM 返回的 JSON，失败时返回默认值 */
function safeParseJson(raw, defaultVal) {
    try {
        const cleaned = extractJsonFromResponse(raw);
        const parsed = JSON.parse(cleaned);
        return { parsed, raw: cleaned };
    }
    catch {
        return { parsed: defaultVal, raw };
    }
}
exports.deepseekService = new DeepseekService();

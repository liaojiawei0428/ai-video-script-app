"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepseekPool = exports.DeepseekPool = void 0;
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const deepseek_1 = require("./deepseek");
class DeepseekPool {
    instances = [];
    index = 0;
    constructor() {
        const keys = config_1.config.deepseekApiKeys;
        if (keys.length === 0) {
            logger_1.logger.warn('No Deepseek API keys configured, pool will be empty');
            return;
        }
        for (let i = 0; i < keys.length; i++) {
            this.instances.push(new deepseek_1.DeepseekService(keys[i]));
        }
        logger_1.logger.info(`Deepseek pool initialized with ${this.instances.length} key(s), ${this.instances.length * (parseInt(process.env.AI_MAX_CONCURRENT || '10', 10))} total AI slots`);
    }
    get keyCount() {
        return this.instances.length;
    }
    get totalMaxConcurrent() {
        return this.instances.reduce((s, inst) => s + inst.getMaxConcurrent(), 0);
    }
    get totalActiveConcurrent() {
        return this.instances.reduce((s, inst) => s + inst.getCurrentConcurrent(), 0);
    }
    getTotalCost() {
        return this.instances.reduce((s, inst) => s + inst.getTotalCost(), 0);
    }
    getTotalTokens() {
        return this.instances.reduce((s, inst) => s + inst.getTotalTokens(), 0);
    }
    nextInstance() {
        if (this.instances.length === 0) {
            throw new Error('No Deepseek API keys configured');
        }
        const inst = this.instances[this.index];
        this.index = (this.index + 1) % this.instances.length;
        return inst;
    }
    async chatCompletion(systemPrompt, userPrompt, temperature = 0.7) {
        return this.nextInstance().chatCompletion(systemPrompt, userPrompt, temperature);
    }
    async chatCompletionWithRetry(systemPrompt, userPrompt, temperature = 0.7, maxRetries = 3) {
        return this.nextInstance().chatCompletionWithRetry(systemPrompt, userPrompt, temperature, maxRetries);
    }
    async chatCompletionWithMessages(messages, temperature = 0.7) {
        return this.nextInstance().chatCompletionWithMessages(messages, temperature);
    }
    async chatCompletionWithMessagesRetry(messages, temperature = 0.7, maxRetries = 3) {
        return this.nextInstance().chatCompletionWithMessagesRetry(messages, temperature, maxRetries);
    }
    async chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature = 0.7) {
        return this.nextInstance().chatCompletionStream(systemPrompt, userPrompt, onChunk, temperature);
    }
    async chatCompletionStreamWithMessages(messages, onChunk, temperature = 0.7) {
        return this.nextInstance().chatCompletionStreamWithMessages(messages, onChunk, temperature);
    }
    async chatCompletionStreamWithRetry(systemPrompt, userPrompt, onChunk, temperature = 0.7, maxRetries = 2) {
        return this.nextInstance().chatCompletionStreamWithRetry(systemPrompt, userPrompt, onChunk, temperature, maxRetries);
    }
}
exports.DeepseekPool = DeepseekPool;
exports.deepseekPool = new DeepseekPool();

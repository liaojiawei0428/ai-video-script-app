"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outlineService = exports.OutlineService = void 0;
/**
 * v2.0.0 - 大纲 + 事件图谱 service
 */
const promises_1 = __importDefault(require("fs/promises"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const deepseekPool_1 = require("./deepseekPool");
const novel_1 = require("../models/novel");
const character_1 = require("../models/character");
const stylePresets_1 = require("../shared/stylePresets");
const episodeOutline_1 = require("../prompts/episodeOutline");
const plotGraph_1 = require("../prompts/plotGraph");
const styleBible_1 = require("./styleBible");
function calcTargetEpisodes(totalChars) {
    return Math.max(8, Math.min(20, Math.floor(totalChars / 3500)));
}
function safeJsonParse(text) {
    // 兼容 ```json ... ``` 包裹
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = m ? m[1].trim() : text.trim();
    try {
        return JSON.parse(raw);
    }
    catch (e) {
        // 尝试去掉末尾逗号等
        const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
    }
}
class OutlineService {
    async generateOutline(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel?.filePath)
            throw new errors_1.AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);
        const raw = await promises_1.default.readFile(novel.filePath);
        let content = iconv_lite_1.default.decode(raw, 'utf-8');
        if (content.includes('\uFFFD'))
            content = iconv_lite_1.default.decode(raw, 'gbk');
        const characters = await character_1.characterModel.findByNovelId(novelId);
        const style = stylePresets_1.STYLE_PRESET_LIST.find(s => s.id === (novel.styleId || 'realistic')) || stylePresets_1.STYLE_PRESET_LIST[0];
        const styleBibleBlock = novel.styleBible ? (0, styleBible_1.buildStyleAnchorPrefix)(novel.styleBible, 'zh') : undefined;
        const target = calcTargetEpisodes(novel.totalChars);
        const userPrompt = (0, episodeOutline_1.buildEpisodeOutlineUserPrompt)({
            novelTitle: novel.title,
            totalChars: novel.totalChars,
            styleName: style.name,
            characters: characters.map(c => ({ name: c.name, role: c.role || '?', description: c.description })),
            fullContent: content,
            styleBibleBlock,
        }) + `\n\n请严格输出 ${target} 集大纲。`;
        logger_1.logger.info('OutlineService.generateOutline start', { novelId, target, charCount: characters.length });
        const result = await deepseekPool_1.deepseekPool.chatCompletionWithRetry((0, episodeOutline_1.episodeOutlineSystemPrompt)(styleBibleBlock), userPrompt, 0.7, 2);
        const parsed = safeJsonParse(result.content);
        if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
            throw new errors_1.AppError('LLM_INVALID_OUTPUT', 'AI 返回的大纲格式无效', 500);
        }
        const outline = {
            novelId,
            items: parsed.items,
            generatedAt: Date.now(),
        };
        await novel_1.novelModel.updateOutline(novelId, JSON.stringify(outline));
        logger_1.logger.info('OutlineService.generateOutline done', { novelId, itemCount: outline.items.length });
        return outline;
    }
    async getOutline(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel)
            return null;
        const raw = novel.outlineText;
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async confirmOutline(novelId) {
        const outline = await this.getOutline(novelId);
        if (!outline)
            throw new errors_1.AppError('OUTLINE_NOT_FOUND', '请先生成大纲', 404);
        outline.confirmedAt = Date.now();
        await novel_1.novelModel.confirmOutline(novelId, JSON.stringify(outline));
        return outline;
    }
    async generatePlotGraph(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel?.filePath)
            throw new errors_1.AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);
        const raw = await promises_1.default.readFile(novel.filePath);
        let content = iconv_lite_1.default.decode(raw, 'utf-8');
        if (content.includes('\uFFFD'))
            content = iconv_lite_1.default.decode(raw, 'gbk');
        const characters = await character_1.characterModel.findByNovelId(novelId);
        const styleBibleBlock = novel.styleBible ? (0, styleBible_1.buildStyleAnchorPrefix)(novel.styleBible, 'zh') : undefined;
        const userPrompt = (0, plotGraph_1.buildPlotGraphUserPrompt)({
            novelTitle: novel.title,
            totalChars: novel.totalChars,
            characters: characters.map(c => ({ name: c.name, role: c.role || '?' })),
            fullContent: content,
            styleBibleBlock,
        });
        logger_1.logger.info('OutlineService.generatePlotGraph start', { novelId, charCount: characters.length });
        const result = await deepseekPool_1.deepseekPool.chatCompletionWithRetry((0, plotGraph_1.plotGraphSystemPrompt)(styleBibleBlock), userPrompt, 0.6, 2);
        const parsed = safeJsonParse(result.content);
        if (!parsed.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
            throw new errors_1.AppError('LLM_INVALID_OUTPUT', 'AI 返回的事件图谱格式无效', 500);
        }
        const graph = {
            chapters: parsed.chapters,
            generatedAt: Date.now(),
        };
        await novel_1.novelModel.updatePlotGraph(novelId, JSON.stringify(graph));
        logger_1.logger.info('OutlineService.generatePlotGraph done', { novelId, chapterCount: graph.chapters.length });
        return graph;
    }
    async getPlotGraph(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel)
            return null;
        const raw = novel.plotGraph;
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
}
exports.OutlineService = OutlineService;
exports.outlineService = new OutlineService();
